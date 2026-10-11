/**
 * The world clock as SmallTime reads it: Foundry's world time in seconds, where every
 * multiple of 86,400 is a midnight. Plain functions, no Foundry, so they can be tested.
 */
export const DAY_SECONDS = 86400;
export const DAY_MINUTES = 1440;

/** SmallTime 1.24's defaults: steps, sunrise and sunset in minutes (after midnight). */
export const SMALLTIME_DEFAULTS = { smallStep: 10, largeStep: 60, sunriseStart: 180, sunriseEnd: 420, sunsetStart: 1050, sunsetEnd: 1320, hour12: true };

/** Midnights since world time 0 (negative before it). */
export function dayIndex(worldTime) {
  return Math.floor(Number(worldTime) / DAY_SECONDS);
}

/** Minutes after midnight, 0-1439, for any world time (including negative ones). */
export function minutesOfDay(worldTime) {
  const s = ((Number(worldTime) % DAY_SECONDS) + DAY_SECONDS) % DAY_SECONDS;
  return Math.floor(s / 60);
}

/** Midnights passed going from one world time to another: negative going back. */
export function daysCrossed(before, after) {
  return dayIndex(after) - dayIndex(before);
}

/** Seconds to add to reach a time of day (minutes) on the same day. */
export function secondsTo(worldTime, minutes) {
  const target = Math.min(DAY_MINUTES - 1, Math.max(0, Math.round(Number(minutes) || 0)));
  return (target - minutesOfDay(worldTime)) * 60;
}

/** "21:05", or "9:05 PM" on a 12-hour clock. */
export function formatTime(minutes, hour12 = false) {
  const h = Math.floor(minutes / 60) % 24;
  const m = String(minutes % 60).padStart(2, "0");
  if (!hour12) return `${String(h).padStart(2, "0")}:${m}`;
  return `${h % 12 || 12}:${m} ${h < 12 ? "AM" : "PM"}`;
}

/** A step button's label: "+10m", "−1h", "+4h". */
export function stepLabel(minutes) {
  const sign = minutes < 0 ? "\u2212" : "+";
  const n = Math.abs(minutes);
  return n % 60 === 0 ? `${sign}${n / 60}h` : `${sign}${n}m`;
}

/** "HH:MM" (24-hour) to minutes, or null. */
export function parseTime(text) {
  const match = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(String(text ?? ""));
  if (!match) return null;
  const [h, m] = [Number(match[1]), Number(match[2])];
  return h < 24 && m < 60 ? h * 60 + m : null;
}

/** Daylight, by SmallTime's sunrise end and sunset start. */
export function isDaytime(minutes, { sunriseEnd = SMALLTIME_DEFAULTS.sunriseEnd, sunsetStart = SMALLTIME_DEFAULTS.sunsetStart } = {}) {
  return minutes >= sunriseEnd && minutes < sunsetStart;
}
