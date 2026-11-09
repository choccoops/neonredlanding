import { test } from "node:test";
import assert from "node:assert/strict";

const notes = [];
const hooks = {};
globalThis.foundry = { utils: { getProperty: (o, k) => k.split(".").reduce((x, p) => x?.[p], o) } };
globalThis.Hooks = { on: (name, fn) => (hooks[name] = fn) };
globalThis.ui = { notifications: { warn: (m) => notes.push(["warn", m]), info: (m) => notes.push(["info", m]) } };
globalThis.game = {
  user: { id: "me" },
  i18n: { localize: (k) => k, format: (k, d) => `${k} ${JSON.stringify(d)}` },
  items: { get: () => null }
};
const { RangeMods, plan, writeInto, rangeModOf, misfit } = await import("../scripts/items/range-mods.js");
RangeMods.init();

const MOD = "cpr-neon-hub";
const snub = { table: "DV Snubnose Pistol", family: "pistol", option: "Snub Barrel", tables: ["DV Pistol", "DV Snubnose Pistol", "DV Long Barrel Pistol", "DV Long-Barrel Pistol"], weaponTypes: ["heavyPistol", "medPistol", "vHeavyPistol"] };
const long = { ...snub, table: "DV Long Barrel Pistol", option: "Long Barrel" };
const upgrade = (id, name, rangeMod, extra = {}) => ({ id, type: "itemUpgrade", name, system: { size: 0, ...extra }, flags: rangeMod ? { [MOD]: { rangeMod } } : {} });

function actorWith(...items) {
  const updates = [];
  const actor = {
    items: { get: (id) => items.find((i) => i.id === id), [Symbol.iterator]: () => items[Symbol.iterator]() },
    updates,
    async updateEmbeddedDocuments(type, data, options) {
      updates.push({ data, options });
    }
  };
  for (const i of items) i.parent = actor;
  return actor;
}
const pistol = (list = [], flags = {}, table = "DV Pistol") => ({
  id: "gun", type: "weapon", name: "Militech Avenger", system: { isRanged: true, weaponType: "medPistol", dvTable: table, installedItems: { list, usedSlots: 0 } },
  flags: { [MOD]: flags }
});

test("installing a Snub Barrel moves a pistol to DV Snubnose Pistol and keeps DV Pistol for later", () => {
  const gun = pistol();
  const up = upgrade("snub", "Snub Barrel (Pistol)", snub);
  actorWith(gun, up);
  // CPR's installItems: the weapon's whole installedItems object, flat, through updateEmbeddedDocuments.
  const changes = { _id: "gun", "system.installedItems": { list: ["snub"], usedSlots: 0 } };
  hooks.preUpdateItem(gun, changes, {});
  assert.equal(changes["system.dvTable"], "DV Snubnose Pistol");
  assert.equal(changes[`flags.${MOD}.dvTableBase`], "DV Pistol");
  assert.deepEqual(changes["system.installedItems"].list, ["snub"]);
});

test("taking it out puts the pistol back on the table it came with", () => {
  const gun = pistol(["snub"], { dvTableBase: "DV Pistol" }, "DV Snubnose Pistol");
  actorWith(gun, upgrade("snub", "Snub Barrel (Pistol)", snub));
  const changes = { system: { installedItems: { list: [] } } };
  hooks.preUpdateItem(gun, changes, {});
  assert.equal(changes.system.dvTable, "DV Pistol", "nested updates get nested writes");
  assert.equal(changes.flags[MOD]["-=dvTableBase"], null);
});

test("one at a time: a second modification is refused with a warning, the rest of the update goes through", () => {
  notes.length = 0;
  const gun = pistol(["snub"], { dvTableBase: "DV Pistol" }, "DV Snubnose Pistol");
  actorWith(gun, upgrade("snub", "Snub Barrel (Pistol)", snub), upgrade("long", "Long Barrel (Pistol)", long), upgrade("scope", "Sniping Scope", null, { size: 1 }));
  const changes = { "system.installedItems": { list: ["snub", "long", "scope"], usedSlots: 1 } };
  hooks.preUpdateItem(gun, changes, {});
  assert.deepEqual(changes["system.installedItems"].list, ["snub", "scope"]);
  assert.equal(changes["system.installedItems"].usedSlots, 1);
  assert.equal(changes["system.dvTable"], undefined, "already on the Snub Barrel's table");
  assert.equal(notes.length, 1);
  assert.match(notes[0][1], /NEONHUB\.RangeMods\.OneAtATime .*Snub Barrel/);
});

test("a modification for another kind of weapon doesn't go in", () => {
  notes.length = 0;
  const gun = pistol();
  const scout = upgrade("scout", "Scout Barrel (Sniper Rifle)", { table: "DV Scout Rifle", tables: ["DV Sniper Rifle", "DV Scout Rifle", "DV Anti-materiel Rifle"], weaponTypes: ["sniperRifle"] });
  actorWith(gun, scout);
  const changes = { "system.installedItems": { list: ["scout"], usedSlots: 0 } };
  hooks.preUpdateItem(gun, changes, {});
  assert.deepEqual(changes["system.installedItems"].list, []);
  assert.equal(changes["system.dvTable"], undefined);
  assert.match(notes[0][1], /NEONHUB\.RangeMods\.Wrong/);
});

test("fit goes by the weapon's table, so Exotic Weapons qualify; a weapon with no table goes by its type", () => {
  const exotic = { type: "weapon", system: { isRanged: true, weaponType: "assaultRifle", dvTable: "DV Pistol" }, flags: {} };
  assert.equal(misfit(exotic, snub), null, "an exotic on the Pistol table takes a pistol barrel");
  const machineGun = { type: "weapon", system: { isRanged: true, weaponType: "medPistol", dvTable: "DV Machine Gun" }, flags: {} };
  assert.equal(misfit(machineGun, snub), "Wrong", "its table decides, not its type");
  assert.equal(misfit({ type: "weapon", system: { isRanged: true, weaponType: "heavyPistol", dvTable: "" }, flags: {} }, snub), null);
  assert.equal(misfit({ type: "weapon", system: { isRanged: true, weaponType: "sniperRifle", dvTable: "" }, flags: {} }, snub), "Wrong");
  assert.equal(misfit({ type: "weapon", system: { isRanged: false, weaponType: "medMelee" }, flags: {} }, snub), "NotRanged");
  assert.equal(misfit({ type: "weapon", system: { isRanged: true, weaponType: "medPistol", dvTable: "DV Pistol" }, flags: { [MOD]: { noRangeMod: true } } }, snub), "Barred");
  // A swapped weapon is judged on the table it came with.
  assert.equal(misfit(pistol([], { dvTableBase: "DV Pistol" }, "DV Snubnose Pistol"), long), null);
});

test("no modification while a Conversion Kit is in, and no kit while a modification is", () => {
  const kit = upgrade("kit", "Conversion Kit (Assault / Carbine / DMR / PDW / Payload / Ramjet / Rifle / SBR)", null, { size: 1 });
  const up = upgrade("snub", "Snub Barrel (Pistol)", snub);
  const resolve = (id) => ({ kit, snub: up })[id];
  let res = plan(pistol(["kit"]), ["kit", "snub"], resolve);
  assert.equal(res.refused[0].reason, "Conversion");
  assert.deepEqual(res.list, ["kit"]);
  res = plan(pistol(["snub"], { dvTableBase: "DV Pistol" }, "DV Snubnose Pistol"), ["snub", "kit"], resolve);
  assert.equal(res.refused[0].reason, "KitWithMod");
  assert.deepEqual(res.list, ["snub"]);
});

test("swapping in one go (old out, new in, in one update) moves to the new table and keeps the first base", () => {
  const resolve = (id) => ({ snub: upgrade("snub", "Snub Barrel (Pistol)", snub), long: upgrade("long", "Long Barrel (Pistol)", long) })[id];
  const res = plan(pistol(["snub"], { dvTableBase: "DV Pistol" }, "DV Snubnose Pistol"), ["long"], resolve);
  assert.deepEqual(res.refused, []);
  assert.equal(res.dvTable, "DV Long Barrel Pistol");
  assert.equal(res.base, undefined, "DV Pistol stays the saved table");
});

test("an unchanged list (CPR writes the whole system on reload) changes nothing", () => {
  const resolve = () => upgrade("snub", "Snub Barrel (Pistol)", snub);
  const res = plan(pistol(["snub"], { dvTableBase: "DV Pistol" }, "DV Snubnose Pistol"), ["snub"], resolve);
  assert.deepEqual(writeInto({}, res), {});
});

test("older copies named \"Range Table Modification (Scout Barrel)\" work by name; the bare summary entry only tells you", () => {
  const rifle = { type: "weapon", system: { isRanged: true, weaponType: "sniperRifle", dvTable: "DV Sniper Rifle", installedItems: { list: [] } }, flags: {} };
  const old = { id: "old", type: "itemUpgrade", name: "Range Table Modification (Scout Barrel)", system: {}, flags: {} };
  assert.equal(rangeModOf(old, rifle).table, "DV Scout Rifle");
  assert.equal(plan(rifle, ["old"], () => old).dvTable, "DV Scout Rifle");
  // An ACPA gun from before 1.23.0: swapped, no saved table. Out it comes, back to the family's own table.
  const acpaGun = { ...rifle, system: { ...rifle.system, dvTable: "DV Scout Rifle", installedItems: { list: ["old"] } } };
  assert.equal(plan(acpaGun, [], () => old).dvTable, "DV Sniper Rifle");
  const scope = upgrade("scope", "Sniping Scope", null, { size: 1 });
  const both = (id) => ({ old, scope })[id];
  assert.deepEqual(writeInto({}, plan(acpaGun, ["old", "scope"], both)), {}, "another attachment going in saves no wrong table");
  const anti = upgrade("anti", "Long Barrel (Sniper Rifle)", { table: "DV Anti-materiel Rifle", tables: ["DV Sniper Rifle", "DV Scout Rifle", "DV Anti-materiel Rifle"], weaponTypes: ["sniperRifle"] });
  const swap = plan(acpaGun, ["anti"], (id) => ({ old, anti })[id]);
  assert.equal(swap.dvTable, "DV Anti-materiel Rifle");
  assert.equal(swap.base, "DV Sniper Rifle", "swapping out an untracked one saves the family's table, not the swapped one");
  notes.length = 0;
  const bare = { id: "bare", type: "itemUpgrade", name: "Range Table Modification", system: { size: 0 }, flags: {} };
  const gun = pistol();
  actorWith(gun, bare);
  const changes = { "system.installedItems": { list: ["bare"], usedSlots: 0 } };
  hooks.preUpdateItem(gun, changes, {});
  assert.deepEqual(changes["system.installedItems"].list, ["bare"], "it goes in, as before");
  assert.equal(changes["system.dvTable"], undefined);
  assert.match(notes[0][1], /NEONHUB\.RangeMods\.Legacy/);
});

test("deleting a modification that's still in a weapon takes it out and restores the table", async () => {
  const gun = pistol(["snub", "scope"], { dvTableBase: "DV Pistol" }, "DV Snubnose Pistol");
  const up = upgrade("snub", "Snub Barrel (Pistol)", snub);
  const actor = actorWith(gun, upgrade("scope", "Sniping Scope", null));
  up.parent = actor;
  hooks.deleteItem(up, {}, "me");
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(actor.updates.length, 1);
  const [{ data: [u], options }] = actor.updates;
  assert.deepEqual(u["system.installedItems.list"], ["scope"]);
  assert.equal(u["system.dvTable"], "DV Pistol");
  assert.equal(u[`flags.${MOD}.-=dvTableBase`], null);
  assert.ok(options[`${MOD}.rangeMods`], "marked done, so the pre-update hook leaves it");
  hooks.deleteItem(up, {}, "someone else");
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(actor.updates.length, 1, "only the deleting client acts");
});

test("check() answers before anything moves (the Weaponbench asks it)", () => {
  const gun = pistol(["snub"], { dvTableBase: "DV Pistol" }, "DV Snubnose Pistol");
  actorWith(gun, upgrade("snub", "Snub Barrel (Pistol)", snub));
  assert.match(RangeMods.check(gun, upgrade("long", "Long Barrel (Pistol)", long)), /OneAtATime/);
  assert.equal(RangeMods.check(pistol(), upgrade("long", "Long Barrel (Pistol)", long)), null);
  assert.equal(RangeMods.check(pistol(), upgrade("scope", "Sniping Scope", null)), null);
});
