/**
 * Gregorian dates for the calendar, and the rent periods that tie it to Lifestyle.
 *
 * A date is a plain { year, month, day } with a 1-based month. Arithmetic runs on
 * day numbers from UTC Dates built with setUTCFullYear, so years under 100 aren't
 * read as 19xx and no time zone can push a date across midnight. Pure: no Foundry calls.
 */

export const MIN_YEAR = 1;
export const MAX_YEAR = 9999;
const DAY_MS = 86_400_000;

function utc(year, month, day) {
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, day);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Days since 1970-01-01 (negative before). */
export function dayNumber(date) {
  return Math.round(utc(date.year, date.month, date.day).getTime() / DAY_MS);
}

export function fromDayNumber(n) {
  const d = new Date(n * DAY_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function daysInMonth(year, month) {
  return utc(year, month + 1, 0).getUTCDate();
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(date) {
  return utc(date.year, date.month, date.day).getUTCDay();
}

export function dayOfYear(date) {
  return dayNumber(date) - dayNumber({ year: date.year, month: 1, day: 1 }) + 1;
}

/** Bring any {year, month, day}-like value into range; impossible days clip to the month's end. */
export function clampDate(raw = {}) {
  const year = Math.min(MAX_YEAR, Math.max(MIN_YEAR, Math.trunc(Number(raw.year)) || MIN_YEAR));
  const month = Math.min(12, Math.max(1, Math.trunc(Number(raw.month)) || 1));
  const day = Math.min(daysInMonth(year, month), Math.max(1, Math.trunc(Number(raw.day)) || 1));
  return { year, month, day };
}

export function addDays(date, n) {
  return clampDate(fromDayNumber(dayNumber(date) + Math.trunc(n)));
}

/** Months keep the day where they can and clip it otherwise (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(date, n) {
  const total = date.year * 12 + (date.month - 1) + Math.trunc(n);
  const year = Math.floor(total / 12);
  const month = total - year * 12 + 1;
  return clampDate({ year, month, day: Math.min(date.day, daysInMonth(year, month)) });
}

export function daysBetween(a, b) {
  return dayNumber(b) - dayNumber(a);
}

export function sameDate(a, b) {
  return !!a && !!b && a.year === b.year && a.month === b.month && a.day === b.day;
}

export function pad(n, width = 2) {
  return String(n).padStart(width, "0");
}

/* ------------------------------------------ */
/*  Rent periods                              */
/* ------------------------------------------ */

/** The rent day in a given month: the chosen day, or the month's last day if it's shorter. */
export function rentDayIn(year, month, rentDay = 1) {
  return Math.min(Math.max(1, Math.trunc(rentDay) || 1), daysInMonth(year, month));
}

/**
 * Which rent month a date falls in, as a single number (year * 12 + month - 1).
 * The period starts on its rent day: with rent on the 15th, 10 March is still February's period.
 */
export function periodOf(date, rentDay = 1) {
  const index = date.year * 12 + (date.month - 1);
  return date.day >= rentDayIn(date.year, date.month, rentDay) ? index : index - 1;
}

/** { year, month } a period number stands for. */
export function periodMonth(period) {
  const year = Math.floor(period / 12);
  return { year, month: period - year * 12 + 1 };
}

/** The rent day that opened a period. */
export function periodStart(period, rentDay = 1) {
  const { year, month } = periodMonth(period);
  return { year, month, day: rentDayIn(year, month, rentDay) };
}

/**
 * The next rent day after `date` (a rent day falling on `date` itself is "today", not next).
 * @returns {{ date: object, days: number, today: boolean }}
 */
export function nextRentDay(date, rentDay = 1) {
  const period = periodOf(date, rentDay);
  const start = periodStart(period, rentDay);
  const next = periodStart(period + 1, rentDay);
  return { date: next, days: daysBetween(date, next), today: sameDate(start, date) };
}

/** Rent days crossed moving from one date to another (0 going backwards or within a period). */
export function rentDaysCrossed(from, to, rentDay = 1) {
  return Math.max(0, periodOf(to, rentDay) - periodOf(from, rentDay));
}
