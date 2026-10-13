import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toMinutes, split, formatDuration, normalizeCall, balance, timeline, allSpent, spendProblem, addEntry, removeEntry, summary
} from "../scripts/calendar/downtime-data.js";
import { skipLabel, skySkip, shownEvents, windDuration } from "../scripts/calendar/skip-sky.js";

const call = (extra = {}) => normalizeCall({ id: "c1", label: "Between gigs", total: toMinutes({ days: 5 }), participants: ["A", "B"], status: "open", ...extra });

test("durations", () => {
  assert.equal(toMinutes({ days: 2, hours: 3, minutes: 15 }), 2 * 1440 + 195);
  assert.deepEqual(split(1440 * 3 + 125), { days: 3, hours: 2, minutes: 5 });
  assert.deepEqual([0, 45, 150, 1440, 7380].map(formatDuration), ["0m", "45m", "2h 30m", "1d", "5d 3h"]);
  assert.equal(toMinutes({ days: 9999 }), 366 * 1440, "capped at a year");
});

test("calls normalize safely: entries need a participant and some time", () => {
  const c = normalizeCall({ id: "x", total: 100, participants: ["A", "A", ""], entries: [{ id: "e1", actor: "A", minutes: 30 }, { id: "e2", actor: "Z", minutes: 30 }, { id: "e3", actor: "A", minutes: 0 }], status: "weird" });
  assert.deepEqual(c.participants, ["A"]);
  assert.deepEqual(c.entries.map((e) => e.id), ["e1"]);
  assert.equal(c.status, "open");
  assert.equal(normalizeCall(null), null);
});

test("balances and spending", () => {
  let c = call();
  assert.deepEqual(balance(c, "A"), { total: 7200, spent: 0, left: 7200, taking: true });
  assert.equal(balance(c, "Z").taking, false);
  assert.equal(spendProblem(c, "A", 1440 * 2), null);
  c = addEntry(c, { id: "e1", actor: "A", minutes: 1440 * 2, label: "Fixed the bike", at: 1 });
  c = addEntry(c, { id: "e2", actor: "A", minutes: 1440, label: "Gym", at: 2 });
  assert.equal(balance(c, "A").left, 1440 * 2);
  assert.equal(spendProblem(c, "A", 1440 * 3), "NotEnough");
  assert.equal(spendProblem(c, "Z", 10), "NotTaking");
  assert.equal(spendProblem(c, "A", 0), "NoTime");
  assert.equal(spendProblem({ ...c, status: "done" }, "A", 10), "NoCall");
  assert.equal(balance(removeEntry(c, "e2"), "A").left, 1440 * 3);
});

test("a character's spends run back to back from the start", () => {
  let c = call();
  c = addEntry(c, { id: "e2", actor: "A", minutes: 600, label: "Second", at: 20 });
  c = addEntry(c, { id: "e1", actor: "A", minutes: 1440, label: "First", at: 10 });
  c = addEntry(c, { id: "e3", actor: "B", minutes: 60, label: "Other", at: 15 });
  assert.deepEqual(timeline(c, "A").map((e) => [e.label, e.from, e.to]), [["First", 0, 1440], ["Second", 1440, 2040]]);
});

test("all spent: everyone taking part has used all their time", () => {
  let c = call({ total: 100 });
  assert.equal(allSpent(c), false);
  c = addEntry(c, { id: "e1", actor: "A", minutes: 100, at: 1 });
  assert.equal(allSpent(c), false);
  c = addEntry(c, { id: "e2", actor: "B", minutes: 100, at: 2 });
  assert.equal(allSpent(c), true);
  assert.equal(allSpent({ ...c, status: "done" }), false);
  const s = summary(c);
  assert.deepEqual([s.total, s.spent, s.entries, s.participants], [100, 200, 2, 2]);
});

test("skip labels show days past a day", () => {
  assert.deepEqual([90, 1440, 1500, 7380].map(skipLabel), ["+1h 30m", "+24h", "+1d 1h", "+5d 3h"]);
});

test("each participant's start date is kept", () => {
  const c = normalizeCall({ id: "c", total: 60, participants: ["A"], starts: { A: { year: 2045, month: 11, day: 13 }, Z: { year: 1, month: 1, day: 1 } } });
  assert.deepEqual(c.starts, { A: { year: 2045, month: 11, day: 13 } });
});

test("long winds hold the sky through the middle days", () => {
  const month = 30 * 1440;
  assert.equal(skySkip(600, month), 600);
  assert.equal(skySkip(1440, month), 1440);
  assert.equal(skySkip(10 * 1440 + 300, month), 1440);
  assert.equal(skySkip(28 * 1440, month), 1440);
  assert.equal(skySkip(29 * 1440, month), 29 * 1440);
  assert.equal(skySkip(29 * 1440 + 5, month), 29 * 1440 + 5);
  // two days or less: the sky moves all the way
  assert.equal(skySkip(1500, 2 * 1440 + 600), 1500);
  // time of day never jumps going in or out of the hold
  assert.equal((29 * 1440) % 1440, 1440 % 1440);
  const events = [{ at: 1000 + 300 }, { at: 1000 + 5 * 1440 }, { at: 1000 + 29 * 1440 }];
  assert.deepEqual(shownEvents(events, 1000, month).map((e) => e.at), [1300, 1000 + 29 * 1440]);
});

test("winds take longer for days of downtime, within limits", () => {
  assert.equal(windDuration(1440), 8000);
  assert.ok(windDuration(7 * 1440) > windDuration(2 * 1440));
  assert.equal(windDuration(366 * 1440), 20000);
});
