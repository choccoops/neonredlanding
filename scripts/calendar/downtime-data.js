/**
 * Downtime credits. The GM calls a stretch of downtime; each character taking part gets that much
 * time to spend, and every downtime action spends some of it into a log. Pure: no Foundry calls.
 *
 * Times are minutes. A character's spends run back to back from the start, so each entry has an
 * in-world place in the downtime (`from`/`to`, minutes after the start).
 */

export const MINUTES = { day: 1440, hour: 60 };
export const STATUSES = ["open", "done", "cancelled"];
const MAX_MINUTES = 366 * MINUTES.day;

const int = (v, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};
const str = (v, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Days, hours and minutes to minutes. */
export function toMinutes({ days = 0, hours = 0, minutes = 0 } = {}) {
  return Math.min(MAX_MINUTES, int(days) * MINUTES.day + int(hours) * MINUTES.hour + int(minutes));
}

/** Minutes to { days, hours, minutes }. */
export function split(total) {
  const t = int(total);
  return { days: Math.floor(t / MINUTES.day), hours: Math.floor((t % MINUTES.day) / MINUTES.hour), minutes: t % MINUTES.hour };
}

/** "5d 3h", "2h 30m", "45m", "0m". */
export function formatDuration(total) {
  const { days, hours, minutes } = split(total);
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes || !parts.length) parts.push(`${minutes}m`);
  return parts.join(" ");
}

export function normalizeEntry(raw = {}) {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    id: str(r.id, 32),
    actor: str(r.actor, 120),
    minutes: int(r.minutes, 0, MAX_MINUTES),
    label: str(r.label) || "Downtime",
    source: str(r.source, 60),
    user: str(r.user, 60),
    at: int(r.at),
    data: r.data && typeof r.data === "object" ? r.data : null
  };
}

const date = (d) => (d && typeof d === "object" && d.year ? { year: int(d.year), month: int(d.month), day: int(d.day) } : null);

export function normalizeCall(raw) {
  if (!raw || typeof raw !== "object") return null;
  const participants = Array.isArray(raw.participants) ? [...new Set(raw.participants.filter((u) => typeof u === "string" && u))] : [];
  const starts = {};
  for (const [uuid, d] of Object.entries(raw.starts ?? {})) if (participants.includes(uuid) && date(d)) starts[uuid] = date(d);
  return {
    id: str(raw.id, 32),
    label: str(raw.label, 80),
    total: int(raw.total, 0, MAX_MINUTES),
    participants,
    // The calendar date it started on ({ year, month, day } or null) and the world time.
    start: date(raw.start),
    // each participant's start, on their own calendar
    starts,
    worldTime: Number(raw.worldTime) || 0,
    status: STATUSES.includes(raw.status) ? raw.status : "open",
    entries: (Array.isArray(raw.entries) ? raw.entries : []).map(normalizeEntry).filter((e) => e.id && participants.includes(e.actor) && e.minutes > 0),
    allSpentNotified: !!raw.allSpentNotified,
    startedAt: int(raw.startedAt)
  };
}

/** What a character has spent and has left. */
export function balance(call, actorUuid) {
  if (!call || !call.participants.includes(actorUuid)) return { total: 0, spent: 0, left: 0, taking: false };
  const spent = call.entries.filter((e) => e.actor === actorUuid).reduce((n, e) => n + e.minutes, 0);
  return { total: call.total, spent, left: Math.max(0, call.total - spent), taking: true };
}

/** A character's log in order, each entry placed in the downtime: from/to minutes after the start. */
export function timeline(call, actorUuid) {
  let at = 0;
  return (call?.entries ?? []).filter((e) => e.actor === actorUuid).sort((a, b) => a.at - b.at).map((e) => {
    const placed = { ...e, from: at, to: at + e.minutes };
    at += e.minutes;
    return placed;
  });
}

/** Everyone taking part has spent all their time. */
export function allSpent(call) {
  if (!call || call.status !== "open" || !call.participants.length || !call.total) return false;
  return call.participants.every((u) => balance(call, u).left === 0);
}

/**
 * Whether a spend can go ahead: an open call, a character taking part, and enough time left.
 * @returns {string|null} why not (an error key), or null
 */
export function spendProblem(call, actorUuid, minutes) {
  if (!call || call.status !== "open") return "NoCall";
  if (!call.participants.includes(actorUuid)) return "NotTaking";
  const m = int(minutes);
  if (m <= 0) return "NoTime";
  if (m > balance(call, actorUuid).left) return "NotEnough";
  return null;
}

/** The call with a spend added. */
export function addEntry(call, entry) {
  return { ...call, entries: [...call.entries, normalizeEntry(entry)] };
}

/** The call with an entry taken back. */
export function removeEntry(call, entryId) {
  return { ...call, entries: call.entries.filter((e) => e.id !== entryId) };
}

/** A short record of a finished call for the history. */
export function summary(call) {
  return {
    id: call.id,
    label: call.label,
    total: call.total,
    status: call.status,
    start: call.start,
    participants: call.participants.length,
    spent: call.entries.reduce((n, e) => n + e.minutes, 0),
    entries: call.entries.length,
    endedAt: Date.now()
  };
}
