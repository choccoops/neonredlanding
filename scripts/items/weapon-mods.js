import { MODULE_ID } from "../constants.js";
import { DELETE, plan, rangeSets, baseTable } from "./range-mods.js";
import { autofirePlan, autofireTableOf } from "./autofire-mods.js";

const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));

/** Update option: this update already carries the weapon's changes. */
const DONE = `${MODULE_ID}.rangeMods`;

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

/**
 * Write planned changes ({ path: value }, DELETE removes a flag) into update data, in the same (flat or
 * nested) shape the update uses.
 */
export function writeSets(changes, sets) {
  const nested = changes.system && typeof changes.system === "object";
  for (const [path, value] of Object.entries(sets)) {
    const parts = path.split(".");
    if (value === DELETE) parts[parts.length - 1] = `-=${parts.at(-1)}`;
    const v = value === DELETE ? null : value;
    if (!nested) {
      changes[parts.join(".")] = v;
      continue;
    }
    let at = changes;
    for (const p of parts.slice(0, -1)) at = at[p] && typeof at[p] === "object" ? at[p] : (at[p] = {});
    at[parts.at(-1)] = v;
  }
  return changes;
}

/** A range plan written into update data (kept for the range table's own callers). */
export const writeInto = (changes, result) => writeSets(changes, rangeSets(result));

const resolverFor = (weapon, extra = null) => (id) => (extra?.id === id ? extra : null) ?? weapon.parent?.items?.get(id) ?? game.items?.get(id) ?? null;

/** Both plans for a new install list: the range table first, then Autofire on what's left. */
export function weaponPlan(weapon, list, resolve) {
  const range = plan(weapon, list, resolve);
  const auto = autofirePlan(weapon, range.list, resolve, baseTable(weapon));
  return { list: auto.list, refused: [...range.refused, ...auto.refused], legacy: range.legacy, sets: { ...rangeSets(range), ...auto.sets } };
}

/**
 * What Neon Hub's weapon upgrades change on the weapon itself, so CPR's attack, its Autofire switch, DV
 * displays and Neon Combat Manager all follow. Range Table Modifications set its range table (system.dvTable).
 * Autofire attachments set its Autofire rating and Suppressive Fire (system.fireModes) and the Autofire table
 * (flags.cpr-neon-hub.autofireTable). Taking one out, or deleting it, puts the weapon back. One at a time,
 * only in weapons they fit.
 */
export const WeaponMods = {
  init() {
    Hooks.on("preUpdateItem", (item, changes, options) => this.onPreUpdate(item, changes, options));
    Hooks.on("deleteItem", (item, options, userId) => {
      if (userId === game.user.id) this.onDelete(item).catch((err) => console.warn(`${MODULE_ID} | weapon upgrade restore failed`, err));
    });
  },

  /** Why this upgrade can't go in this weapon, as a message, or null if it can (the Weaponbench asks before it moves anything). */
  check(weapon, upgrade) {
    const list = [...(weapon?.system?.installedItems?.list ?? [])];
    if (!weapon || !upgrade || list.includes(upgrade.id)) return null;
    const res = weaponPlan(weapon, [...list, upgrade.id], resolverFor(weapon, upgrade));
    return res.refused.length ? this.message(weapon, res.refused[0]) : null;
  },

  message(weapon, { item, reason, other }) {
    return L(`NEONHUB.RangeMods.${reason}`, {
      mod: item?.name ?? "", weapon: weapon.name, other: other?.name ?? "", table: baseTable(weapon) || "—", autofire: autofireTableOf(weapon) ?? "—"
    });
  },

  onPreUpdate(item, changes, options) {
    if (item.type !== "weapon" || options?.[DONE]) return;
    const change = listChange(changes);
    if (!change) return;
    const res = weaponPlan(item, change.list, resolverFor(item));
    if (res.refused.length) {
      change.set(res.list);
      // Refused items give their slots back (most of these have none; a Conversion Kit does).
      const size = res.refused.reduce((n, r) => n + (Number(r.item?.system?.size) || 0), 0);
      if (size && change.usedKey && typeof changes[change.usedKey] === "number") changes[change.usedKey] -= size;
      else if (size && typeof change.holder.usedSlots === "number") change.holder.usedSlots -= size;
      for (const r of res.refused) ui.notifications.warn(this.message(item, r));
    }
    for (const up of res.legacy) ui.notifications.info(L("NEONHUB.RangeMods.Legacy", { mod: up.name, weapon: item.name }));
    writeSets(changes, res.sets);
  },

  /** An upgrade deleted while still in a weapon (not through CPR's sheet, which takes it out first): take it out. */
  async onDelete(upgrade) {
    if (upgrade.type !== "itemUpgrade") return;
    const holders = upgrade.parent ? [...upgrade.parent.items] : [...(game.items ?? [])];
    for (const w of holders.filter((i) => i.type === "weapon" && (i.system?.installedItems?.list ?? []).includes(upgrade.id))) {
      const list = w.system.installedItems.list.filter((id) => id !== upgrade.id);
      const res = weaponPlan(w, list, resolverFor(w, upgrade));
      if (!Object.keys(res.sets).length) continue;
      const update = writeSets({ _id: w.id, "system.installedItems.list": list }, res.sets);
      if (w.parent) await w.parent.updateEmbeddedDocuments("Item", [update], { [DONE]: true });
      else await w.update(update, { [DONE]: true });
    }
  }
};
