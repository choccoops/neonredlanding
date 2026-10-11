/**
 * Calendar notes: who sees and edits them. Pure: no Foundry calls.
 *
 * A note sits on one day of one calendar. The GM's notes are hidden from players
 * unless shared; a player's notes are theirs alone unless shared with their group
 * (everyone who can see that calendar). The GM sees and can edit every note.
 */

export const MAX_TITLE = 80;
export const MAX_TEXT = 4000;

export function normalizeNote(raw = {}) {
  const r = raw && typeof raw === "object" ? raw : {};
  const int = (v, min, max) => Math.min(max, Math.max(min, Math.trunc(Number(v)) || min));
  return {
    id: typeof r.id === "string" && r.id ? r.id : "",
    calendarId: typeof r.calendarId === "string" ? r.calendarId : "",
    year: int(r.year, 1, 9999),
    month: int(r.month, 1, 12),
    day: int(r.day, 1, 31),
    title: String(r.title ?? "").trim().slice(0, MAX_TITLE),
    text: String(r.text ?? "").slice(0, MAX_TEXT),
    shared: !!r.shared,
    author: typeof r.author === "string" ? r.author : "",
    gm: !!r.gm,
    at: Number(r.at) || 0
  };
}

/**
 * Whether a viewer can read a note.
 * @param {object} note
 * @param {{ userId: string, isGM: boolean, inGroup: boolean }} viewer - inGroup: can see the note's calendar
 */
export function canView(note, { userId, isGM, inGroup }) {
  if (isGM) return true;
  if (!inGroup) return false;
  if (note.author === userId && !note.gm) return true;
  return note.shared;
}

/** The GM edits any note; a player only their own. */
export function canEdit(note, { userId, isGM }) {
  return isGM || (!note.gm && note.author === userId);
}

export function onDay(note, date) {
  return note.year === date.year && note.month === date.month && note.day === date.day;
}

/** Notes in reading order: the GM's first, then by when they were written. */
export function sortNotes(notes) {
  return [...notes].sort((a, b) => Number(b.gm) - Number(a.gm) || a.at - b.at);
}

/**
 * How a day's notes look to this viewer:
 * "gm" (only the GM's hidden notes), "private" (only notes nobody else sees), "shared" (something shared).
 */
export function dayMarker(notes, { userId, isGM }) {
  if (!notes.length) return null;
  if (notes.some((n) => n.shared)) return "shared";
  if (isGM && notes.every((n) => n.gm)) return "gm";
  return notes.some((n) => n.author === userId || isGM) ? "private" : "shared";
}

/** "YYYY-MM-DD" key for grouping notes by day. */
export function dayKey(date) {
  return `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}
