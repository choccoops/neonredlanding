/**
 * Lifestyle: monthly expenses for Cyberpunk RED characters.
 *
 * A lifestyle item is an ordinary CPR `gear` item carrying `flags.cpr-neon-hub.lifestyle`.
 * Equipping it (system.equipped === "equipped") makes it active: it is billed each month,
 * and because its usage is "equipped", CPR only applies its Active Effects while it is.
 *
 * Everything in this file is pure (no Foundry calls) so it can be unit tested.
 */

export const LS_FLAG = "lifestyle";

/** Item categories. `group` is the column a cost is totalled under. */
export const CATEGORIES = {
  housing: { icon: "fa-solid fa-house", group: "housing", img: "housing" },
  lifestyle: { icon: "fa-solid fa-utensils", group: "lifestyle", img: "lifestyle", single: true },
  membership: { icon: "fa-solid fa-id-card", group: "memberships", img: "membership" },
  health: { icon: "fa-solid fa-truck-medical", group: "memberships", img: "health" },
  subscription: { icon: "fa-solid fa-newspaper", group: "memberships", img: "subscription" },
  transport: { icon: "fa-solid fa-train-subway", group: "transport", img: "transport" },
  fuel: { icon: "fa-solid fa-gas-pump", group: "transport", img: "fuel" },
  loan: { icon: "fa-solid fa-sack-dollar", group: "loans", img: "loan" },
  furnishing: { icon: "fa-solid fa-couch", group: "home", img: "furnishing", oneTime: true },
  other: { icon: "fa-solid fa-receipt", group: "other", img: "other" }
};

export const GROUPS = ["housing", "lifestyle", "memberships", "transport", "loans", "home", "other"];

export const LIFESTYLE_TIERS = 4;
export const LOAN_KINDS = ["interest", "installment"];
export const FURNISHES = ["", "container", "conapt", "house"];
export const MAX_HISTORY = 24;

const int = (v, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};
const str = (v) => (typeof v === "string" ? v : "");

/** Default lifestyle data for a new item of a category. */
export function defaultLifestyle(category = "other") {
  return normalizeLifestyle({ category });
}

/** Fill in and clamp every field so the rest of the code can trust the shape. */
export function normalizeLifestyle(raw = {}) {
  const r = raw && typeof raw === "object" ? raw : {};
  const category = CATEGORIES[r.category] ? r.category : "other";
  const loan = r.loan && typeof r.loan === "object" ? r.loan : {};
  const check = r.check && typeof r.check === "object" ? r.check : {};
  return {
    category,
    monthly: int(r.monthly),
    perk: !!r.perk,
    template: !!r.template,
    notes: str(r.notes),
    // housing
    sleeps: int(r.sleeps ?? 1, 0, 99),
    rooms: int(r.rooms, 0, 99),
    parking: int(r.parking, 0, 99),
    buyPrice: int(r.buyPrice),
    owned: !!r.owned,
    roughNight: int(r.roughNight, 0, 30),
    // lifestyle packages
    tier: int(r.tier, 0, LIFESTYLE_TIERS),
    plus: !!r.plus,
    // memberships, health plans, subscriptions
    minTier: int(r.minTier, 0, LIFESTYLE_TIERS),
    response: str(r.response).trim(),
    check: { skill: str(check.skill).trim(), dv: int(check.dv, 0, 30) },
    // furnishings
    humanity: int(r.humanity, 0, 10),
    furnishes: FURNISHES.includes(r.furnishes) ? r.furnishes : "",
    // loans
    loan: {
      kind: LOAN_KINDS.includes(loan.kind) ? loan.kind : "interest",
      principal: int(loan.principal),
      ratePct: Math.min(100, Math.max(0, Number(loan.ratePct) || 0)),
      downPct: Math.min(100, Math.max(0, Number(loan.downPct) || 0)),
      termMonths: int(loan.termMonths, 0, 600),
      monthsLeft: int(loan.monthsLeft, 0, 600)
    }
  };
}

/**
 * Plain description of an item, read from a Foundry Item or its plain data.
 * @param {object} item - Item document or item data ({ _id|id, name, img, system, flags })
 * @param {string} moduleId
 * @returns {object|null} null when the item isn't a lifestyle item
 */
export function describeItem(item, moduleId) {
  const flag = item?.flags?.[moduleId]?.[LS_FLAG];
  if (!flag) return null;
  const ls = normalizeLifestyle(flag);
  const system = item.system ?? {};
  return {
    id: item.id ?? item._id,
    uuid: item.uuid ?? null,
    name: String(item.name ?? ""),
    img: item.img ?? "",
    ...ls,
    group: CATEGORIES[ls.category].group,
    amount: Math.max(1, int(system.amount ?? 1, 1)),
    price: int(system.price?.market),
    active: system.equipped === "equipped"
  };
}

/** Monthly cost of one described item as it stands now (0 when inactive, owned outright, or a perk). */
export function lineCost(d) {
  if (!d?.active || d.perk) return 0;
  if (d.category === "housing" && d.owned) return 0;
  if (d.category === "loan" && d.loan.kind === "installment" && d.loan.monthsLeft <= 0) return 0;
  return d.monthly * d.amount;
}

/**
 * The month's bill.
 * @param {object[]} items - described items (see describeItem)
 * @param {object} [opts]
 * @param {number} [opts.moraleDiscount=0] - Morale Boost: Lifestyle costs this much less (No Place Like Home)
 * @returns {{lines: object[], groups: Object<string, number>, discount: number, total: number}}
 */
export function computeBill(items, { moraleDiscount = 0 } = {}) {
  const groups = Object.fromEntries(GROUPS.map((g) => [g, 0]));
  const lines = [];
  for (const d of items) {
    if (!d?.active) continue;
    const cost = lineCost(d);
    groups[d.group] += cost;
    if (cost > 0 || d.category !== "furnishing") lines.push({ id: d.id, name: d.name, category: d.category, group: d.group, amount: d.amount, cost });
  }
  const discount = Math.min(int(moraleDiscount), groups.lifestyle);
  groups.lifestyle -= discount;
  const total = GROUPS.reduce((sum, g) => sum + groups[g], 0);
  return { lines, groups, discount, total };
}

/** Furnishings don't stack: the best active one sets the Humanity recovery bonus. */
export function humanityBonus(items) {
  return items.reduce((best, d) => (d?.active && d.category === "furnishing" ? Math.max(best, d.humanity) : best), 0);
}

/** Active lifestyle packages (normally one). */
export function activeTier(items) {
  return items.filter((d) => d?.active && d.category === "lifestyle").sort((a, b) => b.tier - a.tier)[0] ?? null;
}

/** What it costs to clear a loan today. */
export function payoffAmount(d) {
  if (d?.category !== "loan") return 0;
  if (d.loan.kind === "installment") return d.monthly * d.amount * d.loan.monthsLeft;
  return d.loan.principal * d.amount;
}

/**
 * Terms for taking out a loan of `principal`.
 * Interest loans hand over the principal and charge interest monthly until paid off.
 * Installment loans take a down payment, hand over the rest, and charge a fixed
 * share of the principal for a set number of months.
 */
export function loanTerms(loan, principal) {
  const p = int(principal);
  if (loan.kind === "installment") {
    const down = Math.ceil((p * loan.downPct) / 100);
    const monthly = Math.ceil((p * loan.ratePct) / 100);
    return { principal: p, cash: p - down, down, monthly, monthsLeft: loan.termMonths };
  }
  const monthly = loan.ratePct ? Math.ceil((p * loan.ratePct) / 100) : null;
  return { principal: p, cash: p, down: 0, monthly, monthsLeft: 0 };
}

/**
 * After a month is paid: installment loans count down. Returns the flag updates to make
 * and which loans are now paid off.
 */
export function advanceLoans(items) {
  const updates = [];
  const finished = [];
  for (const d of items) {
    if (!d?.active || d.category !== "loan" || d.loan.kind !== "installment") continue;
    // 0 months left means the loan was never set up (e.g. dragged onto a sheet), not that it's paid.
    if (d.loan.monthsLeft <= 0) continue;
    const monthsLeft = d.loan.monthsLeft - 1;
    if (monthsLeft === 0) finished.push(d.id);
    else updates.push({ id: d.id, monthsLeft });
  }
  return { updates, finished };
}

/**
 * Several months' bills at once (the calendar jumped past more than one rent day).
 * Installment loans count down month by month, so a loan with one payment left
 * is charged once, not every month.
 * @returns {{ months, total, groups, discount, lines, loans: {id, monthsLeft}[], finished: string[] }}
 */
export function computeMonths(items, months = 1, opts = {}) {
  const n = Math.max(1, Math.floor(months) || 1);
  let current = items.map((d) => ({ ...d, loan: { ...d.loan } }));
  const groups = Object.fromEntries(GROUPS.map((g) => [g, 0]));
  const lines = new Map();
  const finished = [];
  let discount = 0;
  for (let i = 0; i < n; i++) {
    const bill = computeBill(current, opts);
    discount += bill.discount;
    for (const g of GROUPS) groups[g] += bill.groups[g];
    for (const l of bill.lines) {
      const line = lines.get(l.id) ?? { ...l, cost: 0, months: 0 };
      line.cost += l.cost;
      if (l.cost > 0) line.months += 1;
      lines.set(l.id, line);
    }
    const step = advanceLoans(current);
    for (const u of step.updates) current.find((d) => d.id === u.id).loan.monthsLeft = u.monthsLeft;
    finished.push(...step.finished);
    current = current.filter((d) => !step.finished.includes(d.id));
  }
  const loans = current
    .filter((d) => d.category === "loan" && d.loan.kind === "installment" && d.active)
    .map((d) => ({ id: d.id, monthsLeft: d.loan.monthsLeft }))
    .filter((u) => items.find((d) => d.id === u.id)?.loan.monthsLeft !== u.monthsLeft);
  const total = GROUPS.reduce((sum, g) => sum + groups[g], 0);
  return { months: n, total, groups, discount, lines: [...lines.values()], loans, finished };
}

/**
 * How many months a character owes.
 * Calendar mode: rent periods since the last one paid (capped), or 1 for someone never billed.
 * Without a calendar: the shared month counter.
 */
export function monthsOwed({ period, paidPeriod = null, cap = 12 }) {
  if (paidPeriod === null || paidPeriod === undefined) return 1;
  return Math.min(cap, Math.max(0, period - paidPeriod));
}

/** Things to remember at the table this month (rough nights, monthly checks). */
export function reminders(items) {
  const out = [];
  for (const d of items) {
    if (!d?.active) continue;
    if (d.category === "housing" && d.roughNight) out.push({ kind: "roughNight", name: d.name, dv: d.roughNight });
    if (d.check.skill && d.check.dv) out.push({ kind: "check", name: d.name, skill: d.check.skill, dv: d.check.dv });
  }
  return out;
}

/** Ids of other active lifestyle packages to switch off when `id` becomes active. */
export function packagesToDeactivate(items, id) {
  const target = items.find((d) => d.id === id);
  if (!target || !CATEGORIES[target.category].single) return [];
  return items.filter((d) => d.id !== id && d.active && d.category === target.category).map((d) => d.id);
}

/** Append a bill to an actor's history, keeping the most recent MAX_HISTORY. */
export function pushHistory(history, entry) {
  const list = Array.isArray(history) ? history.slice() : [];
  list.push(entry);
  return list.slice(-MAX_HISTORY);
}

/** "paid", "due" or "debt" for a character: from months owed, or the counter month paid. */
export function billStatus({ paidMonth = 0, month = 1, wallet = 0, owed } = {}) {
  if (wallet < 0) return "debt";
  if (owed !== undefined) return owed > 0 ? "due" : "paid";
  return paidMonth >= month ? "paid" : "due";
}

/** Strip HTML to a short plain-text excerpt. */
export function excerpt(html, max = 160) {
  const text = String(html ?? "")
    .replace(/@UUID\[[^\]]*\]\{([^}]*)\}/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/**
 * The key CPR gives a skill's bonus (actor.bonuses[key]), as SystemUtils.slugify does in 0.92.4:
 * "Wardrobe & Style" -> "wardrobeAndStyle", "Resist Torture/Drugs" -> "resistTortureOrDrugs".
 */
export function cprSlug(name) {
  const s = String(name ?? "");
  const lower = (x) => x.charAt(0).toLowerCase() + x.slice(1);
  const joined = s.split(" ").join("");
  if (["Conceal/Reveal Object", "Paint/Draw/Sculpt", "Resist Torture/Drugs"].includes(s)) return lower(joined.split("/").join("Or"));
  if (s === "Language (Streetslang)") return lower(joined.split("(").join("").split(")").join(""));
  return lower(joined.split("/").join("And").split("&").join("And"));
}

/** Readable name for an Active Effect change key: bonuses.wardrobeAndStyle -> Wardrobe & Style. */
export function changeKeyLabel(key, skillNames = {}) {
  const stat = /^system\.stats\.(\w+)\.value$/.exec(key);
  if (stat) return stat[1].toUpperCase();
  const bonus = /^bonuses\.(\w+)$/.exec(key);
  if (!bonus) return key;
  const slug = bonus[1];
  if (skillNames[slug]) return skillNames[slug];
  const special = { allActions: "All actions", universalDamageReduction: "Damage reduction", deathSavePenalty: "Death Save penalty" };
  if (special[slug]) return special[slug];
  return slug.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\bAnd\b/g, "&").replace(/^./, (c) => c.toUpperCase());
}
