import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { planBody, oldChrome, coreBoxes, boxUpdate, hlFormula, FBC_CORE_SLOTS } from "../full-borg/scripts/fbc-plan.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const FB = "cpr-neon-full-borg";
const load = (dir) => readdirSync(path.join(root, dir)).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(path.join(root, dir, f), "utf8")));
const bodies = load("full-borg/packs/_source/fbc-bodies-2070").filter((d) => d.type === "mook");
const parts = load("full-borg/packs/_source/fbc-2070").filter((d) => d.system);
const hubItems = load("packs/_source/items-2070").filter((d) => d.system);
const byName = (list, name) => list.find((d) => d.name === name);
const listOf = (d) => d.system?.installedItems?.list ?? [];

// The bodies the 2070 Item Compendium's Full Body Conversions chapter prints, as of this release.
const BODIES = [
  "Arasaka ZSR-05 Murasaki", "Arasaka ZSR-07 Kawakami", "Arasaka ZSR-09 Fuma", "Arasaka ZSR-11 Benkei", "Arasaka ZSR-13 Seimei", "Biotechnica Demeter",
  "Continental Brands Laureate", "Dynalar Salamander", "Dynalar Thalassa", "Kiroshi Argus", "Militech Arachne", "Militech Hoplite War Platform",
  "Militech Kratos", "Militech Nemesis", "Militech Phoenix Security Unit", "Moore Technologies Avalanche", "Moore Technologies Gehenna", "NovelTech Atlas",
  "Orbital Air Galileo", "Raven Microcybernetics Gemini IV", "Raven Microcybernetics Sage", "Sanroo Hello Cutie Pwr-Up Idol", "Techtronika Burlak",
  "Trauma Team Osler", "Zetatech Newman"
];

const book = process.env.NEON_2070_BOOK ?? "/home/eduardo/Documents/neonencountermanager/cpr-2070-books/source";
const markup = path.join(book, "out", "compendium_markup.txt");

test("the bodies are the 2070 book's Full Body Conversions, with its cost, HL and frame", (t) => {
  assert.deepEqual(bodies.map((b) => b.name).sort(), [...BODIES].sort());
  if (!existsSync(markup)) return t.diagnostic("2070 book source not found; checked the recorded list only");
  const sec = readFileSync(markup, "utf8").match(/^# Full Body Conversions\n([\s\S]*?)(?=^# )/m)[1];
  const printed = [...sec.matchAll(/^### (.+)$/gm)].map((m) => m[1].trim());
  assert.deepEqual(bodies.map((b) => b.name).sort(), printed.sort(), "the pack matches the book's headings");
  for (const entry of sec.split(/^### /m).slice(1)) {
    const name = entry.split("\n")[0].trim();
    const info = byName(bodies, name).flags[FB].fbcBody;
    assert.equal(info.cost, entry.match(/\*\*Cost\*\* (.+?) •/)[1], `${name} cost`);
    assert.equal(info.hl.text, entry.match(/\*\*HL\*\* (.+)$/m)[1].trim(), `${name} HL`);
    assert.equal(info.body, Number(entry.match(/\*\*Frame\*\* [^(]+\((\d+)\)/)[1]), `${name} BODY`);
  }
});

test("every body is a whole FBC: chassis, frame, eyes and core boxes, installed once each", () => {
  for (const b of bodies) {
    const items = new Map(b.items.map((i) => [i._id, i]));
    const where = new Map();
    for (const id of b.system.installedItems.list) where.set(id, [...(where.get(id) ?? []), "actor"]);
    for (const i of b.items) for (const c of listOf(i)) where.set(c, [...(where.get(c) ?? []), i._id]);
    for (const [id, at] of where) {
      assert.ok(items.has(id), `${b.name}: installed id ${id} exists`);
      assert.equal(at.length, 1, `${b.name}: ${items.get(id)?.name} installed once`);
    }
    for (const i of b.items) {
      if (i.type === "cyberware" || i.type === "itemUpgrade") assert.ok(where.has(i._id), `${b.name}: ${i.name} is installed`);
      assert.equal(i.flags[FB].body, b._id, `${b.name}: ${i.name} carries the body's id`);
      assert.equal(i._key, `!actors.items!${b._id}.${i._id}`);
      for (const fx of i.effects) assert.equal(fx._key, `!actors.items.effects!${b._id}.${i._id}.${fx._id}`);
      const ii = i.system.installedItems;
      if (ii?.list.length) assert.ok(ii.usedSlots <= ii.slots, `${b.name}: ${i.name} ${ii.usedSlots}/${ii.slots}`);
    }
    const top = b.system.installedItems.list.map((id) => items.get(id));
    const count = (re) => top.filter((i) => re.test(i.name)).length;
    assert.ok(count(/arm/i) >= 1, `${b.name}: arms`);
    assert.ok(count(/^Cyberleg \(FBC\)$/) === 2 || count(/^Rocklin Augmentics Skydrivers \(FBC\)$/) === 1, `${b.name}: legs (two, or one paired item)`);
    assert.equal(count(/Neuroport/), 1, `${b.name}: Neuroport`);
    assert.equal(count(/Cyberaudio Suite/), 1, `${b.name}: ears`);
    assert.ok(count(/Cybereye|MonoVision|XtremSight/) >= 1, `${b.name}: eyes`);
    const frame = top.find((i) => /^Internal Linear Frame/.test(i.name));
    const body = frame.effects.flatMap((e) => e.changes).find((c) => c.key === "system.stats.body.value");
    assert.equal(Number(body.value), b.flags[FB].fbcBody.body, `${b.name}: frame BODY`);
    assert.deepEqual(top.filter((i) => i.flags[FB].core).map((i) => i.flags[FB].core).sort(), ["cyberwareExternal", "cyberwareInternal", "fashionware"]);
    const skull = b.items.find((i) => i.name === "Cyberskull (FBC)");
    assert.ok(skull, `${b.name}: Cyberskull`);
  }
  const arachne = byName(bodies, "Militech Arachne");
  assert.equal(arachne.items.filter((i) => i.name === "Cyberarm (FBC)").length, 4, "the Arachne has four arms");
  assert.equal(arachne.items.filter((i) => i.name === "Grapple Hand").length, 4);
  const burlak = byName(bodies, "Techtronika Burlak");
  assert.equal(burlak.items.filter((i) => i.name === "Neo-Soviet Cyberarm (FBC)").length, 2, "the Burlak's arms replace the standard ones");
  assert.ok(!burlak.items.some((i) => i.name === "Cyberarm (FBC)"));
  assert.ok(burlak.items.some((i) => i.name === "Discount Cyberaudio Suite (FBC)"));
  const kawakami = byName(bodies, "Arasaka ZSR-07 Kawakami");
  const blades = kawakami.items.filter((i) => i.name === "Mantis Blade");
  assert.equal(blades.length, 2);
  for (const blade of blades) assert.equal(kawakami.items.find((i) => i._id === listOf(blade)[0])?.name, "Spring Loaded");
  const phoenix = byName(bodies, "Militech Phoenix Security Unit");
  const legs = phoenix.items.filter((i) => i.name === "Rocklin Augmentics Skydrivers (FBC)");
  assert.equal(legs.length, 1, "the Phoenix stands on Skydrivers");
  assert.equal(legs[0].system.installedItems.slots, 12, "a pair sold as one: 3 slots each, doubled");
  assert.ok(byName(bodies, "Raven Microcybernetics Sage").items.some((i) => i.name === "Integrated Zetatech CyberConductor"));
  for (const b of bodies) assert.ok(!/Not fitted on the sheet/.test(b.system.information.description), `${b.name}: every part fitted`);
  assert.deepEqual(legs.flatMap((l) => listOf(l)).map((id) => phoenix.items.find((i) => i._id === id).name), ["Reinforced Cyberlimb Upgrade", "Reinforced Cyberlimb Upgrade"]);
  assert.equal(byName(bodies, "Moore Technologies Avalanche").flags[FB].fbcBody.body, 10);
});

test("FBC chassis is free and its option slots are doubled; the rest keeps its catalog HL", () => {
  for (const b of bodies) {
    for (const i of b.items.filter((x) => x.flags[FB].chassis || x.flags[FB].core)) {
      assert.equal(i.system.humanityLoss.static, 0, `${b.name}: ${i.name} has no HL`);
    }
  }
  const pairs = [["Cyberarm (FBC)", "Cyberarm"], ["Cyberleg (FBC)", "Cyberleg"], ["Cybereye (FBC)", "Cybereye"], ["Neuroport (FBC)", "Neuroport"]];
  for (const [fbc, meat] of pairs) {
    assert.equal(byName(parts, fbc).system.installedItems.slots, byName(hubItems, meat).system.installedItems.slots * 2, fbc);
  }
  for (const f of parts.filter((p) => /^Internal Linear Frame/.test(p.name))) {
    assert.equal(f.system.type, "borgware");
    const changes = f.effects.flatMap((e) => e.changes);
    assert.ok(changes.some((c) => c.key === "system.stats.body.value" && c.mode === 5 && c.priority === 10), `${f.name}: sets BODY first`);
    assert.ok(changes.some((c) => c.key === "bonuses.maxHumanity" && c.value === "4"), `${f.name}: cancels Borgware's −4`);
    for (const e of f.effects) assert.ok(e.flags["cyberpunk-red-core"].changes.cats, `${f.name}: CPR's change categories`);
  }
  const murasaki = byName(bodies, "Arasaka ZSR-05 Murasaki");
  for (const n of ["Techhair", "Shift Tacts"]) assert.equal(byName(murasaki.items, n).system.humanityLoss.static, 0, `base chrome ${n} is free`);
  assert.ok(byName(murasaki.items, "AudioVox").system.humanityLoss.static > 0, "listed chrome keeps its HL");
});

test("Internal Hydraulics and implanted frames set their stats before other chrome's penalties", () => {
  const want = { "Internal Hydraulics Upgrade": 4, "Internal Hydraulics Upgrade, Tuned": 6, "Internal Hydraulics Upgrade, Perfected": 8 };
  for (const [name, n] of Object.entries(want)) {
    const changes = byName(hubItems, name).effects.flatMap((e) => e.changes);
    assert.deepEqual(changes.map((c) => c.key).sort(), ["system.stats.dex.value", "system.stats.move.value", "system.stats.ref.value"], name);
    for (const c of changes) assert.deepEqual([c.mode, c.value, c.priority], [4, String(n), 10], name);
  }
  const dragoon = byName(hubItems, "Dragoon Plating").effects.flatMap((e) => e.changes);
  assert.ok(dragoon.every((c) => c.mode === 2 && c.priority === null), "penalties ADD at the default priority, after the floor");
});

test("every body has a package to sell, and HL rolls in one formula", () => {
  const pkgs = parts.filter((p) => p.flags[FB].fbcPackage);
  assert.equal(pkgs.length, bodies.length);
  for (const p of pkgs) {
    const b = bodies.find((x) => x._id === p.flags[FB].fbcPackage.actor);
    assert.ok(b, `${p.name}: its body exists`);
    assert.equal(b.name, p.name);
    assert.equal(p.type, "gear");
    assert.ok(p.system.price.market > 5000, `${p.name}: ${p.system.price.market}`);
    const hl = p.flags[FB].fbcPackage.hl;
    assert.match(hl.roll, /^\d+d6( \+ (floor|ceil)\(\d+d6\/2\))?$/, `${p.name}: ${hl.roll}`);
  }
  const bio = parts.find((p) => p.flags[FB].biosystem);
  assert.equal(bio.system.type, "borgware");
  assert.equal(bio.system.humanityLoss.roll, "4d6");
  const starved = byName(parts, "Brain Starved").effects[0].changes;
  assert.deepEqual(starved.map((c) => [c.key, c.value]), [["bonuses.allActions", "-2"]]);
});

test("everything cites the 2070 books only", () => {
  const text = JSON.stringify([bodies, parts]);
  for (const bad of ["Corgo", "Going Metal", "Interface RED", "DLC", "CORE p.", "Black Chrome", "SoF 2045", "CEMK"]) assert.ok(!text.includes(bad), bad);
  for (const p of parts) assert.match(p.system.description.value, /Item Compendium \(2070\) • /, p.name);
});

test("the module is its own Foundry module that requires Neon Hub, at Neon Hub's version", () => {
  const hub = JSON.parse(readFileSync(path.join(root, "module.json"), "utf8"));
  const fb = JSON.parse(readFileSync(path.join(root, "full-borg/module.json"), "utf8"));
  assert.equal(fb.id, FB);
  assert.equal(fb.version, hub.version);
  assert.deepEqual(fb.relationships.requires.map((r) => r.id), ["cpr-neon-hub"]);
  for (const p of fb.packs) assert.ok(existsSync(path.join(root, "full-borg/packs/_source", p.name)), p.name);
  for (const f of [...fb.esmodules, ...fb.styles, ...fb.languages.map((l) => l.path)]) assert.ok(existsSync(path.join(root, "full-borg", f)), f);
  assert.ok(hub.relationships.recommends.some((r) => r.id === FB), "Neon Hub recommends it");
});

/* ------------------------------------------ */
/*  Go Metal's planning                       */
/* ------------------------------------------ */

const coreItem = (id, type, slots = 7, list = []) => ({ _id: id, type: "cyberware", name: `${type} (${slots} Option Slots)`, flags: {},
  system: { type, core: true, isFoundational: true, size: 1, installedItems: { list, slots, usedSlots: list.length } } });

test("planBody gives the body's items fresh ids and moves its box contents into the character's core boxes", () => {
  const body = byName(bodies, "Militech Kratos");
  let n = 0;
  const core = coreBoxes([coreItem("in", "cyberwareInternal"), coreItem("ex", "cyberwareExternal"), coreItem("fa", "fashionware")]);
  const plan = planBody(body.items, body.system.installedItems.list, core, () => `new${++n}`, body._id);
  const ids = new Set(plan.create.map((d) => d._id));
  assert.equal(ids.size, plan.create.length, "fresh ids are unique");
  assert.ok(!plan.create.some((d) => d.flags[FB]?.core), "the body's own boxes stay behind");
  assert.equal(plan.create.length, body.items.length - 3);
  for (const d of plan.create) {
    for (const c of listOf(d)) assert.ok(ids.has(c), `${d.name}: child ${c} is a new item`);
    assert.equal(d.flags[FB].body, body._id);
    assert.equal(d._key, undefined);
  }
  for (const id of plan.top) assert.ok(ids.has(id));
  const moved = (box) => plan.intoCore[box].map((id) => plan.create.find((d) => d._id === id).name).sort();
  assert.deepEqual(moved("in"), ["Cyberskull (FBC)", "Titanium Bones"]);
  assert.deepEqual(moved("ex"), ["Hidden Holster"]);
  // Without core boxes (a hand-built actor), the body's own boxes come along instead.
  const bare = planBody(body.items, body.system.installedItems.list, {}, () => `x${++n}`, body._id);
  assert.equal(bare.create.length, body.items.length);
  assert.deepEqual(bare.intoCore, {});
});

test("oldChrome takes out top-level chrome and core-box options, and leaves the Biosystem", () => {
  const items = [
    coreItem("in", "cyberwareInternal", 7, ["bones", "bio2"]),
    { _id: "arm", type: "cyberware", name: "Cyberarm", flags: {}, system: { type: "cyberArm", installedItems: { list: ["blade"] } } },
    { _id: "blade", type: "cyberware", name: "Mantis Blade", flags: {}, system: { type: "cyberArm" } },
    { _id: "bones", type: "cyberware", name: "Titanium Bones", flags: {}, system: { type: "cyberwareInternal" } },
    { _id: "bio", type: "cyberware", name: "Biosystem", flags: { [FB]: { biosystem: true } }, system: { type: "borgware" } },
    { _id: "bio2", type: "cyberware", name: "Biosystem", flags: {}, system: { type: "borgware" } },
    { _id: "gun", type: "weapon", name: "Pistol", flags: {}, system: {} }
  ];
  assert.deepEqual(oldChrome(items, ["in", "arm", "bio", "gun"]), [{ id: "bones", from: "in" }, { id: "arm", from: "actor" }]);
});

test("boxUpdate doubles a core box and hlFormula picks the roll", () => {
  const u = boxUpdate(coreItem("in", "cyberwareInternal", 7, ["a"]), ["b", "c"], { b: 1, c: 2 });
  assert.equal(u.name, "cyberwareInternal (14 Option Slots)");
  assert.equal(u["system.installedItems.slots"], FBC_CORE_SLOTS.cyberwareInternal);
  assert.deepEqual(u["system.installedItems.list"], ["a", "b", "c"]);
  assert.equal(u["system.installedItems.usedSlots"], 4);
  assert.equal(boxUpdate(coreItem("fa", "fashionware", 7), [])["system.installedItems.slots"], 7, "Fashionware isn't doubled");
  assert.equal(boxUpdate(coreItem("big", "cyberwareExternal", 20), [])["system.installedItems.slots"], 20, "never fewer slots");
  const hl = { static: 61, roll: "17d6 + ceil(2d6/2)" };
  assert.equal(hlFormula(hl, "roll"), "17d6 + ceil(2d6/2)");
  assert.equal(hlFormula(hl, "static"), "61");
  assert.equal(hlFormula(hl, "none"), "0");
});
