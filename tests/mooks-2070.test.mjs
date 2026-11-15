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
const own = (m) => !!m.flags["cpr-neon-hub"].mook2070.own; // Neon Hub's own stat blocks (data/mooks_own.json)
const NAMED = ["Kurt Hansen", "Melissa Rory", "Sandayu Oda", "Sasquatch"];

test("the Mook Pack has Corgo's 128 mooks in 20 factions, Neon Hub's own 8 in 2 more, and the 29 drones", () => {
  assert.equal(mooks.length, 136);
  assert.equal(mooks.filter(own).length, 8);
  assert.deepEqual([...new Set(mooks.filter(own).map((m) => m.flags["cpr-neon-hub"].mook2070.faction))].sort(), ["Combat Cab", "REO Meatwagon"]);
  assert.equal(drones.length, 29);
  assert.equal(all.length, mooks.length + drones.length);
  assert.equal(folders.length, 23);
  for (const m of all) assert.ok(folders.some((f) => f._id === m.folder), `${m.name} is in a folder`);
  assert.equal(new Set(all.map((m) => m.name)).size, all.length, "names are unique");
});

test("every mook has its own portrait as art and token", () => {
  for (const m of mooks) {
    assert.match(m.img, /^modules\/cpr-neon-hub\/assets\/art\/mooks\/.+\.webp$/, m.name);
    assert.ok(existsSync(file(m.img)), `${m.img} exists`);
    assert.equal(m.prototypeToken.actorLink, false, "spawned mooks are unlinked");
    // the named ones stand on the map as a top-down token; everyone else shows the portrait in a ring
    if (NAMED.includes(m.name)) {
      assert.match(m.prototypeToken.texture.src, /^modules\/cpr-neon-hub\/assets\/art\/tokens\/.+\.webp$/, m.name);
      assert.ok(existsSync(file(m.prototypeToken.texture.src)), `${m.prototypeToken.texture.src} exists`);
      assert.equal(m.prototypeToken.ring.enabled, false, m.name);
    } else {
      assert.equal(m.prototypeToken.texture.src, m.img);
      assert.equal(m.prototypeToken.ring.enabled, true, m.name);
    }
  }
});

test("Sasquatch: Combat Cab's boss, Moto 10 and a Drive Land Vehicle base of 20", () => {
  const s = mooks.find((m) => m.name === "Sasquatch");
  assert.equal(s.flags["cpr-neon-hub"].mook2070.faction, "Combat Cab");
  assert.match(s.system.information.notes, /Nomad: Moto 10/);
  const drive = s.items.find((i) => i.type === "skill" && i.name === "Drive Land Vehicle");
  assert.equal(s.system.stats.ref.value + drive.system.level, 20);
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
  for (const m of mooks.filter((x) => !own(x))) {
    assert.match(m.system.information.description, /Corgopolis/);
    assert.match(m.system.information.description, /Homebrew Content Policy/);
  }
  for (const m of mooks.filter(own)) {
    assert.match(m.system.information.description, /Stat block by Neon Hub/);
    assert.doesNotMatch(m.system.information.description, /Corgopolis/);
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

const catalog = new Map(readdirSync(path.join(root, "packs/_source/items-2070")).filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(path.join(root, "packs/_source/items-2070", f), "utf8"))).filter((d) => d.system).map((d) => [`${d.type}|${d.name}`, d]));
const attacks = (m) => m.items.filter((i) => i.type === "weapon" || i.system.isWeapon);
const attackBase = (m, w) => {
  const skill = m.items.find((i) => i.type === "skill" && i.name === w.system.weaponSkill);
  return m.system.stats[skill.system.stat].value + skill.system.level + (w.system.attackmod || 0);
};

test("every weapon attacks with a Skill its mook has", () => {
  for (const m of all) {
    const skills = new Set(m.items.filter((i) => i.type === "skill").map((i) => i.name));
    for (const w of attacks(m)) assert.ok(skills.has(w.system.weaponSkill), `${m.name}: ${w.name} attacks with ${w.system.weaponSkill}`);
  }
});

test("an item a mook shares with the Item Compendium is that item: its name, its icon, its flags", () => {
  let shared = 0;
  for (const m of mooks) {
    for (const i of m.items) {
      const src = catalog.get(`${i.type}|${i.name}`);
      if (!src) continue;
      shared += 1;
      if ((i.system.quality ?? "") === (src.system.quality ?? "")) assert.equal(i.img, src.img, `${m.name}: ${i.name}`);
      assert.deepEqual(i.flags["cpr-neon-hub"]?.source2070, src.flags["cpr-neon-hub"]?.source2070, `${m.name}: ${i.name}`);
    }
    for (const i of m.items.filter((x) => x.type === "weapon")) assert.ok(existsSync(file(i.img)) || i.img.startsWith("systems/"), `${m.name}: ${i.img}`);
  }
  assert.ok(shared > 1500, `${shared} catalog items on the mooks`);
});

test("armor is the catalog's head and body pieces, and nothing is worn twice", () => {
  for (const m of mooks) {
    const names = m.items.filter((i) => i.type === "armor").map((i) => i.name);
    assert.equal(new Set(names).size, names.length, `${m.name}: ${names}`);
  }
  const ganger = mooks.find((m) => m.items.some((i) => i.name === "Kevlar® (Body)"));
  assert.ok(ganger, "Kevlar comes as the catalog's Kevlar® (Body)");
  assert.ok(!mooks.some((m) => m.items.some((i) => i.type === "armor" && ["Kevlar", "Max-Helm", "Light Armorjack"].includes(i.name))));
});

test("Kurt Hansen: Fang, Bald Eagle and Wild Dog are the Iconics, at his printed attack bases", () => {
  const kurt = mooks.find((m) => m.name === "Kurt Hansen");
  const w = (name) => kurt.items.find((i) => i.type === "weapon" && i.name.startsWith(name));
  const fang = w("Fang");
  assert.equal(fang.name, "Fang (Kurt Hansen’s Knife)");
  assert.match(fang.img, /CombatKnife_excellent_iconic\.svg$/);
  assert.equal(fang.system.quality, "excellent");
  assert.match(fang.system.description.value, /deal \+1d6/, "its special rules come with it");
  assert.equal(fang.system.weaponSkill, "Melee Weapon");
  assert.deepEqual([attackBase(kurt, fang), attackBase(kurt, w("Bald Eagle")), attackBase(kurt, w("Wild Dog (")), attackBase(kurt, w("Martial Arts"))], [15, 17, 18, 14]);
  assert.equal(w("Wild Dog (").system.weaponSkill, "Autofire");
});

test("chrome that is a weapon attacks from the body: Mantis Blades are the installed piece, not a second item", () => {
  const mantis = mooks.filter((m) => m.items.some((i) => i.type === "cyberware" && i.name === "Mantis Blade"));
  assert.ok(mantis.length > 0);
  for (const m of mantis) {
    assert.ok(m.items.filter((i) => i.name === "Mantis Blade").every((i) => i.type === "cyberware" && i.system.isWeapon), m.name);
    assert.ok(!m.items.some((i) => i.type === "weapon" && /Mantis Blades?$/.test(i.name)), m.name);
  }
});

test("nothing a mook carries is left without an item, bar the GM's own picks and its ride", () => {
  const notes = (m) => m.system.information.notes;
  for (const m of mooks) assert.doesNotMatch(notes(m), /no catalog item/, m.name);
  const has = (name, type, item) => mooks.find((m) => m.name === name).items.find((i) => i.type === type && i.name === item);
  assert.ok(has("Kurt Hansen", "gear", "Dog Tags"));
  assert.ok(has("Melissa Rory", "gear", "Ion Cuffs"));
  assert.ok(has("Trauma Team Medic", "gear", "Cryopump"), "a Cryobag is the Cryopump");
  assert.match(has("Trauma Team Medic", "gear", "Smart Ears").system.description.value, /includes Level Damper, Scrambler\/Descrambler/);
  assert.equal(has("Hardened Triggerman", "drug", "Timewarp").system.amount, 1);
  assert.equal(has("Arasaka Sniper", "ammo", "Nobunaga Rifle Ammunition").system.amount, 16);
  assert.ok(has("Sasquatch", "cyberware", "Exotic Bodysculpting"));
  // a maker's model the catalog doesn't list is the standard piece under its name, with its options fitted
  const arm = has("Arasaka Agent/Executioner", "cyberware", "Arasaka Corpochrome Cyberarm");
  assert.equal(arm.system.type, "cyberArm");
  assert.ok(arm.system.installedItems.list.length > 0);
  // the CEMK port is the 2070 book's Cybersuite, and the deck in it is on the sheet
  const runners = mooks.filter((m) => m.items.some((i) => i.name === "Cybersuite"));
  assert.equal(runners.length, 7);
  const generic = ["Cyberdeck", "Cyberdeck (Excellent)", "Cyberdeck (Poor)"];
  for (const m of runners) {
    const decks = m.items.filter((i) => i.type === "cyberdeck");
    assert.equal(decks.length, 1, m.name);
    // a named deck from the Item Compendium, its slots filled with quickhacks and no more
    const ii = decks[0].system.installedItems;
    assert.ok(!generic.includes(decks[0].name), `${m.name}: ${decks[0].name}`);
    const loaded = ii.list.map((id) => m.items.find((i) => i._id === id));
    assert.ok(loaded.length >= 5 && loaded.every((i) => i?.type === "program"), m.name);
    assert.equal(ii.usedSlots, loaded.reduce((n, i) => n + i.system.size, 0), m.name);
    assert.ok(ii.usedSlots <= ii.slots, `${m.name}: ${ii.usedSlots} of ${ii.slots} slots`);
    assert.match(notes(m), /Programs for a NET Architecture run \(not loaded/, m.name);
  }
  const deckOf = (name) => mooks.find((m) => m.name === name).items.find((i) => i.type === "cyberdeck").name;
  assert.deepEqual([deckOf("Arasaka Netrunner"), deckOf("NetWatch Special Agent"), deckOf("Voodoo Boys Manbo")],
    ["Arasaka Shadow Mk.5", "NetWatch Netdriver Mk.1", "Raven Mk.3 Viral"]);
  assert.ok(!mooks.some((m) => /cryobag/i.test(JSON.stringify(m))), "the Cryobag is the Cryopump everywhere");
  // a block's ride is the vehicle item, a model from Neon Hub's vehicles, and the notes say which
  const ride = (name) => mooks.find((m) => m.name === name).items.filter((i) => i.type === "vehicle").map((i) => i.name);
  assert.deepEqual(ride("Trauma Team Pilot"), ["Trauma Team Atlus"]);
  for (const n of ["Aldecaldos Nomad", "Aldecaldos Gunslinger", "Wraiths Bane"]) assert.deepEqual(ride(n), ['Brennan Apollo "Harriet"'], n);
  assert.equal(mooks.filter((m) => m.items.some((i) => i.type === "vehicle")).length, 4);
  assert.match(notes(mooks.find((m) => m.name === "Aldecaldos Gunslinger")), /Ride \(.+\): Brennan Apollo "Harriet" \(add NOS\)/);
});
