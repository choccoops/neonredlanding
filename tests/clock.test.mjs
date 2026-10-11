import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DAY_SECONDS, minutesOfDay, daysCrossed, secondsTo, formatTime, parseTime, stepLabel, isDaytime
} from "../scripts/calendar/clock-time.js";

test("time of day from world time, SmallTime's way (midnight at every 86,400 s)", () => {
  assert.equal(minutesOfDay(0), 0);
  assert.equal(minutesOfDay(21 * 3600 + 47 * 60 + 30), 21 * 60 + 47);
  assert.equal(minutesOfDay(3 * DAY_SECONDS + 3600), 60);
  assert.equal(minutesOfDay(-60), 1439, "before world time 0 counts back from midnight");
});

test("midnights crossed, forward and back", () => {
  const evening = 23 * 3600 + 50 * 60;
  assert.equal(daysCrossed(evening, evening + 10 * 60), 1, "23:50 + 10 minutes is the next day");
  assert.equal(daysCrossed(evening, evening + 9 * 60), 0);
  assert.equal(daysCrossed(DAY_SECONDS + 60, DAY_SECONDS - 60), -1, "going back past midnight");
  assert.equal(daysCrossed(0, 3 * DAY_SECONDS), 3);
  assert.equal(daysCrossed(-30, 30), 1);
});

test("setting the time of day stays on the same day", () => {
  const now = 5 * DAY_SECONDS + 22 * 3600;
  assert.equal(secondsTo(now, 6 * 60), -16 * 3600);
  assert.equal(daysCrossed(now, now + secondsTo(now, 6 * 60)), 0);
  assert.equal(secondsTo(now, 23 * 60 + 30), 90 * 60);
  assert.equal(secondsTo(now, 5000), (1439 - 22 * 60) * 60, "clamped to 23:59");
});

test("formatting and parsing times", () => {
  assert.equal(formatTime(0), "00:00");
  assert.equal(formatTime(21 * 60 + 5), "21:05");
  assert.equal(formatTime(0, true), "12:00 AM");
  assert.equal(formatTime(12 * 60 + 30, true), "12:30 PM");
  assert.equal(formatTime(21 * 60 + 5, true), "9:05 PM");
  assert.equal(parseTime("06:30"), 390);
  assert.equal(parseTime("24:00"), null);
  assert.equal(parseTime("noon"), null);
  assert.deepEqual([-60, -10, 10, 240].map(stepLabel), ["−1h", "−10m", "+10m", "+4h"]);
});

test("day and night by SmallTime's default sunrise and sunset", () => {
  assert.equal(isDaytime(12 * 60), true);
  assert.equal(isDaytime(6 * 60), false);
  assert.equal(isDaytime(20 * 60), false);
  assert.equal(isDaytime(8 * 60, { sunriseEnd: 9 * 60, sunsetStart: 17 * 60 }), false);
});

/* ---------- day changes on the calendars ---------- */

let settings;
const shifts = [];
globalThis.foundry = {
  utils: {
    randomID: () => Math.random().toString(36).slice(2, 14),
    deepClone: (o) => structuredClone(o),
    mergeObject: (a, b) => Object.assign(a, b),
    getProperty: (o, k) => k.split(".").reduce((x, p) => x?.[p], o),
    hasProperty: (o, k) => k.split(".").reduce((x, p) => x?.[p], o) !== undefined
  }
};
globalThis.Hooks = { on() {}, once() {}, callAll() {} };
globalThis.game = {
  user: { id: "gm", isGM: true },
  users: { activeGM: { id: "gm" } },
  modules: new Map([["smalltime", { active: true }]]),
  settings: { get: (scope, key) => settings[`${scope}.${key}`], set: async (scope, key, v) => { settings[`${scope}.${key}`] = v; } },
  i18n: { localize: (k) => k, format: (k) => k },
  system: { id: "cyberpunk-red-core" }
};
const { Clock } = await import("../scripts/calendar/clock.js");
const { CalendarOps } = await import("../scripts/calendar/cal-ops.js");
CalendarOps.shift = async (id, amount) => shifts.push([id, amount.days]);

function world(list) {
  settings = { "cpr-neon-hub.calendars": { list }, "cpr-neon-hub.smalltimeMoon": true, "smalltime.moon-phase": 4 };
  shifts.length = 0;
}

test("passing midnight moves every calendar that follows the clock, in order", async () => {
  world([
    { id: "a", name: "Crew", year: 2045, month: 1, day: 1 },
    { id: "b", name: "Flashback", year: 2020, month: 5, day: 5, clock: false },
    { id: "c", name: "Nomads", year: 2045, month: 3, day: 9 }
  ]);
  Clock.onTime(DAY_SECONDS + 300, 600);
  Clock.onTime(3 * DAY_SECONDS + 10, 2 * DAY_SECONDS);
  await Clock.queue;
  assert.deepEqual(shifts, [["a", 1], ["c", 1], ["a", 2], ["c", 2]], "'b' doesn't follow the clock");
});

test("going back past midnight moves them back; no change within a day", async () => {
  world([{ id: "a", name: "Crew", year: 2045, month: 1, day: 1 }]);
  Clock.onTime(DAY_SECONDS - 60, -120);
  Clock.onTime(DAY_SECONDS + 3600, 60);
  await Clock.queue;
  assert.deepEqual(shifts, [["a", -1]]);
});

test("only the active GM moves calendars, and only with SmallTime enabled", async () => {
  world([{ id: "a", name: "Crew", year: 2045, month: 1, day: 1 }]);
  game.users.activeGM = { id: "other-gm" };
  Clock.onTime(DAY_SECONDS + 1, 2);
  game.users.activeGM = { id: "gm" };
  game.modules.get("smalltime").active = false;
  Clock.onTime(DAY_SECONDS + 1, 2);
  game.modules.get("smalltime").active = true;
  await Clock.queue;
  assert.deepEqual(shifts, []);
});

test("SmallTime's moon follows the real Moon on the first following calendar", async () => {
  // 2024-01-11 was a new moon; 2024-01-25 a full moon.
  world([
    { id: "b", name: "Flashback", year: 2024, month: 1, day: 25, clock: false },
    { id: "a", name: "Crew", year: 2024, month: 1, day: 11 }
  ]);
  await Clock.syncMoon();
  assert.equal(settings["smalltime.moon-phase"], 0, "new moon on the Crew's date");
  settings["cpr-neon-hub.smalltimeMoon"] = false;
  settings["cpr-neon-hub.calendars"].list[1].day = 25;
  await Clock.syncMoon();
  assert.equal(settings["smalltime.moon-phase"], 0, "left alone when the setting is off");
});
