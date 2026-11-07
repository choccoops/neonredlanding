import { MODULE_ID } from "../constants.js";
import { CPR } from "../cpr.js";
import { cprSlug } from "../lifestyle/ls-data.js";
import { CredStore } from "../cred/cred-store.js";
import { LS_ERA_SETTING } from "../lifestyle/ls-store.js";
import { STYLES, CLASSIC, FOLD, DISTRICTS, styleOf, analyze, fitIn, reads, district } from "./fashion-data.js";

const { getProperty } = foundry.utils;
const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));

export const FASHION_FLAG = "fashion";
export const FASHION_PACK = `${MODULE_ID}.fashion-2070`;
/** Scene flag: the district the scene is in. Actor flag: the faction an NPC is known to belong to. */
export const SCENE_DISTRICT_FLAG = "district";
export const ACTOR_FACTION_FLAG = "faction";

/** Chrome you can see at a glance: limbs, borgware and external chrome (cybereyes count once). */
const VISIBLE_CHROME = ["cyberArm", "cyberLeg", "borgware"];
const FRAMES = /linear frame|grafted muscle/i;

const skillLevel = (actor, name) => {
  const skill = actor.items.find((i) => i.type === "skill" && i.name === name);
  if (!skill) return 0;
  return (Number(getProperty(skill, "system.level")) || 0) + (Number(actor.bonuses?.[cprSlug(name)]) || 0);
};
const installed = (item) => {
  try {
    return !!item.system?.isInstalled;
  } catch {
    return false;
  }
};

/** The NCPD, read like a faction (it's Heat in Street Cred, not a Standing). */
const NCPD = { id: "ncpd", name: "NCPD", kind: "other" };

export const FashionOps = {
  init() {
    // In the 2070s, the sheet's classic style names show their 2070 heir: "Kitsch (Asia Pop)".
    Hooks.once("setup", () => this.relabel());
  },

  relabel() {
    let era = null;
    try {
      era = game.settings.get(MODULE_ID, LS_ERA_SETTING);
    } catch { /* not registered yet */ }
    if (String(era) !== "2070") return;
    for (const [classic, style] of Object.entries(FOLD)) {
      const key = `CPR.global.clothing.style.${{ businesswear: "businessWear", leisurewear: "leisureWear" }[classic] ?? classic}`;
      const old = getProperty(game.i18n.translations, key);
      if (typeof old !== "string") continue;
      const label = L(`NEONHUB.Fashion.Style.${style}`);
      foundry.utils.setProperty(game.i18n.translations, key, CLASSIC[style] === classic ? label : `${label} (${old})`);
    }
  },

  /** What a character has on, as a plain kit for fashion-data.js. */
  kitOf(actor) {
    const items = actor?.items ?? [];
    const clothing = items.filter((i) => i.type === "clothing" && i.system?.equipped === "equipped").map((i) => ({
      name: i.name,
      type: i.system.type,
      style: styleOf(i.system, i.getFlag?.(MODULE_ID, FASHION_FLAG)),
      faction: i.getFlag?.(MODULE_ID, FASHION_FLAG)?.faction ?? null,
      price: Number(getProperty(i, "system.price.market")) || 0,
      uuid: i.uuid
    }));
    let visible = 0;
    let hidden = 0;
    let fashionware = 0;
    let frames = 0;
    let eyes = false;
    for (const c of items.filter((i) => i.type === "cyberware" && installed(i))) {
      const type = c.system?.type;
      if (FRAMES.test(c.name)) frames++;
      if (type === "fashionware") fashionware++;
      else if (type === "cyberEye") eyes ||= c.system?.isFoundational !== false;
      else if (type === "cyberwareExternal" || (VISIBLE_CHROME.includes(type) && c.system?.isFoundational !== false)) visible++;
      else hidden++;
    }
    if (eyes) visible++;
    let shown = 0;
    let tucked = 0;
    for (const w of items.filter((i) => i.type === "weapon")) {
      const eq = w.system?.equipped;
      const can = !!w.system?.concealable?.concealable;
      const concealed = can && !!w.system?.concealable?.isConcealed;
      if (eq === "equipped") (concealed ? tucked++ : shown++);
      else if (eq === "carried") (can ? tucked++ : shown++);
    }
    const armor = items.filter((i) => i.type === "armor" && i.system?.equipped === "equipped" && i.system?.isBodyLocation && Number(i.system?.bodyLocation?.sp) >= 11).length;
    return {
      clothing,
      chrome: { visible, hidden, fashionware, frames },
      weapons: { visible: shown, hidden: tucked },
      armor: { visible: armor },
      skills: {
        ws: skillLevel(actor, "Wardrobe & Style"),
        pg: skillLevel(actor, "Personal Grooming"),
        hp: skillLevel(actor, "Human Perception"),
        cool: Number(getProperty(actor, "system.stats.cool.value")) || 0,
        int: Number(getProperty(actor, "system.stats.int.value")) || 0
      }
    };
  },

  analyze(actor) {
    return analyze(this.kitOf(actor));
  },

  /** Street Cred's view of a character, for district fit. */
  credContext(actor) {
    const isPC = actor?.type === "character" && actor.hasPlayerOwner;
    return {
      rivals: (id) => CredStore.rivalsOf(id).map((f) => f.id),
      standing: isPC ? (id) => CredStore.standing(actor, id) : null,
      heat: isPC ? CredStore.heat(actor) : 0
    };
  },

  fit(actor, districtId, analysis = this.analyze(actor)) {
    const d = district(districtId);
    return d ? fitIn(analysis, d, this.credContext(actor)) : null;
  },

  /** Every district, best fit first. */
  fits(actor, analysis = this.analyze(actor)) {
    const ctx = this.credContext(actor);
    return DISTRICTS.map((d) => fitIn(analysis, d, ctx)).sort((a, b) => b.fit - a.fit);
  },

  /** Factions a look can read as: Street Cred's (the GM's hidden ones only for the GM) and the NCPD. */
  readableFactions() {
    return [...CredStore.factions().filter((f) => game.user.isGM || !f.hidden), NCPD];
  },

  faction(id) {
    return this.readableFactions().find((f) => f.id === id) ?? null;
  },

  reads(actor, analysis = this.analyze(actor)) {
    return reads(analysis, this.readableFactions());
  },

  /** The faction an NPC is known to belong to (the GM's tag), else the one their look reads as most, if it's clear. */
  knownFaction(actor, analysis = this.analyze(actor)) {
    const tag = actor?.getFlag?.(MODULE_ID, ACTOR_FACTION_FLAG);
    if (tag) return { id: tag, tagged: true };
    const top = this.reads(actor, analysis)[0];
    return top && top.score >= 60 ? { id: top.id, tagged: false } : null;
  },

  async tagFaction(actor, id) {
    if (!game.user.isGM) throw new Error(L("NEONHUB.Error.GMOnly"));
    return id ? actor.setFlag(MODULE_ID, ACTOR_FACTION_FLAG, id) : actor.unsetFlag(MODULE_ID, ACTOR_FACTION_FLAG);
  },

  sceneDistrict(scene = canvas?.scene) {
    const id = scene?.getFlag?.(MODULE_ID, SCENE_DISTRICT_FLAG);
    return district(id) ? id : null;
  },

  async setSceneDistrict(scene, id) {
    if (!game.user.isGM) throw new Error(L("NEONHUB.Error.GMOnly"));
    return id ? scene.setFlag(MODULE_ID, SCENE_DISTRICT_FLAG, id) : scene.unsetFlag(MODULE_ID, SCENE_DISTRICT_FLAG);
  },

  /**
   * Clothing for sale: the 2070 fashion compendium and the world's own clothing items.
   * @returns {Promise<{ name, type, style, faction, price, uuid, img }[]>}
   */
  async catalog() {
    const out = [];
    const pack = game.packs.get(FASHION_PACK);
    if (pack) {
      const index = await pack.getIndex({ fields: ["system.type", "system.style", "system.price.market", `flags.${MODULE_ID}.${FASHION_FLAG}`] });
      for (const e of index) {
        if (e.type !== "clothing") continue;
        const flag = getProperty(e, `flags.${MODULE_ID}.${FASHION_FLAG}`);
        out.push({ name: e.name, type: e.system?.type, style: styleOf(e.system, flag), faction: flag?.faction ?? null, price: Number(e.system?.price?.market) || 0, uuid: e.uuid, img: e.img });
      }
    }
    for (const i of game.items.filter((x) => x.type === "clothing" && x.testUserPermission(game.user, "LIMITED"))) {
      const flag = i.getFlag(MODULE_ID, FASHION_FLAG);
      out.push({ name: i.name, type: i.system.type, style: styleOf(i.system, flag), faction: flag?.faction ?? null, price: Number(i.system.price?.market) || 0, uuid: i.uuid, img: i.img });
    }
    return out.filter((c) => c.type);
  },

  /**
   * Buy pieces for a character: pay through the wealth ledger, then add them, worn, taking off
   * whatever they had on in those slots. Owners and the GM.
   */
  async buy(actor, uuids) {
    if (!actor?.isOwner) throw new Error(L("NEONHUB.Error.NotAllowed"));
    const docs = (await Promise.all(uuids.map((u) => fromUuid(u)))).filter((d) => d?.type === "clothing");
    if (!docs.length) return [];
    const total = docs.reduce((s, d) => s + (Number(d.system.price?.market) || 0), 0);
    if (total > CPR.getWealth(actor)) throw new Error(L("NEONHUB.Fashion.Shop.TooPoor", { total }));
    if (total) await CPR.changeWealth(actor, -total, L("NEONHUB.Fashion.Shop.Reason", { items: docs.map((d) => d.name).join(", ") }));
    const types = new Set(docs.map((d) => d.system.type));
    const off = actor.items.filter((i) => i.type === "clothing" && i.system.equipped === "equipped" && types.has(i.system.type)).map((i) => ({ _id: i.id, "system.equipped": "carried" }));
    if (off.length) await actor.updateEmbeddedDocuments("Item", off);
    const data = docs.map((d) => {
      const o = d.toObject();
      delete o._id;
      o.system.equipped = "equipped";
      return o;
    });
    return actor.createEmbeddedDocuments("Item", data);
  },

  STYLES
};
