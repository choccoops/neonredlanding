import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.foundry = { utils: { getProperty: (o, k) => k.split(".").reduce((x, p) => x?.[p], o) } };
const { BurstRounds, BURST_BY_NAME, burstRounds, shellAutofire } = await import("../scripts/items/burst-rounds.js");

const MOD = "cpr-neon-hub";
const up = (name) => ({ id: name, type: "itemUpgrade", name, system: {}, flags: { [MOD]: { burstMod: BURST_BY_NAME[name] } } });
const shotgun = { type: "weapon", system: { weaponType: "shotgun", dvTable: "DV Shotgun", description: { value: "" } }, flags: {} };
const ar = { type: "weapon", system: { weaponType: "assaultRifle", dvTable: "DV Assault Rifle", description: { value: "" } }, flags: {} };
const hmg = { type: "weapon", system: { weaponType: "assaultRifle", dvTable: "DV Machine Gun", description: { value: "" } }, flags: { [MOD]: { autofireRounds: 20 } } };

test("the control group: 4 slugs a burst, and with shells Autofire is the 4-shell attack", () => {
  const acg = [up("Shotgun Automatic Control Group")];
  assert.equal(burstRounds(shotgun, "autofire", acg, "shotgunSlug"), 4);
  assert.equal(burstRounds(shotgun, "autofire", acg, "shotgunShell"), 4);
  assert.deepEqual(shellAutofire(acg, "shotgunShell"), { shells: 4, shellDodge: -3 });
  assert.equal(shellAutofire(acg, "shotgunSlug"), null, "slugs are a real burst");
  assert.equal(shellAutofire([], "shotgunShell"), null);
  assert.equal(burstRounds(shotgun, "autofire", [], "shotgunSlug"), 10, "without it, CPR's 10");
});

test("Gatling doubles both modes; the autosears only touch Autofire", () => {
  assert.equal(burstRounds(ar, "autofire", [up("Gatling Barrel")]), 20);
  assert.equal(burstRounds(ar, "suppressive", [up("Gatling Barrel")]), 20);
  assert.equal(burstRounds(ar, "autofire", [up("Efficient Autosear")]), 6);
  assert.equal(burstRounds(ar, "suppressive", [up("Efficient Autosear")]), 10);
  assert.equal(burstRounds(hmg, "autofire", []), 20, "its card's 20 rounds each");
  assert.equal(burstRounds(hmg, "autofire", [up("Efficient Autosear")]), 20, "not a 10-round gun");
  assert.equal(burstRounds(hmg, "autofire", [up("Superior Autosear")]), 10);
  assert.equal(burstRounds(hmg, "autofire", [up("Superior Autosear"), up("Gatling Barrel")]), 20, "40 halved");
  assert.equal(burstRounds(ar, "autofire", [up("Superior Autosear"), up("Gatling Barrel")]), 10, "Gatling's 20, back to 10");
  const mg = { ...ar, system: { ...ar.system, dvTable: "DV Machine Gun" } };
  assert.equal(burstRounds(mg, "autofire", [up("Efficient Autosear")]), 10, "not on machine guns");
});

test("the Burst Governor: 5 fewer in both modes, to no fewer than 5, after everything else", () => {
  const gov = up("Burst Governor");
  assert.equal(burstRounds(ar, "autofire", [gov]), 5);
  assert.equal(burstRounds(ar, "suppressive", [gov]), 5);
  assert.equal(burstRounds(hmg, "autofire", [gov]), 15);
  assert.equal(burstRounds(ar, "autofire", [gov, up("Gatling Barrel")]), 15, "20, then 5 fewer");
  assert.equal(burstRounds(ar, "autofire", [gov, up("Efficient Autosear")]), 5, "6, then down to the minimum");
  assert.equal(burstRounds(shotgun, "autofire", [gov, up("Shotgun Automatic Control Group")], "shotgunSlug"), 4, "a 4-slug burst doesn't go up to 5");
  assert.equal(burstRounds(shotgun, "autofire", [gov, up("Shotgun Automatic Control Group")], "shotgunShell"), 4, "the shell attack isn't a burst");
});

test("the patch: CPR's own count, replaced each time the item's mixins load", () => {
  class Item {
    loadMixins() {
      this.bulletConsumption = (roll) => (roll.auto ? 10 : 1);
    }
  }
  assert.equal(BurstRounds.patch(Item.prototype), true);
  assert.equal(BurstRounds.patch(Item.prototype), false, "once");
  const acg = { id: "acg", type: "itemUpgrade", name: "Shotgun Automatic Control Group", system: {}, flags: {} };
  const shells = { id: "ammo", type: "ammo", system: { variety: "shotgunShell" } };
  const gun = new Item();
  Object.assign(gun, { id: "gun", type: "weapon", system: { weaponType: "shotgun", dvTable: "DV Shotgun", installedItems: { list: ["acg", "ammo"] } }, flags: {} });
  gun.actor = { flags: { "cyberpunk-red-core": { "firetype-gun": "autofire" } }, items: { get: (id) => ({ acg, ammo: shells })[id] } };
  gun.loadMixins();
  assert.equal(gun.bulletConsumption({ auto: true }), 4, "an older copy, known by name");
  assert.equal(gun.bulletConsumption({ auto: false }), 1, "a single shot is CPR's");
  gun.loadMixins();
  assert.equal(gun.bulletConsumption({ auto: true }), 4, "still wrapped after the next prepare");
  gun.actor.flags["cyberpunk-red-core"]["firetype-gun"] = "suppressive";
  assert.equal(gun.bulletConsumption({ auto: true }), 10);
});
