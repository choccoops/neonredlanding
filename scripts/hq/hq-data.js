import { MODULE_ID, HQ_SETTING, THEMES } from "../constants.js";

const { deepClone, mergeObject } = foundry.utils;

/**
 * Headquarters rules from "No Place Like Home" (R. Talsorian Games, August 2024).
 * Rule text lives in lang/en.json in summarized form; this file holds the numbers.
 *
 * - Every Improvement and Upgrade costs 40 HQ IP. The Server Room also costs 20,000eb.
 * - Each Improvement can be bought once per HQ and Upgraded once, except:
 *   Rent Reduction (Upgrade repeatable, up to double the HQ's original beds) and
 *   Morale Boost (ten numbered Upgrades).
 */
export const HQ_COST = 40;

export const IMPROVEMENTS = {
  evidenceWall: { icon: "fa-solid fa-diagram-project", roles: ["Lawman"], upgradeRoles: ["Lawman", "Media"] },
  garage: { icon: "fa-solid fa-warehouse", roles: [], upgradeRoles: ["Nomad"], link: "vehicle" },
  lockup: { icon: "fa-solid fa-handcuffs", roles: [], upgradeRoles: ["Lawman"] },
  lounge: { icon: "fa-solid fa-martini-glass", roles: ["Fixer"], upgradeRoles: ["Fixer", "Media"] },
  medbay: { icon: "fa-solid fa-kit-medical", roles: ["Medtech"], upgradeRoles: ["Medtech"], crewWide: true },
  moraleBoost: { icon: "fa-solid fa-champagne-glasses", roles: [], upgradeRoles: [], crewWide: true, maxUpgrades: 10 },
  rentReduction: { icon: "fa-solid fa-tags", roles: [], upgradeRoles: [], crewWide: true, repeatable: true },
  serverRoom: { icon: "fa-solid fa-server", roles: ["Netrunner"], upgradeRoles: ["Netrunner"], eb: 20000, link: "netarch" },
  studio: { icon: "fa-solid fa-microphone-lines", roles: ["Rockerboy"], upgradeRoles: ["Rockerboy"] },
  trainingArea: { icon: "fa-solid fa-dumbbell", roles: [], upgradeRoles: ["Solo"], crewWide: true },
  workshop: { icon: "fa-solid fa-screwdriver-wrench", roles: ["Tech"], upgradeRoles: ["Tech"] },
  workstation: { icon: "fa-solid fa-briefcase", roles: ["Exec"], upgradeRoles: ["Exec"], link: "teamMember" }
};

export const MORALE_LEVELS = 10;

/** Which Morale Boost levels a later level replaces. */
const MORALE_REPLACES = { 4: [1], 8: [6], 9: [1, 4] };

export function newHQ(name = "") {
  return normalizeHQ({ id: foundry.utils.randomID(12), name: name || game.i18n.localize("NEONHUB.HQ.DefaultName") });
}

export function normalizeHQ(raw = {}) {
  const base = {
    id: raw.id || foundry.utils.randomID(12),
    name: game.i18n?.localize?.("NEONHUB.HQ.DefaultName") ?? "Headquarters",
    location: "",
    img: "",
    theme: "neon",
    notes: "",
    crew: [],
    playersSeeAll: false,
    status: "active",
    housing: { kind: "", rent: 0, reducedRent: null, rentFree: false, beds: 1, rentPaid: true },
    /** Calendar whose rent day starts this HQ's months; blank follows its crew. */
    calendarId: "",
    ip: 0,
    improvements: Object.fromEntries(Object.keys(IMPROVEMENTS).map((k) => [k, { owned: false, upgrades: 0, notes: "", link: "" }])),
    log: [],
    month: 0
  };
  const hq = mergeObject(base, deepClone(raw), { inplace: false, insertKeys: true, insertValues: true });
  if (!THEMES[hq.theme]) hq.theme = "neon";
  if (!["active", "lost", "destroyed"].includes(hq.status)) hq.status = "active";
  hq.calendarId = typeof hq.calendarId === "string" ? hq.calendarId : "";
  hq.crew = Array.isArray(hq.crew) ? [...new Set(hq.crew.filter((u) => typeof u === "string" && u))] : [];
  hq.ip = Math.max(0, Math.floor(Number(hq.ip) || 0));
  hq.housing.rent = Math.max(0, Math.floor(Number(hq.housing.rent) || 0));
  hq.housing.beds = Math.max(1, Math.floor(Number(hq.housing.beds) || 1));
  const rr = hq.housing.reducedRent;
  hq.housing.reducedRent = rr === null || rr === "" || rr === undefined || Number.isNaN(Number(rr)) ? null : Math.max(0, Math.floor(Number(rr)));
  for (const key of Object.keys(IMPROVEMENTS)) {
    const imp = hq.improvements[key] ?? {};
    imp.owned = !!imp.owned;
    imp.upgrades = imp.owned ? Math.max(0, Math.min(maxUpgrades(key, hq), Math.floor(Number(imp.upgrades) || 0))) : 0;
    imp.notes ??= "";
    imp.link ??= "";
    hq.improvements[key] = imp;
  }
  for (const key of Object.keys(hq.improvements)) if (!IMPROVEMENTS[key]) delete hq.improvements[key];
  hq.log = Array.isArray(hq.log) ? hq.log.slice(-200) : [];
  hq.month = Math.max(0, Math.floor(Number(hq.month) || 0));
  return hq;
}

/* ------------------------------------------ */
/*  Rules                                     */
/* ------------------------------------------ */

export function maxUpgrades(key, hq) {
  const def = IMPROVEMENTS[key];
  if (!def) return 0;
  if (def.maxUpgrades) return def.maxUpgrades;
  // Rent Reduction adds one bed per Upgrade, never past double the original beds.
  if (def.repeatable) return Math.max(1, Math.floor(Number(hq?.housing?.beds) || 1));
  return 1;
}

export function isActive(hq) {
  return hq.status === "active";
}

/** Why a purchase can't happen, or null if it can. */
export function purchaseBlocker(hq, key) {
  const def = IMPROVEMENTS[key];
  const imp = hq.improvements[key];
  if (!def || !imp) return "NEONHUB.HQ.Block.Unknown";
  if (!isActive(hq)) return "NEONHUB.HQ.Block.NoAccess";
  if (imp.owned) return "NEONHUB.HQ.Block.Owned";
  if (key === "rentReduction" && hq.housing.rentFree) return "NEONHUB.HQ.Block.RentFree";
  if (hq.ip < HQ_COST) return "NEONHUB.HQ.Block.NoIP";
  return null;
}

export function upgradeBlocker(hq, key) {
  const imp = hq.improvements[key];
  if (!IMPROVEMENTS[key] || !imp) return "NEONHUB.HQ.Block.Unknown";
  if (!isActive(hq)) return "NEONHUB.HQ.Block.NoAccess";
  if (!imp.owned) return "NEONHUB.HQ.Block.NotOwned";
  if (imp.upgrades >= maxUpgrades(key, hq)) return "NEONHUB.HQ.Block.MaxUpgrades";
  if (hq.ip < HQ_COST) return "NEONHUB.HQ.Block.NoIP";
  return null;
}

export function beds(hq) {
  const rr = hq.improvements.rentReduction;
  return hq.housing.beds + (rr.owned ? rr.upgrades : 0);
}

export function monthlyRent(hq) {
  if (hq.housing.rentFree) return 0;
  const rr = hq.improvements.rentReduction;
  if (rr.owned && hq.housing.reducedRent !== null) return hq.housing.reducedRent;
  return hq.housing.rent;
}

export function moraleLevel(hq) {
  const mb = hq.improvements.moraleBoost;
  return mb.owned ? mb.upgrades : 0;
}

/** Morale Boost levels whose benefit currently applies (later levels replace earlier ones). */
export function activeMoraleLevels(hq) {
  const level = moraleLevel(hq);
  const owned = Array.from({ length: level }, (_, i) => i + 1);
  const replaced = new Set(owned.flatMap((l) => MORALE_REPLACES[l] ?? []));
  return owned.filter((l) => !replaced.has(l));
}

/** Dice formula for monthly Humanity restoration, or null if none. Cyberpunk RED rounds down. */
export function humanityFormula(hq) {
  if (!isActive(hq)) return null;
  const levels = activeMoraleLevels(hq);
  if (levels.includes(9)) return "2d6kh";
  if (levels.includes(4)) return "1d6";
  if (levels.includes(1)) return "floor(1d6/2)";
  return null;
}

export function luckBonus(hq) {
  if (!isActive(hq)) return 0;
  const level = moraleLevel(hq);
  return (level >= 3 ? 1 : 0) + (level >= 7 ? 1 : 0);
}

/** Points added to BODY for natural healing (Medbay +2, Morale Boost level 2 +1; they stack). */
export function healingBodyBonus(hq) {
  if (!isActive(hq)) return 0;
  return (hq.improvements.medbay.owned ? 2 : 0) + (moraleLevel(hq) >= 2 ? 1 : 0);
}

export function lifestyleDiscount(hq) {
  return isActive(hq) && hq.improvements.moraleBoost.owned ? 50 : 0;
}

/* ------------------------------------------ */
/*  Storage (world setting, GM writes only)   */
/* ------------------------------------------ */

export const HQStore = {
  register() {
    game.settings.register(MODULE_ID, HQ_SETTING, {
      scope: "world",
      config: false,
      type: Object,
      default: {},
      onChange: () => Hooks.callAll(`${MODULE_ID}.hqChanged`)
    });
  },

  raw() {
    try {
      return game.settings.get(MODULE_ID, HQ_SETTING) ?? {};
    } catch {
      return {};
    }
  },

  all() {
    return Object.values(this.raw()).map((h) => normalizeHQ(h)).sort((a, b) => a.name.localeCompare(b.name));
  },

  get(id) {
    const raw = this.raw()[id];
    return raw ? normalizeHQ(raw) : null;
  },

  /** HQs this user may open: GM sees all; players see HQs whose crew includes a character they own. */
  visibleTo(user = game.user) {
    return this.all().filter((hq) => canView(hq, user));
  },

  async save(hq) {
    if (!game.user.isGM) throw new Error(game.i18n.localize("NEONHUB.Error.GMOnly"));
    const all = deepClone(this.raw());
    all[hq.id] = normalizeHQ(hq);
    await game.settings.set(MODULE_ID, HQ_SETTING, all);
    return all[hq.id];
  },

  async delete(id) {
    if (!game.user.isGM) throw new Error(game.i18n.localize("NEONHUB.Error.GMOnly"));
    const all = deepClone(this.raw());
    delete all[id];
    await game.settings.set(MODULE_ID, HQ_SETTING, all);
  }
};

export function canView(hq, user = game.user) {
  if (user.isGM || hq.playersSeeAll) return true;
  return hq.crew.some((uuid) => {
    try {
      return fromUuidSync(uuid)?.testUserPermission?.(user, "OWNER");
    } catch {
      return false;
    }
  });
}

export function logEntry(hq, text, delta = 0) {
  hq.log.push({ t: Date.now(), text, delta, user: game.user.name });
  if (hq.log.length > 200) hq.log = hq.log.slice(-200);
}
