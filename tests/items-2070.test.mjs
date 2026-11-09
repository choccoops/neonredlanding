import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const load = (pack) => readdirSync(path.join(root, "packs/_source", pack)).filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(path.join(root, "packs/_source", pack, f), "utf8")));
const split = (docs) => ({ folders: docs.filter((d) => !d.system && !d.results && d.type !== "mook"), docs: docs.filter((d) => d.system || d.results) });
const items = split(load("items-2070"));
const rides = split(load("rides-2070"));
const tables = load("dv-tables-2070");

// Cyberpunk RED - CORE 0.92.4's lists (module/system/config.js).
const CPR = {
  types: ["ammo", "armor", "clothing", "cyberdeck", "cyberware", "drug", "gear", "itemUpgrade", "program", "skill", "vehicle", "weapon"],
  weaponTypes: ["assaultRifle", "bow", "grenadeLauncher", "heavyMelee", "heavyPistol", "heavySmg", "lightMelee", "martialArts", "medMelee", "medPistol",
    "rocketLauncher", "shotgun", "smg", "sniperRifle", "thrownWeapon", "unarmed", "vHeavyMelee", "vHeavyPistol"],
  ammoVarieties: ["arrow", "battery", "grenade", "heavyPistol", "medPistol", "paintball", "rifle", "rocket", "shotgunShell", "shotgunSlug", "vHeavyPistol"],
  ammoTypes: ["basic", "acid", "armorPiercing", "biotoxin", "emp", "expansive", "flashbang", "incendiary", "poison", "rubber", "sleep", "smart", "smoke", "teargas"],
  cyberwareTypes: ["cyberAudioSuite", "cyberEye", "cyberArm", "cyberLeg", "neuralWare", "cyberwareInternal", "cyberwareExternal", "fashionware", "borgware"],
  installs: ["mall", "clinic", "hospital", "notApplicable"],
  upgradeTypes: ["weapon", "vehicle", "cyberware", "cyberdeck", "armor", "clothing", "gear"],
  programClasses: ["antipersonnelattacker", "antiprogramattacker", "booster", "defender", "blackice"],
  qualities: ["poor", "standard", "excellent"]
};

test("the Item Compendium is all there", () => {
  assert.ok(items.docs.length > 1500, `${items.docs.length} items`);
  const by = (t) => items.docs.filter((d) => d.type === t).length;
  for (const t of ["weapon", "ammo", "armor", "cyberware", "itemUpgrade", "gear", "cyberdeck", "program", "drug", "vehicle"]) assert.ok(by(t) > 10, `${t}: ${by(t)}`);
  assert.ok(rides.docs.length > 180, `${rides.docs.length} rides`);
});

test("every item uses Cyberpunk RED 0.92.4's own types and lists", () => {
  for (const d of items.docs) {
    const s = d.system;
    const where = `${d.type} ${d.name}`;
    assert.ok(CPR.types.includes(d.type), where);
    // skills have no price in Cyberpunk RED
    if (d.type !== "skill") assert.equal(typeof s.price?.market, "number", where);
    assert.ok(s.description?.value?.length > 20, `${where}: has text`);
    if (d.type === "weapon") {
      assert.ok(CPR.weaponTypes.includes(s.weaponType), `${where}: ${s.weaponType}`);
      assert.ok(CPR.qualities.includes(s.quality), where);
      assert.ok(s.ammoVariety.every((v) => CPR.ammoVarieties.includes(v)), where);
      assert.match(s.damage, /^(\d+d\d+|0)$/, where);
      assert.ok(s.rof >= 1 && s.handsReq >= 1, where);
    }
    if (d.type === "ammo") {
      assert.ok(CPR.ammoVarieties.includes(s.variety), `${where}: ${s.variety}`);
      assert.ok(CPR.ammoTypes.includes(s.type), `${where}: ${s.type}`);
    }
    if (d.type === "cyberware") {
      assert.ok(CPR.cyberwareTypes.includes(s.type), `${where}: ${s.type}`);
      assert.ok(CPR.installs.includes(s.installLocation), where);
      assert.equal(typeof s.humanityLoss.static, "number", where);
    }
    if (d.type === "itemUpgrade") assert.ok(CPR.upgradeTypes.includes(s.type), `${where}: ${s.type}`);
    if (d.type === "program") assert.ok(CPR.programClasses.includes(s.class), `${where}: ${s.class}`);
    if (d.type === "armor") assert.ok(s.isShield ? s.shieldHitPoints.max > 0 : s.bodyLocation.sp > 0 || s.headLocation.sp > 0, `${where}: has SP`);
    assert.equal(d.flags["cyberpunk-red-core"]._migration.current, 33, where);
  }
});

test("Active Effects use CPR's own keys and switch on the way CPR expects", () => {
  const usage = { cyberware: "installed", gear: "equipped", weapon: "equipped", armor: "equipped", drug: "snorted", program: "rezzed", itemUpgrade: "toggled" };
  const withFx = items.docs.filter((d) => d.effects.length);
  assert.ok(withFx.length > 60, `${withFx.length} items with effects`);
  for (const d of withFx) {
    assert.equal(d.system.usage, usage[d.type], `${d.name}: usage`);
    for (const e of d.effects) {
      assert.equal(e._key, `!items.effects!${d._id}.${e._id}`, `${d.name}: effect key`);
      assert.ok(e.transfer && e.changes.length, `${d.name}: ${e.name}`);
      const flags = e.flags["cyberpunk-red-core"].changes;
      const keys = e.changes.map((c) => c.key);
      assert.equal(new Set(keys).size, keys.length, `${e.name}: one change per key`);
      e.changes.forEach((c, i) => {
        assert.match(c.key, /^(system\.stats\.(int|ref|dex|tech|cool|will|move|body)\.value|system\.stats\.emp\.max|bonuses\.[a-zA-Z]+)$/, `${e.name}: ${c.key}`);
        assert.ok([2, 4].includes(c.mode) && Number.isInteger(Number(c.value)), `${e.name}: ${c.key} ${c.value}`);
        assert.ok(["stat", "skill", "combat", "netrun", "misc"].includes(flags.cats[i]), `${e.name}: category`);
        assert.equal(flags.cats[i] === "stat", c.key.startsWith("system.stats."), `${e.name}: ${c.key} category`);
        if (flags.situational[i].isSituational) assert.equal(flags.cats[i], "skill", `${e.name}: only skills are situational`);
      });
      // Drugs only work once snorted, upgrades once fitted and toggled, and "activate"-style chrome when you switch it on.
      if (d.type === "drug" || d.type === "itemUpgrade" || e.name.endsWith("(active)")) assert.ok(e.disabled, `${e.name}: starts off`);
    }
  }
  const fx = (n) => items.docs.find((d) => d.name === n).effects;
  assert.deepEqual(fx("Leeroy Ligament System")[0].changes.map((c) => [c.key, c.value]), [["system.stats.move.value", "2"]]);
  assert.ok(fx("Sandevistan")[0].disabled, "Speedware is switched on in play");
  assert.equal(fx("Voice Stress Analyzer")[0].changes.length, 2);
  assert.deepEqual(fx("Fūma Kotarō Linear Frame")[0].changes.find((c) => c.key === "system.stats.body.value"), { key: "system.stats.body.value", mode: 4, value: "12", priority: null });
  for (const n of ["Nymph Perfume", "Impair Movement", "Liche", "Hardpoint Bracing", "Heavy Armorjack (Body)"]) assert.equal(fx(n).length, 0, `${n} works on someone else, or CPR handles it`);
  // Chrome inside a ride carries its effects, keyed under the actor.
  for (const a of rides.docs) for (const i of a.items) for (const e of i.effects ?? []) assert.equal(e._key, `!actors.items.effects!${a._id}.${i._id}.${e._id}`);
});

test("everything is the 2070 Item Compendium's own", () => {
  for (const d of [...items.docs, ...rides.docs]) {
    const text = d.system.description?.value ?? d.system.information?.description ?? "";
    assert.match(text, /<p><small>Item Compendium \(2070\)( • [^<]+)?<\/small><\/p>$/, `${d.name}: source line`);
    assert.doesNotMatch(text, /Corgo 77|Corgo's 77|SoF 2045|Solo of Fortune|CEMK|Black Chrome|DLC|CORE p\.|Interface RED/, `${d.name}: names only the 2070 books`);
  }
  for (const t of tables) assert.match(t.description, /Core Rules \(2070\), Chapter 07/, t.name);
});

// The 2070 book's source, when it's on this machine (CI doesn't have it): NEON_2070_BOOK or the usual folder.
const book = process.env.NEON_2070_BOOK ?? "/home/eduardo/Documents/neonencountermanager/cpr-2070-books/source";
const markup = path.join(book, "out/compendium_markup.txt");

test("the ACPAs are the 2070 book's Production Models, and only those", (t) => {
  // Chapter 04, Production Models, of the 2070 Item Compendium. No Time of the Red suits.
  const models = ["Arasaka Standard-C", "GunMart Mecha Special", "Hydrosubsidium Neo Gorgon", "Militech War Commando", "Orbital Air Neo Spider",
    "Sanroo Hello Cutie Pwr-Up BigSuit"];
  const acpas = rides.docs.filter((d) => d.flags["cpr-neon-hub"]?.acpa2070).map((d) => d.name).sort();
  assert.deepEqual(acpas, models);
  const suitLike = /\b(ACPA|power armor|Metalgear)\b/i;
  for (const d of rides.docs.filter((x) => !x.flags["cpr-neon-hub"]?.acpa2070)) assert.doesNotMatch(d.name, suitLike, `${d.name} isn't a suit`);
  if (!existsSync(markup)) return t.diagnostic("2070 book source not found: checked against the recorded list only");
  const text = readFileSync(markup, "utf8");
  const chapter = text.slice(text.indexOf("@chapter 04"), text.indexOf("@chapter 05"));
  const printed = chapter.slice(chapter.indexOf("# Production Models")).match(/^### (.+)$/gm).map((h) => h.slice(4).trim()).sort();
  assert.deepEqual(acpas, printed, "the book's Production Models");
  // The suits' frames and shells are the chapter's own tables.
  const parts = items.docs.filter((d) => /^ACPA (Frame|Shell): /.test(d.name)).map((d) => d.name.replace(/^ACPA (Frame|Shell): /, "")).sort();
  const rows = [...chapter.matchAll(/^\| ([^|]+?) \| [\d,]+eb/gm)].map((m) => m[1].trim()).sort();
  assert.deepEqual(parts, rows, "the book's ACPA Linear Frames and Shells");
});

test("ranged weapons fire on a table the DV pack has", () => {
  const names = new Set(tables.map((t) => t.name));
  for (const w of items.docs.filter((d) => d.type === "weapon" && d.system.isRanged)) {
    assert.ok(names.has(w.system.dvTable), `${w.name}: ${w.system.dvTable}`);
  }
  for (const t of ["DV Pistol", "DV SMG", "DV Assault Rifle", "DV Shotgun", "DV Sniper Rifle", "DV Bows & Crossbows", "DV Thrown Weapon", "DV Shotgun (Slug)", "DV Long-Barrel Pistol"]) {
    assert.ok(names.has(t), `CPR's ${t} is kept`);
  }
  // CPR finds a weapon's Autofire table by name: it must contain the single-shot table's name and "Autofire".
  for (const base of ["DV Pistol", "DV SMG", "DV Assault Rifle", "DV Machine Gun"]) {
    assert.ok([...names].some((n) => n.includes(base) && n.includes("Autofire")), `${base} has an Autofire table`);
  }
  for (const t of tables) {
    let last = -1;
    for (const r of t.results) {
      assert.ok(r.range[0] > last && r.range[1] >= r.range[0], `${t.name}: ranges climb`);
      last = r.range[1];
      assert.match(r.text, /^\d*$/, `${t.name}: DVs are numbers`);
    }
  }
});

test("ids are unique, folders exist and nest at most three deep", () => {
  const all = [...items.docs, ...items.folders, ...rides.docs, ...rides.folders, ...tables];
  assert.equal(new Set(all.map((d) => d._id)).size, all.length);
  for (const { docs, folders } of [items, rides]) {
    const byId = new Map(folders.map((f) => [f._id, f]));
    for (const d of [...docs, ...folders]) {
      let depth = 0;
      for (let f = d.folder; f; f = byId.get(f)?.folder) {
        assert.ok(byId.has(f), `${d.name}: folder ${f}`);
        depth++;
      }
      assert.ok(depth <= 3, `${d.name}: ${depth} deep`);
    }
  }
  const keys = items.docs.map((d) => `${d.type}|${d.name.toLowerCase()}`);
  assert.equal(new Set(keys).size, keys.length, "one item per type and name");
});

test("nothing repeats what Neon Hub's other packs already have", () => {
  const elsewhere = new Set(["street-goods", "lifestyle-2070", "fashion-2070"].flatMap((p) => load(p).filter((d) => d.system).map((d) => d.name.toLowerCase())));
  for (const d of items.docs.filter((x) => x.type !== "vehicle")) assert.ok(!elsewhere.has(d.name.toLowerCase()), d.name);
});

test("vehicles and ACPAs open on MMuton's vehicle sheet with seats it understands", () => {
  const vas = "mmutons-cyberpunk-red-vas";
  const keys = ["id", "name", "maxOccupants", "canControlWeapons", "bulletproofGlass", "glassHpMax", "skills", "statMods", "grantsTokenControl"];
  for (const a of rides.docs.filter((d) => d.flags[vas])) {
    assert.equal(a.type, "mook");
    assert.equal(a.flags.core.sheetClass, `${vas}.VehicleSheet`);
    const seats = a.flags[vas].positions;
    assert.ok(seats.length >= 1, a.name);
    for (const s of seats) for (const k of keys) assert.ok(k in s, `${a.name}: ${s.name} ${k}`);
    assert.equal(seats.filter((s) => s.grantsTokenControl).length, 1, `${a.name}: one driver`);
    assert.ok(a.system.derivedStats.hp.max > 0, `${a.name}: SDP or HP`);
    const ids = new Set(seats.map((s) => s.id));
    for (const i of a.items) {
      const pos = i.flags?.[vas]?.mountedPosition;
      if (pos) assert.ok(ids.has(pos), `${a.name}: ${i.name} mounted on a real seat`);
      assert.ok(i._key.startsWith(`!actors.items!${a._id}.`), `${a.name}: ${i.name} key`);
    }
  }
  const acpa = rides.docs.find((a) => a.name === "Arasaka Standard-C");
  assert.ok(acpa.items.some((i) => i.type === "weapon" && i.flags[vas]?.mountedPosition));
  assert.ok(acpa.items.some((i) => i.type === "cyberware" && i.flags[vas]?.installed));
  // Every ACPA's kit: the guns' attachments fitted, barrels on their new range table, chrome installed where CPR looks.
  for (const a of rides.docs.filter((d) => d.flags["cpr-neon-hub"]?.acpa2070)) {
    const byId = new Map(a.items.map((i) => [i._id, i]));
    const chrome = a.items.filter((i) => i.type === "cyberware");
    assert.deepEqual([...a.system.installedItems.list].sort(), chrome.map((i) => i._id).sort(), `${a.name}: chrome installed`);
    for (const g of a.items.filter((i) => i.type === "weapon")) {
      const fitted = g.system.installedItems.list.map((id) => byId.get(id));
      assert.ok(fitted.every((u) => u?.type === "itemUpgrade"), `${a.name}: ${g.name} fits real upgrades`);
      assert.ok(g.system.installedItems.usedSlots <= g.system.installedItems.slots, `${a.name}: ${g.name} slots`);
    }
    assert.doesNotMatch(a.system.information.description, /not in the catalog/);
  }
  const gear = (acpa) => rides.docs.find((d) => d.name === acpa).items;
  const gorgon = gear("Hydrosubsidium Neo Gorgon");
  assert.equal(gorgon.find((i) => i.name === "Microwaver").system.dvTable, "DV Long Barrel Pistol", "Long Barrel puts it on that table");
  assert.ok(gorgon.some((i) => i.name === "Techscanner (arm)"));
  const homesafe = gear("GunMart Mecha Special").find((i) => i.name === "GunMart HomeSafe");
  assert.equal(homesafe.system.installedItems.list.length, 3, "Drum Magazine, Grapple Gun Underbarrel and Shotgun Automatic Control Group");
  assert.equal(gear("Orbital Air Neo Spider").filter((i) => i.name === "Malorian Arms 3570 Hailstorm").length, 2, "×2 means two");
  const kaukaz = rides.docs.find((d) => d.name === "Kaukaz Grodno E-80");
  const gunner = kaukaz.flags[vas].positions.find((p) => p.name === "Gunner");
  assert.equal(kaukaz.items.find((i) => i.name === "Techtronika BMG-570")?.flags[vas].mountedPosition, gunner?.id, "the book's mounted BMG-570, on the gunner's seat");
  for (const n of ["Microwaver", "Shrieker", "Techtronika BMG-570", "Bodyweight Autoinjector", "Drum Magazine", "Extended Magazine", "Belt Box", "Backpack Magazine", "Rocklin Augmentics Skydrivers", "Integrated Zetatech CyberConductor"]) {
    assert.ok(items.docs.some((d) => d.name === n), `${n} is in the compendium`);
  }
  const pets = rides.docs.filter((a) => !a.flags[vas]);
  assert.equal(pets.length, 8, "the eight cyberpets");
});

test("every vehicle, ACPA and cyberpet has its own art, on the sheet and the ringed token", () => {
  for (const a of rides.docs) {
    assert.match(a.img, /^modules\/cpr-neon-hub\/assets\/art\/rides\/.+\.webp$/, a.name);
    assert.ok(existsSync(path.join(root, a.img.replace("modules/cpr-neon-hub/", ""))), `${a.img} exists`);
    assert.equal(a.prototypeToken.texture.src, a.img);
    assert.equal(a.prototypeToken.ring?.enabled, true, `${a.name} has a token ring`);
  }
});

test("the Martial Arts Forms: a Skill and a weapon each, as Cyberpunk RED's own Martial Arts", () => {
  const skills = items.docs.filter((d) => d.type === "skill");
  assert.equal(skills.length, 34);
  for (const sk of skills) {
    assert.match(sk.name, /^Martial Arts \(.+\)$/);
    assert.deepEqual([sk.system.stat, sk.system.category, sk.system.difficulty, sk.system.skillType], ["dex", "fightingSkills", "difficult", "martialArt"]);
    assert.ok(sk.system.description.value.includes("Special Moves"), sk.name);
    const w = items.docs.find((d) => d.type === "weapon" && d.name === sk.name);
    assert.ok(w, `${sk.name}: weapon`);
    assert.deepEqual([w.system.weaponType, w.system.weaponSkill, w.system.rof, w.system.unarmedAutomaticCalculation, w.system.ignoreArmorPercent],
      ["martialArts", sk.name, 2, true, 50]);
    assert.equal(w.img, sk.img);
    assert.equal(w.effects.length, 0, `${w.name}: no effects read from its text`);
  }
});
