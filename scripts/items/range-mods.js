import { MODULE_ID } from "../constants.js";

/** Upgrade flag: what a Range Table Modification does (table, family, option, tables, weaponTypes), or { legacy: true }. */
export const RANGE_FLAG = "rangeMod";
/** Weapon flag: the table the weapon fired on before its Range Table Modification went in. */
export const BASE_FLAG = "dvTableBase";
/** Weapon flag: the book bars Range Table Modifications from this weapon. */
export const BARRED_FLAG = "noRangeMod";
/** A set that removes a flag. */
export const DELETE = Symbol("delete");

/**
 * The book's options, for upgrades copied into worlds before they carried flags: the ACPAs' "Range Table
 * Modification (Scout Barrel)". The pack's own items carry the same in flags (a test keeps the two in step).
 */
export const FAMILIES = {
  pistol: {
    types: ["heavyPistol", "medPistol", "vHeavyPistol"], plain: "DV Pistol",
    tables: ["DV Pistol", "DV Snubnose Pistol", "DV Long Barrel Pistol", "DV Long-Barrel Pistol"],
    options: { "snub barrel": "DV Snubnose Pistol", "long barrel": "DV Long Barrel Pistol" }
  },
  smg: { types: ["heavySmg", "smg"], plain: "DV SMG", tables: ["DV SMG", "DV Subcompact SMG"], options: { "short barrel": "DV Subcompact SMG" } },
  shotgun: {
    types: ["shotgun"], plain: "DV Shotgun", tables: ["DV Shotgun", "DV Short Barrel Shotgun", "DV Long Barrel Shotgun", "DV Shotgun (Slug)"],
    options: { "short barrel": "DV Short Barrel Shotgun", choke: "DV Long Barrel Shotgun" }
  },
  rifle: {
    types: ["assaultRifle"], plain: "DV Assault Rifle", tables: ["DV Assault Rifle", "DV Carbine", "DV Battle Rifle", "DV Marksman Rifle"],
    options: { "carbine barrel": "DV Carbine", "battle barrel": "DV Battle Rifle", "marksman barrel": "DV Marksman Rifle" }
  },
  sniper: {
    types: ["sniperRifle"], plain: "DV Sniper Rifle", tables: ["DV Sniper Rifle", "DV Scout Rifle", "DV Anti-materiel Rifle"],
    options: { "scout barrel": "DV Scout Rifle", "long barrel": "DV Anti-materiel Rifle" }
  },
  bow: {
    types: ["bow"], plain: "DV Bow", tables: ["DV Bow", "DV Shortbow", "DV Longbow", "DV Bows & Crossbows"],
    options: { "short limbs": "DV Shortbow", "long limbs": "DV Longbow" }
  },
  launcher: {
    types: ["grenadeLauncher", "rocketLauncher"], plain: "DV Grenade Launcher", tables: ["DV Grenade Launcher", "DV Rocket Launcher", "DV Missile Launcher"],
    options: { "short tube": "DV Grenade Launcher", "standard tube": "DV Rocket Launcher", "long tube": "DV Missile Launcher" }
  }
};
const PLAIN_BY_TYPE = { rocketLauncher: "DV Rocket Launcher" };

export const flagsOf = (doc) => doc?.flags?.[MODULE_ID] ?? {};
const familyOf = (weapon) => Object.entries(FAMILIES).find(([, f]) => f.types.includes(weapon?.system?.weaponType));

/**
 * What an upgrade does as a Range Table Modification on this weapon: { table, tables, weaponTypes, name },
 * { legacy: true } for the book's summary entry (it changes nothing), or null if it isn't one.
 */
export function rangeModOf(upgrade, weapon = null) {
  if (upgrade?.type !== "itemUpgrade") return null;
  const flag = flagsOf(upgrade)[RANGE_FLAG];
  if (flag?.table) return { table: flag.table, tables: flag.tables ?? [], weaponTypes: flag.weaponTypes ?? [], name: upgrade.name };
  const m = /^Range Table Modification(?:\s*\(([^)]+)\))?$/i.exec(String(upgrade.name ?? "").trim());
  if (!m && !flag?.legacy) return null;
  // An older copy: the option is in its name, and the weapon says which family it's for.
  const option = m?.[1]?.toLowerCase().trim();
  const [, fam] = familyOf(weapon) ?? [];
  const table = option && fam?.options[option];
  if (!table) return { legacy: true, name: upgrade.name };
  return { table, tables: fam.tables, weaponTypes: fam.types, name: upgrade.name };
}

/** A Conversion Kit: no Range Table Modification while one is in. */
export const isConversionKit = (doc) => doc?.type === "itemUpgrade" && /^Conversion Kit\b/i.test(String(doc.name ?? ""));

/** The table the weapon fires on without a modification. */
export function baseTable(weapon) {
  const saved = flagsOf(weapon)[BASE_FLAG];
  return typeof saved === "string" ? saved : String(weapon?.system?.dvTable ?? "");
}

/**
 * Why this modification can't go in this weapon (a reason key), or null if it fits. A weapon on one of the
 * modification's tables takes it whatever its type, so Exotic Weapons can; one with no table goes by its type.
 */
export function misfit(weapon, mod) {
  if (weapon?.type !== "weapon" || !weapon.system?.isRanged) return "NotRanged";
  if (flagsOf(weapon)[BARRED_FLAG]) return "Barred";
  const base = baseTable(weapon);
  if (base ? !mod.tables.includes(base) : !mod.weaponTypes.includes(weapon.system.weaponType)) return "Wrong";
  return null;
}

/**
 * What an install-list change does to a weapon. `list` is the new installed list, `resolve(id)` finds an
 * item by id. Returns { list, refused: [{ item, reason, other }], legacy: [item], dvTable?, base? } where
 * `list` drops refused items, `dvTable` is the table to write (if it changes) and `base` the saved table
 * (a string to save, null to clear, undefined to leave).
 */
export function plan(weapon, list, resolve) {
  const before = new Set(weapon.system?.installedItems?.list ?? []);
  const items = list.map((id) => ({ id, item: resolve(id) }));
  const isMod = (e) => !!e.mod?.table;
  for (const e of items) e.mod = rangeModOf(e.item, weapon);
  const out = { list: [...list], refused: [], legacy: [] };
  const kept = items.filter((e) => before.has(e.id));
  const active = kept.filter(isMod);
  let kit = kept.find((e) => isConversionKit(e.item));
  for (const e of items.filter((x) => !before.has(x.id))) {
    let reason = null;
    let other = null;
    if (isMod(e)) {
      if (kit) [reason, other] = ["Conversion", kit.item];
      else if (active.length) [reason, other] = ["OneAtATime", active[0].item];
      else reason = misfit(weapon, e.mod);
      if (!reason) active.push(e);
    } else if (isConversionKit(e.item)) {
      if (active.length) [reason, other] = ["KitWithMod", active[0].item];
      else kit = e;
    } else if (e.mod?.legacy) out.legacy.push(e.item);
    if (reason) {
      out.refused.push({ item: e.item, reason, other });
      out.list.splice(out.list.indexOf(e.id), 1);
    }
  }

  const current = String(weapon.system?.dvTable ?? "");
  const saved = flagsOf(weapon)[BASE_FLAG];
  // A modification put in before Neon Hub tracked them saved no table: if one comes out (or is still in), the
  // weapon's own table is its family's.
  const untracked = typeof saved !== "string" && [...before].some((id) => rangeModOf(resolve(id), weapon)?.table === current);
  const [, fam] = familyOf(weapon) ?? [];
  const plainTable = fam ? PLAIN_BY_TYPE[weapon.system.weaponType] ?? fam.plain : null;
  const on = active[0];
  if (on) {
    if (current !== on.mod.table) out.dvTable = on.mod.table;
    if (typeof saved !== "string" && !before.has(on.id)) out.base = untracked && plainTable ? plainTable : current;
    return out;
  }
  if (typeof saved === "string") {
    if (current !== saved) out.dvTable = saved;
    out.base = null;
  } else if (untracked && plainTable) out.dvTable = plainTable;
  return out;
}

/** A range plan's writes, as update paths ({ path: value }; DELETE removes a flag). */
export function rangeSets(result) {
  const sets = {};
  if (result.dvTable !== undefined) sets["system.dvTable"] = result.dvTable;
  if (result.base !== undefined) sets[`flags.${MODULE_ID}.${BASE_FLAG}`] = result.base === null ? DELETE : result.base;
  return sets;
}
