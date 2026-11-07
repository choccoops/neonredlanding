import { MODULE_ID, BODY_FLAG } from "./constants.js";

/**
 * Go Metal's planning, on plain item data (no Foundry calls, so the tests run it): which of a character's chrome
 * comes out, and a body's items as new items for the character, installed where the body has them.
 */

/** CPR's core boxes: every character has one of each ("Internal (7 Option Slots)" and kin). */
export const CORE_TYPES = ["cyberwareInternal", "cyberwareExternal", "fashionware"];

/** FBC Baselines (Core Rules (2070), Chapter 09): Internal and External Body slots are doubled. */
export const FBC_CORE_SLOTS = { cyberwareInternal: 14, cyberwareExternal: 14, fashionware: 7 };

const listOf = (doc) => doc?.system?.installedItems?.list ?? [];

/** The character's own core boxes, by cyberware type. */
export function coreBoxes(items) {
  const out = {};
  for (const i of items) {
    if (i.type === "cyberware" && i.system?.core && CORE_TYPES.includes(i.system.type)) out[i.system.type] ??= i;
  }
  return out;
}

/** Is this the brain's pod? It stays through every body. */
export const isBiosystem = (i) => i?.type === "cyberware" && (!!i.flags?.[MODULE_ID]?.biosystem || i.name === "Biosystem");

/**
 * The chrome that comes out when someone goes metal: every top-level piece (foundations and Borgware) and every
 * option sitting straight in a core box. Options inside an arm or an eye come out with it. The Biosystem stays.
 * Returns [{ id, from }], `from` being "actor" or the core box's id.
 */
export function oldChrome(items, actorList) {
  const byId = new Map(items.map((i) => [i._id, i]));
  const out = [];
  for (const id of actorList) {
    const i = byId.get(id);
    if (!i || i.type !== "cyberware" || isBiosystem(i)) continue;
    if (i.system?.core) {
      for (const c of listOf(i)) {
        const ci = byId.get(c);
        if (ci && !isBiosystem(ci)) out.push({ id: c, from: i._id });
      }
    } else out.push({ id, from: "actor" });
  }
  return out;
}

/**
 * A body actor's items as new items for a character. Each gets a fresh id (from `newId`) and its installed lists
 * follow. What the body holds in its own Internal, External and Fashionware boxes goes into the character's core
 * boxes instead (`intoCore`: box id -> new ids), when the character has them; otherwise the body's box comes too.
 * `top` is what goes straight into the actor's installed list. Every new item is flagged with the body's id.
 */
export function planBody(bodyItems, bodyList, core, newId, bodyId) {
  const ids = new Map(bodyItems.map((i) => [i._id, newId()]));
  const byId = new Map(bodyItems.map((i) => [i._id, i]));
  const intoCore = {};
  const top = [];
  const skip = new Set();
  for (const id of bodyList) {
    const i = byId.get(id);
    if (!i) continue;
    const box = core[i.flags?.[MODULE_ID]?.core];
    if (box) {
      skip.add(id);
      intoCore[box._id] = [...(intoCore[box._id] ?? []), ...listOf(i).map((c) => ids.get(c)).filter(Boolean)];
    } else top.push(ids.get(id));
  }
  const create = bodyItems
    .filter((i) => !skip.has(i._id))
    .map((i) => {
      const d = structuredClone(i);
      d._id = ids.get(i._id);
      delete d._key;
      delete d.folder;
      delete d.sort;
      if (d.system?.installedItems) d.system.installedItems.list = listOf(i).map((c) => ids.get(c)).filter(Boolean);
      d.flags = { ...d.flags, [MODULE_ID]: { ...d.flags?.[MODULE_ID], [BODY_FLAG]: bodyId } };
      return d;
    });
  return { create, top, intoCore };
}

/** A core box's update for an FBC: doubled slots (never fewer than it has), the name to match, and what moves in. */
export function boxUpdate(box, added = [], sizes = {}) {
  const ii = box.system.installedItems;
  const slots = Math.max(ii.slots ?? 0, FBC_CORE_SLOTS[box.system.type] ?? 0);
  return {
    _id: box._id,
    name: box.name.replace(/\(\d+ Option Slots\)/, `(${slots} Option Slots)`),
    "system.installedItems.slots": slots,
    "system.installedItems.list": [...ii.list, ...added],
    "system.installedItems.usedSlots": (ii.usedSlots ?? 0) + added.reduce((n, id) => n + (sizes[id] ?? 0), 0)
  };
}

/** The roll for a package's Humanity Loss: the book's dice, its static (average) value, or nothing. */
export function hlFormula(hl, mode) {
  if (mode === "none" || !hl) return "0";
  if (mode === "static") return String(hl.static ?? 0);
  return hl.roll || String(hl.static ?? 0);
}
