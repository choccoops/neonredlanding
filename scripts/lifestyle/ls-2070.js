/**
 * The 2070s Living & Humanity Rework: the monthly environmental Humanity check on rent day,
 * one-time Humanity incidents, housing slots and houseware, and art.
 *
 * Pure: no Foundry calls. Items come in as described by ls-data.js describeItem().
 */

/** Lifestyle eras: which compendium the catalog shows, and whether the 2070s rules run. */
export const ERAS = {
  2045: { pack: "lifestyle", rules: false },
  2070: { pack: "lifestyle-2070", rules: true }
};
export const DEFAULT_ERA = "2045";

/** CPR scarcity, cheapest first. Furnishings and art share it: art needs furnishings at least as fine. */
export const SCARCITY = ["costly", "premium", "expensive", "veryExpensive", "luxury", "superLuxury"];

/** Art by material cost: time, DV and the Humanity it gives each month on display. */
export const ART_TIERS = [
  { scarcity: 1, cost: 100, time: "day", dv: 19, hg: 1 },
  { scarcity: 2, cost: 500, time: "week", dv: 21, hg: 2 },
  { scarcity: 3, cost: 1000, time: "twoWeeks", dv: 24, hg: 3 },
  { scarcity: 4, cost: 5000, time: "month", dv: 29, hg: 4 },
  { scarcity: 5, cost: 10000, time: "monthPer10k", dv: 29, hg: 4, extra: true }
];

/** The skills art can be made with (Cyberpunk RED's names). */
export const ART_SKILLS = ["Paint/Draw/Sculpt", "Composition", "Photography/Film", "Play Instrument", "Acting"];

/** For a two-part project (music, acting, film), the second skill that performs the first. */
export const PERFORMED_BY = { Composition: "Play Instrument", Acting: "Photography/Film" };

/** The art tier a roll reaches: the finest whose DV it meets, or null. */
export function artTierFor(total) {
  let best = null;
  for (const tier of ART_TIERS) if (total >= tier.dv && !tier.extra) best = tier;
  return best;
}

/** Monthly Humanity of a finished piece: Super Luxury gives 4 plus a point per extra month spent. */
export function artHumanity(tier, extraMonths = 0) {
  return tier.hg + (tier.extra ? Math.max(0, Math.floor(extraMonths)) : 0);
}

/* ------------------------------------------ */
/*  Environmental effects                     */
/* ------------------------------------------ */

/**
 * Long-term environmental effects, checked each rent day after the bill is paid.
 * auto: worked out from the character's lifestyle items; count: can apply more than once
 * (the GM enters how many); otherwise the GM ticks it.
 */
export const ENVIRONMENT = {
  // Humanity loss
  nonFresh: { kind: "loss", dice: "1d6", auto: true },
  megabuilding: { kind: "loss", dice: "1d6", auto: true },
  corp: { kind: "loss", dice: "1d6", count: true },
  deaths5: { kind: "loss", dice: "1d6" },
  lovedOne: { kind: "loss", dice: "2d6" },
  wounded: { kind: "loss", dice: "2d6" },
  imprisoned: { kind: "loss", dice: "2d6" },
  starvation: { kind: "loss", dice: "2d6" },
  deaths10: { kind: "loss", dice: "2d6" },
  warZone: { kind: "loss", dice: "3d6" },
  massDeaths: { kind: "loss", dice: "3d6" },
  // Humanity gain
  friend: { kind: "gain", dice: "1d6" },
  family: { kind: "gain", dice: "1d6" },
  weekOff: { kind: "gain", dice: "1d6" },
  outside: { kind: "gain", dice: "1d6" },
  freshFood: { kind: "gain", dice: "2d6", auto: true },
  upscale: { kind: "gain", dice: "2d6", auto: true },
  goodLife: { kind: "gain", dice: "3d6", auto: true }
};

/** One-time Humanity incidents, by severity. Partying needs the group's spending in food and drink. */
export const INCIDENTS = {
  loss: {
    "1d6": ["torture", "killedInCombat", "deathThreat", "injustice", "robbed", "scavenged"],
    "2d6": ["gruesome", "firstKill", "physicalTrauma", "mentalTrauma", "lovedOneAway"],
    "3d6": ["murderInnocent", "lovedOneMurdered"]
  },
  gain: {
    "1d6": ["hatedEnemy", "symbolicVictory", "reconcile", "trueFriend", "foundFamily", "weeklyParty"],
    "2d6": ["savedLife", "monthlyParty", "majorGoal"],
    "3d6": ["lifeAffirming"]
  }
};

/**
 * Housing `env`: which effects living there brings, and what it does to the megabuilding roll.
 * The street's 3d6 for living rough is the GM's call each month (it's a tick, not automatic).
 */
const HOUSING_ENV = {
  worse: [["megabuilding"]],
  vehicle: [["megabuilding", "2d6"]],
  streets: [["megabuilding"]],
  upscale: [["upscale"]],
  ship: [["upscale"], ["outside"]]
};

/** Lifestyle package `env`. Kibble is below Good PrePak like Generic PrePak, and adds a flat tax. */
const PACKAGE_ENV = {
  kibble: [["nonFresh"]],
  nonFresh: [["nonFresh"]],
  fresh: [["freshFood"]]
};

/** The Humanity tax of living on Kibble, each month. */
export const KIBBLE_TAX = 2;

/**
 * The living-space tax this month. A home's tax and credit only count after three weeks there
 * ("home"); before that, none ("none"); and any time on the street or in a vehicle that month,
 * that tax takes over instead.
 */
export const LIVING = { home: null, none: 0, street: 6, vehicle: 3, vehicleUpgrade: 1 };
export const THREE_WEEKS = 21;

/** The living-space choice a check starts on: none under three weeks in the home, else the home's. */
export function defaultLiving(daysInHome) {
  return daysInHome !== null && daysInHome !== undefined && daysInHome < THREE_WEEKS ? "none" : "home";
}

const active = (items, category) => items.filter((d) => d?.active && d.category === category);

/**
 * The primary home: a household the character lives in, else the active housing with the most
 * room (a character can keep a car on the side).
 */
export function primaryHome(items) {
  return active(items, "housing").sort((a, b) => Number(!!b.household) - Number(!!a.household)
    || b.slots - a.slots || b.sleeps - a.sleeps || b.monthly - a.monthly)[0] ?? null;
}

/** Furnishings don't stack: the finest active set (highest scarcity) is the one lived in. */
export function bedroomFurnishing(items) {
  return active(items, "furnishing").sort((a, b) => b.scarcity - a.scarcity || b.gainMod - a.gainMod || a.lossMod - b.lossMod)[0] ?? null;
}

/**
 * The home: slots used by houseware against the slots the home has, how many can live there,
 * and whether the furnishings allow upgrades at all.
 */
export function homeSummary(items) {
  const home = primaryHome(items);
  const furnishing = bedroomFurnishing(items);
  const ware = active(items, "houseware");
  const used = ware.reduce((n, d) => n + d.slots * d.amount, 0);
  const slots = home?.slots ?? 0;
  const capacity = ware.reduce((n, d) => n + d.capacity * d.amount, 0);
  return {
    home,
    furnishing,
    slots,
    used,
    over: used > slots,
    sleeps: (home?.sleeps ?? 0) + capacity,
    // Housemates' ARADs show their own art, not this character's.
    displays: ware.filter((d) => d.display && !d.foreign).reduce((n, d) => n + d.amount, 0),
    blocked: !!furnishing?.noUpgrades && ware.length > 0
  };
}

/**
 * Art on display this month: each piece needs its own ARAD, there can't be more ARADs than
 * people the home sleeps (a CyberBed's extra sleeper doesn't count), and a piece only counts
 * in a room furnished at least as finely.
 */
export function artOnDisplay(items) {
  const home = homeSummary(items);
  const pieces = active(items, "art").sort((a, b) => b.hg - a.hg);
  const sleeps = home.home?.sleeps ?? 0;
  const limit = home.blocked ? 0 : Math.min(home.displays, sleeps || home.displays);
  const fine = home.furnishing?.scarcity ?? 0;
  const shown = [];
  const unshown = [];
  for (const piece of pieces) {
    if (shown.length < limit && piece.scarcity <= fine) shown.push(piece);
    else unshown.push({ piece, reason: shown.length >= limit ? "display" : "furnishing" });
  }
  return { shown, unshown, limit, total: shown.reduce((n, p) => n + p.hg, 0) };
}

/**
 * Which environmental effects this month brings on its own, from the character's items.
 * `taxes` says where the tax comes from (the home, Kibble); `tax` is their total.
 * @returns {{ effects: {key, dice}[], taxes: {key, n}[], tax, credit, lossMod, gainMod, art }}
 */
export function automaticEffects(items, { living = "home" } = {}) {
  const effects = [];
  const add = (key, dice = ENVIRONMENT[key].dice) => {
    if (!effects.some((e) => e.key === key)) effects.push({ key, dice });
  };
  const pkg = active(items, "lifestyle").sort((a, b) => b.tier - a.tier)[0];
  for (const [key, dice] of PACKAGE_ENV[pkg?.env] ?? []) add(key, dice);
  const home = primaryHome(items);
  for (const [key, dice] of HOUSING_ENV[home?.env] ?? []) add(key, dice);
  const furnishing = bedroomFurnishing(items);
  const taxes = [];
  if (pkg?.env === "kibble") taxes.push({ key: "kibble", n: KIBBLE_TAX });
  const space = LIVING[living] === undefined ? "home" : living;
  if (space === "home" && home?.tax) taxes.push({ key: "home", n: home.tax });
  if (LIVING[space]) taxes.push({ key: space, n: LIVING[space] });
  return {
    effects,
    taxes,
    tax: taxes.reduce((n, t) => n + t.n, 0),
    credit: space === "home" ? home?.credit ?? 0 : 0,
    lossMod: furnishing?.lossMod ?? 0,
    gainMod: furnishing?.gainMod ?? 0,
    art: artOnDisplay(items).total
  };
}

/**
 * The month's check: the automatic effects plus what the GM ticked, ready to roll.
 * Living the good life (four or more Humanity Gain effects, fewer than three Humanity Loss)
 * adds its 3d6 on top.
 * @param {object[]} items - described lifestyle items
 * @param {Object<string, number|boolean>} ticked - GM's effects: true, or a count for `count` ones
 * @returns {{ rolls: {key, kind, dice, mod}[], tax, credit, art, lossMod, gainMod }}
 */
export function monthlyCheck(items, ticked = {}) {
  const auto = automaticEffects(items, { living: ticked.living ?? "home" });
  const rolls = auto.effects.map((e) => ({ key: e.key, kind: ENVIRONMENT[e.key].kind, dice: e.dice, auto: true }));
  for (const [key, value] of Object.entries(ticked)) {
    const def = ENVIRONMENT[key];
    // Effects worked out from the items aren't ticked by hand.
    if (!def || def.auto) continue;
    const n = def.count ? Math.max(0, Math.floor(Number(value) || 0)) : value ? 1 : 0;
    for (let i = 0; i < n; i++) {
      if (!def.count && rolls.some((r) => r.key === key)) continue;
      rolls.push({ key, kind: def.kind, dice: def.dice, auto: false });
    }
  }
  const gains = rolls.filter((r) => r.kind === "gain").length;
  const losses = rolls.filter((r) => r.kind === "loss").length;
  if (gains >= 4 && losses < 3) rolls.push({ key: "goodLife", kind: "gain", dice: ENVIRONMENT.goodLife.dice, auto: true });
  for (const r of rolls) r.mod = r.kind === "loss" ? auto.lossMod : auto.gainMod;
  return { rolls, taxes: auto.taxes, tax: auto.tax, credit: auto.credit, art: auto.art, lossMod: auto.lossMod, gainMod: auto.gainMod };
}

/**
 * Roll a check. Furnishing modifiers add to every roll of their kind, and the Humanity tax or
 * credit of the home to the totals (the tax only grows with a loss modifier when there is one).
 * @param {object} check - from monthlyCheck
 * @param {Function} roll - (formula) => number
 * @returns {{ rolls: object[], loss, gain, net }}
 */
export function rollCheck(check, roll) {
  const rolls = check.rolls.map((r) => {
    const result = roll(r.dice);
    return { ...r, result, total: Math.max(0, result + r.mod) };
  });
  const tax = check.tax ? check.tax + check.lossMod : 0;
  const credit = check.credit ? check.credit + check.gainMod : 0;
  const loss = rolls.filter((r) => r.kind === "loss").reduce((n, r) => n + r.total, 0) + tax;
  const gain = rolls.filter((r) => r.kind === "gain").reduce((n, r) => n + r.total, 0) + credit + check.art;
  return { rolls, tax, credit, art: check.art, loss, gain, net: gain - loss };
}

/* ------------------------------------------ */
/*  Membership tiers                          */
/* ------------------------------------------ */

/** Categories that need a minimum lifestyle and start on rent day when bought mid-month. */
export const MEMBERSHIP_CATEGORIES = new Set(["membership", "health", "subscription"]);

/**
 * Active memberships whose minimum lifestyle the character's package no longer meets. (A loan's
 * minimum only decides who can take one out: a loan already taken keeps being owed.)
 */
export function belowTier(items) {
  const tier = active(items, "lifestyle").reduce((best, d) => Math.max(best, d.tier), 0);
  return items.filter((d) => d?.active && d.minTier > tier && MEMBERSHIP_CATEGORIES.has(d.category));
}
