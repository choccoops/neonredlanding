import { addMonths, dayNumber } from "../calendar/cal-dates.js";

/**
 * Street Cred: Reputation, faction Standing, NCPD Heat and relationships, as the 2070 Core Rules
 * (ch.14) run them. Pure data helpers; the store (cred-store.js) keeps it in a world setting.
 *
 * Standing, Heat and relationships all run −10..+10. Reputation (0–10) lives on the CPR
 * character's own ledger, not here.
 */

export const MIN = -10;
export const MAX = 10;
/** Standing a gang or corp jumps you in or hires you at; below it you're out. */
export const JOIN_AT = 4;
/** Standing this high cools by 1 after this many months without contact. */
export const COOL_FROM = 6;
export const COOL_MONTHS = 3;
const MAX_LOG = 60;

export const FACTION_KINDS = ["gang", "corp", "nomad", "other"];

/** Standing bands, high to low: [lowest, highest, key] (NEONHUB.Cred.Standing.<key>). */
export const STANDING_BANDS = [
  [10, 10, "legend"], [8, 9, "made"], [6, 7, "inner"], [4, 5, "trusted"], [3, 3, "friendly"], [1, 2, "known"],
  [0, 0, "nobody"], [-2, -1, "noticed"], [-4, -3, "unwelcome"], [-6, -5, "marked"], [-8, -7, "hunted"], [-10, -9, "kos"]
];
/** Heat bands, hottest (worst) first. */
export const HEAT_BANDS = [
  [9, 10, "enemy"], [7, 8, "mostWanted"], [5, 6, "wanted"], [3, 4, "interest"], [1, 2, "flagged"], [0, 0, "citizen"],
  [-2, -1, "clean"], [-4, -3, "friend"], [-6, -5, "asset"], [-8, -7, "partner"], [-10, -9, "untouchable"]
];
/** Relationship bands, closest first. */
export const BOND_BANDS = [
  [10, 10, "rideOrDie"], [8, 9, "family"], [5, 7, "ally"], [3, 4, "friend"], [1, 2, "acquaintance"], [0, 0, "neutral"],
  [-2, -1, "irritant"], [-4, -3, "rival"], [-7, -5, "adversary"], [-9, -8, "nemesis"], [-10, -10, "archNemesis"]
];

/** Store discount by Standing (members' price; non-members pay double after it). */
const DISCOUNTS = [[10, 30], [8, 25], [6, 20], [4, 10]];

export const clamp = (n, lo = MIN, hi = MAX) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));

/** The key of the band a −10..+10 value falls in. */
export const band = (bands, value) => {
  const v = clamp(value);
  return bands.find(([lo, hi]) => v >= lo && v <= hi)?.[2];
};

export const standingBand = (v) => band(STANDING_BANDS, v);
export const heatBand = (v) => band(HEAT_BANDS, v);
export const bondBand = (v) => band(BOND_BANDS, v);

/** Store discount (percent) at a Standing. */
export const discountAt = (v) => DISCOUNTS.find(([from]) => clamp(v) >= from)?.[1] ?? 0;

/** "+4", "0", "−3" */
export const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

const slug = (s) => String(s ?? "").toLowerCase().normalize("NFKD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");

/**
 * The Free City's major factions (Core Rules ch.14, The Players' Board), as a starting list the GM
 * can change. `cap`: Standing never rises above it. `joinable`: a gang or corp you can join at +4.
 * `entry`: its Worldbook entry, when that isn't named the same.
 */
export const DEFAULT_FACTIONS = [
  { id: "tyger-claws", name: "Tyger Claws", kind: "gang", turf: "Japantown, Kabuki", rivals: ["mox"] },
  { id: "valentinos", name: "Valentinos", kind: "gang", turf: "Heywood (Vista del Rey)", rivals: ["sixth-street"] },
  { id: "sixth-street", name: "6th Street", kind: "gang", turf: "Santo Domingo, Heywood's edges, west Westbrook", rivals: ["valentinos", "aldecaldos"] },
  { id: "maelstrom", name: "Maelstrom", kind: "gang", turf: "Watson, Northside Industrial", rivals: ["scavengers"] },
  { id: "animals", name: "Animals", kind: "gang", turf: "Wherever a pack has a gym", rivals: [] },
  { id: "mox", name: "Mox", entry: "The Mox", kind: "gang", turf: "Kabuki, Little China, Jig-Jig Street", rivals: ["tyger-claws"] },
  { id: "voodoo-boys", name: "Voodoo Boys", kind: "gang", turf: "Pacifica (Coastview, West Wind)", rivals: ["barghest"] },
  { id: "barghest", name: "Barghest Militia", kind: "gang", turf: "Pacifica Occupied Zone", rivals: ["voodoo-boys", "arasaka"] },
  { id: "scavengers", name: "Scavengers", entry: "Scavs", kind: "gang", turf: "Anywhere they can cut", rivals: [], cap: 0, joinable: false },
  { id: "aldecaldos", name: "Aldecaldos", entry: "Aldecaldo Nation", kind: "nomad", turf: "The Badlands", rivals: ["wraiths", "sixth-street"] },
  { id: "wraiths", name: "Wraiths", kind: "gang", turf: "The Badlands", rivals: ["aldecaldos"] },
  { id: "afterlife", name: "Afterlife", kind: "other", turf: "Influence everywhere", rivals: [], joinable: false },
  { id: "arasaka", name: "Arasaka", kind: "corp", turf: "Waterfront, Corporate Plaza", rivals: ["militech", "barghest"] },
  { id: "militech", name: "Militech", kind: "corp", turf: "NUSA, its own offices", rivals: ["arasaka"] },
  { id: "kang-tao", name: "Kang Tao", kind: "corp", turf: "Corporate Plaza and holdings", rivals: ["biotechnica", "night-corp", "petrochem"] },
  { id: "biotechnica", name: "Biotechnica", kind: "corp", turf: "Corporate Plaza and holdings", rivals: ["kang-tao", "night-corp", "petrochem"] },
  { id: "night-corp", name: "Night Corp", kind: "corp", turf: "Corporate Plaza and holdings", rivals: ["kang-tao", "biotechnica", "petrochem"] },
  { id: "petrochem", name: "Petrochem", kind: "corp", turf: "Corporate Plaza and holdings", rivals: ["kang-tao", "biotechnica", "night-corp"] },
  { id: "maxtac", name: "MaxTac", kind: "other", turf: "The whole city", rivals: [], joinable: false },
  { id: "lazarus", name: "Lazarus", kind: "corp", turf: "Its own contracts", rivals: [] }
];

export function normalizeFaction(raw = {}) {
  const name = String(raw.name ?? "").trim().slice(0, 80);
  const kind = FACTION_KINDS.includes(raw.kind) ? raw.kind : "other";
  const id = slug(raw.id) || slug(name);
  if (!id || !name) return null;
  const cap = raw.cap === null || raw.cap === undefined || raw.cap === "" ? null : clamp(raw.cap);
  return {
    id,
    name,
    kind,
    turf: String(raw.turf ?? "").trim().slice(0, 160),
    entry: String(raw.entry ?? "").trim().slice(0, 80),
    rivals: [...new Set((Array.isArray(raw.rivals) ? raw.rivals : []).map(slug).filter((r) => r && r !== id))],
    cap,
    joinable: (kind === "gang" || kind === "corp") && raw.joinable !== false,
    hidden: !!raw.hidden
  };
}

/** A calendar date { year, month, day } or null. */
const date = (d) => (d && Number.isFinite(Number(d.year)) && Number(d.month) >= 1 && Number(d.day) >= 1
  ? { year: Number(d.year), month: Number(d.month), day: Number(d.day) } : null);

export function normalizeBond(raw = {}) {
  const name = String(raw.name ?? "").trim().slice(0, 80);
  const target = typeof raw.target === "string" && raw.target ? raw.target : null;
  if (!name && !target) return null;
  return {
    id: String(raw.id || "").slice(0, 32) || null,
    target,
    name,
    img: typeof raw.img === "string" ? raw.img : "",
    value: clamp(raw.value),
    tags: [...new Set((Array.isArray(raw.tags) ? raw.tags : String(raw.tags ?? "").split(",")).map((t) => String(t).trim().slice(0, 30)).filter(Boolean))].slice(0, 8),
    notes: String(raw.notes ?? "").slice(0, 2000),
    romance: !!raw.romance,
    mutual: !!raw.mutual,
    hidden: !!raw.hidden
  };
}

export function normalizeEntry(raw = {}) {
  return {
    at: Number(raw.at) || 0,
    date: date(raw.date),
    what: ["standing", "heat", "bond", "join", "leave", "cool"].includes(raw.what) ? raw.what : "standing",
    key: String(raw.key ?? ""),
    name: String(raw.name ?? ""),
    from: clamp(raw.from),
    to: clamp(raw.to),
    reason: String(raw.reason ?? "").slice(0, 200),
    by: String(raw.by ?? "")
  };
}

/** One character's record. */
export function normalizePerson(raw = {}) {
  const standing = {};
  for (const [id, s] of Object.entries(raw.standing ?? {})) {
    const value = clamp(typeof s === "object" ? s?.value : s);
    standing[slug(id)] = { value, contact: date(s?.contact) };
  }
  const bonds = (Array.isArray(raw.bonds) ? raw.bonds : []).map(normalizeBond).filter((b) => b?.id);
  return {
    standing,
    heat: clamp(raw.heat),
    member: raw.member ? slug(raw.member) : null,
    bonds,
    log: (Array.isArray(raw.log) ? raw.log : []).map(normalizeEntry).slice(0, MAX_LOG)
  };
}

export function normalizeState(raw = {}) {
  const factions = (Array.isArray(raw.factions) ? raw.factions : DEFAULT_FACTIONS).map(normalizeFaction).filter(Boolean);
  const seen = new Set();
  const unique = factions.filter((f) => !seen.has(f.id) && seen.add(f.id));
  const people = {};
  for (const [uuid, p] of Object.entries(raw.people ?? {})) people[uuid] = normalizePerson(p);
  return { factions: unique, people };
}

/** The highest Standing a faction allows. */
export const capOf = (faction) => (faction?.cap === null || faction?.cap === undefined ? MAX : faction.cap);

/** Add a log line, newest first. */
export function logged(person, entry) {
  return { ...person, log: [normalizeEntry(entry), ...person.log].slice(0, MAX_LOG) };
}

/**
 * Change a character's Standing with a faction.
 * @returns {{ person, from, to, crossed: boolean, patchedOut: boolean, canJoin: boolean }}
 */
export function changeStanding(person, faction, delta, { reason = "", by = "", at = 0, today = null, set = null } = {}) {
  const old = person.standing[faction.id] ?? { value: 0, contact: null };
  const to = clamp(set ?? old.value + Number(delta || 0), MIN, capOf(faction));
  let next = { ...person, standing: { ...person.standing, [faction.id]: { value: to, contact: date(today) ?? old.contact } } };
  if (to !== old.value) next = logged(next, { what: "standing", key: faction.id, name: faction.name, from: old.value, to, reason, by, at, date: today });
  const patchedOut = next.member === faction.id && to < JOIN_AT;
  if (patchedOut) {
    next = logged({ ...next, member: null }, { what: "leave", key: faction.id, name: faction.name, from: old.value, to, reason, by, at, date: today });
  }
  return {
    person: next,
    from: old.value,
    to,
    crossed: standingBand(old.value) !== standingBand(to),
    patchedOut,
    canJoin: faction.joinable && to >= JOIN_AT && old.value < JOIN_AT && !next.member
  };
}

export function changeHeat(person, delta, { reason = "", by = "", at = 0, today = null, set = null } = {}) {
  const from = person.heat;
  const to = clamp(set ?? from + Number(delta || 0));
  const next = to === from ? person : logged({ ...person, heat: to }, { what: "heat", key: "ncpd", name: "NCPD", from, to, reason, by, at, date: today });
  return { person: next, from, to, crossed: heatBand(from) !== heatBand(to) };
}

/** Why a character can't join a faction now, or null. */
export function joinProblem(person, faction) {
  if (!faction?.joinable) return "NotJoinable";
  if (person.member && person.member !== faction.id) return "OneOnly";
  if (person.member === faction.id) return "Already";
  if ((person.standing[faction.id]?.value ?? 0) < JOIN_AT) return "TooLow";
  return null;
}

/** Standings due to cool off: +6 or better with no contact for three months (by the character's calendar date). */
export function coolingDue(person, today) {
  const now = date(today);
  if (!now) return [];
  return Object.entries(person.standing)
    .filter(([, s]) => s.value >= COOL_FROM && s.contact && dayNumber(addMonths(s.contact, COOL_MONTHS)) <= dayNumber(now))
    .map(([id]) => id);
}

/** Rivals of a faction whose Standing could drop by 1 ("enemies of my enemy"). */
export function rivalsOf(state, faction) {
  const ids = new Set(faction?.rivals ?? []);
  for (const f of state.factions) if (f.rivals.includes(faction?.id)) ids.add(f.id);
  ids.delete(faction?.id);
  return state.factions.filter((f) => ids.has(f.id));
}

/** Put a relationship in (by id), or add it. */
export function upsertBond(person, bond) {
  const b = normalizeBond(bond);
  if (!b?.id) return person;
  const has = person.bonds.some((x) => x.id === b.id);
  return { ...person, bonds: has ? person.bonds.map((x) => (x.id === b.id ? b : x)) : [...person.bonds, b] };
}

export const removeBond = (person, id) => ({ ...person, bonds: person.bonds.filter((b) => b.id !== id) });

/** Bar geometry for a −10..+10 value: where the fill starts and how wide it is, in percent of the bar. */
export function barOf(value) {
  const v = clamp(value);
  const half = (Math.abs(v) / MAX) * 50;
  return v >= 0 ? { left: 50, width: half, side: v > 0 ? "pos" : "zero" } : { left: 50 - half, width: half, side: "neg" };
}
