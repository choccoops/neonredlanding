import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STYLES, CLASSIC, FOLD, PRICES, TYPES, DISTRICTS, FACTION_LOOKS, styleOf, analyze, fitIn, fitBand, readAs, reads, disguiseOf,
  crewCohesion, targetStyle, shoppingList, quality, gradeOf, district, feedTopics, seeded
} from "../scripts/fashion/fashion-data.js";
import { DEFAULT_FACTIONS, normalizeState, rivalsOf } from "../scripts/cred/cred-data.js";

const state = normalizeState({});
const faction = (id) => state.factions.find((f) => f.id === id) ?? { id, name: id, kind: "other" };
const rivals = (id) => rivalsOf(state, faction(id)).map((f) => f.id);
const outfit = (style, types = ["top", "bottoms", "footwear", "jewelry", "jacket"], extra = {}) =>
  types.map((type) => ({ name: `${style} ${type}`, type, style, price: PRICES[style][type], ...extra }));
const kit = (clothing, more = {}) => ({ clothing, skills: { ws: 4, pg: 4, cool: 6 }, ...more });

test("every 2070 style has a classic CPR style and prices; every classic style has a 2070 heir", () => {
  for (const s of STYLES) {
    assert.ok(CLASSIC[s], s);
    assert.equal(FOLD[CLASSIC[s]], s, `${s} round-trips`);
    assert.deepEqual(Object.keys(PRICES[s]).sort(), [...TYPES].sort());
  }
  assert.equal(styleOf({ style: "asiaPop" }), "kitsch");
  assert.equal(styleOf({ style: "bohemian" }), "entropism");
  assert.equal(styleOf({ style: "businesswear" }, { style: "neoKitsch" }), "neoKitsch", "the flag wins");
  assert.equal(PRICES.highFashion.jewelry, 50000);
});

test("every district names real styles and Street Cred factions", () => {
  const ids = new Set(DEFAULT_FACTIONS.map((f) => f.id));
  assert.equal(DISTRICTS.length, 19);
  for (const d of DISTRICTS) {
    for (const s of Object.keys(d.likes)) assert.ok(STYLES.includes(s), `${d.id}: ${s}`);
    for (const c of d.controllers) assert.ok(ids.has(c), `${d.id}: ${c}`);
  }
  for (const id of Object.keys(FACTION_LOOKS)) assert.ok(ids.has(id) || id === "ncpd", id);
  for (const [id, look] of Object.entries(FACTION_LOOKS)) {
    assert.ok(Math.abs(Object.values(look.styles).reduce((a, b) => a + b, 0) - 1) < 1e-9, `${id} shares add up`);
  }
});

test("a look: score, grade, full look and what's missing", () => {
  const empty = analyze(kit([]));
  assert.equal(empty.look, null);
  assert.deepEqual(empty.missing, ["top", "bottoms", "footwear", "jewelry"]);
  const hf = analyze(kit(outfit("highFashion", [...TYPES])));
  assert.equal(hf.look, "highFashion");
  assert.equal(hf.grade, "A", `${hf.score}: the clothes alone`);
  const icon = analyze({ clothing: outfit("highFashion", [...TYPES]), skills: { ws: 8, pg: 8, cool: 8 }, chrome: { fashionware: 2 } });
  assert.equal(icon.grade, "S", `${icon.score}: and the skills and fashionware to carry them`);
  const mixed = analyze(kit([...outfit("kitsch", ["top", "bottoms"]), ...outfit("entropism", ["footwear"])]));
  assert.equal(mixed.look, null);
  assert.equal(mixed.dominant, "kitsch");
  assert.equal(mixed.cohesion, 67);
  assert.ok(mixed.score < hf.score);
  assert.equal(gradeOf(44), "D");
  assert.equal(quality(0), 0);
  assert.equal(quality(100), 5);
  assert.equal(quality(50000), 10);
});

test("district fit: the right look belongs, the wrong one is marked", () => {
  const plaza = district("corporate-plaza");
  const suit = analyze(kit(outfit("neoMilitarism")));
  const rags = analyze(kit(outfit("entropism")));
  assert.ok(fitIn(suit, plaza).fit >= 3);
  assert.equal(fitBand(-10)[1], "marked");
  const r = fitIn(rags, plaza);
  assert.ok(r.fit <= -4, `${r.fit}`);
  assert.equal(r.modifier, -2);
  assert.ok(r.reasons.some((x) => x.key === "cheap"));
});

test("colors: your own turf, and a rival's", () => {
  const claws = analyze(kit(outfit("gangColors", undefined, { faction: "tyger-claws" })));
  const jtown = fitIn(claws, district("japantown"), { rivals });
  assert.ok(jtown.reasons.some((x) => x.key === "ownTurf"));
  const mox = analyze(kit(outfit("gangColors", undefined, { faction: "mox" })));
  const r = fitIn(mox, district("japantown"), { rivals });
  assert.ok(r.warnings.some((w) => w.key === "rivalColors"));
  assert.ok(r.fit < jtown.fit);
});

test("chrome, weapons and money", () => {
  const base = outfit("kitsch");
  const chromed = analyze(kit(base, { chrome: { visible: 4 } }));
  assert.ok(fitIn(chromed, district("northside")).reasons.some((x) => x.key === "chromeShown"));
  assert.ok(fitIn(chromed, district("north-oak")).reasons.some((x) => x.key === "chromeHidden"));
  const armed = analyze(kit(base, { weapons: { visible: 2 } }));
  const waterfront = fitIn(armed, district("arasaka-waterfront"));
  assert.ok(waterfront.warnings.some((w) => w.key === "armsForbidden"));
  assert.ok(fitIn(analyze(kit(base)), district("vista-del-rey")).reasons.some((x) => x.key === "unarmed"));
  const rich = analyze(kit(outfit("highFashion")));
  assert.ok(fitIn(rich, district("coastview")).warnings.some((w) => w.key === "money"));
});

test("Street Cred feeds the fit: Marked on their turf, Heat under a high SC", () => {
  const a = analyze(kit(outfit("kitsch")));
  const r = fitIn(a, district("kabuki"), { standing: (id) => (id === "mox" ? -6 : 0), heat: 3 });
  assert.ok(r.warnings.some((w) => w.key === "marked" && w.data.faction === "mox"));
  assert.ok(r.warnings.some((w) => w.key === "heat"));
  assert.ok(!fitIn(a, district("occupied-zone"), { heat: 3 }).warnings.some((w) => w.key === "heat"), "a different badge");
});

test("reading as a faction, and the disguise it buys", () => {
  const arasaka = analyze(kit([...outfit("neoMilitarism", ["bottoms", "footwear", "jewelry"]), ...outfit("neoMilitarism", ["top", "jacket"], { faction: "arasaka" })]));
  const top = reads(arasaka, state.factions)[0];
  assert.equal(top.id, "arasaka");
  assert.ok(top.score >= 80, `${top.score}`);
  assert.equal(disguiseOf(top.score).modifier, 2);
  const nomad = analyze(kit(outfit("nomadLeathers")));
  assert.ok(readAs(nomad, faction("aldecaldos")) > readAs(nomad, faction("arasaka")));
  assert.equal(disguiseOf(10).modifier, null, "can't pass at all");
  const wrong = analyze(kit(outfit("gangColors", undefined, { faction: "valentinos" })));
  assert.ok(readAs(wrong, faction("sixth-street")) < readAs(wrong, faction("valentinos")));
});

test("crew cohesion and shopping", () => {
  const a = analyze(kit(outfit("kitsch")));
  const b = analyze(kit(outfit("kitsch", ["top", "bottoms"])));
  const c = analyze(kit(outfit("entropism", ["top"])));
  assert.deepEqual(crewCohesion([a, b, c]), { style: "kitsch", percent: 88 });
  assert.equal(targetStyle({ district: district("north-oak") }), "highFashion");
  assert.equal(targetStyle({ faction: faction("aldecaldos") }), "nomadLeathers");
  const catalog = TYPES.flatMap((type) => STYLES.map((style) => ({ name: `${style} ${type}`, type, style, price: PRICES[style][type] })));
  const start = analyze(kit(outfit("entropism", ["top", "bottoms"])));
  const list = shoppingList(start, catalog, { style: "neoMilitarism", budget: 1200 });
  assert.ok(list.spent <= 1200);
  assert.deepEqual(list.buy.map((x) => x.type), ["top", "bottoms", "footwear", "contactLenses"].filter((t) => list.buy.some((x) => x.type === t)));
  assert.equal(list.buy[0].replaces, "entropism top");
  assert.ok(analyze(list.kit).counts.neoMilitarism >= 2);
  const withColors = [...catalog, { name: "Neon Tyger Jacket", type: "jacket", style: "gangColors", faction: "tyger-claws", price: 50 }];
  const claws = shoppingList(start, withColors, { style: targetStyle({ faction: faction("tyger-claws") }), faction: "tyger-claws", budget: 2000 });
  assert.equal(claws.buy.find((b) => b.type === "jacket").name, "Neon Tyger Jacket", "the faction's own colors first");
  assert.ok(readAs(analyze(claws.kit), faction("tyger-claws")) > readAs(start, faction("tyger-claws")));
});

test("the feed is seeded and picks topics from the look", () => {
  const r1 = seeded("V|kabuki");
  const r2 = seeded("V|kabuki");
  assert.equal(r1(), r2());
  const a = analyze(kit(outfit("highFashion", [...TYPES]), { chrome: { visible: 3 }, weapons: { visible: 1 } }));
  const topics = feedTopics(a, fitIn(a, district("coastview")));
  for (const t of ["sharp", "outOfPlace", "look.highFashion", "chrome", "armed", "rich"]) assert.ok(topics.includes(t), t);
});
