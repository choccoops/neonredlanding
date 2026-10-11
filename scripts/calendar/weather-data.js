/**
 * Night City weather, from R. Talsorian's free Night City Weather DLC for Cyberpunk RED:
 * the seasonal tables (1d6 for Temperature, 1d6 for Current Conditions), the Strange
 * Weather table (1d10 for the condition, then its duration) and which conditions exist.
 * Only the dice tables are used; every description in Neon Hub is its own wording.
 *
 * Plain functions with an injectable random source, no Foundry, so they can be tested.
 */
import { addDays, dayNumber, fromDayNumber } from "./cal-dates.js";
import { dayKey } from "./cal-notes-data.js";

/* ------------------------------------------ */
/*  Tables                                    */
/* ------------------------------------------ */

/** Seasonal tables by month: temperature band and °F, and the Current Conditions column. */
const WINTER = {
  temps: [["cold", 35], ["cold", 40], ["cold", 40], ["cool", 50], ["cool", 50], ["cool", 60]],
  conds: ["clear", "lightRain", "overcast", "overcast", "heavyRain", "strange"]
};
const SPRING = {
  temps: [["cold", 40], ["cool", 50], ["cool", 50], ["cool", 50], ["warm", 60], ["warm", 70]],
  conds: ["clear", "lightRain", "overcast", "lightRain", "heavyRain", "strange"]
};
const SUMMER = {
  temps: [["warm", 60], ["warm", 70], ["warm", 70], ["hot", 80], ["hot", 80], ["hot", 90]],
  conds: ["lightRain", "clear", "overcast", "overcast", "clear", "strange"]
};
const AUTUMN = {
  temps: [["cool", 40], ["warm", 60], ["warm", 60], ["warm", 60], ["warm", 70], ["hot", 80]],
  conds: ["lightRain", "clear", "overcast", "overcast", "clear", "strange"]
};
export const SEASONS = { winter: WINTER, spring: SPRING, summer: SUMMER, autumn: AUTUMN };

export function seasonOf(month) {
  if (month === 12 || month <= 2) return "winter";
  if (month <= 5) return "spring";
  if (month <= 8) return "summer";
  return "autumn";
}

/** Strange Weather, 1d10. Entry 8 is a Cold Snap in Cool or Cold weather, else a Heat Wave. */
const STRANGE = [
  ["radioactiveWindstorm"], ["ashStorm"], ["flooding"], ["bloodRain"], ["acidRain"],
  ["deadlyThunderstorm"], ["inversionSmog"], ["coldSnap", "heatWave"], ["dustStorm"], ["blackout"]
];

/**
 * Every condition: its kind (standard or strange), how long a strange one lasts (1d6 of a unit),
 * how a forecast treats it, its icon and colour.
 * forecast: "obvious" (called accurately days ahead), "risk" (shown as a chance, may be missed
 * or a false alarm), "none" (no one sees it coming).
 */
export const CONDITIONS = {
  clear: { kind: "standard", icon: "fa-sun", color: "#f3e600" },
  overcast: { kind: "standard", icon: "fa-cloud", color: "#8a8fae" },
  lightRain: { kind: "standard", icon: "fa-cloud-rain", color: "#05d9e8", rain: true },
  heavyRain: { kind: "standard", icon: "fa-cloud-showers-heavy", color: "#2f7bff", rain: true },
  radioactiveWindstorm: { kind: "strange", unit: "tenMinutes", forecast: "risk", icon: "fa-radiation", color: "#39ff88" },
  ashStorm: { kind: "strange", unit: "tenMinutes", forecast: "risk", icon: "fa-fire", color: "#ff8a1f" },
  flooding: { kind: "strange", unit: "days", forecast: "obvious", icon: "fa-house-flood-water", color: "#2f7bff" },
  bloodRain: { kind: "strange", unit: "hours", forecast: "risk", icon: "fa-droplet", color: "#d6123c", rain: true },
  acidRain: { kind: "strange", unit: "hours", forecast: "risk", icon: "fa-flask", color: "#b6ff3c", rain: true },
  deadlyThunderstorm: { kind: "strange", unit: "tenMinutes", forecast: "risk", icon: "fa-cloud-bolt", color: "#9d4dff", rain: true },
  inversionSmog: { kind: "strange", unit: "days", forecast: "obvious", icon: "fa-smog", color: "#b5a36a" },
  coldSnap: { kind: "strange", unit: "days", forecast: "obvious", icon: "fa-temperature-low", color: "#9fe8ff" },
  heatWave: { kind: "strange", unit: "days", forecast: "obvious", icon: "fa-temperature-high", color: "#ff2a6d" },
  dustStorm: { kind: "strange", unit: "tenMinutes", forecast: "risk", icon: "fa-wind", color: "#d8a35a" },
  blackout: { kind: "strange", unit: "days", forecast: "none", icon: "fa-power-off", color: "#6e7290" }
};
export const STANDARD = Object.keys(CONDITIONS).filter((k) => CONDITIONS[k].kind === "standard");
export const STRANGE_KEYS = Object.keys(CONDITIONS).filter((k) => CONDITIONS[k].kind === "strange");

/** Conditions of the Time of the Red that a 2070s game might not have. */
export const RED_ERA = ["radioactiveWindstorm", "bloodRain"];

/** Temperatures that Cold Snaps and Heat Waves force, in °F. */
const SNAP_F = 28;
const WAVE_F = [100, 105, 110];

export const toC = (f) => Math.round(((f - 32) * 5) / 9);

/* ------------------------------------------ */
/*  Rolling                                   */
/* ------------------------------------------ */

const die = (rng, n) => 1 + Math.floor(rng() * n);

/**
 * Roll until the result is allowed: a turned-off condition is rerolled, as a GM would.
 * Gives up (null) when nothing on the table is allowed.
 */
function reroll(roll, ok, tries = 60) {
  for (let i = 0; i < tries; i++) {
    const v = roll();
    if (ok(v)) return v;
  }
  return null;
}

/** A standard condition from the season's Conditions column, never "strange". */
function rollStandard(season, rng, allowed) {
  const table = SEASONS[season].conds;
  if (!table.some((c) => c !== "strange" && allowed.has(c))) return "overcast";
  return reroll(() => table[die(rng, 6) - 1], (c) => c !== "strange" && allowed.has(c));
}

/** A Strange Weather condition fitting the temperature band, or null if none is allowed. */
function rollStrange(band, rng, allowed) {
  const pick = () => {
    const entry = STRANGE[die(rng, 10) - 1];
    return entry.length > 1 ? entry[band === "cold" || band === "cool" ? 0 : 1] : entry[0];
  };
  return reroll(pick, (k) => allowed.has(k));
}

/** How long a strange condition lasts: { minutes } or { days }. */
function rollDuration(key, rng) {
  const n = die(rng, 6);
  const unit = CONDITIONS[key].unit;
  if (unit === "days") return { days: n };
  return { minutes: unit === "hours" ? n * 60 : n * 10 };
}

/**
 * One day of weather.
 * @returns {{ band, f, cond, strange: { key, start, minutes }|null, event: { key, id, day, of }|null }}
 *   cond is the day's ordinary sky (Clear, Overcast, rain); strange is a short Strange Weather
 *   event that day; event is a Strange Weather event lasting days.
 */
function rollDay(date, rng, allowed, ongoing) {
  const season = seasonOf(date.month);
  const [band, f] = SEASONS[season].temps[die(rng, 6) - 1];
  const day = { band, f, cond: null, strange: null, event: null };

  let strangeKey = null;
  if (!ongoing) {
    const roll = SEASONS[season].conds[die(rng, 6) - 1];
    if (roll === "strange") strangeKey = rollStrange(band, rng, allowed);
    else if (allowed.has(roll)) day.cond = roll;
  }
  // The day's sky: rolled again when the conditions roll went strange (or was turned off).
  day.cond ??= rollStandard(season, rng, allowed);

  if (strangeKey) {
    const length = rollDuration(strangeKey, rng);
    if (length.days) day.event = { key: strangeKey, id: `${dayKey(date)}-${strangeKey}`, day: 1, of: length.days };
    else day.strange = { key: strangeKey, start: Math.floor(rng() * 288) * 5, minutes: length.minutes };
  } else if (ongoing) {
    day.event = { ...ongoing, day: ongoing.day + 1 };
  }
  applyEvent(day, rng);
  return day;
}

/** Cold Snaps and Heat Waves override the temperature roll. */
function applyEvent(day, rng) {
  if (day.event?.key === "coldSnap") Object.assign(day, { band: "freezing", f: SNAP_F });
  if (day.event?.key === "heatWave") Object.assign(day, { band: "scorching", f: WAVE_F[Math.floor(rng() * WAVE_F.length)] });
}

/**
 * Plan the weather for a run of days.
 * @param {object} from - first date
 * @param {number} count - how many days
 * @param {object} options
 * @param {Function} [options.rng] - random source in [0, 1)
 * @param {Iterable<string>} [options.off] - condition keys turned off
 * @param {object} [options.before] - the day before `from`, to carry a multi-day event on
 * @returns {Object<string, object>} days by "YYYY-MM-DD"
 */
export function planWeather(from, count, { rng = Math.random, off = [], before = null } = {}) {
  const allowed = new Set(Object.keys(CONDITIONS).filter((k) => !new Set(off).has(k)));
  const out = {};
  let ongoing = before?.event && before.event.day < before.event.of ? before.event : null;
  for (let i = 0; i < count; i++) {
    const date = addDays(from, i);
    const day = rollDay(date, rng, allowed, ongoing);
    out[dayKey(date)] = day;
    ongoing = day.event && day.event.day < day.event.of ? day.event : null;
  }
  return out;
}

/* ------------------------------------------ */
/*  Forecasts                                 */
/* ------------------------------------------ */

const NEIGHBOURS = { clear: ["overcast"], overcast: ["clear", "lightRain"], lightRain: ["overcast", "heavyRain"], heavyRain: ["lightRain", "overcast"] };
const round5 = (n) => Math.round(n / 5) * 5;
const pct = (p) => Math.max(0, Math.min(90, Math.round(p * 10) * 10));

/** How often a forecast gets a day right, by days ahead (1 = tomorrow). */
export function accuracy(lead) {
  return Math.max(0.45, 0.92 - 0.075 * (lead - 1));
}

export function bandOf(f) {
  if (f <= 32) return "freezing";
  if (f < 45) return "cold";
  if (f < 60) return "cool";
  if (f < 75) return "warm";
  if (f < 95) return "hot";
  return "scorching";
}

/**
 * A forecast for one day, made `lead` days ahead from what will really happen.
 * Ordinary weather is usually right tomorrow and a coin flip a week out; temperatures
 * come as a range that widens with distance. Short strange events show as a risk that
 * can be missed or turn out a false alarm; multi-day storms are called; blackouts never.
 */
export function forecastDay(actual, lead, { rng = Math.random, off = [] } = {}) {
  if (!actual) return { unknown: true };
  const acc = accuracy(lead);
  const gauss = () => (rng() + rng() + rng() - 1.5) * 1.4;
  const obvious = actual.event && CONDITIONS[actual.event.key].forecast === "obvious" ? actual.event : null;

  // Temperature: the real one, nudged by an error that grows with distance, as a range.
  const width = lead <= 2 ? 5 : lead <= 5 ? 10 : 15;
  const mid = actual.f + gauss() * (1.5 + lead * 1.6);
  const lo = round5(mid - width / 2);
  const hi = lo + width;

  // Sky: right, or a neighbouring guess.
  let cond = actual.cond;
  if (rng() > acc) {
    const options = NEIGHBOURS[actual.cond] ?? ["overcast"];
    cond = options[Math.floor(rng() * options.length)];
  }
  const wet = CONDITIONS[cond].rain;
  const rain = pct(wet ? 0.45 + 0.4 * acc + (rng() - 0.5) * 0.2 : (1 - acc) * 0.3 + rng() * 0.15);

  // Risks: real short events, sometimes missed; and the odd false alarm.
  const risks = [];
  const real = actual.strange && CONDITIONS[actual.strange.key].forecast === "risk" ? actual.strange.key : null;
  if (real && rng() < 0.8 - 0.08 * (lead - 1)) risks.push({ key: real, pct: pct(0.25 + 0.45 * acc * rng() + 0.1) });
  const alarms = Object.keys(CONDITIONS).filter((k) => CONDITIONS[k].forecast === "risk" && k !== real && !new Set(off).has(k));
  if (alarms.length && rng() < 0.1) risks.push({ key: alarms[Math.floor(rng() * alarms.length)], pct: pct(0.1 + rng() * 0.2) });

  return {
    band: obvious && ["coldSnap", "heatWave"].includes(obvious.key) ? actual.band : bandOf((lo + hi) / 2),
    lo: obvious && ["coldSnap", "heatWave"].includes(obvious.key) ? round5(actual.f - 2) : lo,
    hi: obvious && ["coldSnap", "heatWave"].includes(obvious.key) ? round5(actual.f - 2) + 5 : hi,
    cond,
    rain,
    risks,
    event: obvious ? { ...obvious } : null
  };
}

/**
 * The week's forecast issued on a date: the seven days after it.
 * @param {object} issued - the date it's issued
 * @param {Object<string, object>} days - planned weather by "YYYY-MM-DD"
 * @returns {{ issued: string, days: object[] }} each day with its "key" and "lead"
 */
export function forecastWeek(issued, days, options = {}) {
  const out = [];
  for (let lead = 1; lead <= 7; lead++) {
    const key = dayKey(addDays(issued, lead));
    out.push({ key, lead, ...forecastDay(days[key], lead, options) });
  }
  return { issued: dayKey(issued), days: out };
}

/** The latest date on or before `date` that falls on `weekday` (0 = Sunday). */
export function lastWeekday(date, weekday) {
  const n = dayNumber(date);
  const wd = ((n % 7) + 7 + 4) % 7; // 1970-01-01 was a Thursday
  return fromDayNumber(n - ((wd - weekday + 7) % 7));
}

/** "YYYY-MM-DD" back to a date. */
export function parseKey(key) {
  const [year, month, day] = String(key).split("-").map(Number);
  return { year, month, day };
}
