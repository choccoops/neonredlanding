import { test } from "node:test";
import assert from "node:assert/strict";
import {
  daysInMonth, weekday, dayOfYear, addDays, addMonths, clampDate, daysBetween, rentDayIn, periodOf,
  periodMonth, periodStart, nextRentDay, rentDaysCrossed
} from "../scripts/calendar/cal-dates.js";
import { truePhaseJDE, phaseEvents, illumination, moonDays, litPath, localMidnight, tzOffset } from "../scripts/calendar/moon.js";

const MIN = 60_000;
const utc = (s) => Date.parse(s);
const near = (ms, iso, tolMin, label) => {
  const diff = Math.abs(ms - utc(iso)) / MIN;
  assert.ok(diff <= tolMin, `${label}: off by ${diff.toFixed(1)} min (got ${new Date(ms).toISOString()}, want ${iso})`);
};

/* ---------------- dates ---------------- */

test("Gregorian basics, including leap years and 2045", () => {
  assert.equal(daysInMonth(2044, 2), 29);
  assert.equal(daysInMonth(2045, 2), 28);
  assert.equal(daysInMonth(2100, 2), 28);
  assert.equal(weekday({ year: 2045, month: 1, day: 1 }), 0, "1 Jan 2045 is a Sunday");
  assert.equal(weekday({ year: 2026, month: 10, day: 10 }), 6, "10 Oct 2026 is a Saturday");
  assert.equal(dayOfYear({ year: 2045, month: 12, day: 31 }), 365);
  assert.deepEqual(clampDate({ year: 2045, month: 2, day: 31 }), { year: 2045, month: 2, day: 28 });
  assert.deepEqual(clampDate({ year: 45, month: 1, day: 1 }), { year: 45, month: 1, day: 1 }, "year 45 is not 1945");
});

test("adding days and months", () => {
  assert.deepEqual(addDays({ year: 2045, month: 12, day: 31 }, 1), { year: 2046, month: 1, day: 1 });
  assert.deepEqual(addDays({ year: 2045, month: 3, day: 1 }, -1), { year: 2045, month: 2, day: 28 });
  assert.deepEqual(addMonths({ year: 2045, month: 1, day: 31 }, 1), { year: 2045, month: 2, day: 28 });
  assert.deepEqual(addMonths({ year: 2045, month: 1, day: 15 }, -1), { year: 2044, month: 12, day: 15 });
  assert.equal(daysBetween({ year: 2045, month: 1, day: 1 }, { year: 2046, month: 1, day: 1 }), 365);
});

test("rent periods start on the rent day", () => {
  assert.equal(rentDayIn(2045, 2, 31), 28, "rent on the 31st falls on the last day of February");
  const nov1 = 2045 * 12 + 10;
  assert.equal(periodOf({ year: 2045, month: 11, day: 1 }, 1), nov1);
  assert.equal(periodOf({ year: 2045, month: 11, day: 30 }, 1), nov1);
  assert.equal(periodOf({ year: 2045, month: 11, day: 14 }, 15), nov1 - 1, "before the 15th it's still October's rent month");
  assert.equal(periodOf({ year: 2045, month: 11, day: 15 }, 15), nov1);
  assert.deepEqual(periodMonth(nov1), { year: 2045, month: 11 });
  assert.deepEqual(periodStart(nov1, 31), { year: 2045, month: 11, day: 30 });
});

test("rent day countdown", () => {
  assert.deepEqual(nextRentDay({ year: 2045, month: 10, day: 27 }, 1), { date: { year: 2045, month: 11, day: 1 }, days: 5, today: false });
  const today = nextRentDay({ year: 2045, month: 11, day: 1 }, 1);
  assert.equal(today.today, true);
  assert.deepEqual(today.date, { year: 2045, month: 12, day: 1 });
  assert.equal(nextRentDay({ year: 2045, month: 12, day: 20 }, 1).days, 12, "across the new year");
  assert.deepEqual(nextRentDay({ year: 2045, month: 1, day: 31 }, 31).date, { year: 2045, month: 2, day: 28 });
});

test("rent days crossed by moving the date", () => {
  assert.equal(rentDaysCrossed({ year: 2045, month: 10, day: 30 }, { year: 2045, month: 11, day: 1 }, 1), 1);
  assert.equal(rentDaysCrossed({ year: 2045, month: 11, day: 1 }, { year: 2045, month: 11, day: 29 }, 1), 0);
  assert.equal(rentDaysCrossed({ year: 2045, month: 10, day: 15 }, { year: 2046, month: 1, day: 20 }, 1), 3);
  assert.equal(rentDaysCrossed({ year: 2045, month: 12, day: 5 }, { year: 2045, month: 10, day: 5 }, 1), 0, "going back doesn't refund");
});

/* ---------------- moon ---------------- */

test("Meeus example 49.a: new moon of 1977 Feb 18", () => {
  // JDE 2443192.65118 = 1977 Feb 18, 3h37m42s TD
  assert.ok(Math.abs(truePhaseJDE(-283) - 2443192.65118) < 0.00002);
});

test("principal phases match the real Moon", () => {
  const events = phaseEvents(utc("2024-01-01T00:00:00Z"), utc("2046-01-01T00:00:00Z"));
  const find = (type, iso) => events.reduce((best, e) => (e.type === type && (!best || Math.abs(e.ms - utc(iso)) < Math.abs(best.ms - utc(iso))) ? e : best), null);
  // Published times (USNO / timeanddate), UTC.
  near(find("new", "2024-01-11T11:57Z").ms, "2024-01-11T11:57Z", 3, "new moon Jan 2024");
  near(find("firstQuarter", "2024-01-18T03:52Z").ms, "2024-01-18T03:52Z", 3, "first quarter Jan 2024");
  near(find("full", "2024-01-25T17:54Z").ms, "2024-01-25T17:54Z", 3, "full moon Jan 2024");
  near(find("lastQuarter", "2024-02-02T23:18Z").ms, "2024-02-02T23:18Z", 3, "last quarter Feb 2024");
  near(find("new", "2024-04-08T18:21Z").ms, "2024-04-08T18:21Z", 3, "new moon of the 8 Apr 2024 total solar eclipse");
  near(find("full", "2025-03-14T06:55Z").ms, "2025-03-14T06:55Z", 3, "full moon of the 14 Mar 2025 total lunar eclipse");
  near(find("full", "2025-09-07T18:09Z").ms, "2025-09-07T18:09Z", 3, "full moon of the 7 Sep 2025 total lunar eclipse");
  near(find("new", "2045-08-12T17:42Z").ms, "2045-08-12T17:42Z", 30, "new moon of the 12 Aug 2045 total solar eclipse");
});

test("phases come in order, about a week apart", () => {
  const events = phaseEvents(utc("2045-01-01T00:00:00Z"), utc("2046-01-01T00:00:00Z"));
  const order = ["new", "firstQuarter", "full", "lastQuarter"];
  for (let i = 1; i < events.length; i++) {
    assert.equal(order.indexOf(events[i].type), (order.indexOf(events[i - 1].type) + 1) % 4);
    const gap = (events[i].ms - events[i - 1].ms) / 86_400_000;
    assert.ok(gap > 6.4 && gap < 8.4, `gap ${gap}`);
  }
  assert.ok(events.filter((e) => e.type === "full").length >= 12);
});

test("illumination: dark at new, lit at full, half at quarters", () => {
  const events = phaseEvents(utc("2045-03-01T00:00:00Z"), utc("2045-04-15T00:00:00Z"));
  for (const e of events) {
    const { fraction } = illumination(e.ms);
    if (e.type === "new") assert.ok(fraction < 0.01, `new ${fraction}`);
    if (e.type === "full") assert.ok(fraction > 0.99, `full ${fraction}`);
    if (e.type === "firstQuarter" || e.type === "lastQuarter") assert.ok(Math.abs(fraction - 0.5) < 0.03, `${e.type} ${fraction}`);
  }
});

test("time zones put events on the Night City date", () => {
  // Full moon 2025-03-14 06:55 UTC is 23:55 on 13 March in Los Angeles (PDT, UTC-7).
  assert.equal(tzOffset(utc("2025-03-14T06:55:00Z"), "America/Los_Angeles"), -7 * 3_600_000);
  assert.equal(localMidnight({ year: 2025, month: 3, day: 13 }, "America/Los_Angeles"), utc("2025-03-13T07:00:00Z"));
  const days = moonDays([{ year: 2025, month: 3, day: 13 }, { year: 2025, month: 3, day: 14 }], "America/Los_Angeles");
  assert.equal(days[0].phase, "full");
  assert.equal(days[0].event.hour, 23);
  assert.equal(days[1].phase, "waningGibbous");
  const utcDays = moonDays([{ year: 2025, month: 3, day: 13 }, { year: 2025, month: 3, day: 14 }], "UTC");
  assert.equal(utcDays[1].phase, "full", "in UTC the same full moon is on the 14th");
});

test("a month of moon days names every day and marks four principal phases", () => {
  const dates = Array.from({ length: 30 }, (_, i) => ({ year: 2045, month: 11, day: i + 1 }));
  const days = moonDays(dates, "America/Los_Angeles");
  assert.equal(days.length, 30);
  const principal = days.filter((d) => d.event);
  assert.ok(principal.length >= 3 && principal.length <= 5);
  assert.ok(days.every((d) => d.fraction >= 0 && d.fraction <= 1 && d.phase));
});

test("lit path shapes", () => {
  assert.equal(litPath(0.5, true, 10), "M0 -10 A10 10 0 0 1 0 10 A0 10 0 0 1 0 -10Z");
  assert.equal(litPath(1, true, 10), "M0 -10 A10 10 0 0 1 0 10 A10 10 0 0 1 0 -10Z");
  assert.match(litPath(0.25, false, 10), /^M0 -10 A10 10 0 0 0 0 10 A5 10 0 0 1 0 -10Z$/);
});

/* ---------------- notes ---------------- */

import { normalizeNote, canView, canEdit, onDay, sortNotes, dayMarker, dayKey } from "../scripts/calendar/cal-notes-data.js";

const gmNote = (o = {}) => normalizeNote({ id: "g", calendarId: "c", year: 2045, month: 11, day: 8, title: "Ambush", author: "gm1", gm: true, ...o });
const pNote = (o = {}) => normalizeNote({ id: "p", calendarId: "c", year: 2045, month: 11, day: 8, title: "Pay Rogue", author: "u1", ...o });
const viewer = (userId, { isGM = false, inGroup = true } = {}) => ({ userId, isGM, inGroup });

test("note visibility: GM notes hidden until shared", () => {
  assert.equal(canView(gmNote(), viewer("u1")), false);
  assert.equal(canView(gmNote({ shared: true }), viewer("u1")), true);
  assert.equal(canView(gmNote({ shared: true }), viewer("u1", { inGroup: false })), false, "not on this calendar");
  assert.equal(canView(gmNote(), viewer("gm1", { isGM: true })), true);
});

test("note visibility: player notes are private unless shared with the group", () => {
  assert.equal(canView(pNote(), viewer("u1")), true, "author");
  assert.equal(canView(pNote(), viewer("u2")), false);
  assert.equal(canView(pNote({ shared: true }), viewer("u2")), true);
  assert.equal(canView(pNote(), viewer("gm1", { isGM: true })), true, "GM sees everything");
});

test("note editing", () => {
  assert.equal(canEdit(pNote(), { userId: "u1", isGM: false }), true);
  assert.equal(canEdit(pNote(), { userId: "u2", isGM: false }), false);
  assert.equal(canEdit(gmNote({ shared: true }), { userId: "u1", isGM: false }), false);
  assert.equal(canEdit(pNote(), { userId: "gm1", isGM: true }), true);
});

test("note helpers", () => {
  const n = normalizeNote({ year: "2045", month: 13, day: 0, title: "  x  ".repeat(1), text: "y" });
  assert.deepEqual([n.year, n.month, n.day, n.title], [2045, 12, 1, "x"]);
  assert.equal(onDay(pNote(), { year: 2045, month: 11, day: 8 }), true);
  assert.equal(dayKey({ year: 2045, month: 1, day: 5 }), "2045-01-05");
  const sorted = sortNotes([pNote({ at: 1 }), gmNote({ at: 5 }), pNote({ id: "p2", at: 0 })]);
  assert.deepEqual(sorted.map((x) => x.id), ["g", "p2", "p"]);
});

test("day markers", () => {
  const gm = { userId: "gm1", isGM: true };
  assert.equal(dayMarker([], gm), null);
  assert.equal(dayMarker([gmNote()], gm), "gm");
  assert.equal(dayMarker([gmNote(), pNote()], gm), "private");
  assert.equal(dayMarker([gmNote({ shared: true })], { userId: "u1", isGM: false }), "shared");
  assert.equal(dayMarker([pNote()], { userId: "u1", isGM: false }), "private");
});
