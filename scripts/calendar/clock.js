import { MODULE_ID } from "../constants.js";
import { Compat } from "../compat.js";
import { CalendarStore } from "./cal-store.js";
import { CalendarOps } from "./cal-ops.js";
import { moonDays, PHASES } from "./moon.js";
import { DAY_MINUTES, SMALLTIME_DEFAULTS, daysCrossed, minutesOfDay, secondsTo, formatTime, stepLabel, isDaytime } from "./clock-time.js";

export const SMALLTIME_ID = "smalltime";
export const CLOCK_MOON_SETTING = "smalltimeMoon";

/**
 * SmallTime integration (SmallTime 1.24, the last release for Foundry v12).
 *
 * SmallTime keeps the time of day in Foundry's world time, so that's the link: when the
 * world clock passes midnight, by SmallTime's buttons, a macro, combat rounds or anything
 * else, every calendar that follows the clock moves on a day (rent days included). The
 * calendar window shows the time and gives the GM SmallTime's steps and slider, which also
 * just move the world clock, so SmallTime's own window and darkness link follow along.
 * SmallTime's moon is set to the real Moon on the date of the first calendar that follows.
 */
export const Clock = {
  /** Day changes run one after another, in order, on the active GM's client. */
  queue: Promise.resolve(),

  register() {
    game.settings.register(MODULE_ID, CLOCK_MOON_SETTING, {
      name: "NEONHUB.Clock.Setting.Moon",
      hint: "NEONHUB.Clock.Setting.MoonHint",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
      onChange: () => this.syncMoon()
    });
  },

  init() {
    Hooks.on("updateWorldTime", (worldTime, delta) => this.onTime(worldTime, delta));
    Hooks.on(`${MODULE_ID}.calendarChanged`, () => this.syncMoon());
    Hooks.once("ready", () => this.syncMoon());
  },

  /** SmallTime is installed and enabled. */
  get active() {
    return !!game.modules.get(SMALLTIME_ID)?.active;
  },

  /** A SmallTime setting, or its default if SmallTime isn't there. */
  setting(key, fallback) {
    try {
      return game.settings.get(SMALLTIME_ID, key) ?? fallback;
    } catch {
      return fallback;
    }
  },

  get options() {
    return {
      smallStep: Number(this.setting("small-step", SMALLTIME_DEFAULTS.smallStep)) || SMALLTIME_DEFAULTS.smallStep,
      largeStep: Number(this.setting("large-step", SMALLTIME_DEFAULTS.largeStep)) || SMALLTIME_DEFAULTS.largeStep,
      hour12: Number(this.setting("time-format", 12)) === 12,
      sunriseStart: Number(this.setting("sunrise-start", SMALLTIME_DEFAULTS.sunriseStart)),
      sunriseEnd: Number(this.setting("sunrise-end", SMALLTIME_DEFAULTS.sunriseEnd)),
      sunsetStart: Number(this.setting("sunset-start", SMALLTIME_DEFAULTS.sunsetStart)),
      sunsetEnd: Number(this.setting("sunset-end", SMALLTIME_DEFAULTS.sunsetEnd))
    };
  },

  /** GMs see the time; players when SmallTime lets them see its clock in this scene. */
  get visible() {
    if (!this.active) return false;
    if (game.user.isGM) return true;
    return game.modules.get(SMALLTIME_ID)?.clockAuth ?? true;
  },

  get minutes() {
    return minutesOfDay(game.time.worldTime);
  },

  /** What the calendar window shows. */
  view() {
    const options = this.options;
    const minutes = this.minutes;
    const pct = (m) => `${Math.round((m / DAY_MINUTES) * 1000) / 10}%`;
    return {
      minutes,
      time: formatTime(minutes, options.hour12),
      day: isDaytime(minutes, options),
      steps: [-options.largeStep, -options.smallStep, options.smallStep, options.largeStep].map((m) => ({ minutes: m, label: stepLabel(m) })),
      // Night, dawn, day, dusk, night along the slider, from SmallTime's sunrise and sunset.
      sky: `--rise-a:${pct(options.sunriseStart)};--rise-b:${pct(options.sunriseEnd)};--set-a:${pct(options.sunsetStart)};--set-b:${pct(options.sunsetEnd)}`
    };
  },

  /** Calendars that follow the clock. */
  followers() {
    return CalendarStore.all().filter((c) => c.clock);
  },

  onTime(worldTime, delta) {
    if (!this.active || !delta || Compat.activeGM?.id !== game.user.id) return;
    const days = daysCrossed(worldTime - delta, worldTime);
    if (!days) return;
    this.queue = this.queue
      .then(() => this.advanceCalendars(days))
      .catch((err) => console.error(`${MODULE_ID} | moving calendars with the clock failed`, err));
  },

  async advanceCalendars(days) {
    for (const calendar of this.followers()) await CalendarOps.shift(calendar.id, { days });
  },

  /** GM: move the world clock by seconds (negative goes back). */
  async advance(seconds) {
    if (!game.user.isGM) throw new Error(game.i18n.localize("NEONHUB.Error.GMOnly"));
    seconds = Math.round(Number(seconds) || 0);
    if (seconds) await game.time.advance(seconds);
  },

  /** GM: set the time of day (minutes after midnight) without changing the day. */
  async setTime(minutes) {
    return this.advance(secondsTo(game.time.worldTime, minutes));
  },

  /** Show or hide SmallTime's own window. */
  toggleSmallTime() {
    globalThis.SmallTimeApp?.toggleAppVis?.("toggle");
  },

  /** Set SmallTime's moon to the real Moon on the first following calendar's date. */
  async syncMoon() {
    if (!this.active || Compat.activeGM?.id !== game.user.id) return;
    if (!game.settings.get(MODULE_ID, CLOCK_MOON_SETTING)) return;
    const lead = this.followers()[0];
    if (!lead) return;
    const [moon] = moonDays([{ year: lead.year, month: lead.month, day: lead.day }], CalendarStore.zone);
    const phase = PHASES.indexOf(moon?.phase);
    if (phase < 0 || Number(this.setting("moon-phase", -1)) === phase) return;
    try {
      await game.settings.set(SMALLTIME_ID, "moon-phase", phase);
      // SmallTime redraws its moon when the time changes; nudge it now.
      if (typeof canvas !== "undefined" && canvas?.scene) await globalThis.SmallTimeApp?.timeTransition?.(this.minutes);
    } catch (err) {
      console.warn(`${MODULE_ID} | couldn't set SmallTime's moon phase`, err);
    }
  }
};
