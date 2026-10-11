import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SEASONS, CONDITIONS, STRANGE_KEYS, RED_ERA, seasonOf, planWeather, forecastDay, forecastWeek, accuracy, lastWeekday, parseKey, toC, bandOf
} from "../scripts/calendar/weather-data.js";
import { weekday } from "../scripts/calendar/cal-dates.js";

/** A repeatable random source. */
function seeded(seed = 1) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
/** A random source that returns these values in turn (die n gets value v → 1 + floor(v*n)). */
const fixed = (...values) => {
  let i = 0;
  return () => values[i++ % values.length];
};
const face = (n, sides) => (n - 0.5) / sides; // the value that rolls n on a d(sides)

test("the DLC's seasonal tables, by month", () => {
  assert.deepEqual([12, 1, 2, 3, 5, 6, 8, 9, 11].map(seasonOf), ["winter", "winter", "winter", "spring", "spring", "summer", "summer", "autumn", "autumn"]);
  assert.deepEqual(SEASONS.winter.temps[0], ["cold", 35]);
  assert.deepEqual(SEASONS.summer.temps[5], ["hot", 90]);
  assert.deepEqual(SEASONS.autumn.temps[0], ["cool", 40]);
  for (const s of Object.values(SEASONS)) {
    assert.equal(s.temps.length, 6);
    assert.equal(s.conds[5], "strange", "a 6 on Current Conditions goes to Strange Weather");
  }
  assert.equal(STRANGE_KEYS.length, 11, "ten entries, one of them Cold Snap or Heat Wave");
  assert.equal(toC(50), 10);
  assert.equal(toC(35), 2);
});

test("a plain day: temperature and sky from the season's table", () => {
  // Temperature 4 (Cool 50), conditions 3 (Overcast) in January.
  const days = planWeather({ year: 2045, month: 1, day: 10 }, 1, { rng: fixed(face(4, 6), face(3, 6)) });
  assert.deepEqual(days["2045-01-10"], { band: "cool", f: 50, cond: "overcast", strange: null, event: null });
});

test("a 6 goes to Strange Weather: short events get a start time and minutes", () => {
  // Temp 1 (Cold 35), conditions 6 → strange d10 = 5 (Acid Rain), sky reroll 1 (Clear), duration 3 → 3 hours, start.
  const days = planWeather({ year: 2045, month: 1, day: 10 }, 1, { rng: fixed(face(1, 6), face(6, 6), face(5, 10), face(1, 6), face(3, 6), 0.5) });
  const day = days["2045-01-10"];
  assert.equal(day.cond, "clear");
  assert.equal(day.strange.key, "acidRain");
  assert.equal(day.strange.minutes, 180);
  assert.equal(day.strange.start % 5, 0);
});

test("entry 8 is a Cold Snap when it's cold, a Heat Wave when it's hot, and it sets the temperature", () => {
  const cold = planWeather({ year: 2045, month: 1, day: 1 }, 1, { rng: fixed(face(1, 6), face(6, 6), face(8, 10), face(2, 6), face(2, 6), 0) })["2045-01-01"];
  assert.equal(cold.event.key, "coldSnap");
  assert.equal(cold.band, "freezing");
  assert.ok(cold.f < 32);
  const hot = planWeather({ year: 2045, month: 7, day: 1 }, 1, { rng: fixed(face(6, 6), face(6, 6), face(8, 10), face(2, 6), face(2, 6), 0.99) })["2045-07-01"];
  assert.equal(hot.event.key, "heatWave");
  assert.ok(hot.f >= 100);
});

test("multi-day events run on across the days, with no new strange weather on top", () => {
  // Day 1: Flooding for 4 days; then the following days carry it.
  const values = [face(3, 6), face(6, 6), face(3, 10), face(2, 6), face(4, 6)];
  const rng = (() => { let i = 0; const r = seeded(7); return () => (i < values.length ? values[i++] : r()); })();
  const days = planWeather({ year: 2045, month: 1, day: 30 }, 6, { rng });
  const keys = Object.keys(days);
  assert.deepEqual(keys.slice(0, 3), ["2045-01-30", "2045-01-31", "2045-02-01"], "crosses the month");
  const events = keys.map((k) => days[k].event);
  assert.deepEqual(events.slice(0, 4).map((e) => [e.key, e.day, e.of]), [["flooding", 1, 4], ["flooding", 2, 4], ["flooding", 3, 4], ["flooding", 4, 4]]);
  assert.ok(events.slice(0, 4).every((e) => e.id === "2045-01-30-flooding"));
  assert.ok(days[keys[1]].strange === null && days[keys[2]].strange === null);
  assert.ok(STRANGE_KEYS.length && days[keys[0]].cond, "flooded days still have a sky");
});

test("an event carries on from the day before a new plan", () => {
  const before = { band: "cool", f: 50, cond: "overcast", strange: null, event: { key: "inversionSmog", id: "x", day: 2, of: 4 } };
  const days = planWeather({ year: 2045, month: 3, day: 5 }, 3, { rng: seeded(3), before });
  assert.deepEqual(Object.values(days).slice(0, 2).map((d) => d.event?.day), [3, 4]);
});

test("turned-off conditions are never planned; the 2070s preset drops the Red-era weather", () => {
  assert.deepEqual(RED_ERA, ["radioactiveWindstorm", "bloodRain"]);
  const off = [...RED_ERA, "clear", "flooding"];
  const days = planWeather({ year: 2045, month: 1, day: 1 }, 1500, { rng: seeded(11), off });
  const seen = new Set();
  for (const d of Object.values(days)) {
    seen.add(d.cond);
    if (d.strange) seen.add(d.strange.key);
    if (d.event) seen.add(d.event.key);
  }
  for (const k of off) assert.ok(!seen.has(k), `${k} was planned`);
  assert.ok(seen.has("acidRain") && seen.has("overcast"));
});

test("with every strange condition off, a 6 just rerolls the sky", () => {
  const days = planWeather({ year: 2045, month: 6, day: 1 }, 400, { rng: seeded(5), off: STRANGE_KEYS });
  assert.ok(Object.values(days).every((d) => !d.strange && !d.event && CONDITIONS[d.cond].kind === "standard"));
});

test("strange weather turns up about as often as the tables say", () => {
  const days = Object.values(planWeather({ year: 2045, month: 1, day: 1 }, 3650, { rng: seeded(21) }));
  const starts = days.filter((d) => d.strange || d.event?.day === 1).length;
  const free = days.filter((d) => !d.event || d.event.day === 1).length;
  const rate = starts / free;
  assert.ok(rate > 0.12 && rate < 0.22, `1 in 6 expected, got ${rate.toFixed(3)}`);
});

test("forecasts are right tomorrow, shakier a week out, and never call a blackout", () => {
  assert.ok(accuracy(1) > 0.9 && accuracy(7) < 0.55);
  const actual = { band: "warm", f: 70, cond: "clear", strange: null, event: null };
  const right = (lead) => {
    const rng = seeded(lead * 13);
    let hits = 0;
    for (let i = 0; i < 2000; i++) if (forecastDay(actual, lead, { rng }).cond === "clear") hits++;
    return hits / 2000;
  };
  assert.ok(right(1) > 0.85, `tomorrow ${right(1)}`);
  assert.ok(right(7) < 0.65, `a week out ${right(7)}`);
  const f = forecastDay(actual, 3, { rng: seeded(2) });
  assert.ok(f.lo <= f.hi && f.hi - f.lo === 10 && f.lo % 5 === 0);
  const blackout = forecastDay({ ...actual, event: { key: "blackout", id: "b", day: 1, of: 3 } }, 1, { rng: seeded(2) });
  assert.equal(blackout.event, null);
});

test("obvious multi-day storms are called; short ones are risks", () => {
  const smog = forecastDay({ band: "cool", f: 50, cond: "overcast", strange: null, event: { key: "inversionSmog", id: "s", day: 2, of: 5 } }, 6, { rng: seeded(4) });
  assert.equal(smog.event.key, "inversionSmog");
  const wave = forecastDay({ band: "scorching", f: 105, cond: "clear", strange: null, event: { key: "heatWave", id: "h", day: 1, of: 3 } }, 5, { rng: seeded(4) });
  assert.equal(wave.band, "scorching");
  let warned = 0;
  const rng = seeded(9);
  for (let i = 0; i < 1000; i++) {
    const f = forecastDay({ band: "cool", f: 50, cond: "overcast", strange: { key: "acidRain", start: 600, minutes: 120 }, event: null }, 2, { rng });
    if (f.risks.some((r) => r.key === "acidRain")) warned++;
  }
  assert.ok(warned > 550 && warned < 900, `acid rain warned ${warned}/1000`);
  const alarms = { rng: seeded(10), off: ["acidRain"] };
  for (let i = 0; i < 500; i++) assert.ok(!forecastDay({ band: "cool", f: 50, cond: "clear", strange: null, event: null }, 3, alarms).risks.some((r) => r.key === "acidRain"), "no false alarms for turned-off weather");
});

test("a week's forecast covers the seven days after it's issued", () => {
  const days = planWeather({ year: 2045, month: 11, day: 1 }, 30, { rng: seeded(8) });
  const week = forecastWeek({ year: 2045, month: 11, day: 10 }, days, { rng: seeded(8) });
  assert.equal(week.issued, "2045-11-10");
  assert.deepEqual(week.days.map((d) => d.key), ["2045-11-11", "2045-11-12", "2045-11-13", "2045-11-14", "2045-11-15", "2045-11-16", "2045-11-17"]);
  assert.deepEqual(week.days.map((d) => d.lead), [1, 2, 3, 4, 5, 6, 7]);
  const empty = forecastWeek({ year: 2046, month: 6, day: 1 }, days);
  assert.ok(empty.days.every((d) => d.unknown));
});

test("the latest forecast day on or before a date", () => {
  const d = { year: 2045, month: 11, day: 15 }; // a Wednesday
  assert.equal(weekday(d), 3);
  assert.deepEqual(lastWeekday(d, 1), { year: 2045, month: 11, day: 13 });
  assert.deepEqual(lastWeekday(d, 3), d);
  assert.deepEqual(lastWeekday(d, 4), { year: 2045, month: 11, day: 9 });
  assert.deepEqual(parseKey("2045-02-03"), { year: 2045, month: 2, day: 3 });
  assert.equal(bandOf(28), "freezing");
  assert.equal(bandOf(105), "scorching");
});
