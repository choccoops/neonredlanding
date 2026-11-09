import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dir = path.join(root, "packs/_source/mooks-2070");
const docs = readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")));
const all = docs.filter((d) => d.type === "mook");
const mooks = all.filter((d) => d.flags["cpr-neon-hub"]?.mook2070);
const drones = all.filter((d) => d.flags["cpr-neon-hub"]?.drone2070);
const folders = docs.filter((d) => d._key?.startsWith("!folders!"));
const file = (src) => path.join(root, src.replace("modules/cpr-neon-hub/", ""));

test("the Mook Pack has Corgo's 128 mooks in 20 factions, and the 29 drones", () => {
  assert.equal(mooks.length, 128);
  assert.equal(drones.length, 29);
  assert.equal(all.length, mooks.length + drones.length);
  assert.equal(folders.length, 21);
  for (const m of all) assert.ok(folders.some((f) => f._id === m.folder), `${m.name} is in a folder`);
  assert.equal(new Set(all.map((m) => m.name)).size, all.length, "names are unique");
});

test("every mook has its own portrait as art and token", () => {
  for (const m of mooks) {
    assert.match(m.img, /^modules\/cpr-neon-hub\/assets\/art\/mooks\/.+\.webp$/, m.name);
    assert.ok(existsSync(file(m.img)), `${m.img} exists`);
    assert.equal(m.prototypeToken.texture.src, m.img);
    assert.equal(m.prototypeToken.actorLink, false, "spawned mooks are unlinked");
  }
});

test("mooks carry the core Skills, the core cyberware containers and their attacks", () => {
  for (const m of all) {
    const skills = m.items.filter((i) => i.type === "skill");
    assert.ok(skills.length >= 63, `${m.name}: ${skills.length} skills`);
    for (const c of ["Internal (7 Option Slots)", "External (7 Option Slots)", "Fashionware (7 Option Slots)"]) {
      assert.ok(m.items.some((i) => i.name === c), `${m.name} has ${c}`);
    }
    if (!m.flags["cpr-neon-hub"].drone2070) assert.ok(m.items.some((i) => i.type === "weapon" || i.system.isWeapon), `${m.name} has an attack`);
    assert.ok(m.system.derivedStats.hp.max > 0);
    const ids = new Set(m.items.map((i) => i._id));
    assert.equal(ids.size, m.items.length, `${m.name}: embedded ids are unique`);
    for (const id of m.system.installedItems.list) assert.ok(ids.has(id), `${m.name}: installed ${id} is embedded`);
    for (const i of m.items) for (const id of i.system.installedItems?.list ?? []) assert.ok(ids.has(id), `${m.name}: ${i.name} holds ${id}`);
  }
});

test("a mook with grenades has a Thrown Weapon, loaded with one", () => {
  let n = 0;
  for (const m of mooks) {
    const nades = m.items.filter((i) => i.type === "ammo" && i.system.variety === "grenade");
    if (!nades.length) continue;
    n++;
    const thrown = m.items.find((i) => i.name === "Thrown Weapon");
    assert.ok(thrown, `${m.name} can throw its grenades`);
    assert.equal(thrown.system.magazine.value, 1, m.name);
    assert.ok(nades.some((g) => thrown.system.installedItems.list.includes(g._id)), `${m.name}: a grenade is loaded`);
  }
  assert.ok(n > 40, `${n} mooks carry grenades`);
});

test("a mook's Skill totals match its stat block", () => {
  const goon = mooks.find((m) => m.name === "Maelstrom Goon");
  const stat = (k) => goon.system.stats[k].value;
  const total = (n) => {
    const s = goon.items.find((i) => i.type === "skill" && i.name === n);
    return s.system.level + stat(s.system.stat);
  };
  assert.equal(total("Athletics"), 9);
  assert.equal(total("Resist Torture/Drugs"), 10);
  assert.equal(total("Shoulder Arms"), 10, "COM# is the base of unlisted attack Skills");
  assert.equal(stat("body"), 5, "BODY is the Death Save");
});

test("descriptions are Neon Hub's own and credit Corgo", () => {
  for (const m of mooks) {
    assert.match(m.system.information.description, /Corgopolis/);
    assert.match(m.system.information.description, /Homebrew Content Policy/);
  }
});

test("drones: their compendium stats, CN as the base of their attacks, art and a top-down token", () => {
  const find = (n) => drones.find((d) => d.name === n);
  const griffin = find("Militech Griffin");
  const level = (d, n) => d.items.find((i) => i.type === "skill" && i.name === n).system.level;
  assert.equal(griffin.system.derivedStats.hp.max, 20);
  assert.equal(griffin.system.stats.move.value, 6);
  assert.equal(level(griffin, "Handgun"), 14, "CN 14");
  assert.equal(level(griffin, "Evasion"), 14);
  assert.ok(griffin.items.some((i) => i.type === "armor" && i.system.bodyLocation.sp === 7), "SP 7 plate");
  assert.ok(griffin.items.some((i) => i.type === "weapon" && i.name === "Heavy SMG"));
  assert.equal(find("KTech Doberman 500").system.derivedStats.hp.max, 25, "stats from the entry's prose");
  assert.equal(find("Militech Chimera").prototypeToken.width, 5);
  for (const d of drones) {
    assert.match(d.img, /assets\/art\/mooks\/.+\.webp$/, d.name);
    assert.ok(existsSync(file(d.img)), `${d.img} exists`);
    assert.match(d.prototypeToken.texture.src, /assets\/art\/tokens\/.+\.webp$/, d.name);
    assert.ok(existsSync(file(d.prototypeToken.texture.src)), `${d.name} token exists`);
  }
});
