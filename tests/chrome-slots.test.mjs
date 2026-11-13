/** Chrome takes upgrades: the compendium ships it open, and copies already in a world are brought up to date. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
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
  items: [], actors: [], scenes: [],
  // The Item Compendium (2070s)'s index, as loadNames() reads it.
  packs: new Map([[`${MOD}.items-2070`, { getIndex: async () => [{ name: "Sandevistan", type: "cyberware" }, { name: "Kerenzikov", type: "cyberware" }, { name: "Berserk", type: "cyberware" }, { name: "Militech ‘Falcon’ OS", type: "itemUpgrade" }] }]])
};
globalThis.Actor = class {};
const { ChromeSlots, slotFix, eligible, normName, takesUpgrades, upgradeChoices, isUpgradeDrop, SLOTS_SETTING, SLOTS_VERSION } = await import("../scripts/items/chrome-slots.js");
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
  assert.equal(slotFix(chrome("Sandevistan", {}, {})), null, "unflagged, and no compendium names to match: left alone");
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

// CPR 0.92.4's own Sandevistan (core/cyberware/cyberware.sandevistan.yaml): no Neon Hub flag, "installed items" off.
const cprSandevistan = () => chrome("Sandevistan", { allowed: false, allowedTypes: ["itemUpgrade"], slots: 3 }, { "cyberpunk-red-core": {} });

test("chrome without Neon Hub's flag is recognised by its name in the Item Compendium (2070s)", () => {
  const names = new Set(["sandevistan", "kerenzikov", "militech 'falcon' os"]);
  assert.deepEqual(slotFix(cprSandevistan(), names), { "system.installedItems.allowed": true }, "CPR's own Sandevistan");
  assert.equal(eligible(chrome("Some Homebrew Implant", {}, {}), names), false, "a name the compendium doesn't have");
  assert.equal(eligible({ ...cprSandevistan(), system: { core: true, installedItems: {} } }, names), false, "CPR's core option boxes");
  assert.equal(eligible({ ...cprSandevistan(), type: "itemUpgrade" }, names), false, "only cyberware");
  assert.equal(normName("Militech ‘Falcon’  OS"), "militech 'falcon' os");
});

test("SLOTS_VERSION 2 runs the fix-up again over a world 1.25.0 already did, and opens CPR's own chrome", async () => {
  assert.equal(SLOTS_VERSION, 2);
  game.user = { id: "gm", isGM: true };
  settings.set(SLOTS_SETTING, 1);
  const mine = cprSandevistan();
  const updates = [];
  game.items = [];
  game.actors = [{ name: "V", items: [mine], async updateEmbeddedDocuments(type, list) { updates.push(list); } }];
  game.scenes = [];
  ChromeSlots.names = new Set();
  await ChromeSlots.ready();
  assert.ok(ChromeSlots.names.has("sandevistan"), "names loaded from the compendium index, cyberware only");
  assert.ok(!ChromeSlots.names.has("militech 'falcon' os"));
  assert.deepEqual(updates, [[{ _id: "Sandevistan", "system.installedItems.allowed": true }]]);
  assert.equal(settings.get(SLOTS_SETTING), 2);
  // And as one arrives on a sheet.
  const dropped = cprSandevistan();
  hooks.preCreateItem(dropped);
  assert.deepEqual(dropped.sourced, { "system.installedItems.allowed": true });
});

test("every piece of chrome that takes upgrades gets the button; the picker offers loose cyberware upgrades and its own", () => {
  const sande = { _id: "s", type: "cyberware", system: { installedItems: { allowed: true, allowedTypes: ["itemUpgrade"], list: [] } } };
  const falcon = { _id: "f", type: "itemUpgrade", system: { type: "cyberware" } };
  const scope = { _id: "w", type: "itemUpgrade", system: { type: "weapon" } };
  assert.equal(takesUpgrades(sande), true, "with or without an upgrade on the sheet (the world this was reported from had none)");
  assert.equal(takesUpgrades({ ...sande, system: { installedItems: { allowed: false, allowedTypes: ["itemUpgrade"], list: [] } } }), false, "closed chrome");
  assert.equal(takesUpgrades({ ...sande, system: { core: true, installedItems: sande.system.installedItems } }), false, "CPR's core boxes");
  assert.equal(takesUpgrades({ ...scope }), false);
  assert.deepEqual(upgradeChoices(sande, [sande, falcon, scope]).map((i) => i._id), ["f"], "a loose OS, not a weapon upgrade");
  assert.deepEqual(upgradeChoices(sande, [sande]), [], "nothing to fit");
  const fitted = { ...sande, system: { installedItems: { ...sande.system.installedItems, list: ["f"] } } };
  assert.deepEqual(upgradeChoices(fitted, [fitted, falcon]).map((i) => i._id), ["f"], "its own OS, to take out again");
  const other = { _id: "k", type: "cyberware", system: { installedItems: { allowed: true, allowedTypes: ["itemUpgrade"], list: [] } } };
  assert.deepEqual(upgradeChoices(other, [other, fitted, falcon]), [], "the only OS is already in another piece");
  assert.equal(isUpgradeDrop({ type: "itemUpgrade" }), true, "a compendium index entry has only its type");
  assert.equal(isUpgradeDrop({ type: "weapon" }), false);
});

// Why the button exists: CPR 0.92.4's Cyberware tab filters upgrades by `type` (always "itemUpgrade") where it means
// `system.type`, so it never shows its own. When CPR fixes that, this fails and Neon Hub's button can go.
const CPR_SRC = process.env.CPR_SYSTEM ?? "/home/eduardo/Documents/cprredfoundry/fvtt-cyberpunk-red-core-v0.92.4/src";
test("CPR's Cyberware tab still hides Manage Upgrades on chrome", (t) => {
  const dir = path.join(CPR_SRC, "templates/actor/character/right-pane/tabs/cyberware");
  if (!existsSync(dir)) return t.diagnostic("CPR source not found; skipped");
  for (const f of ["cpr-cyberware-optional-content.hbs", "cpr-cyberware-foundational-content.hbs"]) {
    assert.match(readFileSync(path.join(dir, f), "utf8"), /cprFilter actor\.itemTypes\.itemUpgrade "type" "cyberware"/, f);
  }
  const container = readFileSync(path.join(CPR_SRC, "modules/item/mixins/cpr-installable.js"), "utf8");
  assert.match(container, /installedItems\.allowed &&/, "CPR still needs the switch on to offer the chrome as a target");
});

// A fake sheet: rows, their action boxes, listeners, and the documents behind them.
function fakeSheet({ withOS = true } = {}) {
  globalThis.HTMLElement = class {};
  globalThis.document = {
    createElement: () => ({ dataset: {}, attrs: {}, listeners: {}, setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(k, fn) { this.listeners[k] = fn; } })
  };
  const calls = { opened: [], installed: [], created: [], notes: [] };
  globalThis.ui = { notifications: { info: (m) => calls.notes.push(["info", m]), warn: (m) => calls.notes.push(["warn", m]), error: (m) => calls.notes.push(["error", m]) } };
  const list = [];
  const actor = Object.assign(new Actor(), {
    name: "V",
    items: Object.assign(list, { get: (id) => list.find((i) => i.id === id) }),
    async createEmbeddedDocuments(type, docs) {
      const made = docs.map((d, n) => doc({ ...d, _id: `new${n}` }));
      calls.created.push(...made.map((m) => m.name));
      list.push(...made);
      return made;
    }
  });
  function doc(data) {
    const d = {
      ...data, id: data._id, parent: actor, actor,
      toObject: () => structuredClone({ ...data }),
      sheet: { _manageInstalledItems: async (type) => calls.opened.push([data._id, type]) },
      async installItems(items) { calls.installed.push([data._id, items.map((i) => i.id)]); return true; }
    };
    d.system = { ...data.system, isInstalled: !!data.system?.isInstalled, installedIn: data.system?.installedIn ?? [] };
    return d;
  }
  const sande = doc({ _id: "s", name: "Sandevistan", type: "cyberware", flags: {}, system: { installedItems: { allowed: true, allowedTypes: ["itemUpgrade"], list: [] } } });
  const closed = doc({ _id: "c", name: "Old Implant", type: "cyberware", flags: {}, system: { installedItems: { allowed: false, allowedTypes: [], list: [] } } });
  list.push(sande, closed);
  if (withOS) list.push(doc({ _id: "f", name: "Militech ‘Falcon’ OS", type: "itemUpgrade", flags: {}, system: { type: "cyberware" } }));
  const row = (id, existing = null) => {
    const actions = { added: [], querySelector: () => existing, append(el) { this.added.push(el); } };
    return { dataset: { itemId: id }, actions, listeners: {}, addEventListener(k, fn) { this.listeners[k] = fn; }, querySelector: (sel) => (sel.includes("cyberware-actions") ? actions : null) };
  };
  return { actor, calls, doc, row, sande };
}
const tick = () => new Promise((r) => setTimeout(r, 0));
const dropEvent = (data) => ({ stopped: false, prevented: false, data, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } });

test("the button lands on the right rows and opens CPR's own upgrade picker", async () => {
  const { actor, calls, row } = fakeSheet();
  const rows = [row("s"), row("c"), row("s", {})];
  ChromeSlots.decorate({ actor, isEditable: true }, [{ querySelectorAll: () => rows }]);
  assert.equal(rows[0].actions.added.length, 1, "the Sandevistan gets one");
  assert.equal(rows[1].actions.added.length, 0, "closed chrome doesn't");
  assert.equal(rows[2].actions.added.length, 0, "a row that already has CPR's button doesn't get a second");
  assert.ok(rows[0].listeners.drop && rows[2].listeners.drop && !rows[1].listeners.drop, "open chrome takes drops");
  const button = rows[0].actions.added[0];
  assert.match(button.className, /neon-hub-upgrades/);
  await button.listeners.click({ preventDefault() {}, stopPropagation() {} });
  await tick();
  assert.deepEqual(calls.opened, [["s", "itemUpgrade"]]);
  ChromeSlots.decorate({ actor, isEditable: true }, [{ querySelectorAll: () => [rows[0]] }]);
  assert.equal(rows[0].actions.added.length, 1, "a re-render doesn't stack a second button");
  const ro = row("s");
  ChromeSlots.decorate({ actor, isEditable: false }, [{ querySelectorAll: () => [ro] }]);
  assert.equal(ro.actions.added.length, 0, "nothing on a sheet you can't edit");
});

test("with no upgrade on the sheet the button still shows, and says how to get one there", async () => {
  const { actor, calls, row } = fakeSheet({ withOS: false });
  const r = row("s");
  ChromeSlots.decorate({ actor, isEditable: true }, [{ querySelectorAll: () => [r] }]);
  assert.equal(r.actions.added.length, 1);
  await r.actions.added[0].listeners.click({ preventDefault() {}, stopPropagation() {} });
  await tick();
  assert.deepEqual(calls.opened, [], "no empty picker");
  assert.equal(calls.notes[0][0], "info");
  assert.match(calls.notes[0][1], /NEONHUB\.ChromeSlots\.NoneToFit/);
});

test("an upgrade dropped on a chrome row goes into that piece; anything else is left to CPR's sheet", async () => {
  const { actor, calls, doc, row, sande } = fakeSheet({ withOS: false });
  const falconPack = { name: "Militech ‘Falcon’ OS", type: "itemUpgrade", system: { type: "cyberware" }, toObject: () => ({ name: "Militech ‘Falcon’ OS", type: "itemUpgrade", system: { type: "cyberware" }, _id: "packId" }) };
  const scopePack = { name: "Sniping Scope", type: "itemUpgrade", system: { type: "weapon" } };
  const docs = { "Compendium.cpr-neon-hub.items-2070.Item.f": falconPack, "Compendium.x.Item.scope": scopePack };
  const index = { "Compendium.cpr-neon-hub.items-2070.Item.f": { type: "itemUpgrade" }, "Compendium.x.Item.scope": { type: "itemUpgrade" }, "Compendium.x.Item.gun": { type: "weapon" } };
  globalThis.fromUuidSync = (u) => index[u] ?? actor.items.find((i) => `Actor.V.Item.${i.id}` === u) ?? null;
  globalThis.fromUuid = async (u) => docs[u] ?? actor.items.find((i) => `Actor.V.Item.${i.id}` === u) ?? null;
  // Compat.getDragEventData reads the event through Foundry's TextEditor (found with foundry.utils.getProperty).
  globalThis.foundry = { utils: { getProperty: (o, k) => k.split(".").reduce((x, p) => x?.[p], o) } };
  globalThis.TextEditor = { getDragEventData: (e) => e.data };
  const r = row("s");
  ChromeSlots.decorate({ actor, isEditable: true }, [{ querySelectorAll: () => [r] }]);

  const fromPack = dropEvent({ type: "Item", uuid: "Compendium.cpr-neon-hub.items-2070.Item.f" });
  r.listeners.drop(fromPack);
  assert.ok(fromPack.stopped && fromPack.prevented, "CPR's sheet doesn't also make a copy");
  await tick(); await tick();
  assert.deepEqual(calls.created, ["Militech ‘Falcon’ OS"], "a compendium OS is put on the sheet first");
  assert.deepEqual(calls.installed, [["s", ["new0"]]], "then into the Sandevistan, through CPR's install");
  assert.match(calls.notes.at(-1)[1], /Fitted/);

  const gun = dropEvent({ type: "Item", uuid: "Compendium.x.Item.gun" });
  r.listeners.drop(gun);
  assert.ok(!gun.stopped, "a weapon dropped on the row goes on to CPR as usual");

  const scope = dropEvent({ type: "Item", uuid: "Compendium.x.Item.scope" });
  r.listeners.drop(scope);
  await tick(); await tick();
  assert.match(calls.notes.at(-1)[1], /WrongKind/, "a weapon upgrade isn't for chrome");
  assert.equal(calls.installed.length, 1);

  // An OS already on the sheet and loose: installed as it is, no copy.
  const loose = doc({ _id: "o", name: "Zetatech ‘Reflex-Plus’ OS", type: "itemUpgrade", flags: {}, system: { type: "cyberware" } });
  actor.items.push(loose);
  r.listeners.drop(dropEvent({ type: "Item", uuid: "Actor.V.Item.o" }));
  await tick(); await tick();
  assert.deepEqual(calls.installed.at(-1), ["s", ["o"]]);
  assert.equal(calls.created.length, 1);

  // One already installed in another piece isn't pulled out of it.
  const busy = doc({ _id: "b", name: "Moore Tech ‘Matterhorn’ OS", type: "itemUpgrade", flags: {}, system: { type: "cyberware", isInstalled: true, installedIn: ["k"] } });
  actor.items.push(busy);
  r.listeners.drop(dropEvent({ type: "Item", uuid: "Actor.V.Item.b" }));
  await tick(); await tick();
  assert.match(calls.notes.at(-1)[1], /InstalledElsewhere/);
  assert.equal(calls.installed.length, 2);
  assert.equal(sande.id, "s");
});
