import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeLifestyle, computeBill, CATEGORIES } from "../scripts/lifestyle/ls-data.js";
import {
  ERAS, ART_TIERS, artTierFor, artHumanity, automaticEffects, monthlyCheck, rollCheck, homeSummary, artOnDisplay,
  belowTier, bedroomFurnishing, primaryHome
} from "../scripts/lifestyle/ls-2070.js";

/** A described lifestyle item, active unless said otherwise. */
let n = 0;
const item = (category, flag = {}, extra = {}) => ({
  id: `i${++n}`, name: `${category} ${n}`, ...normalizeLifestyle({ category, ...flag }), group: CATEGORIES[category].group, amount: 1, price: 0, active: true, ...extra
});
/** Each die shows its maximum: "2d6" -> 12. */
const max = (f) => { const [c, s] = f.split("d").map(Number); return c * s; };

test("eras: 2045 keeps today's pack, 2070s has its own and turns the rules on", () => {
  assert.equal(ERAS[2045].pack, "lifestyle");
  assert.equal(ERAS[2045].rules, false);
  assert.equal(ERAS[2070].pack, "lifestyle-2070");
  assert.equal(ERAS[2070].rules, true);
});

test("new fields are clamped and default safely", () => {
  const d = normalizeLifestyle({ category: "houseware", slots: 2, display: 1, capacity: 1, era: "2070", upfront: "500" });
  assert.equal(d.category, "houseware");
  assert.deepEqual([d.slots, d.display, d.capacity, d.era, d.upfront], [2, true, 1, "2070", 500]);
  assert.equal(normalizeLifestyle({ era: "1990" }).era, "");
  assert.equal(normalizeLifestyle({ env: "lava" }).env, "");
  assert.equal(normalizeLifestyle({ category: "art", hg: 99 }).hg, 30);
});

test("houseware and art are paid once, not every month", () => {
  const bill = computeBill([item("houseware", { monthly: 0 }), item("art", { hg: 2 }), item("lifestyle", { monthly: 300, tier: 2 })]);
  assert.equal(bill.total, 300);
  assert.equal(bill.lines.length, 1);
});

test("Kibble: the below-Good-PrePak 1d6 and a flat 2 tax; Generic PrePak the 1d6; Fresh Food a gain", () => {
  const kibble = automaticEffects([item("lifestyle", { tier: 1, env: "kibble" })]);
  assert.deepEqual(kibble.effects.map((e) => e.key), ["nonFresh"]);
  assert.deepEqual(kibble.taxes, [{ key: "kibble", n: 2 }]);
  assert.equal(kibble.tax, 2);
  assert.deepEqual(automaticEffects([item("lifestyle", { tier: 2, env: "nonFresh" })]).effects.map((e) => e.key), ["nonFresh"]);
  assert.equal(automaticEffects([item("lifestyle", { tier: 2, env: "nonFresh" })]).tax, 0);
  assert.deepEqual(automaticEffects([item("lifestyle", { tier: 3 })]).effects, []);
  assert.deepEqual(automaticEffects([item("lifestyle", { tier: 4, env: "fresh" })]).effects.map((e) => e.key), ["freshFood"]);
  assert.deepEqual(automaticEffects([item("lifestyle", { tier: 1, env: "kibble" }, { active: false })]).effects, [], "inactive packages don't count");
});

test("homes: megabuilding or worse, vehicles roll 2d6, the street taxes 6, upscale and ships gain", () => {
  const eff = (env, extra = {}) => automaticEffects([item("housing", { env, ...extra })]);
  assert.deepEqual(eff("worse").effects, [{ key: "megabuilding", dice: "1d6" }]);
  assert.deepEqual(eff("vehicle", { tax: 3 }).effects, [{ key: "megabuilding", dice: "2d6" }]);
  assert.equal(eff("vehicle", { tax: 3 }).tax, 3);
  assert.deepEqual(eff("streets", { tax: 6 }).effects.map((e) => e.key), ["megabuilding"], "living rough (3d6) is the GM's tick");
  assert.equal(eff("streets", { tax: 6 }).tax, 6);
  assert.deepEqual(monthlyCheck([item("housing", { env: "streets", tax: 6 })], { warZone: true }).rolls.map((r) => [r.key, r.dice]), [["megabuilding", "1d6"], ["warZone", "3d6"]]);
  assert.deepEqual(eff("upscale", { credit: 1 }).effects, [{ key: "upscale", dice: "2d6" }]);
  assert.equal(eff("upscale", { credit: 1 }).credit, 1);
  assert.deepEqual(eff("ship").effects.map((e) => e.key), ["upscale", "outside"]);
});

test("the GM's ticks join the automatic ones; counts repeat; auto effects can't be ticked", () => {
  const items = [item("lifestyle", { tier: 2, env: "nonFresh" }), item("housing", { env: "worse" })];
  const check = monthlyCheck(items, { corp: 2, deaths10: true, freshFood: true, friend: false });
  assert.deepEqual(check.rolls.map((r) => r.key), ["nonFresh", "megabuilding", "corp", "corp", "deaths10"]);
});

test("living the good life: four gains and fewer than three losses add 3d6", () => {
  const good = [item("lifestyle", { tier: 4, env: "fresh" }), item("housing", { env: "upscale" })];
  const yes = monthlyCheck(good, { friend: true, family: true });
  assert.ok(yes.rolls.some((r) => r.key === "goodLife"));
  const no = monthlyCheck(good, { friend: true });
  assert.ok(!no.rolls.some((r) => r.key === "goodLife"), "three gains isn't enough");
  const stressed = monthlyCheck(good, { friend: true, family: true, corp: 3 });
  assert.ok(!stressed.rolls.some((r) => r.key === "goodLife"), "three losses spoil it");
});

test("rolling: furnishing modifiers add to each roll, tax and credit to the totals, art on top", () => {
  const items = [
    item("lifestyle", { tier: 1, env: "kibble" }),
    item("housing", { env: "vehicle", tax: 3 }),
    item("furnishing", { scarcity: 0, lossMod: 2, noUpgrades: true })
  ];
  const result = rollCheck(monthlyCheck(items), max);
  assert.deepEqual(result.rolls.map((r) => [r.key, r.total]), [["nonFresh", 8], ["megabuilding", 14]]);
  assert.equal(result.tax, 7, "Kibble's 2 and the vehicle's 3, plus the loss modifier once");
  assert.equal(result.loss, 29);
  assert.equal(result.net, -29);

  const nice = [item("housing", { env: "upscale", credit: 2, slots: 4, sleeps: 3 }), item("furnishing", { scarcity: 3, gainMod: 2 }),
    item("houseware", { slots: 1, display: true }), item("art", { hg: 3, scarcity: 3 })];
  const r = rollCheck(monthlyCheck(nice), max);
  assert.equal(r.credit, 4);
  assert.equal(r.art, 3);
  assert.equal(r.gain, 14 + 4 + 3);
});

test("the home: slots used, the CyberBed's extra sleeper, and poor furnishings blocking upgrades", () => {
  const items = [item("housing", { slots: 3, sleeps: 2 }), item("houseware", { slots: 2, capacity: 1 }), item("houseware", { slots: 1, display: true }, { amount: 2 })];
  const home = homeSummary(items);
  assert.deepEqual([home.slots, home.used, home.over, home.sleeps, home.displays], [3, 4, true, 3, 2]);
  assert.equal(homeSummary([...items, item("furnishing", { noUpgrades: true })]).blocked, true);
  assert.equal(primaryHome([item("housing", { slots: 0, sleeps: 1 }), item("housing", { slots: 4, sleeps: 3 })]).slots, 4, "the car on the side isn't home");
});

test("art: one ARAD each, no more than the home sleeps, and only in rooms furnished finely enough", () => {
  const base = [item("housing", { slots: 5, sleeps: 2 }), item("furnishing", { scarcity: 3 }), item("houseware", { display: true }, { amount: 3 })];
  const art = [item("art", { hg: 4, scarcity: 4 }), item("art", { hg: 3, scarcity: 3 }), item("art", { hg: 2, scarcity: 2 }), item("art", { hg: 1, scarcity: 1 })];
  const shown = artOnDisplay([...base, ...art]);
  assert.equal(shown.limit, 2, "three ARADs but the home sleeps two");
  assert.deepEqual(shown.shown.map((p) => p.hg), [3, 2]);
  assert.equal(shown.total, 5);
  assert.equal(shown.unshown.find((u) => u.piece.hg === 4).reason, "furnishing");
  assert.equal(artOnDisplay([...base.slice(0, 2), ...art]).total, 0, "no ARAD, no display");
  const bunk = item("houseware", { slots: 2, capacity: 1 });
  assert.equal(artOnDisplay([...base, bunk, ...art]).limit, 2, "a CyberBed sleeps one more but shows no more art");
});

test("the finest furnishing is the one lived in", () => {
  const best = bedroomFurnishing([item("furnishing", { scarcity: 1, lossMod: 1 }), item("furnishing", { scarcity: 3, gainMod: 2 })]);
  assert.equal(best.gainMod, 2);
});

test("memberships above the character's lifestyle", () => {
  const items = [item("lifestyle", { tier: 2 }), item("membership", { minTier: 3 }), item("health", { minTier: 2 }), item("loan", { minTier: 3 }), item("transport", { minTier: 4 })];
  assert.deepEqual(belowTier(items).map((d) => d.category), ["membership"], "a loan already taken is still owed");
});

test("art tiers from a roll, and Super Luxury months", () => {
  assert.equal(artTierFor(18), null);
  assert.equal(artTierFor(19).hg, 1);
  assert.equal(artTierFor(23).hg, 2);
  assert.equal(artTierFor(30).hg, 4, "Super Luxury is chosen, not rolled into");
  assert.equal(artHumanity(ART_TIERS[4], 3), 7);
  assert.equal(artHumanity(ART_TIERS[1], 3), 2);
  assert.deepEqual(ART_TIERS.map((t) => t.dv), [19, 21, 24, 29, 29]);
});
