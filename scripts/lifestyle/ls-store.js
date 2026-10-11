import { MODULE_ID, THEMES } from "../constants.js";
import { HQStore, isActive, lifestyleDiscount, monthlyRent } from "../hq/hq-data.js";
import { CATEGORIES, LS_FLAG, defaultLifestyle, describeItem } from "./ls-data.js";

const { deepClone } = foundry.utils;

/** World setting with the shared lifestyle month and the window theme. */
export const LS_STATE_SETTING = "lifestyleState";
export const LS_MANAGE_SETTING = "lifestylePlayerManage";
export const LS_DEBT_SETTING = "lifestyleAllowDebt";
/** Actor flag with that character's billing record. */
export const LS_ACTOR_FLAG = "lifestyleState";
/** World folder that homebrew lifestyle items are created in. */
export const LS_FOLDER_FLAG = "lifestyleFolder";
export const LS_PACK = `${MODULE_ID}.lifestyle`;

export const LifestyleStore = {
  register() {
    game.settings.register(MODULE_ID, LS_STATE_SETTING, {
      scope: "world",
      config: false,
      type: Object,
      default: { month: 1, theme: "neon" },
      onChange: () => Hooks.callAll(`${MODULE_ID}.lifestyleChanged`)
    });
    game.settings.register(MODULE_ID, LS_MANAGE_SETTING, {
      name: "NEONHUB.Lifestyle.Setting.Manage",
      hint: "NEONHUB.Lifestyle.Setting.ManageHint",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
      onChange: () => Hooks.callAll(`${MODULE_ID}.lifestyleChanged`)
    });
    game.settings.register(MODULE_ID, LS_DEBT_SETTING, {
      name: "NEONHUB.Lifestyle.Setting.Debt",
      hint: "NEONHUB.Lifestyle.Setting.DebtHint",
      scope: "world",
      config: true,
      type: Boolean,
      default: true
    });
  },

  get state() {
    let raw = {};
    try {
      raw = game.settings.get(MODULE_ID, LS_STATE_SETTING) ?? {};
    } catch { /* not registered yet */ }
    const month = Math.max(1, Math.floor(Number(raw.month) || 1));
    return { month, theme: THEMES[raw.theme] ? raw.theme : "neon" };
  },

  async setState(changes) {
    if (!game.user.isGM) throw new Error(game.i18n.localize("NEONHUB.Error.GMOnly"));
    const raw = deepClone(game.settings.get(MODULE_ID, LS_STATE_SETTING) ?? {});
    await game.settings.set(MODULE_ID, LS_STATE_SETTING, { ...raw, ...changes });
  },

  get month() {
    return this.state.month;
  },

  get playersManage() {
    try {
      return !!game.settings.get(MODULE_ID, LS_MANAGE_SETTING);
    } catch {
      return true;
    }
  },

  get allowDebt() {
    try {
      return !!game.settings.get(MODULE_ID, LS_DEBT_SETTING);
    } catch {
      return true;
    }
  },

  /** "Month 3", or the Simple Calendar month name when that module is running. */
  monthLabel(month = this.month) {
    const sc = game.modules.get("foundryvtt-simple-calendar")?.active ? globalThis.SimpleCalendar?.api : null;
    if (sc && month === this.month) {
      try {
        const m = sc.getCurrentMonth?.();
        const y = sc.getCurrentYear?.();
        if (m?.name) return y?.numericRepresentation ? `${m.name} ${y.numericRepresentation}` : m.name;
      } catch { /* fall back */ }
    }
    return game.i18n.format("NEONHUB.Lifestyle.MonthN", { n: month });
  },

  /* ---------------------------------------- */
  /*  Characters                              */
  /* ---------------------------------------- */

  /** A character's billing record: the last month paid and recent bills. */
  actorState(actor) {
    const raw = actor?.getFlag?.(MODULE_ID, LS_ACTOR_FLAG) ?? {};
    return {
      paidMonth: Math.max(0, Math.floor(Number(raw.paidMonth) || 0)),
      history: Array.isArray(raw.history) ? deepClone(raw.history) : []
    };
  },

  /** Every lifestyle item the actor has, described. */
  items(actor) {
    return (actor?.items ?? []).filter((i) => i.type === "gear").map((i) => describeItem(i, MODULE_ID)).filter(Boolean);
  },

  /** Characters with a player owner: the ones lifestyle billing is for. */
  characters() {
    return game.actors
      .filter((a) => a.type === "character" && a.hasPlayerOwner)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  /** Characters this user can open the Lifestyle window for. */
  viewable(user = game.user) {
    if (user.isGM) return this.characters();
    return game.actors.filter((a) => a.type === "character" && a.testUserPermission(user, "OWNER")).sort((a, b) => a.name.localeCompare(b.name));
  },

  canManage(actor, user = game.user) {
    return user.isGM || (this.playersManage && !!actor?.testUserPermission(user, "OWNER"));
  },

  /* ---------------------------------------- */
  /*  Headquarters                            */
  /* ---------------------------------------- */

  /** Headquarters whose crew includes this actor. */
  hqsFor(actor) {
    if (!actor) return [];
    return HQStore.all().filter((hq) => hq.crew.includes(actor.uuid));
  },

  /** Morale Boost: Lifestyle costs 50eb less for crew of an active HQ that has it. */
  moraleDiscount(actor) {
    return this.hqsFor(actor).reduce((best, hq) => Math.max(best, lifestyleDiscount(hq)), 0);
  },

  hqSummary(actor) {
    return this.hqsFor(actor).map((hq) => {
      const rent = monthlyRent(hq);
      const crew = Math.max(1, hq.crew.length);
      return {
        id: hq.id,
        name: hq.name,
        active: isActive(hq),
        status: hq.status,
        rent,
        share: Math.ceil(rent / crew),
        rentPaid: hq.housing.rentPaid,
        discount: lifestyleDiscount(hq)
      };
    });
  },

  /* ---------------------------------------- */
  /*  Item data                               */
  /* ---------------------------------------- */

  icon(category) {
    return `modules/${MODULE_ID}/assets/lifestyle/${CATEGORIES[category]?.img ?? "other"}.svg`;
  },

  /** Data for a new homebrew lifestyle item of a category. */
  newItemData(category, { name, folder } = {}) {
    const ls = defaultLifestyle(category);
    if (category === "lifestyle") ls.tier = 1;
    if (category === "loan") Object.assign(ls.loan, { kind: "interest", ratePct: 10 });
    return {
      name: name || game.i18n.format("NEONHUB.Lifestyle.NewItemName", { category: game.i18n.localize(`NEONHUB.Lifestyle.Category.${category}`) }),
      type: "gear",
      img: this.icon(category),
      folder: folder ?? null,
      system: {
        description: { value: "" },
        usage: "equipped",
        equipped: "owned",
        price: { market: 0 },
        source: { book: "Homebrew", page: 0 }
      },
      flags: { [MODULE_ID]: { [LS_FLAG]: ls } }
    };
  },

  /** The world folder homebrew items go into, made on first use. */
  async homebrewFolder() {
    const id = game.settings.get(MODULE_ID, LS_STATE_SETTING)?.[LS_FOLDER_FLAG];
    const existing = id ? game.folders.get(id) : null;
    if (existing) return existing;
    const folder = await Folder.create({ name: game.i18n.localize("NEONHUB.Lifestyle.FolderName"), type: "Item", color: "#ff2a6d" });
    await this.setState({ [LS_FOLDER_FLAG]: folder.id });
    return folder;
  }
};
