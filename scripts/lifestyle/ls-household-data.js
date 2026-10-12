/**
 * Households: a home several characters live in, with its rent split evenly, paid by one of them,
 * or paid into a pool until it's covered. Pure: no Foundry calls.
 *
 * A household keeps its own copy of the home's lifestyle settings (from a housing item), the
 * characters living there and how the rent is paid. Each inhabitant's Lifestyle sees the home as if
 * it were theirs: its share of the rent in their bill, its slots, its Humanity effects.
 */
import { normalizeLifestyle } from "./ls-data.js";

export const RENT_MODES = ["split", "payer", "pool"];

const int = (v, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};

export function normalizeHousehold(raw = {}) {
  const r = raw && typeof raw === "object" ? raw : {};
  const home = normalizeLifestyle({ ...(r.home ?? {}), category: "housing" });
  const inhabitants = Array.isArray(r.inhabitants) ? [...new Set(r.inhabitants.filter((u) => typeof u === "string" && u))] : [];
  const pool = r.pool && typeof r.pool === "object" ? r.pool : {};
  const paid = {};
  for (const [uuid, amount] of Object.entries(pool.paid ?? {})) if (inhabitants.includes(uuid) && int(amount) > 0) paid[uuid] = int(amount);
  const movedIn = {};
  for (const [uuid, day] of Object.entries(r.movedIn ?? {})) if (inhabitants.includes(uuid) && Number.isFinite(Number(day)) && day !== null) movedIn[uuid] = Math.floor(Number(day));
  return {
    id: typeof r.id === "string" && r.id ? r.id : "",
    name: String(r.name ?? "").trim() || "Household",
    img: typeof r.img === "string" ? r.img : "",
    source: typeof r.source === "string" ? r.source : "",
    home,
    // The rent the household pays; the home's own monthly cost unless the GM set another.
    rent: r.rent === null || r.rent === undefined || r.rent === "" ? home.monthly : int(r.rent),
    inhabitants,
    rentMode: RENT_MODES.includes(r.rentMode) ? r.rentMode : "split",
    payer: inhabitants.includes(r.payer) ? r.payer : inhabitants[0] ?? "",
    // the day each inhabitant moved in (on their calendar), for the 2070s three-week rule
    movedIn,
    pool: { period: Number.isFinite(Number(pool.period)) && pool.period !== null ? int(pool.period, -1e9, 1e9) : null, paid }
  };
}

/** What the household pays each month: nothing for a home that's owned or a perk. */
export function monthlyRent(hh) {
  if (hh.home.owned || hh.home.perk) return 0;
  return hh.rent;
}

/**
 * One inhabitant's part of the rent in their own bill.
 * split: an even share (rounded up); payer: all of it for the payer, nothing for the rest;
 * pool: nothing (the pool is paid separately).
 */
export function rentShare(hh, actorUuid) {
  const rent = monthlyRent(hh);
  if (!hh.inhabitants.includes(actorUuid) || !rent) return 0;
  if (hh.rentMode === "split") return Math.ceil(rent / hh.inhabitants.length);
  if (hh.rentMode === "payer") return hh.payer === actorUuid ? rent : 0;
  return 0;
}

/** The pool this month: who put in what, the total, and what's left to cover. */
export function poolStatus(hh, period) {
  const rent = monthlyRent(hh);
  const paid = hh.pool.period === period ? hh.pool.paid : {};
  const total = Object.values(paid).reduce((n, v) => n + v, 0);
  return { rent, paid, total, left: Math.max(0, rent - total), covered: total >= rent };
}

/**
 * Put money into the pool. Only what's still needed is taken; a new month starts an empty pool.
 * @returns {{ pool, taken, status }} the new pool, how much was taken, and the pool after
 */
export function contribute(hh, period, actorUuid, amount) {
  const before = poolStatus(hh, period);
  const taken = Math.min(int(amount), before.left);
  const paid = { ...before.paid };
  if (taken > 0) paid[actorUuid] = (paid[actorUuid] ?? 0) + taken;
  const pool = { period, paid };
  return { pool, taken, status: poolStatus({ ...hh, pool }, period) };
}

/**
 * Move-in days after the inhabitants change: those who stay keep theirs, newcomers get `today`
 * (null when there's no calendar to date it by).
 * @param {Function} today - (actorUuid) => day number or null
 */
export function moveIns(hh, inhabitants, today) {
  const out = {};
  for (const uuid of inhabitants) {
    if (hh?.inhabitants.includes(uuid) && hh.movedIn[uuid] !== undefined) out[uuid] = hh.movedIn[uuid];
    else {
      const day = today(uuid);
      if (day !== null && day !== undefined) out[uuid] = day;
    }
  }
  return out;
}

/**
 * Who fits: the home sleeps its own count plus one per CyberBed (or other houseware that adds sleepers)
 * among the inhabitants' houseware.
 * @param {number} extraSleepers - from houseware
 */
export function capacity(hh, extraSleepers = 0) {
  const sleeps = hh.home.sleeps + extraSleepers;
  return { sleeps, living: hh.inhabitants.length, over: hh.inhabitants.length > sleeps };
}
