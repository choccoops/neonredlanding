import { MODULE_ID, TEMPLATE_PATH } from "../constants.js";
import { Compat } from "../compat.js";
import { CalendarStore } from "./cal-store.js";
import { addDays, dayNumber, weekday, pad } from "./cal-dates.js";
import { dayKey } from "./cal-notes-data.js";
import { planWeather, forecastWeek, lastWeekday, parseKey } from "./weather-data.js";
import { WeatherView } from "./weather-view.js";

const { deepClone } = foundry.utils;
const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));

export const WEATHER_SETTING = "calendarWeather";
export const WEATHER_OFF_SETTING = "weatherOff";
/** How far ahead weather is kept planned, and how long past days are kept. */
const AHEAD = 35;
const KEEP = 120;

/**
 * Planned weather per calendar, in a world setting:
 * { [calendarId]: { days: { "YYYY-MM-DD": day }, forecast: { issued, days } | null, revealed: [keys] } }
 * The GM plans it; players see today's weather, the week's forecast and any day the GM reveals.
 * As with GM notes, hiding is done in the interface: world settings reach every client.
 */
export const WeatherStore = {
  /** GM writes run one at a time, each on fresh data, so a date change and a new plan can't clobber each other. */
  _ops: Promise.resolve(),

  serial(fn) {
    const job = this._ops.then(fn);
    this._ops = job.catch(() => null);
    return job;
  },

  register() {
    game.settings.register(MODULE_ID, WEATHER_SETTING, {
      scope: "world",
      config: false,
      type: Object,
      default: {},
      onChange: () => Hooks.callAll(`${MODULE_ID}.weatherChanged`)
    });
    game.settings.register(MODULE_ID, WEATHER_OFF_SETTING, {
      scope: "world",
      config: false,
      type: Array,
      default: [],
      onChange: () => Hooks.callAll(`${MODULE_ID}.weatherChanged`)
    });
  },

  all() {
    try {
      return game.settings.get(MODULE_ID, WEATHER_SETTING) ?? {};
    } catch {
      return {};
    }
  },

  /** Weather of one calendar. */
  of(calendarId) {
    const raw = this.all()[calendarId] ?? {};
    return { days: raw.days ?? {}, forecast: raw.forecast ?? null, revealed: raw.revealed ?? [] };
  },

  /** Condition keys the GM turned off. */
  get off() {
    try {
      return [...(game.settings.get(MODULE_ID, WEATHER_OFF_SETTING) ?? [])];
    } catch {
      return [];
    }
  },

  async setOff(keys) {
    await game.settings.set(MODULE_ID, WEATHER_OFF_SETTING, [...new Set(keys)]);
  },

  has(calendarId) {
    return Object.keys(this.of(calendarId).days).length > 0;
  },

  /* ---------------------------------------- */
  /*  What a viewer sees                      */
  /* ---------------------------------------- */

  /**
   * A day's weather as this user sees it: { actual } for the GM, today, past days and days the
   * GM revealed; { forecast } for days in the current forecast; null otherwise.
   */
  seen(calendar, date, user = game.user) {
    const data = this.of(calendar.id);
    const key = dayKey(date);
    const actual = data.days[key] ?? null;
    const offset = dayNumber(date) - dayNumber(calendar);
    if (user.isGM || offset <= 0 || data.revealed.includes(key)) return actual ? { actual, key } : null;
    const forecast = data.forecast?.days.find((d) => d.key === key && !d.unknown);
    return forecast ? { forecast, key } : null;
  },

  /* ---------------------------------------- */
  /*  Writing (GM)                            */
  /* ---------------------------------------- */

  async _write(calendarId, change) {
    if (!game.user.isGM) throw new Error(L("NEONHUB.Error.GMOnly"));
    const all = deepClone(this.all());
    const current = all[calendarId] ?? { days: {}, forecast: null, revealed: [] };
    all[calendarId] = { ...current, ...change(deepClone(current)) };
    await game.settings.set(MODULE_ID, WEATHER_SETTING, all);
  },

  /** GM: plan `count` days of weather from a date, replacing what was planned there. */
  plan(calendarId, from, count) {
    return this.serial(() => this._plan(calendarId, from, count));
  },

  async _plan(calendarId, from, count) {
    const calendar = CalendarStore.get(calendarId);
    if (!calendar) return;
    const before = this.of(calendarId).days[dayKey(addDays(from, -1))] ?? null;
    const planned = planWeather(from, count, { off: this.off, before });
    await this._write(calendarId, (w) => ({ days: this._prune({ ...w.days, ...planned }, calendar) }));
    // A new plan makes the current forecast stale: issue it again, quietly.
    await this._issue(calendar, { force: true, post: false });
  },

  /** GM: forget a calendar's weather. */
  clear(calendarId) {
    return this.serial(async () => {
      if (!game.user.isGM) throw new Error(L("NEONHUB.Error.GMOnly"));
      const all = deepClone(this.all());
      delete all[calendarId];
      await game.settings.set(MODULE_ID, WEATHER_SETTING, all);
    });
  },

  /** GM: show a day's full weather to players (or hide it again). */
  reveal(calendarId, key, shown) {
    return this.serial(() => this._write(calendarId, (w) => {
      const set = new Set(w.revealed);
      if (shown) set.add(key);
      else set.delete(key);
      return { revealed: [...set] };
    }));
  },

  _prune(days, calendar) {
    const oldest = dayNumber(calendar) - KEEP;
    return Object.fromEntries(Object.entries(days).filter(([k]) => dayNumber(parseKey(k)) >= oldest));
  },

  /**
   * Active GM, when a calendar's date changes: keep its weather planned ahead and issue
   * the week's forecast when its forecast day comes round.
   */
  maintain() {
    if (!game.user.isGM || Compat.activeGM?.id !== game.user.id) return Promise.resolve();
    return this.serial(() => this._maintain());
  },

  async _maintain() {
    for (const calendar of CalendarStore.all()) {
      if (!this.has(calendar.id)) continue;
      try {
        if (calendar.weather.auto) await this._extend(calendar);
        await this._issue(calendar);
      } catch (err) {
        console.error(`${MODULE_ID} | weather for ${calendar.name} failed`, err);
      }
    }
  },

  /** Plan any missing days between today and AHEAD days on. */
  async _extend(calendar) {
    const days = this.of(calendar.id).days;
    const last = Object.keys(days).sort().at(-1);
    const today = dayNumber(calendar);
    const lastN = last ? dayNumber(parseKey(last)) : today - 1;
    if (lastN >= today + AHEAD - 7) return;
    const from = lastN >= today ? addDays(parseKey(last), 1) : calendar;
    const count = today + AHEAD - dayNumber(from) + 1;
    const before = days[dayKey(addDays(from, -1))] ?? null;
    const planned = planWeather(from, count, { off: this.off, before });
    await this._write(calendar.id, (w) => ({ days: this._prune({ ...w.days, ...planned }, calendar) }));
  },

  /**
   * Issue the week's forecast if it's due: on the latest forecast day on or before today.
   * @param {object} options - force: issue again even if done; post: chat card (default: the calendar's setting)
   */
  issue(calendar, options = {}) {
    return this.serial(() => this._issue(calendar, options));
  },

  async _issue(calendar, { force = false, post = null } = {}) {
    const fd = calendar.weather.forecastDay;
    const data = this.of(calendar.id);
    if (fd < 0) {
      if (data.forecast) await this._write(calendar.id, () => ({ forecast: null }));
      return null;
    }
    const issued = lastWeekday(calendar, fd);
    if (!force && data.forecast?.issued === dayKey(issued)) return data.forecast;
    const week = forecastWeek(issued, data.days, { off: this.off });
    await this._write(calendar.id, () => ({ forecast: week }));
    const fresh = dayNumber(calendar) - dayNumber(issued) < 7;
    if ((post ?? calendar.weather.chat) && fresh && !force) await this.postForecast(calendar, week);
    return week;
  },

  /** The week's forecast as a chat card to the calendar's group. */
  async postForecast(calendar, week = this.of(calendar.id).forecast) {
    if (!week) return null;
    const issued = parseKey(week.issued);
    const content = await Compat.renderTemplate(`${TEMPLATE_PATH}/calendar/forecast-card.hbs`, {
      name: calendar.name,
      color: calendar.color,
      issued: `${L(`NEONHUB.Calendar.Weekday.${weekday(issued)}`)} ${pad(issued.day)}.${pad(issued.month)}`,
      days: week.days.filter((d) => !d.unknown).map((d) => ({ ...WeatherView.forecast(d), date: WeatherView.shortDate(parseKey(d.key)) }))
    });
    const whisper = calendar.players.length ? [...new Set([...calendar.players, ...game.users.filter((u) => u.isGM).map((u) => u.id)])] : [];
    return ChatMessage.create({ content, speaker: { alias: L("NEONHUB.Weather.Service") }, whisper });
  }
};
