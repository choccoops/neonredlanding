import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeLifestyle, describeItem, lineCost, computeBill, humanityBonus, payoffAmount, loanTerms,
  advanceLoans, reminders, packagesToDeactivate, pushHistory, billStatus, excerpt, changeKeyLabel, cprSlug, MAX_HISTORY,
  computeMonths, monthsOwed
} from "../scripts/lifestyle/ls-data.js";

const M = "cpr-neon-hub";
let n = 0;
const item = (lifestyle, { equipped = "equipped", amount = 1, name } = {}) => ({
  _id: `i${++n}`,
  name: name ?? `Item ${n}`,
  system: { equipped, amount, price: { market: lifestyle.monthly ?? 0 } },
  flags: { [M]: { lifestyle } }
});
const d = (...args) => describeItem(item(...args), M);

test("normalizeLifestyle fills defaults and clamps", () => {
  const ls = normalizeLifestyle({ category: "nope", monthly: -5, tier: 9, loan: { kind: "weird", ratePct: 300 } });
  assert.equal(ls.category, "other");
  assert.equal(ls.monthly, 0);
  assert.equal(ls.tier, 4);
  assert.equal(ls.loan.kind, "interest");
  assert.equal(ls.loan.ratePct, 100);
  assert.deepEqual(ls.check, { skill: "", dv: 0 });
});

test("describeItem ignores items without the flag and reads equipped state", () => {
  assert.equal(describeItem({ name: "Rope", system: {} }, M), null);
  const on = d({ category: "housing", monthly: 1500 });
  const off = d({ category: "housing", monthly: 1500 }, { equipped: "owned" });
  assert.equal(on.active, true);
  assert.equal(off.active, false);
  assert.equal(on.group, "housing");
});

test("lineCost: inactive, perks and owned homes are free; quantity multiplies", () => {
  assert.equal(lineCost(d({ category: "housing", monthly: 1500 })), 1500);
  assert.equal(lineCost(d({ category: "housing", monthly: 1500 }, { equipped: "carried" })), 0);
  assert.equal(lineCost(d({ category: "housing", monthly: 1500, owned: true })), 0);
  assert.equal(lineCost(d({ category: "housing", monthly: 900, perk: true })), 0);
  assert.equal(lineCost(d({ category: "fuel", monthly: 250 }, { amount: 2 })), 500);
});

test("computeBill totals groups and applies the Morale Boost discount to lifestyle only", () => {
  const items = [
    d({ category: "housing", monthly: 1000 }),
    d({ category: "lifestyle", monthly: 300, tier: 2 }),
    d({ category: "subscription", monthly: 50 }),
    d({ category: "health", monthly: 500 }),
    d({ category: "fuel", monthly: 100 }),
    d({ category: "loan", monthly: 100, loan: { kind: "interest", principal: 1000 } }),
    d({ category: "furnishing", monthly: 0, humanity: 1 }),
    d({ category: "transport", monthly: 600 }, { equipped: "owned" })
  ];
  const bill = computeBill(items, { moraleDiscount: 50 });
  assert.equal(bill.groups.housing, 1000);
  assert.equal(bill.groups.lifestyle, 250);
  assert.equal(bill.groups.memberships, 550);
  assert.equal(bill.groups.transport, 100);
  assert.equal(bill.groups.loans, 100);
  assert.equal(bill.discount, 50);
  assert.equal(bill.total, 2000);
  assert.ok(!bill.lines.some((l) => l.category === "furnishing"), "free furnishings don't clutter the bill");
});

test("Morale discount never exceeds the lifestyle cost", () => {
  const bill = computeBill([d({ category: "lifestyle", monthly: 0, tier: 1 })], { moraleDiscount: 50 });
  assert.equal(bill.discount, 0);
  assert.equal(bill.total, 0);
});

test("humanityBonus takes the best active furnishing, not the sum", () => {
  const items = [
    d({ category: "furnishing", humanity: 1 }),
    d({ category: "furnishing", humanity: 3 }, { equipped: "owned" }),
    d({ category: "furnishing", humanity: 2 })
  ];
  assert.equal(humanityBonus(items), 2);
});

test("loans: interest payoff is the principal, installment payoff is what's left", () => {
  const interest = d({ category: "loan", monthly: 250, loan: { kind: "interest", principal: 2500 } });
  assert.equal(payoffAmount(interest), 2500);
  const auto = d({ category: "loan", monthly: 1000, loan: { kind: "installment", principal: 20000, monthsLeft: 7 } });
  assert.equal(payoffAmount(auto), 7000);
});

test("loanTerms: auto loan takes 10% down and charges 5% for 20 months", () => {
  const terms = loanTerms(normalizeLifestyle({ loan: { kind: "installment", downPct: 10, ratePct: 5, termMonths: 20 } }).loan, 20000);
  assert.deepEqual(terms, { principal: 20000, cash: 18000, down: 2000, monthly: 1000, monthsLeft: 20 });
  const plain = loanTerms(normalizeLifestyle({ loan: { kind: "interest" } }).loan, 1000);
  assert.equal(plain.cash, 1000);
  assert.equal(plain.monthly, null);
});

test("advanceLoans counts installment loans down and reports the finished ones", () => {
  const a = d({ category: "loan", monthly: 100, loan: { kind: "installment", monthsLeft: 3 } });
  const b = d({ category: "loan", monthly: 100, loan: { kind: "installment", monthsLeft: 1 } });
  const c = d({ category: "loan", monthly: 100, loan: { kind: "interest", principal: 1000 } });
  const unset = d({ category: "loan", monthly: 0, loan: { kind: "installment", monthsLeft: 0 } });
  const { updates, finished } = advanceLoans([a, b, c, unset]);
  assert.deepEqual(updates, [{ id: a.id, monthsLeft: 2 }]);
  assert.deepEqual(finished, [b.id]);
});

test("computeMonths bills several months and stops a loan when it's paid off", () => {
  const rent = d({ category: "housing", monthly: 1000 });
  const food = d({ category: "lifestyle", monthly: 300, tier: 2 });
  const car = d({ category: "loan", monthly: 500, loan: { kind: "installment", monthsLeft: 2 } });
  const three = computeMonths([rent, food, car], 3, { moraleDiscount: 50 });
  assert.equal(three.months, 3);
  assert.equal(three.groups.housing, 3000);
  assert.equal(three.groups.lifestyle, 750, "discount applies each month");
  assert.equal(three.discount, 150);
  assert.equal(three.groups.loans, 1000, "only the two payments left");
  assert.equal(three.total, 4750);
  assert.deepEqual(three.finished, [car.id]);
  assert.equal(three.lines.find((l) => l.id === car.id).months, 2);
  const one = computeMonths([rent, car], 1);
  assert.deepEqual(one.loans, [{ id: car.id, monthsLeft: 1 }]);
  assert.equal(one.total, computeBill([rent, car]).total);
});

test("monthsOwed", () => {
  assert.equal(monthsOwed({ period: 100, paidPeriod: null }), 1, "never billed: this month");
  assert.equal(monthsOwed({ period: 100, paidPeriod: 100 }), 0);
  assert.equal(monthsOwed({ period: 103, paidPeriod: 100 }), 3);
  assert.equal(monthsOwed({ period: 140, paidPeriod: 100 }), 12, "capped");
  assert.equal(monthsOwed({ period: 99, paidPeriod: 100 }), 0, "date moved back");
});

test("reminders list rough nights and monthly checks for active items only", () => {
  const items = [
    d({ category: "housing", roughNight: 15 }, { name: "Street" }),
    d({ category: "subscription", check: { skill: "Library Search", dv: 15 } }, { name: "Sheet" }),
    d({ category: "subscription", check: { skill: "Library Search", dv: 15 } }, { equipped: "owned" })
  ];
  assert.deepEqual(reminders(items).map((r) => r.kind), ["roughNight", "check"]);
});

test("only one lifestyle package stays active", () => {
  const a = d({ category: "lifestyle", tier: 1 });
  const b = d({ category: "lifestyle", tier: 3 });
  const c = d({ category: "membership" });
  assert.deepEqual(packagesToDeactivate([a, b, c], b.id), [a.id]);
  assert.deepEqual(packagesToDeactivate([a, b, c], c.id), []);
});

test("history keeps the most recent entries", () => {
  let h = [];
  for (let i = 0; i < MAX_HISTORY + 5; i++) h = pushHistory(h, { month: i });
  assert.equal(h.length, MAX_HISTORY);
  assert.equal(h[0].month, 5);
});

test("billStatus", () => {
  assert.equal(billStatus({ paidMonth: 3, month: 3, wallet: 10 }), "paid");
  assert.equal(billStatus({ paidMonth: 2, month: 3, wallet: 10 }), "due");
  assert.equal(billStatus({ paidMonth: 3, month: 3, wallet: -1 }), "debt");
});

test("cprSlug matches CPR 0.92.4 SystemUtils.slugify", () => {
  assert.equal(cprSlug("Streetwise"), "streetwise");
  assert.equal(cprSlug("Wardrobe & Style"), "wardrobeAndStyle");
  assert.equal(cprSlug("Electronics/Security Tech"), "electronicsAndSecurityTech");
  assert.equal(cprSlug("Resist Torture/Drugs"), "resistTortureOrDrugs");
  assert.equal(cprSlug("Language (Streetslang)"), "languageStreetslang");
  assert.equal(cprSlug("Library Search"), "librarySearch");
});

test("excerpt and change labels", () => {
  assert.equal(excerpt("<p>Hello&nbsp;<b>choom</b></p>"), "Hello choom");
  assert.equal(excerpt("x".repeat(200), 10).length, 10);
  assert.equal(changeKeyLabel("system.stats.cool.value"), "COOL");
  assert.equal(changeKeyLabel("bonuses.wardrobeAndStyle"), "Wardrobe & Style");
  assert.equal(changeKeyLabel("bonuses.streetwise", { streetwise: "Streetwise" }), "Streetwise");
  assert.equal(changeKeyLabel("bonuses.allActions"), "All actions");
});
