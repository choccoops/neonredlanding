import { test } from "node:test";
import assert from "node:assert/strict";

// A small Foundry: world settings, two player characters, a GM, chat.
let n = 0;
const settings = new Map();
const chat = [];
const gm = { id: "gm", isGM: true, name: "GM", active: true };
const player = { id: "p1", isGM: false, name: "Pat", active: true };
const makeActor = (id, name, items = []) => ({
  id, uuid: `Actor.${id}`, name, img: `${id}.webp`, type: "character", hasPlayerOwner: true,
  system: { reputation: { value: 2, transactions: [] }, stats: { cool: { value: 6 } } },
  items,
  testUserPermission: (u) => u.isGM || (u.id === "p1" && id === "v"),
  async update(data) {
    for (const [k, v] of Object.entries(data)) k.split(".").reduce((o, p, i, a) => (i === a.length - 1 ? (o[p] = v) : o[p]), this);
  }
});
const ganger = { type: "role", name: "Ganger", system: { rank: 0 }, async update(d) { this.system.rank = d["system.rank"]; } };
const v = makeActor("v", "V", [ganger]);
const jackie = makeActor("j", "Jackie");
const actors = [v, jackie];
actors.get = (id) => actors.find((a) => a.id === id);

globalThis.foundry = {
  utils: {
    randomID: () => `id${++n}`,
    deepClone: (o) => structuredClone(o),
    getProperty: (o, k) => k.split(".").reduce((x, p) => x?.[p], o),
    hasProperty: (o, k) => k.split(".").reduce((x, p) => x?.[p], o) !== undefined
  }
};
globalThis.Handlebars = { escapeExpression: (s) => String(s) };
globalThis.Hooks = { callAll() {}, on() {} };
globalThis.ChatMessage = { create: async (m) => chat.push(m) };
const users = [gm, player];
globalThis.game = {
  user: gm,
  users: Object.assign(users, { activeGM: gm }),
  actors,
  journal: [],
  socket: { on() {}, emit() {} },
  i18n: { localize: (k) => k, format: (k, d) => `${k} ${JSON.stringify(d)}`, has: () => false },
  settings: {
    register() {},
    get: (mod, key) => settings.get(key) ?? ({ credAnnounce: true, credShowCrew: false, credPlayersBonds: false, calendars: [] }[key]),
    set: async (mod, key, value) => settings.set(key, structuredClone(value))
  }
};

const { CredStore } = await import("../scripts/cred/cred-store.js");

test("a GM deed moves Standing, drops the rivals ticked, and tells the player on a new band", async () => {
  chat.length = 0;
  const out = await CredStore.adjust(v, "tyger-claws", 3, { reason: "Saved a lieutenant", rivals: ["mox"] });
  assert.deepEqual(out, [{ faction: "tyger-claws", from: 0, to: 3 }, { faction: "mox", from: 0, to: -1 }]);
  assert.equal(CredStore.standing(v, "tyger-claws"), 3);
  assert.equal(CredStore.standing(v, "mox"), -1);
  assert.equal(chat.length, 2, "both moved into a new band");
  assert.deepEqual(chat[0].whisper.sort(), ["gm", "p1"]);
  assert.equal(CredStore.person(v).log[0].key, "mox");
});

test("joining at +4: the Ganger rank follows Standing, and falling below +4 patches them out", async () => {
  await CredStore.adjust(v, "tyger-claws", 2);
  await CredStore.join(v, "tyger-claws");
  assert.equal(CredStore.person(v).member, "tyger-claws");
  assert.equal(ganger.system.rank, 5);
  await assert.rejects(() => CredStore.join(v, "arasaka"), /OneOnly|NotJoinable|TooLow/);
  await CredStore.adjust(v, "tyger-claws", 2);
  assert.equal(ganger.system.rank, 7);
  await CredStore.adjust(v, "tyger-claws", 0, { set: 3 });
  assert.equal(CredStore.person(v).member, null);
  assert.ok(chat.at(-1).content.includes("Card.Out.gang"));
});

test("Heat and Reputation", async () => {
  assert.deepEqual(await CredStore.adjustHeat(v, 5, { reason: "Shootout on camera" }), { from: 0, to: 5 });
  assert.equal(CredStore.heat(v), 5);
  assert.equal(await CredStore.adjustReputation(v, 3, "Took down a cyberpsycho"), 5);
  assert.equal(v.system.reputation.value, 5);
  assert.equal(v.system.reputation.transactions.length, 1);
  assert.equal(await CredStore.adjustReputation(v, 20), 10, "Reputation tops out at 10");
});

test("mutual relationships are mirrored, hidden ones stay the GM's", async () => {
  const b = await CredStore.saveBond(v, { target: jackie.uuid, name: "Jackie", value: 8, mutual: true, hidden: true });
  assert.equal(CredStore.person(v).bonds[0].value, 8);
  const mirror = CredStore.person(jackie).bonds.find((x) => x.target === v.uuid);
  assert.equal(mirror.value, 8);
  assert.equal(mirror.mutual, true);
  await CredStore.saveBond(v, { ...b, value: 9 });
  assert.equal(CredStore.person(jackie).bonds.length, 1, "updated, not duplicated");
  assert.equal(CredStore.person(jackie).bonds[0].value, 9);
  // A player can't touch relationships unless the GM allows it.
  await assert.rejects(() => CredStore._bond({ actor: v.uuid, bond: { name: "Rogue" } }, player), /NotAllowed/);
  settings.set("credPlayersBonds", true);
  const mine = await CredStore._bond({ actor: v.uuid, bond: { id: b.id, target: jackie.uuid, name: "Jackie", value: 2, hidden: false } }, player);
  assert.equal(mine.hidden, true, "players can't unhide the GM's secret");
  await assert.rejects(() => CredStore._unbond({ actor: v.uuid, id: b.id }, player), /NotAllowed/);
  await assert.rejects(() => CredStore._bond({ actor: jackie.uuid, bond: { name: "Rogue" } }, player), /NotAllowed/, "not their character");
});

test("players see their own characters unless the crew is shared", () => {
  assert.deepEqual(CredStore.characters(player).map((a) => a.name), ["V"]);
  settings.set("credShowCrew", true);
  assert.deepEqual(CredStore.characters(player).map((a) => a.name), ["Jackie", "V"]);
});

test("factions: a lower cap brings Standing down; removing one clears it everywhere", async () => {
  await CredStore.adjust(jackie, "arasaka", 6);
  await CredStore.saveFaction({ ...CredStore.faction("arasaka"), originalId: "arasaka", cap: 2 });
  assert.equal(CredStore.standing(jackie, "arasaka"), 2);
  await CredStore.removeFaction("mox");
  assert.equal(CredStore.faction("mox"), null);
  assert.ok(!CredStore.faction("tyger-claws").rivals.includes("mox"));
  assert.equal(CredStore.person(v).standing.mox, undefined);
});
