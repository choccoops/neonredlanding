import { test } from "node:test";
import assert from "node:assert/strict";
import {
  standingBand, heatBand, bondBand, discountAt, signed, normalizeState, normalizeFaction, normalizePerson, changeStanding,
  changeHeat, joinProblem, coolingDue, rivalsOf, upsertBond, removeBond, barOf, DEFAULT_FACTIONS, STANDING_BANDS, HEAT_BANDS, BOND_BANDS
} from "../scripts/cred/cred-data.js";

const state = normalizeState({});
const faction = (id) => state.factions.find((f) => f.id === id);
const fresh = () => normalizePerson({});

test("every value from −10 to +10 falls in exactly one band", () => {
  for (const bands of [STANDING_BANDS, HEAT_BANDS, BOND_BANDS]) {
    for (let v = -10; v <= 10; v++) assert.equal(bands.filter(([lo, hi]) => v >= lo && v <= hi).length, 1, `${v}`);
  }
});

test("Standing, Heat and relationship bands follow the Core Rules ladders", () => {
  assert.deepEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map(standingBand),
    ["legend", "made", "made", "inner", "inner", "trusted", "trusted", "friendly", "known", "known", "nobody"]);
  assert.deepEqual([-1, -2, -3, -4, -5, -6, -7, -8, -9, -10].map(standingBand),
    ["noticed", "noticed", "unwelcome", "unwelcome", "marked", "marked", "hunted", "hunted", "kos", "kos"]);
  assert.deepEqual([10, 7, 5, 3, 1, 0, -1, -3, -5, -7, -9].map(heatBand),
    ["enemy", "mostWanted", "wanted", "interest", "flagged", "citizen", "clean", "friend", "asset", "partner", "untouchable"]);
  assert.equal(bondBand(10), "rideOrDie");
  assert.equal(bondBand(-10), "archNemesis");
  assert.equal(bondBand(-9), "nemesis");
  assert.equal(standingBand(99), "legend", "clamped");
});

test("store discounts by Standing", () => {
  assert.deepEqual([3, 4, 6, 8, 10].map(discountAt), [0, 10, 20, 25, 30]);
  assert.deepEqual([4, 0, -3].map(signed), ["+4", "0", "−3"]);
});

test("the default factions are the Players' Board, and they normalize", () => {
  assert.equal(state.factions.length, DEFAULT_FACTIONS.length);
  assert.equal(faction("scavengers").cap, 0);
  assert.equal(faction("scavengers").joinable, false);
  assert.equal(faction("afterlife").joinable, false, "takes contracts, not members");
  assert.equal(faction("aldecaldos").joinable, false, "only gangs and corps jump you in or hire you");
  assert.equal(faction("arasaka").joinable, true);
  assert.equal(normalizeFaction({ name: "" }), null);
  assert.equal(normalizeFaction({ name: "The Mox!", rivals: ["the-mox", "tyger-claws"] }).id, "the-mox");
  assert.deepEqual(normalizeFaction({ name: "The Mox!", rivals: ["the-mox", "Tyger Claws"] }).rivals, ["tyger-claws"]);
  const dup = normalizeState({ factions: [{ name: "Mox" }, { name: "mox" }] });
  assert.equal(dup.factions.length, 1);
});

test("Standing changes clamp, log and track contact", () => {
  const today = { year: 2070, month: 7, day: 1 };
  const r = changeStanding(fresh(), faction("tyger-claws"), 3, { reason: "Saved a lieutenant", by: "GM", today });
  assert.equal(r.to, 3);
  assert.equal(r.crossed, true);
  assert.deepEqual(r.person.standing["tyger-claws"].contact, today);
  assert.equal(r.person.log[0].reason, "Saved a lieutenant");
  assert.equal(changeStanding(r.person, faction("tyger-claws"), 30).to, 10);
  assert.equal(changeStanding(fresh(), faction("scavengers"), 5).to, 0, "never above the cap");
  assert.equal(changeStanding(fresh(), faction("scavengers"), -5).to, -5);
  assert.equal(changeStanding(fresh(), faction("mox"), 0, { set: -7 }).to, -7);
});

test("joining at +4, and being patched out below it", () => {
  let p = changeStanding(fresh(), faction("valentinos"), 3).person;
  assert.equal(joinProblem(p, faction("valentinos")), "TooLow");
  const up = changeStanding(p, faction("valentinos"), 1);
  assert.equal(up.canJoin, true);
  p = { ...up.person, member: "valentinos" };
  assert.equal(joinProblem(p, faction("valentinos")), "Already");
  assert.equal(joinProblem(changeStanding(p, faction("arasaka"), 5).person, faction("arasaka")), "OneOnly");
  assert.equal(joinProblem(p, faction("afterlife")), "NotJoinable");
  const down = changeStanding(p, faction("valentinos"), -1);
  assert.equal(down.patchedOut, true);
  assert.equal(down.person.member, null);
  assert.equal(down.person.log[0].what, "leave");
});

test("Heat runs the other way and clamps", () => {
  const r = changeHeat(fresh(), 6, { reason: "Shot a cop" });
  assert.equal(r.to, 6);
  assert.equal(heatBand(r.to), "wanted");
  assert.equal(changeHeat(r.person, -20).to, -10);
  assert.equal(changeHeat(fresh(), 0).person.log.length, 0, "no change, no log line");
});

test("Standing of +6 or better cools after three months without contact", () => {
  const contact = { year: 2070, month: 6, day: 15 };
  let p = normalizePerson({ standing: { arasaka: { value: 7, contact }, mox: { value: 5, contact }, militech: { value: 6, contact: null } } });
  assert.deepEqual(coolingDue(p, { year: 2070, month: 9, day: 14 }), []);
  assert.deepEqual(coolingDue(p, { year: 2070, month: 9, day: 15 }), ["arasaka"]);
  assert.deepEqual(coolingDue(p, null), []);
});

test("rivals run both ways", () => {
  const names = (id) => rivalsOf(state, faction(id)).map((f) => f.id).sort();
  assert.deepEqual(names("tyger-claws"), ["mox"]);
  assert.deepEqual(names("aldecaldos"), ["sixth-street", "wraiths"]);
  assert.ok(names("arasaka").includes("barghest"));
});

test("relationships", () => {
  let p = upsertBond(fresh(), { id: "b1", name: "Rogue", value: 4, tags: "fixer, Afterlife, fixer" });
  assert.deepEqual(p.bonds[0].tags, ["fixer", "Afterlife"]);
  p = upsertBond(p, { ...p.bonds[0], value: 15 });
  assert.equal(p.bonds.length, 1);
  assert.equal(p.bonds[0].value, 10);
  assert.equal(upsertBond(p, { name: "No id" }).bonds.length, 1);
  assert.equal(removeBond(p, "b1").bonds.length, 0);
  assert.equal(normalizePerson({ bonds: [{ id: "x" }] }).bonds.length, 0, "needs a name or a target");
});

test("bars grow from the middle", () => {
  assert.deepEqual(barOf(5), { left: 50, width: 25, side: "pos" });
  assert.deepEqual(barOf(-10), { left: 0, width: 50, side: "neg" });
  assert.deepEqual(barOf(0), { left: 50, width: 0, side: "zero" });
});
