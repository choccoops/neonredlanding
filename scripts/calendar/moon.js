/**
 * The real Moon, for any Gregorian date.
 *
 * Principal phases (new, first quarter, full, last quarter) use the full "true phase"
 * method of Jean Meeus, Astronomical Algorithms (2nd ed.), chapter 49: mean phase plus
 * every periodic and planetary correction, good to a minute or two for centuries either
 * side of 2000. Illuminated fraction uses chapter 48's low-precision phase angle
 * (about 1%). Terrestrial Time is converted to UT with the Espenak–Meeus ΔT polynomials.
 *
 * Days are taken in a time zone (Night City: America/Los_Angeles) so a full moon at
 * 03:00 UTC lands on the evening before, as it would for someone in Night City.
 * Pure: no Foundry calls.
 */

const DAY_MS = 86_400_000;
const RAD = Math.PI / 180;
const SYNODIC = 29.530588861;
const JD_UNIX = 2440587.5;

export const PHASES = ["new", "waxingCrescent", "firstQuarter", "waxingGibbous", "full", "waningGibbous", "lastQuarter", "waningCrescent"];
/** Principal phases by quarter offset (k + 0, .25, .5, .75). */
const PRINCIPAL = ["new", "firstQuarter", "full", "lastQuarter"];

const sin = (deg) => Math.sin(deg * RAD);
const cos = (deg) => Math.cos(deg * RAD);

export const jdFromMs = (ms) => ms / DAY_MS + JD_UNIX;
export const msFromJd = (jd) => (jd - JD_UNIX) * DAY_MS;

/** ΔT = TT − UT in seconds (Espenak & Meeus, NASA eclipse polynomials). */
export function deltaT(year) {
  const y = year;
  if (y >= 2005 && y < 2050) {
    const t = y - 2000;
    return 62.92 + 0.32217 * t + 0.005589 * t * t;
  }
  if (y >= 2050 && y < 2150) {
    const u = (y - 1820) / 100;
    return -20 + 32 * u * u - 0.5628 * (2150 - y);
  }
  if (y >= 1986 && y < 2005) {
    const t = y - 2000;
    return 63.86 + 0.3345 * t - 0.060374 * t ** 2 + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5;
  }
  if (y >= 1961 && y < 1986) {
    const t = y - 1975;
    return 45.45 + 1.067 * t - t * t / 260 - t ** 3 / 718;
  }
  if (y >= 1941 && y < 1961) {
    const t = y - 1950;
    return 29.07 + 0.407 * t - t * t / 233 + t ** 3 / 2547;
  }
  const u = (y - 1820) / 100;
  return -20 + 32 * u * u;
}

/**
 * Julian Ephemeris Day of a principal phase.
 * @param {number} k - lunation number; integer for new moon, +0.25 first quarter, +0.5 full, +0.75 last quarter
 */
export function truePhaseJDE(k) {
  const T = k / 1236.85;
  const T2 = T * T, T3 = T2 * T, T4 = T3 * T;
  let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T2 - 0.00000015 * T3 + 0.00000000073 * T4;

  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const M = 2.5534 + 29.1053567 * k - 0.0000014 * T2 - 0.00000011 * T3;
  const Mp = 201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4;
  const F = 160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4;
  const O = 124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3;

  const frac = Math.round((k - Math.floor(k)) * 4) % 4;
  let c;
  if (frac === 0 || frac === 2) {
    const full = frac === 2;
    c = (full ? -0.40614 : -0.4072) * sin(Mp)
      + (full ? 0.17302 : 0.17241) * E * sin(M)
      + (full ? 0.01614 : 0.01608) * sin(2 * Mp)
      + (full ? 0.01043 : 0.01039) * sin(2 * F)
      + (full ? 0.00734 : 0.00739) * E * sin(Mp - M)
      + (full ? -0.00515 : -0.00514) * E * sin(Mp + M)
      + (full ? 0.00209 : 0.00208) * E * E * sin(2 * M)
      - 0.00111 * sin(Mp - 2 * F)
      - 0.00057 * sin(Mp + 2 * F)
      + 0.00056 * E * sin(2 * Mp + M)
      - 0.00042 * sin(3 * Mp)
      + 0.00042 * E * sin(M + 2 * F)
      + 0.00038 * E * sin(M - 2 * F)
      - 0.00024 * E * sin(2 * Mp - M)
      - 0.00017 * sin(O)
      - 0.00007 * sin(Mp + 2 * M)
      + 0.00004 * sin(2 * Mp - 2 * F)
      + 0.00004 * sin(3 * M)
      + 0.00003 * sin(Mp + M - 2 * F)
      + 0.00003 * sin(2 * Mp + 2 * F)
      - 0.00003 * sin(Mp + M + 2 * F)
      + 0.00003 * sin(Mp - M + 2 * F)
      - 0.00002 * sin(Mp - M - 2 * F)
      - 0.00002 * sin(3 * Mp + M)
      + 0.00002 * sin(4 * Mp);
  } else {
    c = -0.62801 * sin(Mp)
      + 0.17172 * E * sin(M)
      - 0.01183 * E * sin(Mp + M)
      + 0.00862 * sin(2 * Mp)
      + 0.00804 * sin(2 * F)
      + 0.00454 * E * sin(Mp - M)
      + 0.00204 * E * E * sin(2 * M)
      - 0.0018 * sin(Mp - 2 * F)
      - 0.0007 * sin(Mp + 2 * F)
      - 0.0004 * sin(3 * Mp)
      - 0.00034 * E * sin(2 * Mp - M)
      + 0.00032 * E * sin(M + 2 * F)
      + 0.00032 * E * sin(M - 2 * F)
      - 0.00028 * E * E * sin(Mp + 2 * M)
      + 0.00027 * E * sin(2 * Mp + M)
      - 0.00017 * sin(O)
      - 0.00005 * sin(Mp - M - 2 * F)
      + 0.00004 * sin(2 * Mp + 2 * F)
      - 0.00004 * sin(Mp + M + 2 * F)
      + 0.00004 * sin(Mp - 2 * M)
      + 0.00003 * sin(Mp + M - 2 * F)
      + 0.00003 * sin(3 * M)
      + 0.00002 * sin(2 * Mp - 2 * F)
      + 0.00002 * sin(Mp - M + 2 * F)
      - 0.00002 * sin(3 * Mp + M);
    const W = 0.00306 - 0.00038 * E * cos(M) + 0.00026 * cos(Mp) - 0.00002 * cos(Mp - M) + 0.00002 * cos(Mp + M) + 0.00002 * cos(2 * F);
    c += frac === 1 ? W : -W;
  }

  // Planetary arguments (same for every phase).
  const A = [
    [299.77 + 0.107408 * k - 0.009173 * T2, 0.000325],
    [251.88 + 0.016321 * k, 0.000165],
    [251.83 + 26.651886 * k, 0.000164],
    [349.42 + 36.412478 * k, 0.000126],
    [84.66 + 18.206239 * k, 0.00011],
    [141.74 + 53.303771 * k, 0.000062],
    [207.14 + 2.453732 * k, 0.00006],
    [154.84 + 7.30686 * k, 0.000056],
    [34.52 + 27.261239 * k, 0.000047],
    [207.19 + 0.121824 * k, 0.000042],
    [291.34 + 1.844379 * k, 0.00004],
    [161.72 + 24.198154 * k, 0.000037],
    [239.56 + 25.513099 * k, 0.000035],
    [331.55 + 3.592518 * k, 0.000023]
  ];
  const planetary = A.reduce((sum, [arg, coef]) => sum + coef * sin(arg), 0);
  return jde + c + planetary;
}

/** UTC milliseconds of a principal phase. */
export function phaseInstant(k) {
  const jde = truePhaseJDE(k);
  const approxYear = 2000 + k / 12.3685;
  return msFromJd(jde - deltaT(approxYear) / 86400);
}

/** Every principal phase between two instants, in order: [{ type, ms }]. */
export function phaseEvents(startMs, endMs) {
  const startJd = jdFromMs(startMs);
  let k = Math.floor((startJd - 2451550.09766) / SYNODIC) - 1;
  const out = [];
  for (; ; k++) {
    for (let q = 0; q < 4; q++) {
      const ms = phaseInstant(k + q / 4);
      if (ms > endMs) return out;
      if (ms >= startMs) out.push({ type: PRINCIPAL[q], ms });
    }
  }
}

/**
 * Illuminated fraction of the Moon's disk at an instant (Meeus ch. 48, low precision).
 * @returns {{ fraction: number, waxing: boolean }}
 */
export function illumination(ms) {
  const T = (jdFromMs(ms) + deltaT(new Date(ms).getUTCFullYear()) / 86400 - 2451545) / 36525;
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T + T ** 3 / 545868 - T ** 4 / 113065000;
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T + T ** 3 / 24490000;
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T + T ** 3 / 69699 - T ** 4 / 14712000;
  const i = 180 - D - 6.289 * sin(Mp) + 2.1 * sin(M) - 1.274 * sin(2 * D - Mp) - 0.658 * sin(2 * D) - 0.214 * sin(2 * Mp) - 0.11 * sin(D);
  const fraction = (1 + cos(i)) / 2;
  const elongation = ((D % 360) + 360) % 360;
  return { fraction, waxing: elongation < 180 };
}

/* ------------------------------------------ */
/*  Time zones                                */
/* ------------------------------------------ */

const formatters = new Map();
function formatter(tz) {
  if (!formatters.has(tz)) {
    formatters.set(tz, new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric"
    }));
  }
  return formatters.get(tz);
}

export function validTimeZone(tz) {
  try {
    formatter(tz);
    return true;
  } catch {
    return false;
  }
}

/** How far a time zone's wall clock is ahead of UTC at an instant, in ms. */
export function tzOffset(ms, tz) {
  const parts = Object.fromEntries(formatter(tz).formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  const wall = new Date(0);
  wall.setUTCFullYear(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  wall.setUTCHours(Number(parts.hour), Number(parts.minute), Number(parts.second), 0);
  return wall.getTime() - (ms - (ms % 1000 + 1000) % 1000);
}

/** UTC instant of local midnight starting a calendar date in a time zone. */
export function localMidnight(date, tz) {
  const d = new Date(0);
  d.setUTCFullYear(date.year, date.month - 1, date.day);
  const naive = d.getTime();
  let guess = naive - tzOffset(naive, tz);
  guess = naive - tzOffset(guess, tz);
  return guess;
}

/** Wall-clock { year, month, day, hour, minute } of an instant in a time zone. */
export function localParts(ms, tz) {
  const p = Object.fromEntries(formatter(tz).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { year: Number(p.year), month: Number(p.month), day: Number(p.day), hour: Number(p.hour), minute: Number(p.minute) };
}

/* ------------------------------------------ */
/*  Days                                      */
/* ------------------------------------------ */

/**
 * The Moon on each of a run of consecutive dates.
 * @param {object[]} dates - consecutive { year, month, day }
 * @param {string} tz - IANA time zone the days are reckoned in
 * @returns {object[]} per date: { phase, fraction, waxing, event: { type, ms, hour, minute } | null }
 */
export function moonDays(dates, tz = "UTC") {
  if (!dates.length) return [];
  const starts = dates.map((d) => localMidnight(d, tz));
  const last = dates.at(-1);
  const lastEnd = localMidnight(nextDate(last), tz);
  const events = phaseEvents(starts[0] - 9 * DAY_MS, lastEnd + DAY_MS);
  return dates.map((date, i) => {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : lastEnd;
    const event = events.find((e) => e.ms >= start && e.ms < end) ?? null;
    const noon = start + (end - start) / 2;
    const { fraction, waxing } = illumination(event ? event.ms : noon);
    let phase;
    if (event) phase = event.type;
    else {
      const before = [...events].reverse().find((e) => e.ms < start);
      phase = { new: "waxingCrescent", firstQuarter: "waxingGibbous", full: "waningGibbous", lastQuarter: "waningCrescent" }[before?.type ?? "new"];
    }
    return {
      phase,
      fraction,
      waxing: event ? event.type === "new" || event.type === "firstQuarter" : phase.startsWith("waxing"),
      event: event ? { type: event.type, ms: event.ms, ...pick(localParts(event.ms, tz)) } : null
    };
  });
}

function pick({ hour, minute }) {
  return { hour, minute };
}

function nextDate(date) {
  const d = new Date(0);
  d.setUTCFullYear(date.year, date.month - 1, date.day + 1);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/**
 * SVG path for the lit part of a Moon of radius r centred on 0,0, as seen from the
 * northern hemisphere (waxing lit on the right).
 */
export function litPath(fraction, waxing, r = 10) {
  const f = Math.min(1, Math.max(0, fraction));
  const rx = Math.abs(1 - 2 * f) * r;
  const limb = waxing ? 1 : 0;
  const term = waxing ? (f < 0.5 ? 0 : 1) : (f < 0.5 ? 1 : 0);
  const n = (x) => Math.round(x * 100) / 100;
  return `M0 ${-r} A${r} ${r} 0 0 ${limb} 0 ${r} A${n(rx)} ${r} 0 0 ${term} 0 ${-r}Z`;
}
