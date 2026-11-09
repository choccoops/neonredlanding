import { MODULE_ID } from "../constants.js";

const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));

/** Upgrade flag: what a Range Table Modification does (table, family, option, tables, weaponTypes), or { legacy: true }. */
export const RANGE_FLAG = "rangeMod";
/** Weapon flag: the table the weapon fired on before its Range Table Modification went in. */
export const BASE_FLAG = "dvTableBase";
/** Weapon flag: the book bars Range Table Modifications from this weapon. */
export const BARRED_FLAG = "noRangeMod";
/** Update option: this update already carries the table change. */
const DONE = `${MODULE_ID}.rangeMods`;

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

const flagsOf = (doc) => doc?.flags?.[MODULE_ID] ?? {};
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

/** The installed list an update writes, and where to put a filtered one back. */
function listChange(changes) {
  const flat = changes["system.installedItems"];
  if (Array.isArray(flat?.list)) return { list: flat.list, holder: flat, set: (l) => (flat.list = l) };
  if (Array.isArray(changes["system.installedItems.list"])) {
    return { list: changes["system.installedItems.list"], holder: changes, usedKey: "system.installedItems.usedSlots", set: (l) => (changes["system.installedItems.list"] = l) };
  }
  const nested = changes.system?.installedItems;
  if (Array.isArray(nested?.list)) return { list: nested.list, holder: nested, set: (l) => (nested.list = l) };
  return null;
}

/** Write a planned table change into update data, in the same (flat or nested) shape the update uses. */
export function writeInto(changes, result) {
  const nested = changes.system && typeof changes.system === "object";
  if (result.dvTable !== undefined) {
    if (nested) changes.system.dvTable = result.dvTable;
    else changes["system.dvTable"] = result.dvTable;
  }
  if (result.base === undefined) return changes;
  const key = result.base === null ? `-=${BASE_FLAG}` : BASE_FLAG;
  if (nested) {
    changes.flags ??= {};
    changes.flags[MODULE_ID] ??= {};
    changes.flags[MODULE_ID][key] = result.base;
  } else changes[`flags.${MODULE_ID}.${key}`] = result.base;
  return changes;
}

const resolverFor = (weapon, extra = null) => (id) => (extra?.id === id ? extra : null) ?? weapon.parent?.items?.get(id) ?? game.items?.get(id) ?? null;

/**
 * Range Table Modifications: installing one moves the weapon to its table (system.dvTable, so CPR's attack,
 * its Autofire switch, DV displays and Neon Combat Manager all follow), and taking it out, or deleting it,
 * puts the weapon back. One at a time, only in weapons it fits.
 */
export const RangeMods = {
  init() {
    Hooks.on("preUpdateItem", (item, changes, options) => this.onPreUpdate(item, changes, options));
    Hooks.on("deleteItem", (item, options, userId) => {
      if (userId === game.user.id) this.onDelete(item).catch((err) => console.warn(`${MODULE_ID} | range table restore failed`, err));
    });
  },

  /** Why this upgrade can't go in this weapon, as a message, or null if it can (the Weaponbench asks before it moves anything). */
  check(weapon, upgrade) {
    const list = [...(weapon?.system?.installedItems?.list ?? [])];
    if (!weapon || !upgrade || list.includes(upgrade.id)) return null;
    const res = plan(weapon, [...list, upgrade.id], resolverFor(weapon, upgrade));
    return res.refused.length ? this.message(weapon, res.refused[0]) : null;
  },

  message(weapon, { item, reason, other }) {
    return L(`NEONHUB.RangeMods.${reason}`, { mod: item?.name ?? "", weapon: weapon.name, other: other?.name ?? "", table: baseTable(weapon) || "—" });
  },

  onPreUpdate(item, changes, options) {
    if (item.type !== "weapon" || options?.[DONE]) return;
    const change = listChange(changes);
    if (!change) return;
    const res = plan(item, change.list, resolverFor(item));
    if (res.refused.length) {
      change.set(res.list);
      // Refused items give their slots back (a Range Table Modification has none; a Conversion Kit does).
      const size = res.refused.reduce((n, r) => n + (Number(r.item?.system?.size) || 0), 0);
      if (size && change.usedKey && typeof changes[change.usedKey] === "number") changes[change.usedKey] -= size;
      else if (size && typeof change.holder.usedSlots === "number") change.holder.usedSlots -= size;
      for (const r of res.refused) ui.notifications.warn(this.message(item, r));
    }
    for (const up of res.legacy) ui.notifications.info(L("NEONHUB.RangeMods.Legacy", { mod: up.name, weapon: item.name }));
    writeInto(changes, res);
  },

  /** A modification deleted while still in a weapon (not through CPR's sheet, which takes it out first): take it out. */
  async onDelete(upgrade) {
    if (upgrade.type !== "itemUpgrade") return;
    const holders = upgrade.parent ? [...upgrade.parent.items] : [...(game.items ?? [])];
    for (const w of holders.filter((i) => i.type === "weapon" && (i.system?.installedItems?.list ?? []).includes(upgrade.id))) {
      const list = w.system.installedItems.list.filter((id) => id !== upgrade.id);
      const res = plan(w, list, resolverFor(w, upgrade));
      const update = writeInto({ _id: w.id, "system.installedItems.list": list }, res);
      if (w.parent) await w.parent.updateEmbeddedDocuments("Item", [update], { [DONE]: true });
      else await w.update(update, { [DONE]: true });
    }
  }
};
