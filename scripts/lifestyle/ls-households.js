import { MODULE_ID } from "../constants.js";
import { CATEGORIES, describeItem } from "./ls-data.js";
import { normalizeHousehold, rentShare } from "./ls-household-data.js";

const { deepClone } = foundry.utils;

export const HH_SETTING = "households";

/** World actor for a uuid, without awaiting (inhabitants are world actors). */
function actorOf(uuid) {
  const id = /^Actor\.([^.]+)$/.exec(uuid)?.[1];
  return id ? game.actors.get(id) ?? null : null;
}

/**
 * Households, in a world setting the GM writes. Each one is shown to its inhabitants' Lifestyle as
 * a home of their own (see extraItems), so their bills, slots and Humanity checks include it.
 */
export const HouseholdStore = {
  register() {
    game.settings.register(MODULE_ID, HH_SETTING, {
      scope: "world",
      config: false,
      type: Object,
      default: { list: [] },
      onChange: () => Hooks.callAll(`${MODULE_ID}.lifestyleChanged`)
    });
  },

  all() {
    let raw;
    try {
      raw = game.settings.get(MODULE_ID, HH_SETTING);
    } catch {
      return [];
    }
    return (raw?.list ?? []).map((h) => normalizeHousehold(h));
  },

  get(id) {
    return this.all().find((h) => h.id === id) ?? null;
  },

  /** The household a character lives in (the first, if the GM put them in more than one). */
  forActor(actor) {
    if (!actor?.uuid) return null;
    return this.all().find((h) => h.inhabitants.includes(actor.uuid)) ?? null;
  },

  /** The household's inhabitants that still exist. */
  inhabitants(hh) {
    return hh.inhabitants.map(actorOf).filter(Boolean);
  },

  /** Houseware switched on by the household's inhabitants: it all shares the home's slots. */
  houseware(hh, except = null) {
    const out = [];
    for (const actor of this.inhabitants(hh)) {
      if (actor.uuid === except) continue;
      for (const item of actor.items ?? []) {
        if (item.type !== "gear") continue;
        const d = describeItem(item, MODULE_ID);
        if (d?.active && d.category === "houseware") out.push({ ...d, owner: actor.name });
      }
    }
    return out;
  },

  /**
   * What a character's Lifestyle adds for their household: the home itself (their share of the rent
   * as its monthly cost), and their housemates' houseware (counted against the shared slots, never
   * billed or shown as theirs).
   */
  extraItems(actor) {
    const hh = this.forActor(actor);
    if (!hh) return [];
    const home = {
      id: `household-${hh.id}`,
      uuid: null,
      name: hh.name,
      img: hh.img,
      ...hh.home,
      category: "housing",
      group: CATEGORIES.housing.group,
      monthly: rentShare(hh, actor.uuid),
      amount: 1,
      price: 0,
      active: true,
      virtual: true,
      household: hh.id
    };
    const foreign = this.houseware(hh, actor.uuid).map((d) => ({ ...d, id: `foreign-${d.id}`, foreign: true }));
    return [home, ...foreign];
  },

  /* ---------------------------------------- */
  /*  Writing (GM)                            */
  /* ---------------------------------------- */

  async _save(list) {
    if (!game.user.isGM) throw new Error(game.i18n.localize("NEONHUB.Error.GMOnly"));
    await game.settings.set(MODULE_ID, HH_SETTING, { list: list.map((h) => normalizeHousehold(h)) });
  },

  async create(data) {
    const list = this.all();
    const hh = normalizeHousehold({ ...data, id: foundry.utils.randomID(12) });
    list.push(hh);
    await this._save(list);
    return hh;
  },

  async update(id, changes) {
    const list = this.all();
    const index = list.findIndex((h) => h.id === id);
    if (index < 0) return null;
    list[index] = normalizeHousehold({ ...list[index], ...deepClone(changes), id });
    await this._save(list);
    return list[index];
  },

  async remove(id) {
    await this._save(this.all().filter((h) => h.id !== id));
  }
};
