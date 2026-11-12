/** Chrome takes upgrades: the compendium ships it open, and copies already in a world are brought up to date. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const MOD = "cpr-neon-hub";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const hooks = {};
const notes = [];
const settings = new Map();
globalThis.Hooks = { on: (name, fn) => (hooks[name] = fn) };
globalThis.ui = { notifications: { info: (m) => notes.push(m) } };
globalThis.game = {
  user: { id: "gm", isGM: true },
  users: { activeGM: { id: "gm" }, find: () => null },
  i18n: { localize: (k) => k, format: (k, d) => `${k} ${JSON.stringify(d)}` },
  settings: { register: (m, k, o) => settings.set(k, o.default), get: (m, k) => settings.get(k), set: async (m, k, v) => settings.set(k, v) },
  items: [], actors: [], scenes: []
};
const { ChromeSlots, slotFix, SLOTS_SETTING, SLOTS_VERSION } = await import("../scripts/items/chrome-slots.js");
ChromeSlots.init();

const chrome = (name, ii = {}, flags = { [MOD]: { source2070: { book: "Item Compendium (2070)" } } }) => ({
  id: name, name, type: "cyberware", flags,
  system: { installedItems: { allowed: false, allowedTypes: ["itemUpgrade"], list: [], slots: 0, usedSlots: 0, ...ii } },
  async update(u) { this.updated = u; },
  updateSource(u) { this.sourced = u; }
});
const load = () => readdirSync(path.join(root, "packs/_source/items-2070")).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(path.join(root, "packs/_source/items-2070", f), "utf8")));

test("what a piece of chrome needs so an Operating System or Enhancement goes in", () => {
  assert.deepEqual(slotFix(chrome("Sandevistan")), { "system.installedItems.allowed": true });
  assert.deepEqual(slotFix(chrome("Cyberarm", { allowed: true, allowedTypes: ["cyberware"], slots: 4 })), { "system.installedItems.allowedTypes": ["cyberware", "itemUpgrade"] }, "a limb keeps its option slots");
  assert.equal(slotFix(chrome("Sandevistan", { allowed: true })), null, "already open");
  assert.equal(slotFix(chrome("Dynalar Cyberfingers")), null, "no Enhancement slot");
  assert.equal(slotFix(chrome("Sandevistan", {}, {})), null, "not the 2070 compendium's: left alone");
  assert.equal(slotFix({ type: "weapon", flags: { [MOD]: { source2070: {} } }, system: {} }), null);
});

test("the compendium ships every piece of chrome open to upgrades, except Cyberfingers", () => {
  const docs = load();
  const cyber = docs.filter((d) => d.type === "cyberware");
  assert.ok(cyber.length > 250);
  for (const c of cyber) {
    const ii = c.system.installedItems;
    if (/cyberfinger/i.test(c.name)) continue;
    assert.ok(ii.allowed && ii.allowedTypes.includes("itemUpgrade"), c.name);
    assert.equal(slotFix(c), null, `${c.name}: nothing left to fix`);
  }
  const arm = cyber.find((c) => c.name === "Cyberarm");
  assert.deepEqual(arm.system.installedItems.allowedTypes, ["cyberware", "itemUpgrade"]);
  assert.equal(arm.system.installedItems.slots, 4);
  // An Operating System is an upgrade of no size for cyberware, so Cyberpunk RED offers the Sandevistan as its target.
  const falcon = docs.find((d) => /Falcon/.test(d.name));
  assert.equal(falcon.type, "itemUpgrade");
  assert.equal(falcon.system.type, "cyberware");
  assert.equal(falcon.system.size, 0);
});

test("upgrades whose entry says the piece counts as Borgware carry the flag Neon At Home reads", () => {
  const flagged = load().filter((d) => d.flags?.[MOD]?.countsAsBorgware).map((d) => d.name).sort();
  assert.deepEqual(flagged, ["Endo-Lace Bracing", "Firewall Port", "Militech 'Apogee' OS", "Militech ‘Baldur’ OS", "Militech ‘Falcon’ OS", "Painducer"]);
  for (const d of load().filter((x) => x.flags?.[MOD]?.countsAsBorgware)) assert.match(d.system.description.value, /counts as Borgware/i);
});

test("the fix-up: once per world on the GM's client, sheets, unlinked tokens and the sidebar; older copies are fixed as they arrive", async () => {
  const sande = chrome("Sandevistan");
  const open = chrome("Kerenzikov", { allowed: true });
  const updates = [];
  const actor = (name, items) => ({ name, items, async updateEmbeddedDocuments(type, list) { updates.push([name, type, list]); } });
  const sidebar = chrome("Berserk");
  game.items = [sidebar];
  game.actors = [actor("V", [sande, open, { id: "gun", type: "weapon", flags: {}, system: {} }])];
  game.scenes = [{ tokens: [{ actorLink: false, actor: actor("Ganger", [chrome("Sandevistan")]) }, { actorLink: true, actor: game.actors[0] }] }];
  await ChromeSlots.ready();
  assert.deepEqual(sidebar.updated, { "system.installedItems.allowed": true });
  assert.deepEqual(updates, [
    ["V", "Item", [{ _id: "Sandevistan", "system.installedItems.allowed": true }]],
    ["Ganger", "Item", [{ _id: "Sandevistan", "system.installedItems.allowed": true }]]
  ], "a linked token's actor is done once");
  assert.equal(settings.get(SLOTS_SETTING), SLOTS_VERSION);
  assert.equal(notes.length, 1);
  updates.length = 0;
  await ChromeSlots.ready();
  assert.equal(updates.length, 0, "not twice");
  // A player's client never runs it.
  settings.set(SLOTS_SETTING, 0);
  game.user = { id: "p1", isGM: false };
  await ChromeSlots.ready();
  assert.equal(updates.length, 0);
  // An older copy dropped on a sheet.
  const old = chrome("Sandevistan");
  hooks.preCreateItem(old);
  assert.deepEqual(old.sourced, { "system.installedItems.allowed": true });
});
