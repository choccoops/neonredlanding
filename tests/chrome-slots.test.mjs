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
const { ChromeSlots, slotFix, eligible, normName, wantsUpgradeButton, SLOTS_SETTING, SLOTS_VERSION } = await import("../scripts/items/chrome-slots.js");
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

test("the Cyberware tab's chrome gets a Manage Upgrades button when an upgrade could go in or is in", () => {
  const sande = { _id: "s", type: "cyberware", system: { installedItems: { allowed: true, allowedTypes: ["itemUpgrade"], list: [] } } };
  const falcon = { _id: "f", type: "itemUpgrade", system: { type: "cyberware" } };
  const scope = { _id: "w", type: "itemUpgrade", system: { type: "weapon" } };
  assert.equal(wantsUpgradeButton(sande, [sande, falcon]), true, "a loose OS on the sheet");
  assert.equal(wantsUpgradeButton(sande, [sande, scope]), false, "only a weapon upgrade around");
  const fitted = { ...sande, system: { installedItems: { ...sande.system.installedItems, list: ["f"] } } };
  assert.equal(wantsUpgradeButton(fitted, [fitted, falcon]), true, "its OS is in: the button takes it out again");
  const other = { _id: "k", type: "cyberware", system: { installedItems: { allowed: true, allowedTypes: ["itemUpgrade"], list: [] } } };
  assert.equal(wantsUpgradeButton(other, [other, fitted, falcon]), false, "the only OS is already in another piece");
  assert.equal(wantsUpgradeButton({ ...sande, system: { installedItems: { allowed: false, allowedTypes: ["itemUpgrade"], list: [] } } }, [falcon]), false, "closed chrome");
  assert.equal(wantsUpgradeButton({ ...sande, system: { core: true, installedItems: sande.system.installedItems } }, [falcon]), false, "CPR's core boxes");
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

test("the button lands on the right rows and opens CPR's own upgrade picker", async () => {
  globalThis.HTMLElement = class {};
  globalThis.document = {
    createElement: () => ({ dataset: {}, attrs: {}, listeners: {}, setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(k, fn) { this.listeners[k] = fn; } })
  };
  const opened = [];
  const doc = (data) => ({ ...data, id: data._id, sheet: { _manageInstalledItems: async (type) => opened.push([data._id, type]) } });
  const sande = doc({ _id: "s", name: "Sandevistan", type: "cyberware", flags: {}, system: { installedItems: { allowed: true, allowedTypes: ["itemUpgrade"], list: [] } } });
  const closed = doc({ _id: "c", name: "Old Implant", type: "cyberware", flags: {}, system: { installedItems: { allowed: false, allowedTypes: [], list: [] } } });
  const falcon = doc({ _id: "f", name: "Militech ‘Falcon’ OS", type: "itemUpgrade", flags: {}, system: { type: "cyberware" } });
  const list = [sande, closed, falcon];
  const actor = Object.assign(new Actor(), { items: Object.assign(list, { get: (id) => list.find((i) => i.id === id) }) });
  const row = (id, existing = null) => {
    const actions = { added: [], querySelector: () => existing, append(el) { this.added.push(el); } };
    return { dataset: { itemId: id }, actions, querySelector: (sel) => (sel.includes("cyberware-actions") ? actions : null) };
  };
  const rows = [row("s"), row("c"), row("s", {})];
  const root = { querySelectorAll: () => rows };
  ChromeSlots.decorate({ actor, isEditable: true }, [root]);
  assert.equal(rows[0].actions.added.length, 1, "the Sandevistan gets one");
  assert.equal(rows[1].actions.added.length, 0, "closed chrome doesn't");
  assert.equal(rows[2].actions.added.length, 0, "a row that already has CPR's button doesn't get a second");
  const button = rows[0].actions.added[0];
  assert.match(button.className, /neon-hub-upgrades/);
  await button.listeners.click({ preventDefault() {}, stopPropagation() {} });
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(opened, [["s", "itemUpgrade"]]);
  ChromeSlots.decorate({ actor, isEditable: false }, [{ querySelectorAll: () => [row("s")] }]);
  assert.equal(opened.length, 1, "nothing on a sheet you can't edit");
});
