import { MODULE_ID } from "../constants.js";
import { clampDate, sameDate, periodOf, periodMonth } from "./cal-dates.js";
import { validTimeZone } from "./moon.js";

const { deepClone } = foundry.utils;

export const CAL_SETTING = "calendars";
export const CAL_ZONE_SETTING = "calendarMoonZone";
export const CAL_SYSTEM_YEARS = { "cyberpunk-red-core": 2045, cyberpunk2020: 2020 };
export const NIGHT_CITY_ZONE = "America/Los_Angeles";

/** Accents a calendar can take; the first is the default. */
export const ACCENTS = ["#ff2a6d", "#05d9e8", "#f3e600", "#ff4fd8", "#39ff88", "#ff8a1f", "#9d4dff", "#e6e6f0"];

/**
 * Group calendars. One world setting holds them all, so only a GM writes and every
 * client hears about a change at once. Each calendar has its own date, its players
 * (none = everyone sees it) and a rent day; characters follow the calendar their
 * player is on, or the first calendar.
 */
export const CalendarStore = {
  register() {
    game.settings.register(MODULE_ID, CAL_SETTING, {
      scope: "world",
      config: false,
      type: Object,
      default: { list: [] },
      onChange: (value) => Hooks.callAll(`${MODULE_ID}.calendarChanged`, value?.list ?? [])
    });
    game.settings.register(MODULE_ID, CAL_ZONE_SETTING, {
      name: "NEONHUB.Calendar.Setting.Zone",
      hint: "NEONHUB.Calendar.Setting.ZoneHint",
      scope: "world",
      config: true,
      type: String,
      default: NIGHT_CITY_ZONE,
      onChange: () => Hooks.callAll(`${MODULE_ID}.calendarChanged`, null)
    });
    game.settings.register(MODULE_ID, "calendarWeekStart", {
      name: "NEONHUB.Calendar.Setting.WeekStart",
      hint: "NEONHUB.Calendar.Setting.WeekStartHint",
      scope: "client",
      config: true,
      type: Number,
      choices: { 1: "NEONHUB.Calendar.Setting.Monday", 0: "NEONHUB.Calendar.Setting.Sunday" },
      default: 1,
      onChange: () => Hooks.callAll(`${MODULE_ID}.calendarChanged`, null)
    });
    game.settings.register(MODULE_ID, "calendarShowMoon", {
      name: "NEONHUB.Calendar.Setting.Moon",
      hint: "NEONHUB.Calendar.Setting.MoonHint",
      scope: "client",
      config: true,
      type: Boolean,
      default: true,
      onChange: () => Hooks.callAll(`${MODULE_ID}.calendarChanged`, null)
    });
    game.settings.register(MODULE_ID, "calendarNotify", {
      name: "NEONHUB.Calendar.Setting.Notify",
      hint: "NEONHUB.Calendar.Setting.NotifyHint",
      scope: "client",
      config: true,
      type: Boolean,
      default: true
    });
    game.settings.register(MODULE_ID, "calendarActive", { scope: "client", config: false, type: String, default: "" });
    game.settings.register(MODULE_ID, "calendarPopout", { scope: "client", config: false, type: Boolean, default: false });
  },

  defaultDate() {
    return { year: CAL_SYSTEM_YEARS[game.system?.id] ?? 2045, month: 1, day: 1 };
  },

  normalize(raw = {}) {
    const date = clampDate(raw.year ? raw : this.defaultDate());
    return {
      id: String(raw.id || foundry.utils.randomID(12)),
      name: String(raw.name ?? "").trim() || "—",
      color: /^#[0-9a-f]{6}$/i.test(raw.color ?? "") ? raw.color : ACCENTS[0],
      players: Array.isArray(raw.players) ? [...new Set(raw.players.filter((p) => typeof p === "string" && p))] : [],
      rentDay: Math.min(31, Math.max(1, Math.floor(Number(raw.rentDay)) || 1)),
      // Moves on a day each time the world clock passes midnight (with SmallTime).
      clock: raw.clock !== false,
      // Night City Weather: the weekday a forecast is issued (0 Sunday … 6 Saturday, -1 none),
      // keeping weather planned ahead, and posting forecasts to chat.
      weather: {
        forecastDay: Number.isInteger(raw.weather?.forecastDay) && raw.weather.forecastDay >= -1 && raw.weather.forecastDay <= 6 ? raw.weather.forecastDay : 1,
        auto: raw.weather?.auto !== false,
        chat: raw.weather?.chat !== false
      },
      ...date
    };
  },

  all() {
    let raw;
    try {
      raw = game.settings.get(MODULE_ID, CAL_SETTING);
    } catch {
      return [];
    }
    return (raw?.list ?? []).map((c) => this.normalize(c));
  },

  get(idOrName) {
    const list = this.all();
    return list.find((c) => c.id === idOrName) ?? list.find((c) => c.name === idOrName) ?? null;
  },

  /** No players ticked: everyone sees it. Some ticked: only they and the GM. */
  canSee(calendar, user = game.user) {
    return user.isGM || !calendar.players.length || calendar.players.includes(user.id);
  },

  visibleTo(user = game.user) {
    return this.all().filter((c) => this.canSee(c, user));
  },

  get zone() {
    let tz = NIGHT_CITY_ZONE;
    try {
      tz = game.settings.get(MODULE_ID, CAL_ZONE_SETTING) || NIGHT_CITY_ZONE;
    } catch { /* not registered */ }
    return validTimeZone(tz) ? tz : "UTC";
  },

  /* ---------------------------------------- */
  /*  Who follows which calendar              */
  /* ---------------------------------------- */

  /** The calendar a character lives by: the one their player is on, else the first one. */
  forActor(actor) {
    const list = this.all();
    if (!list.length || !actor) return list[0] ?? null;
    const owners = game.users.filter((u) => !u.isGM && actor.testUserPermission?.(u, "OWNER")).map((u) => u.id);
    return list.find((c) => c.players.some((p) => owners.includes(p))) ?? list[0];
  },

  /** A Headquarters' calendar: the one picked on its setup, else its crew's, else the first. */
  forHQ(hq) {
    const list = this.all();
    if (!list.length) return null;
    if (hq?.calendarId) {
      const chosen = list.find((c) => c.id === hq.calendarId);
      if (chosen) return chosen;
    }
    for (const uuid of hq?.crew ?? []) {
      let actor = null;
      try { actor = fromUuidSync(uuid); } catch { /* ignore */ }
      if (actor) return this.forActor(actor);
    }
    return list[0];
  },

  period(calendar) {
    return periodOf(calendar, calendar.rentDay);
  },

  /** "November 2045" for a rent period. */
  periodLabel(period) {
    const { year, month } = periodMonth(period);
    return `${game.i18n.localize(`NEONHUB.Calendar.Month.${month}`)} ${year}`;
  },

  /* ---------------------------------------- */
  /*  Writing (GM)                            */
  /* ---------------------------------------- */

  async _save(list) {
    if (!game.user.isGM) throw new Error(game.i18n.localize("NEONHUB.Error.GMOnly"));
    await game.settings.set(MODULE_ID, CAL_SETTING, { list: list.map((c) => this.normalize(c)) });
  },

  async create(data = {}) {
    const list = this.all();
    const calendar = this.normalize({
      ...this.defaultDate(),
      color: ACCENTS[list.length % ACCENTS.length],
      name: game.i18n.format("NEONHUB.Calendar.DefaultName", { n: list.length + 1 }),
      ...data,
      id: foundry.utils.randomID(12)
    });
    list.push(calendar);
    await this._save(list);
    return calendar;
  },

  async update(id, changes) {
    const list = this.all();
    const calendar = list.find((c) => c.id === id);
    if (!calendar) return null;
    for (const key of ["name", "color", "players", "rentDay", "clock", "weather"]) if (key in changes) calendar[key] = deepClone(changes[key]);
    await this._save(list);
    return this.get(id);
  },

  async duplicate(id) {
    const source = this.get(id);
    if (!source) return null;
    return this.create({ ...source, name: game.i18n.format("NEONHUB.Calendar.CopyName", { name: source.name }) });
  },

  async remove(id) {
    await this._save(this.all().filter((c) => c.id !== id));
  },

  async move(id, offset) {
    const list = this.all();
    const from = list.findIndex((c) => c.id === id);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= list.length) return;
    list.splice(to, 0, list.splice(from, 1)[0]);
    await this._save(list);
  },

  /** Set the date only; CalendarOps.setDate also runs rent days. */
  async writeDate(id, date) {
    const list = this.all();
    const calendar = list.find((c) => c.id === id);
    if (!calendar) return null;
    const before = { year: calendar.year, month: calendar.month, day: calendar.day };
    const after = clampDate(date);
    if (sameDate(before, after)) return { calendar, before, after, changed: false };
    Object.assign(calendar, after);
    await this._save(list);
    return { calendar: this.get(id), before, after, changed: true };
  }
};
