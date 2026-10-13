/**
 * The sky over a time skip. Plain functions, no Foundry, so they can be tested.
 *
 * Times are minutes from the midnight that starts the skip's first day ("absolute"
 * minutes), so a skip from 21:00 to 03:00 runs from 1260 to 1620.
 *
 * Sun: up between SmallTime's sunrise and sunset (the middle of its dawn and dusk).
 * Moon: rises with the sun at new moon and about 49 minutes later each day of its age
 * (at sunset when full), and sets half a lunar day after it rises. That's the textbook
 * rule of thumb, good to a fraction of an hour; the phase itself is the real one.
 */
export const SYNODIC = 29.530588853;
/** A lunar day: the Moon comes back to the same place in the sky every ~24 h 50 min. */
export const LUNAR_DAY = 1440 * SYNODIC / (SYNODIC - 1);

const mod = (n, m) => ((n % m) + m) % m;
const mid = (a, b) => Math.round((a + b) / 2);

/**
 * The sky model for a skip.
 * @param {object} options - SmallTime's sunriseStart/End and sunsetStart/End (minutes)
 * @param {number} age - the Moon's age in days at absolute minute 0
 */
export function skyModel(options, age) {
  const rise = mid(options.sunriseStart, options.sunriseEnd);
  const set = mid(options.sunsetStart, options.sunsetEnd);
  // Moonrise k falls where the time of day equals sunrise + age/SYNODIC of a day:
  //   t - rise - (age + t/1440) * 1440/SYNODIC = 1440 k
  const base = (rise + (age * 1440) / SYNODIC) / (1 - 1 / SYNODIC);
  return { ...options, sunrise: rise, sunset: set, age, firstMoonrise: mod(base, LUNAR_DAY) - LUNAR_DAY };
}

/** Moonrises (absolute minutes) from before `from` to after `to`. */
function moonrises(model, from, to) {
  const out = [];
  const first = model.firstMoonrise + Math.floor((from - model.firstMoonrise) / LUNAR_DAY) * LUNAR_DAY - LUNAR_DAY;
  for (let t = first; t <= to + LUNAR_DAY; t += LUNAR_DAY) out.push(t);
  return out;
}

/** Sun: { up, arc } where arc runs 0 at sunrise to 1 at sunset. */
export function sunAt(model, t) {
  const tod = mod(t, 1440);
  const up = tod >= model.sunrise && tod < model.sunset;
  return { up, arc: up ? (tod - model.sunrise) / (model.sunset - model.sunrise) : 0 };
}

/** Moon: { up, arc, fraction, waxing } at absolute minute t. */
export function moonAt(model, t) {
  const since = mod(t - model.firstMoonrise, LUNAR_DAY);
  const up = since < LUNAR_DAY / 2;
  const age = mod(model.age + t / 1440, SYNODIC);
  return {
    up,
    arc: up ? since / (LUNAR_DAY / 2) : 0,
    fraction: (1 - Math.cos((2 * Math.PI * age) / SYNODIC)) / 2,
    waxing: age < SYNODIC / 2
  };
}

/**
 * What happens in the sky between two absolute minutes, in order:
 * [{ type: "sunrise"|"sunset"|"moonrise"|"moonset"|"midnight", at }].
 */
export function skyEvents(model, from, to) {
  const events = [];
  const push = (type, at) => {
    if (at > from && at <= to) events.push({ type, at: Math.round(at) });
  };
  for (let day = Math.floor(from / 1440); day <= Math.floor(to / 1440) + 1; day++) {
    push("midnight", day * 1440);
    push("sunrise", day * 1440 + model.sunrise);
    push("sunset", day * 1440 + model.sunset);
  }
  for (const rise of moonrises(model, from, to)) {
    push("moonrise", rise);
    push("moonset", rise + LUNAR_DAY / 2);
  }
  return events.sort((a, b) => a.at - b.at);
}

/** Sky colours at a time of day: { top, bottom, stars } with stars 0 (day) to 1 (night). */
export function skyColors(options, t) {
  const tod = mod(t, 1440);
  const night = { top: [6, 4, 22], bottom: [24, 10, 48] };
  const glow = { top: [40, 22, 70], bottom: [255, 120, 60] };
  const day = { top: [10, 90, 150], bottom: [5, 200, 220] };
  const dusk = { top: [50, 16, 70], bottom: [255, 42, 109] };
  const { sunriseStart: rs, sunriseEnd: re, sunsetStart: ss, sunsetEnd: se } = options;
  let a, b, f;
  if (tod >= rs && tod < re) {
    const half = (rs + re) / 2;
    [a, b, f] = tod < half ? [night, glow, (tod - rs) / (half - rs)] : [glow, day, (tod - half) / (re - half)];
  } else if (tod >= re && tod < ss) [a, b, f] = [day, day, 0];
  else if (tod >= ss && tod < se) {
    const half = (ss + se) / 2;
    [a, b, f] = tod < half ? [day, dusk, (tod - ss) / (half - ss)] : [dusk, night, (tod - half) / (se - half)];
  } else [a, b, f] = [night, night, 0];
  const mix = (x, y) => `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * f)).join(",")})`;
  let stars = 1;
  if (tod >= rs && tod < re) stars = 1 - (tod - rs) / (re - rs);
  else if (tod >= re && tod < ss) stars = 0;
  else if (tod >= ss && tod < se) stars = (tod - ss) / (se - ss);
  return { top: mix(a.top, b.top), bottom: mix(a.bottom, b.bottom), stars };
}

/** The group's call: the median vote (lower middle on a tie), or null without votes. */
export function groupCall(votes) {
  const list = Object.values(votes ?? {}).filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (!list.length) return null;
  return list[Math.floor((list.length - 1) / 2)];
}

/** "+5h 30m", "+45m", "+24h", and past a day "+5d 3h". */
export function skipLabel(minutes) {
  if (minutes > 1440) {
    const d = Math.floor(minutes / 1440);
    const h = Math.floor((minutes % 1440) / 60);
    const m = minutes % 60;
    return `+${d}d${h ? ` ${h}h` : ""}${m ? ` ${m}m` : ""}`;
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `+${h ? `${h}h` : ""}${h && m ? " " : ""}${m || !h ? `${m}m` : ""}`;
}

/** How long the clock takes to wind through a skip on screen, in ms: longer for days of downtime. */
export function windDuration(minutes) {
  if (minutes > 1440) return Math.round(Math.min(20000, 8000 + ((minutes - 1440) / 1440) * 600));
  return Math.round(Math.min(8000, 2400 + (minutes / 60) * 240));
}

/**
 * Where the sky is during a wind of `minutes`, `skip` minutes in. Over three days or more the sky
 * plays the first day, holds still through the middle days while the clock counts them, then plays
 * the last day or two, so it never flickers from day to night. The hold starts and ends at the
 * starting time of day, so it never jumps.
 */
export function skySkip(skip, minutes) {
  const days = Math.floor(minutes / 1440);
  if (days < 3 || skip < 1440 || skip >= (days - 1) * 1440) return skip;
  return 1440;
}

/** The sky events a wind shows: those while the sky moves (see skySkip). */
export function shownEvents(events, start, minutes) {
  return events.filter((e) => skySkip(e.at - start, minutes) === e.at - start);
}
