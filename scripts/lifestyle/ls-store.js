import { MODULE_ID, THEMES, DEFAULT_THEME } from "../constants.js";
import { HQStore, isActive, lifestyleDiscount, monthlyRent } from "../hq/hq-data.js";
import { CalendarStore } from "../calendar/cal-store.js";
import { nextRentDay } from "../calendar/cal-dates.js";
import { CATEGORIES, LS_FLAG, defaultLifestyle, describeItem, monthsOwed } from "./ls-data.js";
import { ERAS, DEFAULT_ERA } from "./ls-2070.js";
import { HouseholdStore } from "./ls-households.js";

const { deepClone } = foundry.utils;

/** World setting with the shared lifestyle month and the window theme. */
export const LS_STATE_SETTING = "lifestyleState";
export const LS_MANAGE_SETTING = "lifestylePlayerManage";
export const LS_DEBT_SETTING = "lifestyleAllowDebt";
export const LS_AUTOBILL_SETTING = "lifestyleAutoBill";
export const LS_ERA_SETTING = "lifestyleEra";
/** Actor flag with that character's billing record. */
export const LS_ACTOR_FLAG = "lifestyleState";
/** World folder that homebrew lifestyle items are created in. */
export const LS_FOLDER_FLAG = "lifestyleFolder";
export const LS_PACK = `${MODULE_ID}.lifestyle`;
/** The compendium of an era's lifestyle items. */
export const eraPack = (era) => `${MODULE_ID}.${(ERAS[era] ?? ERAS[DEFAULT_ERA]).pack}`;

export const LifestyleStore = {
  register() {
    game.settings.register(MODULE_ID, LS_STATE_SETTING, {
      scope: "world",
      config: false,
      type: Object,
      default: { month: 1, theme: DEFAULT_THEME },
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
    game.settings.register(MODULE_ID, LS_AUTOBILL_SETTING, {
      name: "NEONHUB.Lifestyle.Setting.AutoBill",
      hint: "NEONHUB.Lifestyle.Setting.AutoBillHint",
      scope: "world",
      config: true,
      type: Boolean,
      default: false
    });
    game.settings.register(MODULE_ID, LS_ERA_SETTING, {
      name: "NEONHUB.Lifestyle.Setting.Era",
      hint: "NEONHUB.Lifestyle.Setting.EraHint",
      scope: "world",
      config: true,
      type: String,
      choices: { 2045: "NEONHUB.Lifestyle.Era.2045", 2070: "NEONHUB.Lifestyle.Era.2070" },
      default: DEFAULT_ERA,
      onChange: () => Hooks.callAll(`${MODULE_ID}.lifestyleEraChanged`)
    });
  },

  /** The campaign's lifestyle era: "2045" (Time of the Red) or "2070" (the Living & Humanity Rework). */
  get era() {
    try {
      const era = String(game.settings.get(MODULE_ID, LS_ERA_SETTING));
      return ERAS[era] ? era : DEFAULT_ERA;
    } catch {
      return DEFAULT_ERA;
    }
  },

  /** The 2070s rules are on: rent-day Humanity, tiers, slots and art. */
  get rules2070() {
    return !!ERAS[this.era].rules;
  },

  /** The catalog's compendium for this era. */
  get pack() {
    return eraPack(this.era);
  },

  get autoBill() {
    try {
      return !!game.settings.get(MODULE_ID, LS_AUTOBILL_SETTING);
    } catch {
      return false;
    }
  },

  /**
   * Which month a character is billed for and how many they owe.
   * With calendars, the character's calendar sets the month (its rent periods);
   * without any, the shared month counter in this module's state does.
   * @returns {{ mode: "calendar"|"counter", calendar, period, owed, label, firstLabel, next }}
   */
  billing(actor) {
    const state = this.actorState(actor);
    const calendar = CalendarStore.all().length ? CalendarStore.forActor(actor) : null;
    if (calendar) {
      const period = CalendarStore.period(calendar);
      const owed = monthsOwed({ period, paidPeriod: state.paidPeriod });
      return {
        mode: "calendar",
        calendar,
        period,
        owed,
        label: CalendarStore.periodLabel(period),
        firstLabel: CalendarStore.periodLabel(period - Math.max(owed, 1) + 1),
        next: nextRentDay(calendar, calendar.rentDay)
      };
    }
    const month = this.month;
    const owed = state.paidMonth >= month ? 0 : 1;
    const label = this.monthLabel(month);
    return { mode: "counter", calendar: null, period: month, owed, label, firstLabel: label, next: null };
  },

  get state() {
    let raw = {};
    try {
      raw = game.settings.get(MODULE_ID, LS_STATE_SETTING) ?? {};
    } catch { /* not registered yet */ }
    const month = Math.max(1, Math.floor(Number(raw.month) || 1));
    return { month, theme: THEMES[raw.theme] ? raw.theme : DEFAULT_THEME };
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

  /**
   * A character's billing record: the last counter month and calendar rent period paid
   * (null if never billed by calendar), and recent bills.
   */
  actorState(actor) {
    const raw = actor?.getFlag?.(MODULE_ID, LS_ACTOR_FLAG) ?? {};
    const pp = Number(raw.paidPeriod);
    return {
      paidMonth: Math.max(0, Math.floor(Number(raw.paidMonth) || 0)),
      paidPeriod: raw.paidPeriod === null || raw.paidPeriod === undefined || !Number.isFinite(pp) ? null : Math.floor(pp),
      history: Array.isArray(raw.history) ? deepClone(raw.history) : [],
      // 2070s: the month (billing period) of the last rent-day Humanity check, and when one is due
      humanityPeriod: Number.isFinite(Number(raw.humanityPeriod)) && raw.humanityPeriod !== null ? Math.floor(Number(raw.humanityPeriod)) : null,
      humanityDue: Number.isFinite(Number(raw.humanityDue)) && raw.humanityDue !== null ? Math.floor(Number(raw.humanityDue)) : null
    };
  },

  /**
   * Every lifestyle item the actor has, described, plus their household's home (their share of its
   * rent) and their housemates' houseware (marked foreign: it shares the home's slots only).
   */
  items(actor) {
    const own = (actor?.items ?? []).filter((i) => i.type === "gear").map((i) => describeItem(i, MODULE_ID)).filter(Boolean);
    return [...own, ...HouseholdStore.extraItems(actor)];
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
