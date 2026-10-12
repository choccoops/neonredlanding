import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeHousehold, monthlyRent, rentShare, poolStatus, contribute, capacity, RENT_MODES } from "../scripts/lifestyle/ls-household-data.js";

const home = { monthly: 2500, sleeps: 3, slots: 4, rooms: 2 };
const hh = (extra = {}) => normalizeHousehold({ id: "h1", name: "The Loft", home, inhabitants: ["A", "B", "C"], ...extra });

test("households normalize safely", () => {
  const h = normalizeHousehold({ inhabitants: ["A", "A", "", 5], rentMode: "nope", payer: "Z", pool: { paid: { A: 100, Z: 50, B: -3 } } });
  assert.deepEqual(h.inhabitants, ["A"]);
  assert.equal(h.rentMode, "split");
  assert.equal(h.payer, "A", "the payer must live there");
  assert.deepEqual(h.pool.paid, { A: 100 }, "only inhabitants' positive contributions");
  assert.equal(h.home.category, "housing");
  assert.deepEqual(RENT_MODES, ["split", "payer", "pool"]);
});

test("rent: the home's, or the GM's own figure; nothing for an owned home or a perk", () => {
  assert.equal(monthlyRent(hh()), 2500);
  assert.equal(monthlyRent(hh({ rent: 1800 })), 1800);
  assert.equal(monthlyRent(hh({ home: { ...home, owned: true } })), 0);
  assert.equal(monthlyRent(hh({ home: { ...home, perk: true } })), 0);
});

test("split evenly, rounded up", () => {
  const h = hh({ rentMode: "split" });
  assert.deepEqual(["A", "B", "C", "D"].map((u) => rentShare(h, u)), [834, 834, 834, 0]);
});

test("one payer pays it all", () => {
  const h = hh({ rentMode: "payer", payer: "B" });
  assert.deepEqual(["A", "B", "C"].map((u) => rentShare(h, u)), [0, 2500, 0]);
});

test("pool: nobody's bill carries it; contributions add up until it's covered", () => {
  let h = hh({ rentMode: "pool" });
  assert.deepEqual(["A", "B", "C"].map((u) => rentShare(h, u)), [0, 0, 0]);
  let r = contribute(h, 7, "A", 1000);
  assert.equal(r.taken, 1000);
  h = { ...h, pool: r.pool };
  r = contribute(h, 7, "B", 1000);
  h = { ...h, pool: r.pool };
  assert.equal(poolStatus(h, 7).left, 500);
  r = contribute(h, 7, "C", 900);
  assert.equal(r.taken, 500, "only what's still needed");
  assert.equal(r.status.covered, true);
  h = { ...h, pool: r.pool };
  assert.deepEqual(h.pool.paid, { A: 1000, B: 1000, C: 500 });
  assert.equal(contribute(h, 7, "A", 100).taken, 0, "nothing more once covered");
  assert.equal(poolStatus(h, 8).total, 0, "a new month starts an empty pool");
  assert.equal(contribute(h, 8, "A", 300).status.total, 300);
});

test("capacity: the home's sleepers plus CyberBeds", () => {
  assert.deepEqual(capacity(hh()), { sleeps: 3, living: 3, over: false });
  assert.equal(capacity(hh({ inhabitants: ["A", "B", "C", "D"] })).over, true);
  assert.equal(capacity(hh({ inhabitants: ["A", "B", "C", "D"] }), 1).over, false);
});

test("move-in days: those who stay keep theirs, newcomers get today", async () => {
  const { moveIns } = await import("../scripts/lifestyle/ls-household-data.js");
  const h = hh({ movedIn: { A: 100, B: 120, Z: 5 } });
  assert.deepEqual(h.movedIn, { A: 100, B: 120 }, "only inhabitants");
  assert.deepEqual(moveIns(h, ["A", "D"], () => 200), { A: 100, D: 200 });
  assert.deepEqual(moveIns(null, ["A"], () => null), {}, "no calendar, no date");
});
