import { MODULE_ID, TEMPLATE_PATH } from "../constants.js";
import { Compat } from "../compat.js";
import { HQStore } from "../hq/hq-data.js";
import { HQOps } from "../hq/hq-ops.js";
import { LifestyleOps } from "../lifestyle/ls-ops.js";
import { LifestyleStore, LS_ACTOR_FLAG } from "../lifestyle/ls-store.js";
import { CalendarStore } from "./cal-store.js";
import { addDays, addMonths, rentDaysCrossed, nextRentDay, weekday, pad } from "./cal-dates.js";

const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));
const MAX_MONTHS = 12;

/**
 * Changing a calendar's date, and what happens on rent day: when the GM moves a
 * calendar past its rent day, a new month begins for everyone living by it. Lifestyle
 * bills become due (or are charged, with auto-billing on) and its Headquarters roll
 * their month: Morale Boost Humanity, rent due.
 */
export const CalendarOps = {
  /**
   * GM: set a calendar's date. Going forward past rent days starts those months
   * (rent: true), or with rent: false skips the time without billing: everyone's
   * paid-up standing moves along with the date.
   */
  async setDate(idOrName, date, { rent = true } = {}) {
    const calendar = CalendarStore.get(idOrName);
    if (!calendar) return null;
    const result = await CalendarStore.writeDate(calendar.id, date);
    if (!result?.changed) return result;
    const crossed = rentDaysCrossed(result.before, result.after, result.calendar.rentDay);
    if (crossed) {
      try {
        if (rent) await this.rentDay(result.calendar, crossed);
        else await this.skipRent(result.calendar, crossed);
      } catch (err) {
        console.error(`${MODULE_ID} | rent day for ${result.calendar.name} failed`, err);
        ui.notifications.error(L("NEONHUB.Calendar.Error.RentDay", { error: err.message }));
      }
    }
    return result;
  },

  /** The date a shift by days or months lands on. */
  shifted(calendar, { days = 0, months = 0 } = {}) {
    let date = calendar;
    if (months) date = addMonths(date, months);
    if (days) date = addDays(date, days);
    return date;
  },

  /** GM: move a calendar by days or months. */
  async shift(idOrName, amount = {}, options = {}) {
    const calendar = CalendarStore.get(idOrName);
    if (!calendar) return null;
    return this.setDate(calendar.id, this.shifted(calendar, amount), options);
  },

  /** How many rent days moving a calendar to a date would pass. */
  crossing(calendar, date) {
    return rentDaysCrossed(calendar, date, calendar.rentDay);
  },

  /** Time skip: shift each character's paid month along so nobody owes for skipped months. */
  async skipRent(calendar, crossed) {
    for (const actor of LifestyleStore.characters()) {
      if (CalendarStore.forActor(actor)?.id !== calendar.id) continue;
      const state = LifestyleStore.actorState(actor);
      if (state.paidPeriod === null) continue;
      await actor.setFlag(MODULE_ID, LS_ACTOR_FLAG, { ...state, paidPeriod: state.paidPeriod + crossed });
    }
  },

  /** GM: jump to the calendar's next rent day. */
  async toRentDay(idOrName) {
    const calendar = CalendarStore.get(idOrName);
    if (!calendar) return null;
    return this.setDate(calendar.id, nextRentDay(calendar, calendar.rentDay).date);
  },

  /** Rent day passed `crossed` times on this calendar. */
  async rentDay(calendar, crossed) {
    const months = Math.min(MAX_MONTHS, crossed);
    const hqs = HQStore.all().filter((hq) => hq.status !== "destroyed" && CalendarStore.forHQ(hq)?.id === calendar.id);
    for (const hq of hqs) {
      for (let i = 0; i < months; i++) await HQOps.newMonth(hq.id);
    }
    const billing = LifestyleStore.autoBill ? await LifestyleOps.billAll({ calendarId: calendar.id }) : null;

    const label = CalendarStore.periodLabel(CalendarStore.period(calendar));
    const content = await Compat.renderTemplate(`${TEMPLATE_PATH}/calendar/rent-card.hbs`, {
      name: calendar.name,
      color: calendar.color,
      label,
      months: crossed > 1 ? crossed : null,
      capped: crossed > MAX_MONTHS,
      hqs: hqs.map((h) => h.name).join(", "),
      billed: billing ? billing.paid.length : null,
      failed: billing?.failed.length ? billing.failed.map((f) => f.name).join(", ") : null
    });
    await ChatMessage.create({ content, speaker: { alias: calendar.name }, whisper: this.audience(calendar) });
  },

  /** Who a calendar's messages go to: its players and the GMs, or everyone if it has none. */
  audience(calendar) {
    if (!calendar.players.length) return [];
    return [...new Set([...calendar.players, ...game.users.filter((u) => u.isGM).map((u) => u.id)])];
  },

  /** Post a calendar's date to chat (anyone who can see it). */
  async toChat(idOrName) {
    const calendar = CalendarStore.get(idOrName);
    if (!calendar || !CalendarStore.canSee(calendar)) return null;
    const rent = nextRentDay(calendar, calendar.rentDay);
    const content = await Compat.renderTemplate(`${TEMPLATE_PATH}/calendar/date-card.hbs`, {
      name: calendar.name,
      color: calendar.color,
      day: pad(calendar.day),
      month: L(`NEONHUB.Calendar.Month.${calendar.month}`),
      year: calendar.year,
      weekday: L(`NEONHUB.Calendar.Weekday.${weekday(calendar)}`),
      code: `${pad(calendar.day)}.${pad(calendar.month)}.${pad(calendar.year, 4)}`,
      rent: rent.today ? L("NEONHUB.Calendar.Rent.Today") : L("NEONHUB.Calendar.Rent.In", { n: rent.days })
    });
    return ChatMessage.create({ content, speaker: { alias: calendar.name }, whisper: this.audience(calendar) });
  }
};
