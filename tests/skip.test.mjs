import { test } from "node:test";
import assert from "node:assert/strict";
import { skyModel, sunAt, moonAt, skyEvents, skyColors, groupCall, skipLabel, windDuration, SYNODIC, LUNAR_DAY } from "../scripts/calendar/skip-sky.js";

const ST = { sunriseStart: 180, sunriseEnd: 420, sunsetStart: 1050, sunsetEnd: 1320 };
const near = (a, b, tol = 2) => Math.abs(a - b) <= tol;

test("the sun is up between SmallTime's sunrise and sunset", () => {
  const sky = skyModel(ST, 0);
  assert.equal(sky.sunrise, 300);
  assert.equal(sky.sunset, 1185);
  assert.equal(sunAt(sky, 299).up, false);
  assert.equal(sunAt(sky, 300).up, true);
  assert.ok(near(sunAt(sky, 742).arc, 0.5, 0.01), "high in the sky at midday");
  assert.equal(sunAt(sky, 1440 + 600).up, true, "and again the next day");
});

test("the moon rises with the sun when new and at sunset when full", () => {
  const fresh = skyModel(ST, 0);
  const [rise] = skyEvents(fresh, 0, 1440).filter((e) => e.type === "moonrise");
  // By sunrise the new moon is already 5 hours older, so it rises ~10 minutes after.
  assert.ok(near(rise.at, 300, 12), `new moon rises at sunrise, got ${rise.at}`);
  assert.ok(moonAt(fresh, 300).fraction < 0.01);
  const full = skyModel(ST, SYNODIC / 2);
  const [fullRise] = skyEvents(full, 0, 1440).filter((e) => e.type === "moonrise");
  // It ages most of a day before rising, so it comes up ~35 minutes after the 12 hours.
  assert.ok(near(fullRise.at, 300 + 720, 45), `full moon rises about 12 h later, got ${fullRise.at}`);
  assert.ok(moonAt(full, fullRise.at + 60).fraction > 0.99);
  assert.equal(moonAt(full, fullRise.at + 60).up, true);
});

test("moonrise comes about 50 minutes later each day, and sets half a lunar day after", () => {
  const sky = skyModel(ST, 8);
  const rises = skyEvents(sky, 0, 4 * 1440).filter((e) => e.type === "moonrise").map((e) => e.at);
  assert.ok(rises.length >= 3);
  for (let i = 1; i < rises.length; i++) assert.ok(near(rises[i] - rises[i - 1], LUNAR_DAY, 1));
  const sets = skyEvents(sky, 0, 4 * 1440).filter((e) => e.type === "moonset").map((e) => e.at);
  assert.ok(sets.some((s) => rises.some((r) => near(s - r, LUNAR_DAY / 2, 1))));
});

test("events in a skip, in order, with the midnight", () => {
  const sky = skyModel(ST, 3);
  const events = skyEvents(sky, 21 * 60, 30 * 60);
  assert.deepEqual(events.map((e) => e.type).filter((t) => t !== "moonrise" && t !== "moonset"), ["midnight", "sunrise"]);
  for (let i = 1; i < events.length; i++) assert.ok(events[i].at >= events[i - 1].at);
  assert.ok(events.every((e) => e.at > 21 * 60 && e.at <= 30 * 60));
});

test("sky colours: stars at night, none by day, fading through dawn", () => {
  assert.equal(skyColors(ST, 60).stars, 1);
  assert.equal(skyColors(ST, 720).stars, 0);
  assert.ok(near(skyColors(ST, 300).stars, 0.5, 0.01));
  assert.notEqual(skyColors(ST, 720).top, skyColors(ST, 60).top);
});

test("the group's call is the median vote", () => {
  assert.equal(groupCall({}), null);
  assert.equal(groupCall({ a: 60 }), 60);
  assert.equal(groupCall({ a: 60, b: 480, c: 120 }), 120);
  assert.equal(groupCall({ a: 60, b: 480, c: 120, d: 1440 }), 120, "lower middle on a tie");
  assert.equal(groupCall({ a: 0, b: NaN, c: 90 }), 90);
});

test("labels and wind time", () => {
  assert.deepEqual([330, 45, 1440, 60].map(skipLabel), ["+5h 30m", "+45m", "+24h", "+1h"]);
  assert.equal(windDuration(0), 2400);
  assert.equal(windDuration(1440), 8000);
  assert.ok(windDuration(300) > windDuration(60));
});
