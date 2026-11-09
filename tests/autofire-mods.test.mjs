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
const { AF, BY_NAME, autofirePlan, afMisfit, autofireModOf, autofireTableOf } = await import("../scripts/items/autofire-mods.js");
const { DELETE } = await import("../scripts/items/range-mods.js");
const { WeaponMods } = await import("../scripts/items/weapon-mods.js");
WeaponMods.init();

const MOD = "cpr-neon-hub";
const up = (id, name, extra = {}) => ({ id, type: "itemUpgrade", name, system: { size: 0 }, flags: BY_NAME[name] ? { [MOD]: { autofireMod: BY_NAME[name] } } : {}, ...extra });
const gun = ({ type = "heavyPistol", table = "DV Pistol", autoFire = 0, suppressive = false, quality = "standard", ammo = ["heavyPistol"], list = [], flags = {}, card = "" } = {}) => ({
  id: "gun", type: "weapon", name: "Test Gun",
  system: { isRanged: true, weaponType: type, dvTable: table, quality, ammoVariety: ammo, fireModes: { autoFire, suppressiveFire: suppressive }, installedItems: { list, usedSlots: 0 }, description: { value: card } },
  flags: { [MOD]: flags }
});
const by = (...items) => (id) => items.find((i) => i.id === id) ?? null;
const T = `flags.${MOD}.autofireTable`;
const B = `flags.${MOD}.autofireBase`;

test("a Pistol Autosear gives a pistol Autofire (Machine Pistol 3) and Suppressive Fire, and keeps what it had", () => {
  const sear = up("sear", "Pistol Autosear");
  const res = autofirePlan(gun(), ["sear"], by(sear));
  assert.deepEqual(res.refused, []);
  assert.equal(res.sets["system.fireModes.autoFire"], 3);
  assert.equal(res.sets["system.fireModes.suppressiveFire"], true);
  assert.equal(res.sets[T], AF.mp);
  assert.deepEqual(res.sets[B], { autoFire: 0, suppressiveFire: false, table: null });
  // Excellent, or already automatic: Machine Pistol 4.
  assert.equal(autofirePlan(gun({ quality: "excellent" }), ["sear"], by(sear)).sets["system.fireModes.autoFire"], 4);
  assert.equal(autofirePlan(gun({ autoFire: 3, suppressive: true }), ["sear"], by(sear)).sets["system.fireModes.autoFire"], 4);
});

test("taking it out puts the pistol's own Autofire back", () => {
  const sear = up("sear", "Pistol Autosear");
  const g = gun({ autoFire: 3, suppressive: true, list: ["sear"], flags: { autofireTable: AF.mp, autofireBase: { autoFire: 0, suppressiveFire: false, table: null } } });
  const res = autofirePlan(g, [], by(sear));
  assert.equal(res.sets["system.fireModes.autoFire"], 0);
  assert.equal(res.sets["system.fireModes.suppressiveFire"], false);
  assert.equal(res.sets[T], DELETE);
  assert.equal(res.sets[B], DELETE);
});

test("what each fits: pistols not shell-only, SMG 3 guns, slug or shell guns, assault-rifle Autofire", () => {
  const sear = autofireModOf(up("s", "Pistol Autosear"));
  assert.equal(afMisfit(gun({ type: "sniperRifle", table: "DV Sniper Rifle" }), sear), "AfWrong");
  assert.equal(afMisfit(gun({ ammo: ["shotgunShell", "shotgunSlug"] }), sear), "AfWrong", "a shell-only pistol");
  assert.equal(afMisfit(gun({ type: "assaultRifle", table: "DV Pistol" }), sear, "DV Pistol"), null, "an Exotic on the Pistol table");
  const cyclic = autofireModOf(up("c", "SMG Cyclic Internals (Machine Pistol 4)"));
  assert.equal(afMisfit(gun({ type: "smg", table: "DV SMG", autoFire: 3 }), cyclic), null);
  assert.equal(afMisfit(gun({ type: "smg", table: "DV SMG", autoFire: 0 }), cyclic), null, "CPR rates an SMG with no rating 3");
  assert.equal(afMisfit(gun({ type: "smg", table: "DV SMG", autoFire: 4 }), cyclic), "AfWrong");
  assert.equal(afMisfit(gun({ type: "assaultRifle", table: "DV Carbine", autoFire: 3, card: "Alt. fire: Autofire (SMG 3)" }), cyclic), null, "the card's Autofire counts");
  const acg = autofireModOf(up("a", "Shotgun Automatic Control Group"));
  assert.equal(afMisfit(gun({ type: "shotgun", table: "DV Shotgun", ammo: ["shotgunSlug", "shotgunShell"] }), acg), null);
  assert.equal(afMisfit(gun(), acg), "AfWrong");
  const crs = autofireModOf(up("r", "Constant Recoil System"));
  assert.equal(afMisfit(gun({ type: "assaultRifle", table: "DV Assault Rifle", autoFire: 4 }), crs), null);
  assert.equal(afMisfit(gun({ type: "assaultRifle", table: "DV Machine Gun", autoFire: 5 }), crs), "AfWrong", "a machine gun's already Machine Gun");
  assert.equal(afMisfit(gun({ type: "smg", table: "DV SMG", autoFire: 3 }), crs), "AfWrong");
});

test("SMG Cyclic Internals and the Constant Recoil System change the Autofire table", () => {
  const mp = up("mp", "SMG Cyclic Internals (Machine Pistol 4)");
  let res = autofirePlan(gun({ type: "smg", table: "DV SMG", autoFire: 3, suppressive: true }), ["mp"], by(mp));
  assert.equal(res.sets["system.fireModes.autoFire"], 4);
  assert.equal(res.sets[T], AF.mp);
  assert.equal(res.sets["system.fireModes.suppressiveFire"], undefined, "Suppressive Fire unchanged");
  const smg4 = up("s4", "SMG Cyclic Internals (SMG 4)");
  assert.equal(autofirePlan(gun({ type: "smg", table: "DV SMG", autoFire: 3 }), ["s4"], by(smg4)).sets[T], AF.smg);
  const crs = up("crs", "Constant Recoil System");
  res = autofirePlan(gun({ type: "assaultRifle", table: "DV Assault Rifle", autoFire: 4 }), ["crs"], by(crs));
  assert.equal(res.sets["system.fireModes.autoFire"], 3, "Machine Gun 3");
  assert.equal(res.sets[T], AF.mg);
  const excellent = autofirePlan(gun({ type: "assaultRifle", table: "DV Assault Rifle", autoFire: 4, quality: "excellent" }), ["crs"], by(crs));
  assert.equal(excellent.sets["system.fireModes.autoFire"], undefined, "Machine Gun 4 on an Excellent gun: the 4 it had");
  assert.equal(excellent.sets[T], AF.mg);
});

test("Upsized Power adds 1 to whatever rating the gun ends up with, and only to an automatic gun", () => {
  const up1 = up("up", "Upsized Power");
  const sear = up("sear", "Pistol Autosear");
  assert.equal(autofirePlan(gun({ type: "smg", table: "DV SMG", autoFire: 3 }), ["up"], by(up1)).sets["system.fireModes.autoFire"], 4);
  assert.equal(autofirePlan(gun(), ["sear", "up"], by(sear, up1)).sets["system.fireModes.autoFire"], 4, "Autosear 3 + 1");
  const single = autofirePlan(gun(), ["up"], by(up1));
  assert.equal(single.sets["system.fireModes.autoFire"], undefined, "a single-shot pistol stays single-shot");
  // Its base is still kept, so taking the Autosear out later lands on the right rating.
  const g = gun({ autoFire: 4, suppressive: true, list: ["sear", "up"], flags: { autofireTable: AF.mp, autofireBase: { autoFire: 0, suppressiveFire: false, table: null } } });
  const out = autofirePlan(g, ["up"], by(sear, up1));
  assert.equal(out.sets["system.fireModes.autoFire"], 0);
  assert.equal(out.sets[T], DELETE);
  assert.equal(out.sets[B], undefined, "Upsized Power is still in, so the base stays");
});

test("one Autofire attachment at a time, one Upsized Power, nothing that's built in already", () => {
  const sear = up("sear", "Pistol Autosear");
  const acg = up("acg", "Shotgun Automatic Control Group");
  const g = gun({ ammo: ["heavyPistol", "shotgunSlug"], autoFire: 3, suppressive: true, list: ["sear"], flags: { autofireTable: AF.mp, autofireBase: { autoFire: 0, suppressiveFire: false, table: null } } });
  const res = autofirePlan(g, ["sear", "acg"], by(sear, acg));
  assert.equal(res.refused[0].reason, "OneAutofire");
  assert.deepEqual(res.list, ["sear"]);
  const a = up("a", "Upsized Power");
  const b = up("b", "Upsized Power");
  assert.equal(autofirePlan(gun({ type: "smg", table: "DV SMG", autoFire: 4, list: ["a"] }), ["a", "b"], by(a, b)).refused[0].reason, "OnePerGun");
  const yukimura = gun({ autoFire: 3, suppressive: true, card: "<p><strong>Alt. fire:</strong> Autofire (Machine Pistol 3), Suppressive Fire<br><strong>Built-in:</strong> Pistol Autosear, Smart Rebuild</p>" });
  assert.equal(autofirePlan(yukimura, ["sear"], by(sear)).refused[0].reason, "BuiltIn");
});

test("in an install, both kinds at once: a Snub Barrel and an Autosear, and a misfit refused with its reason", () => {
  notes.length = 0;
  const snub = { id: "snub", type: "itemUpgrade", name: "Snub Barrel (Pistol)", system: { size: 0 }, flags: { [MOD]: { rangeMod: { table: "DV Snubnose Pistol", tables: ["DV Pistol", "DV Snubnose Pistol"], weaponTypes: ["heavyPistol"] } } } };
  const sear = up("sear", "Pistol Autosear");
  const crs = up("crs", "Constant Recoil System");
  const g = gun();
  const items = [g, snub, sear, crs];
  g.parent = { items: { get: (id) => items.find((i) => i.id === id) } };
  const changes = { system: { installedItems: { list: ["snub", "crs", "sear"], usedSlots: 0 } } };
  hooks.preUpdateItem(g, changes, {});
  assert.deepEqual(changes.system.installedItems.list, ["snub", "sear"]);
  assert.equal(changes.system.dvTable, "DV Snubnose Pistol");
  assert.deepEqual(changes.system.fireModes, { autoFire: 3, suppressiveFire: true });
  assert.equal(changes.flags[MOD].autofireTable, AF.mp);
  assert.equal(changes.flags[MOD].dvTableBase, "DV Pistol");
  assert.equal(notes.length, 1);
  assert.match(notes[0][1], /NEONHUB\.RangeMods\.AfWrong .*Constant Recoil System/);
  // The Weaponbench's question gets the same answer.
  assert.match(WeaponMods.check(g, crs), /AfWrong/);
});

test("deleting an Autofire attachment still in the gun takes it out and restores the gun", async () => {
  const sear = up("sear", "Pistol Autosear");
  const updates = [];
  const g = gun({ autoFire: 3, suppressive: true, list: ["sear"], flags: { autofireTable: AF.mp, autofireBase: { autoFire: 0, suppressiveFire: false, table: null } } });
  const actor = { items: [g], async updateEmbeddedDocuments(type, data) { updates.push(...data); } };
  g.parent = actor;
  sear.parent = actor;
  hooks.deleteItem(sear, {}, "me");
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0]["system.installedItems.list"], []);
  assert.equal(updates[0]["system.fireModes.autoFire"], 0);
  assert.equal(updates[0][`flags.${MOD}.-=autofireTable`], null);
});

test("a Binary Trigger or an ETE takes Autofire and Suppressive Fire away, and gives them back when it comes out", () => {
  const bt = up("bt", "Binary Trigger");
  const smg = gun({ type: "smg", table: "DV SMG", autoFire: 3, suppressive: true });
  const res = autofirePlan(smg, ["bt"], by(bt));
  assert.equal(res.sets["system.fireModes.autoFire"], 0);
  assert.equal(res.sets["system.fireModes.suppressiveFire"], false);
  assert.deepEqual(res.sets[B], { autoFire: 3, suppressiveFire: true, table: null });
  const sear = up("sear", "Pistol Autosear");
  assert.equal(autofirePlan(gun(), ["sear", "bt"], by(sear, bt)).sets["system.fireModes.autoFire"], undefined, "with an Autosear too it stays at 0");
  const back = autofirePlan(gun({ type: "smg", table: "DV SMG", list: ["bt"], flags: { autofireBase: { autoFire: 3, suppressiveFire: true, table: null } } }), [], by(bt));
  assert.equal(back.sets["system.fireModes.autoFire"], 3);
  assert.equal(back.sets["system.fireModes.suppressiveFire"], true);
});

test("the gun's Autofire table: Neon Hub's flag, then its card, then its type", () => {
  assert.equal(autofireTableOf(gun({ type: "smg", flags: { autofireTable: AF.mp } })), AF.mp);
  assert.equal(autofireTableOf(gun({ type: "shotgun", card: "Autofire (Machine Pistol 4)" })), AF.mp);
  assert.equal(autofireTableOf(gun({ type: "assaultRifle", table: "DV Machine Gun" })), AF.mg);
  assert.equal(autofireTableOf(gun({ type: "bow", table: "DV Bow" })), null);
});
