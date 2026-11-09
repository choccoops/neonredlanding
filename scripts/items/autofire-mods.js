import { MODULE_ID } from "../constants.js";
import { DELETE, FAMILIES, flagsOf } from "./range-mods.js";

/** Upgrade flag: what an Autofire attachment does ({ fits, table, rating, boosted, boostIf, suppressive }, { delta } or { none }). */
export const AF_FLAG = "autofireMod";
/** Weapon flag: the Autofire table it fires on, when an attachment set it (Neon Combat Manager reads it first). */
export const TABLE_FLAG = "autofireTable";
/** Weapon flag: its own Autofire before the attachment ({ autoFire, suppressiveFire, table }). */
export const AF_BASE = "autofireBase";

export const AF = {
  mp: "DV Pistol (Autofire, Machine Pistol)",
  smg: "DV SMG (Autofire)",
  ar: "DV Assault Rifle (Autofire)",
  mg: "DV Machine Gun (Autofire)"
};
const CARD = { "machine pistol": AF.mp, smg: AF.smg, "assault rifle": AF.ar, "machine gun": AF.mg };
const PISTOLS = FAMILIES.pistol.types;
const NOT_PISTOL_AMMO = ["shotgunSlug", "shotgunShell", "arrow"];
/** What Cyberpunk RED gives an SMG or assault rifle whose rating is 0 when it rolls Autofire damage. */
const CPR_DEFAULT = { smg: 3, heavySmg: 3, assaultRifle: 4 };

/**
 * The book's Autofire attachments, for copies made before they carried flags (a test keeps this in step with
 * the pack). The bare "SMG Cyclic Internals" isn't here: it could be either option.
 */
export const BY_NAME = {
  "Pistol Autosear": { fits: "pistol", table: AF.mp, rating: 3, boosted: 4, boostIf: ["excellent", "automatic"], suppressive: true },
  "SMG Cyclic Internals (SMG 4)": { fits: "smg3", table: AF.smg, rating: 4 },
  "SMG Cyclic Internals (Machine Pistol 4)": { fits: "smg3", table: AF.mp, rating: 4 },
  "Shotgun Automatic Control Group": { fits: "shells", table: AF.mp, rating: 3, boosted: 4, boostIf: ["excellent", "automatic"] },
  "Constant Recoil System": { fits: "assaultRifle", table: AF.mg, rating: 3, boosted: 4, boostIf: ["excellent"] },
  "Upsized Power": { delta: 1 },
  "Binary Trigger": { none: true },
  "Electrothermal Enhancement (ETE)": { none: true }
};

/** What an upgrade does to a gun's Autofire, or null. */
export function autofireModOf(upgrade) {
  if (upgrade?.type !== "itemUpgrade") return null;
  const flag = flagsOf(upgrade)[AF_FLAG] ?? BY_NAME[String(upgrade.name ?? "").trim()];
  return flag ? { ...flag, name: upgrade.name } : null;
}

/** The Autofire table the gun's card names, else its type's (what Neon Combat Manager's autofireTable reads too). */
function ownTable(weapon) {
  const s = weapon?.system ?? {};
  const m = /Autofire\s*\(\s*([A-Za-z ]+?)\s*\d/i.exec(String(s.description?.value ?? "").replace(/<[^>]+>/g, " "));
  if (m && CARD[m[1].toLowerCase().trim()]) return CARD[m[1].toLowerCase().trim()];
  if (s.weaponType === "smg" || s.weaponType === "heavySmg") return AF.smg;
  if (s.weaponType === "assaultRifle") return /machine gun/i.test(String(flagsOf(weapon).dvTableBase ?? s.dvTable ?? "")) ? AF.mg : AF.ar;
  if (PISTOLS.includes(s.weaponType)) return AF.mp;
  return null;
}

/** The Autofire table the gun fires on now. */
export function autofireTableOf(weapon) {
  return flagsOf(weapon)[TABLE_FLAG] ?? ownTable(weapon);
}

/** The gun's Autofire without its attachment: { autoFire, suppressiveFire, table, flag }. */
export function baseAutofire(weapon) {
  const saved = flagsOf(weapon)[AF_BASE];
  const fm = weapon?.system?.fireModes ?? {};
  if (saved) return { autoFire: Number(saved.autoFire) || 0, suppressiveFire: !!saved.suppressiveFire, table: saved.table ?? ownTable(weapon), flag: saved.table ?? null };
  const flag = flagsOf(weapon)[TABLE_FLAG] ?? null;
  return { autoFire: Number(fm.autoFire) || 0, suppressiveFire: !!fm.suppressiveFire, table: flag ?? ownTable(weapon), flag };
}

const rated = (weapon, base) => base.autoFire || CPR_DEFAULT[weapon?.system?.weaponType] || 0;
const builtIn = (weapon) => /<strong>Built-in:<\/strong>\s*([^<]*)/i.exec(String(weapon?.system?.description?.value ?? ""))?.[1] ?? "";
const bookName = (name) => String(name ?? "").replace(/\s*\((?:SMG|Machine Pistol) \d\)$/, "");

/** Why this Autofire attachment can't go in this gun (a reason key), or null. `rangeBase` is its own range table. */
export function afMisfit(weapon, mod, rangeBase = "") {
  const s = weapon?.system ?? {};
  if (weapon?.type !== "weapon" || !s.isRanged) return "NotRanged";
  if (bookName(mod.name) && builtIn(weapon).toLowerCase().includes(bookName(mod.name).toLowerCase())) return "BuiltIn";
  if (mod.delta || mod.none) return null;
  const base = baseAutofire(weapon);
  const ammo = [...(s.ammoVariety ?? [])];
  switch (mod.fits) {
    case "pistol":
      if (!PISTOLS.includes(s.weaponType) && !FAMILIES.pistol.tables.includes(rangeBase)) return "AfWrong";
      return ammo.length && ammo.every((a) => NOT_PISTOL_AMMO.includes(a)) ? "AfWrong" : null;
    case "smg3":
      return rated(weapon, base) === 3 && base.table === AF.smg ? null : "AfWrong";
    case "shells":
      return ammo.some((a) => a === "shotgunSlug" || a === "shotgunShell") ? null : "AfWrong";
    case "assaultRifle":
      return base.table === AF.ar && rated(weapon, base) > 0 ? null : "AfWrong";
    default:
      return "AfWrong";
  }
}

/**
 * What an install-list change does to a gun's Autofire. Like the range plan: { list, refused, sets }, where
 * `sets` are update paths to write (DELETE removes a flag). One Autofire attachment that sets the rating at a
 * time; one of each that adds to it; one that takes Autofire away wins over both.
 */
export function autofirePlan(weapon, list, resolve, rangeBase = "") {
  const before = new Set(weapon.system?.installedItems?.list ?? []);
  const out = { list: [...list], refused: [], sets: {} };
  const items = list.map((id) => ({ id, item: resolve(id) })).map((e) => ({ ...e, mod: autofireModOf(e.item) })).filter((e) => e.mod);
  const setters = items.filter((e) => before.has(e.id) && e.mod.table);
  const deltas = items.filter((e) => before.has(e.id) && e.mod.delta);
  const nones = items.filter((e) => e.mod.none);
  for (const e of items.filter((x) => !before.has(x.id))) {
    let reason = null;
    let other = null;
    if (e.mod.table && setters.length) [reason, other] = ["OneAutofire", setters[0].item];
    else if (e.mod.delta && deltas.some((d) => d.item?.name === e.item?.name)) [reason, other] = ["OnePerGun", e.item];
    else reason = afMisfit(weapon, e.mod, rangeBase);
    if (reason) {
      out.refused.push({ item: e.item, reason, other });
      out.list.splice(out.list.indexOf(e.id), 1);
    } else (e.mod.table ? setters : deltas).push(e);
  }

  const fm = weapon.system?.fireModes ?? {};
  const now = { autoFire: Number(fm.autoFire) || 0, suppressiveFire: !!fm.suppressiveFire, flag: flagsOf(weapon)[TABLE_FLAG] ?? null };
  const saved = flagsOf(weapon)[AF_BASE];
  const base = baseAutofire(weapon);
  const set = setters[0]?.mod;
  const put = (path, value, current) => {
    if (value !== current) out.sets[path] = value === null ? DELETE : value;
  };
  if (!set && !deltas.length && !nones.length) {
    if (!saved) return out;
    put("system.fireModes.autoFire", base.autoFire, now.autoFire);
    put("system.fireModes.suppressiveFire", base.suppressiveFire, now.suppressiveFire);
    put(`flags.${MODULE_ID}.${TABLE_FLAG}`, base.flag, now.flag);
    out.sets[`flags.${MODULE_ID}.${AF_BASE}`] = DELETE;
    return out;
  }
  const boost = set && ((set.boostIf ?? []).includes("excellent") && weapon.system?.quality === "excellent"
    || (set.boostIf ?? []).includes("automatic") && rated(weapon, base) > 0);
  let rating = set ? (boost ? set.boosted ?? set.rating : set.rating) : base.autoFire;
  const add = deltas.reduce((n, d) => n + (Number(d.mod.delta) || 0), 0);
  if (add && (rating || rated(weapon, base))) rating = (rating || rated(weapon, base)) + add;
  // A Binary Trigger or an ETE: no Autofire or Suppressive Fire at all (CPR's sheet offers them only on a rating above 0).
  put("system.fireModes.autoFire", nones.length ? 0 : rating, now.autoFire);
  put("system.fireModes.suppressiveFire", !nones.length && (base.suppressiveFire || !!set?.suppressive), now.suppressiveFire);
  put(`flags.${MODULE_ID}.${TABLE_FLAG}`, set ? set.table : base.flag, now.flag);
  if (!saved) out.sets[`flags.${MODULE_ID}.${AF_BASE}`] = { autoFire: now.autoFire, suppressiveFire: now.suppressiveFire, table: now.flag };
  return out;
}
