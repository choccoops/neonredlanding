import { MODULE_ID, SYSTEM_ID } from "../constants.js";
import { flagsOf } from "./range-mods.js";
import { AF, autofireTableOf } from "./autofire-mods.js";

/** Upgrade flag: what it does to a burst's rounds ({ slugs, shells, shellDodge }, { double }, { tenTo }, { twentyPlus }, { less, min }). */
export const BURST_FLAG = "burstMod";
/** Weapon flag: the rounds its own Autofire and Suppressive Fire spend, when its card says (Cyberpunk RED spends 10). */
export const ROUNDS_FLAG = "autofireRounds";
const WRAPPED = `${MODULE_ID}Burst`;

/** The book's burst attachments, for copies made before they carried flags (a test keeps this in step with the pack). */
export const BURST_BY_NAME = {
  "Shotgun Automatic Control Group": { slugs: 4, shells: 4, shellDodge: -3 },
  "Gatling Barrel": { double: true },
  "Efficient Autosear": { tenTo: 6 },
  "Superior Autosear": { twentyPlus: true },
  "Burst Governor": { less: 5, min: 5 }
};

const cardText = (weapon) => String(weapon?.system?.description?.value ?? "").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ");

/**
 * What a weapon's own card says about the rounds it spends, read from its text so copies already on
 * sheets count too: { autofire: rounds an Autofire spends | null, burst: { rounds, every, short } | null }.
 * A burst is what one Single Shot fires ("every": every attack); `short` says what happens with fewer
 * rounds left than a burst: "refuse" (it won't fire) or "empty" (it fires what's left).
 */
export function cardRounds(weapon) {
  const t = cardText(weapon);
  const af = t.match(/Autofire uses (\d+) (?:rounds|shells)/i);
  const b = t.match(/(Single Shot fires|Every shot is) an? (\d+)-round burst([^.]*)\./i);
  const burst = b ? { rounds: Number(b[2]), every: /every/i.test(b[1]), short: /won't fire/i.test(b[3]) ? "refuse" : "empty" } : null;
  return { autofire: af ? Number(af[1]) : null, burst: burst && burst.rounds > 1 ? burst : null };
}

/** The rounds one Single Shot spends: a burst gun's count (what's left, when it fires short), else 1. */
export function shotRounds(weapon, left = Infinity) {
  const { burst } = cardRounds(weapon);
  if (!burst) return 1;
  return burst.short === "refuse" ? burst.rounds : Math.max(1, Math.min(burst.rounds, Number(left) || 0));
}

/** What an upgrade does to a burst's rounds, or null. */
export function burstModOf(upgrade) {
  if (upgrade?.type !== "itemUpgrade") return null;
  return flagsOf(upgrade)[BURST_FLAG] ?? BURST_BY_NAME[String(upgrade.name ?? "").trim()] ?? null;
}

/**
 * The rounds an Autofire or Suppressive Fire attack spends with these upgrades and this ammo loaded.
 * - Shotgun Automatic Control Group: an Autofire burst of slugs spends 4; with shells, Autofire is the
 *   Shotgun Shell attack made with the Autofire Skill, for 4 shells.
 * - Gatling Barrel: double, Autofire and Suppressive Fire.
 * - Efficient Autosear: an Autofire that spends 10 spends 6 (not on machine guns).
 * - Superior Autosear: an Autofire that spends 20 spends 10; more than 20 is halved, rounding up.
 * - Burst Governor: 5 fewer, Autofire and Suppressive Fire, to no fewer than 5 (a burst already under 5 stays).
 * In that order: the gun's own count, the control group's slugs, the Gatling Barrel, the autosears, the governor.
 * @param {"autofire"|"suppressive"} mode
 */
export function burstRounds(weapon, mode, upgrades = [], ammoVariety = "") {
  const mods = upgrades.map(burstModOf).filter(Boolean);
  const group = mods.find((m) => m.slugs || m.shells);
  if (mode === "autofire" && group?.shells && ammoVariety === "shotgunShell") return group.shells;
  let n = Number(flagsOf(weapon)[ROUNDS_FLAG]) || cardRounds(weapon).autofire || 10;
  if (mode === "autofire" && group?.slugs && ammoVariety === "shotgunSlug") n = group.slugs;
  if (mods.some((m) => m.double)) n *= 2;
  if (mode === "autofire") {
    const efficient = mods.find((m) => m.tenTo);
    if (efficient && n === 10 && autofireTableOf(weapon) !== AF.mg) n = efficient.tenTo;
    else if (mods.some((m) => m.twentyPlus) && n >= 20) n = n === 20 ? 10 : Math.ceil(n / 2);
  }
  const governor = mods.find((m) => m.less);
  if (governor && n > (governor.min ?? 0)) n = Math.max(governor.min ?? 0, n - governor.less);
  return n;
}

/** The control group's shell rule for this gun, with what's loaded: { shells, shellDodge } or null. */
export function shellAutofire(upgrades = [], ammoVariety = "") {
  if (ammoVariety !== "shotgunShell") return null;
  const group = upgrades.map(burstModOf).find((m) => m?.shells);
  return group ? { shells: group.shells, shellDodge: group.shellDodge ?? 0 } : null;
}

/**
 * Cyberpunk RED spends 10 rounds on every Autofire and Suppressive Fire attack (its bulletConsumption, which
 * its ammo check and its discharge both ask). It gives each item that method afresh whenever the item's data
 * is prepared (loadMixins), so the wrap goes there: the item's own count, then the attachments'.
 */
export const BurstRounds = {
  patch(proto = CONFIG.Item?.documentClass?.prototype) {
    if (!proto || typeof proto.loadMixins !== "function" || proto[WRAPPED]) return false;
    proto[WRAPPED] = true;
    const load = proto.loadMixins;
    proto.loadMixins = function (...args) {
      const out = load.apply(this, args);
      const own = this.bulletConsumption;
      if (typeof own === "function" && !own[WRAPPED]) {
        const wrapped = function (cprRoll) {
          const n = own.call(this, cprRoll);
          // One shot: a burst gun spends its burst (Cyberpunk RED's own ammo check then refuses a gun that won't fire short).
          if (!(n > 1)) {
            try {
              return n === 1 ? shotRounds(this, this.system?.magazine?.value) : n;
            } catch (err) {
              console.warn(`${MODULE_ID} | burst rounds`, err);
              return n;
            }
          }
          try {
            return BurstRounds.rounds(this) ?? n;
          } catch (err) {
            console.warn(`${MODULE_ID} | burst rounds`, err);
            return n;
          }
        };
        wrapped[WRAPPED] = true;
        this.bulletConsumption = wrapped;
      }
      return out;
    };
    return true;
  },

  /** What this item's Autofire or Suppressive Fire spends now (its fire mode is the actor's flag, as CPR keeps it). */
  rounds(item) {
    const actor = item.actor ?? item.parent;
    const mode = actor?.flags?.[SYSTEM_ID]?.[`firetype-${item.id}`] === "suppressive" ? "suppressive" : "autofire";
    const installed = (item.system?.installedItems?.list ?? []).map((id) => actor?.items?.get(id)).filter(Boolean);
    const ammo = installed.find((i) => i.type === "ammo");
    return burstRounds(item, mode, installed.filter((i) => i.type === "itemUpgrade"), String(ammo?.system?.variety ?? ""));
  }
};
