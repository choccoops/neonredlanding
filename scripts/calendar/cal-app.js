import { MODULE_ID, TEMPLATE_PATH } from "../constants.js";
import { Compat } from "../compat.js";
import { CalendarStore } from "./cal-store.js";
import { CalendarOps } from "./cal-ops.js";
import { calendarDialog } from "./cal-dialogs.js";
import {
  addDays, addMonths, clampDate, sameDate, weekday, dayOfYear, pad, nextRentDay, rentDayIn
} from "./cal-dates.js";
import { moonDays, litPath } from "./moon.js";
import { LifestyleStore } from "../lifestyle/ls-store.js";
import { NotesStore } from "./cal-notes.js";
import { dayMarker, dayKey } from "./cal-notes-data.js";
import { Clock } from "./clock.js";
import { SkipTimeApp } from "./skip-app.js";
import { formatTime, isDaytime } from "./clock-time.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));

/**
 * The calendar window. The GM runs every group's calendar from here; players see the
 * calendars open to them and can page through months without changing anything.
 */
export class CalendarApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static instance = null;

  constructor(options = {}) {
    super(options);
    this.activeId = game.settings.get(MODULE_ID, "calendarActive") || null;
    /** Month on screen { year, month }; the GM's target date, not yet applied. */
    this.view = null;
    this.target = null;
    this.seen = null;
    this.typedDay = null;
    /** Day whose notes are open (null: the calendar's date), and the note being written. */
    this.noteDay = null;
    this.editing = null;
    this.busy = false;
  }

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-calendar`,
    classes: ["neon-hub", "nh-cal-app"],
    tag: "div",
    window: { title: "NEONHUB.Calendar.Title", icon: "fa-solid fa-calendar-days", resizable: true },
    position: { width: 1180, height: 740 },
    actions: {
      select: CalendarApp.#onSelect,
      create: CalendarApp.#onCreate,
      edit: CalendarApp.#onEdit,
      duplicate: CalendarApp.#onDuplicate,
      remove: CalendarApp.#onRemove,
      moveUp: CalendarApp.#onMoveUp,
      moveDown: CalendarApp.#onMoveDown,
      prevMonth: CalendarApp.#onPrevMonth,
      nextMonth: CalendarApp.#onNextMonth,
      toCurrent: CalendarApp.#onToCurrent,
      pick: CalendarApp.#onPick,
      shift: CalendarApp.#onShift,
      apply: CalendarApp.#onApply,
      toRentDay: CalendarApp.#onToRentDay,
      chat: CalendarApp.#onChat,
      lifestyle: CalendarApp.#onLifestyle,
      noteAdd: CalendarApp.#onNoteAdd,
      noteEdit: CalendarApp.#onNoteEdit,
      noteCancel: CalendarApp.#onNoteCancel,
      noteSave: CalendarApp.#onNoteSave,
      noteDelete: CalendarApp.#onNoteDelete,
      noteShare: CalendarApp.#onNoteShare,
      clockStep: CalendarApp.#onClockStep,
      smallTime: CalendarApp.#onSmallTime,
      skipTime: CalendarApp.#onSkipTime
    }
  };

  static PARTS = {
    main: { template: `${TEMPLATE_PATH}/calendar/calendar.hbs`, scrollable: [".nh-cal-list", ".nh-cal-notes-list"] }
  };

  static open() {
    this.instance ??= new this();
    this.instance.render({ force: true });
    this.instance.bringToFront?.();
    return this.instance;
  }

  static toggle() {
    if (this.instance?.rendered) return this.instance.close();
    return this.open();
  }

  static refresh() {
    if (this.instance?.rendered) this.instance.render();
  }

  get active() {
    const list = CalendarStore.visibleTo();
    return list.find((c) => c.id === this.activeId) ?? list[0] ?? null;
  }

  #setActive(id) {
    if (id === this.activeId) return;
    this.activeId = id;
    this.view = this.target = this.seen = this.typedDay = this.noteDay = this.editing = null;
    game.settings.set(MODULE_ID, "calendarActive", id ?? "");
  }

  /* ---------------------------------------- */
  /*  Context                                 */
  /* ---------------------------------------- */

  async _prepareContext() {
    const isGM = game.user.isGM;
    const calendars = CalendarStore.visibleTo();
    const active = this.active;
    if (active && active.id !== this.activeId) this.#setActive(active.id);

    const context = {
      isGM,
      busy: this.busy,
      calendars: calendars.map((c, i) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        short: `${pad(c.day)}.${pad(c.month)}.${pad(c.year, 4)}`,
        active: c.id === active?.id,
        mine: !isGM && c.players.includes(game.user.id),
        restricted: c.players.length > 0,
        playersLabel: c.players.map((id) => game.users.get(id)?.name).filter(Boolean).join(", "),
        first: i === 0,
        last: i === calendars.length - 1
      }))
    };
    if (!active) return context;

    // The stored date moved since the last render (a GM, a macro): follow it.
    if (!sameDate(this.seen, active)) {
      this.view = { year: active.year, month: active.month };
      this.target = { year: active.year, month: active.month, day: active.day };
      this.seen = { year: active.year, month: active.month, day: active.day };
      this.typedDay = null;
    }

    const rent = nextRentDay(active, active.rentDay);
    return {
      ...context,
      active: {
        id: active.id,
        name: active.name,
        color: active.color,
        dd: pad(active.day),
        mm: pad(active.month),
        year: active.year,
        monthName: L(`NEONHUB.Calendar.Month.${active.month}`),
        weekday: L(`NEONHUB.Calendar.Weekday.${weekday(active)}`),
        doy: pad(dayOfYear(active), 3),
        playersLabel: context.calendars.find((c) => c.id === active.id).playersLabel
      },
      rent: {
        today: rent.today,
        soon: !rent.today && rent.days <= 3,
        days: rent.days,
        text: rent.today ? L("NEONHUB.Calendar.Rent.Today") : L("NEONHUB.Calendar.Rent.In", { n: rent.days }),
        date: `${L(`NEONHUB.Calendar.Month.${rent.date.month}`)} ${rent.date.day}`,
        rentDay: active.rentDay,
        bills: this.#billsSummary(active)
      },
      nav: {
        year: this.view.year,
        months: Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: L(`NEONHUB.Calendar.Month.${i + 1}`), selected: i + 1 === this.view.month })),
        onCurrent: this.view.year === active.year && this.view.month === active.month
      },
      clock: Clock.visible ? { ...Clock.view(), follows: active.clock } : null,
      ...this.#grid(active, calendars),
      notes: await this.#notesContext(active),
      target: {
        ...this.target,
        weekday: L(`NEONHUB.Calendar.Weekday.${weekday(this.target)}`),
        changed: !sameDate(this.target, active)
      }
    };
  }

  /** Lifestyle on this calendar: the player's own characters, or a paid count for the GM. */
  #billsSummary(calendar) {
    const characters = LifestyleStore.characters().filter((a) => CalendarStore.forActor(a)?.id === calendar.id);
    if (game.user.isGM) {
      if (!characters.length) return null;
      const paid = characters.filter((a) => !LifestyleStore.billing(a).owed).length;
      return { gm: true, text: L("NEONHUB.Calendar.Rent.PaidCount", { paid, total: characters.length }), due: paid < characters.length };
    }
    const mine = characters.filter((a) => a.isOwner);
    if (!mine.length) return null;
    return {
      gm: false,
      list: mine.map((a) => {
        const owed = LifestyleStore.billing(a).owed;
        return { name: a.name, due: owed > 0, text: owed ? L("NEONHUB.Calendar.Rent.YouOwe", { months: owed }) : L("NEONHUB.Lifestyle.Status.paid") };
      })
    };
  }

  /** The open day's notes, enriched, with the note being written. */
  async #notesContext(active) {
    const day = this.noteDay ?? { year: active.year, month: active.month, day: active.day };
    const TextEditor = Compat.TextEditor;
    const list = [];
    for (const n of NotesStore.visible(active, day)) {
      const plain = Handlebars.escapeExpression(n.text).replace(/\n/g, "<br>");
      list.push({
        id: n.id,
        title: n.title || L("NEONHUB.Calendar.Notes.Untitled"),
        html: plain ? await TextEditor.enrichHTML(plain, { async: true }) : "",
        shared: n.shared,
        gm: n.gm,
        mine: !n.gm && n.author === game.user.id,
        author: NotesStore.authorName(n),
        canEdit: NotesStore.canEdit(n),
        editing: this.editing?.id === n.id
      });
    }
    return {
      label: `${L(`NEONHUB.Calendar.Weekday.${weekday(day)}`)}, ${L(`NEONHUB.Calendar.Month.${day.month}`)} ${day.day}, ${day.year}`,
      today: sameDate(day, active),
      list,
      editing: this.editing,
      adding: this.editing?.id === null,
      shareLabel: L(game.user.isGM ? "NEONHUB.Calendar.Notes.ShareGM" : "NEONHUB.Calendar.Notes.SharePlayer")
    };
  }

  /** Six weeks around the month on screen. */
  #grid(active, calendars) {
    const weekStart = Number(game.settings.get(MODULE_ID, "calendarWeekStart")) || 0;
    const { year, month } = this.view;
    const first = { year, month, day: 1 };
    let cursor = addDays(first, -((weekday(first) - weekStart + 7) % 7));
    const dates = [];
    for (let i = 0; i < 42; i++) {
      dates.push(cursor);
      cursor = addDays(cursor, 1);
    }

    const showMoon = game.settings.get(MODULE_ID, "calendarShowMoon");
    const zone = CalendarStore.zone;
    const moons = showMoon ? moonDays(dates, zone) : [];
    const editable = game.user.isGM;
    const viewer = NotesStore.viewer();
    const notesByDay = new Map();
    for (const n of NotesStore.visible(active)) {
      const key = dayKey(n);
      if (!notesByDay.has(key)) notesByDay.set(key, []);
      notesByDay.get(key).push(n);
    }
    const noteDay = this.noteDay ?? active;
    const cells = dates.map((d, i) => {
      const dayNotes = notesByDay.get(dayKey(d)) ?? [];
      const wd = weekday(d);
      const moon = moons[i];
      return {
        y: d.year,
        m: d.month,
        d: d.day,
        other: d.month !== month,
        weekend: wd === 0 || wd === 6,
        current: sameDate(d, active),
        selected: editable && sameDate(d, this.target) && !sameDate(d, active),
        rent: d.day === rentDayIn(d.year, d.month, active.rentDay),
        viewing: sameDate(d, noteDay) && !sameDate(d, active),
        note: dayNotes.length ? { kind: dayMarker(dayNotes, viewer), count: dayNotes.length > 1 ? dayNotes.length : null, tip: dayNotes.map((n) => n.title || L("NEONHUB.Calendar.Notes.Untitled")).join(" · ") } : null,
        markers: calendars.filter((c) => c.id !== active.id && sameDate(c, d)).map((c) => ({ color: c.color, name: c.name })),
        moon: moon ? {
          path: litPath(moon.fraction, moon.waxing, 9),
          principal: !!moon.event,
          tip: moon.event
            ? L("NEONHUB.Calendar.Moon.At", { phase: L(`NEONHUB.Calendar.Moon.${moon.phase}`), time: `${pad(moon.event.hour)}:${pad(moon.event.minute)}` })
            : L(`NEONHUB.Calendar.Moon.${moon.phase}`)
        } : null
      };
    });
    const weekdays = Array.from({ length: 7 }, (_, i) => {
      const index = (weekStart + i) % 7;
      return { label: L(`NEONHUB.Calendar.WeekdayShort.${index}`), weekend: index === 0 || index === 6 };
    });
    return { weekdays, cells, moonZone: showMoon ? zone : null };
  }

  /* ---------------------------------------- */
  /*  Rendering                               */
  /* ---------------------------------------- */

  _onRender(context, options) {
    super._onRender?.(context, options);
    const html = this.element;
    html.querySelector(".nh-cal-nav-month")?.addEventListener("change", (ev) => {
      this.view.month = Number(ev.currentTarget.value);
      this.render();
    });
    html.querySelector(".nh-cal-nav-year")?.addEventListener("change", (ev) => {
      this.view = clampDate({ year: ev.currentTarget.value, month: this.view.month, day: 1 });
      this.render();
    });
    // Dropping a document into a note writes a link to it at the cursor.
    for (const area of html.querySelectorAll(".nh-cal-note-form textarea")) {
      area.addEventListener("drop", async (ev) => {
        const data = Compat.getDragEventData(ev);
        if (!data?.uuid) return;
        ev.preventDefault();
        const doc = await fromUuid(data.uuid).catch(() => null);
        const link = `@UUID[${data.uuid}]{${doc?.name ?? data.type ?? "link"}}`;
        const at = area.selectionStart ?? area.value.length;
        area.value = `${area.value.slice(0, at)}${link}${area.value.slice(area.selectionEnd ?? at)}`;
        area.focus();
      });
    }
    const form = html.querySelector(".nh-cal-note-form");
    form?.scrollIntoView({ block: "nearest" });
    form?.querySelector("input[name=title]")?.focus({ preventScroll: true });
    if (!game.user.isGM) return;

    // The time slider previews while dragging and sets the time on release.
    const slider = html.querySelector(".nh-cal-clock-slider");
    slider?.addEventListener("input", (ev) => this.#showClock(Number(ev.currentTarget.value)));
    slider?.addEventListener("change", (ev) => this.#run(() => Clock.setTime(Number(ev.currentTarget.value))));

    for (const input of html.querySelectorAll(".nh-cal-target input[data-field]")) {
      input.addEventListener("change", (ev) => {
        const field = ev.currentTarget.dataset.field;
        const next = { ...this.target, [field]: ev.currentTarget.value };
        // Keep a typed 31 while the month is still being typed, rather than clipping it to February first.
        if (field === "day") this.typedDay = Number(ev.currentTarget.value) || null;
        else if (this.typedDay) next.day = this.typedDay;
        this.target = clampDate(next);
        this.view = { year: this.target.year, month: this.target.month };
        this.render();
      });
    }
    for (const cell of html.querySelectorAll(".nh-cal-day")) {
      cell.addEventListener("dblclick", (ev) => {
        const { y, m, d } = ev.currentTarget.dataset;
        this.target = { year: Number(y), month: Number(m), day: Number(d) };
        this.#apply();
      });
    }
  }

  /** The world clock moved: update the time in place, without redrawing the window. */
  updateClock() {
    if (!this.rendered) return;
    const slider = this.element.querySelector(".nh-cal-clock-slider");
    if (slider && document.activeElement === slider && slider.matches(":active")) return;
    this.#showClock(Clock.minutes);
    if (slider) slider.value = Clock.minutes;
  }

  #showClock(minutes) {
    const strip = this.element?.querySelector(".nh-cal-clock");
    if (!strip) return;
    const options = Clock.options;
    const day = isDaytime(minutes, options);
    strip.classList.toggle("is-day", day);
    strip.classList.toggle("is-night", !day);
    strip.querySelector(".nh-cal-clock-time").textContent = formatTime(minutes, options.hour12);
    const icon = strip.querySelector(".nh-cal-clock-label i");
    if (icon) icon.className = `fa-solid ${day ? "fa-sun" : "fa-moon"}`;
  }

  async #run(fn) {
    if (this.busy) return;
    this.busy = true;
    try {
      await fn();
    } catch (err) {
      ui.notifications.warn(err.message);
    } finally {
      this.busy = false;
      if (this.rendered) this.render();
    }
  }

  async #apply() {
    const active = this.active;
    if (!active || sameDate(active, this.target)) return;
    await this.#move(active, this.target);
  }

  /** Change the date; a jump past several rent days asks whether to bill them. */
  async #move(calendar, date) {
    const crossed = CalendarOps.crossing(calendar, date);
    let rent = true;
    if (crossed > 1) {
      const choice = await Compat.DialogV2.wait({
        window: { title: L("NEONHUB.Calendar.Jump.Title"), icon: "fa-solid fa-forward" },
        classes: ["neon-hub", "nh-cal-dialog"],
        content: `<p>${L("NEONHUB.Calendar.Jump.Body", { n: crossed })}</p>`,
        buttons: [
          { action: "rent", label: L("NEONHUB.Calendar.Jump.Rent", { n: crossed }), icon: "fa-solid fa-file-invoice-dollar", default: true },
          { action: "skip", label: L("NEONHUB.Calendar.Jump.Skip"), icon: "fa-solid fa-forward" }
        ],
        rejectClose: false
      });
      if (!choice) return;
      rent = choice === "rent";
    }
    await this.#run(() => CalendarOps.setDate(calendar.id, date, { rent }));
  }

  /* ---------------------------------------- */
  /*  Actions                                 */
  /* ---------------------------------------- */

  static #onSelect(event, target) {
    this.#setActive(target.dataset.id);
    this.render();
  }

  static async #onCreate() {
    const data = await calendarDialog(null);
    if (!data) return;
    const created = await CalendarStore.create(data);
    this.#setActive(created.id);
    this.render();
  }

  static async #onEdit() {
    const active = this.active;
    if (!active) return;
    const data = await calendarDialog(active);
    if (data) await CalendarStore.update(active.id, data);
  }

  static async #onDuplicate() {
    const active = this.active;
    if (!active) return;
    const copy = await CalendarStore.duplicate(active.id);
    if (copy) {
      this.#setActive(copy.id);
      this.render();
    }
  }

  static async #onRemove() {
    const active = this.active;
    if (!active) return;
    const ok = await Compat.DialogV2.confirm({
      window: { title: L("NEONHUB.Calendar.Delete"), icon: "fa-solid fa-trash" },
      classes: ["neon-hub", "nh-cal-dialog"],
      content: `<p>${L("NEONHUB.Calendar.DeleteBody", { name: `<b>${Handlebars.escapeExpression(active.name)}</b>` })}</p>`,
      rejectClose: false
    });
    if (!ok) return;
    await CalendarStore.remove(active.id);
    await NotesStore.removeCalendar(active.id);
    this.#setActive(null);
    this.render();
  }

  static #onMoveUp() {
    if (this.active) CalendarStore.move(this.active.id, -1);
  }

  static #onMoveDown() {
    if (this.active) CalendarStore.move(this.active.id, 1);
  }

  static #onPrevMonth() {
    this.view = addMonths({ ...this.view, day: 1 }, -1);
    this.render();
  }

  static #onNextMonth() {
    this.view = addMonths({ ...this.view, day: 1 }, 1);
    this.render();
  }

  static #onToCurrent() {
    const active = this.active;
    if (!active) return;
    this.view = { year: active.year, month: active.month };
    this.target = { year: active.year, month: active.month, day: active.day };
    this.typedDay = null;
    this.noteDay = null;
    this.editing = null;
    this.render();
  }

  static #onPick(event, target) {
    const date = { year: Number(target.dataset.y), month: Number(target.dataset.m), day: Number(target.dataset.d) };
    if (date.month !== this.view.month || date.year !== this.view.year) this.view = { year: date.year, month: date.month };
    if (game.user.isGM) {
      this.target = date;
      this.typedDay = null;
    }
    this.noteDay = date;
    this.editing = null;
    this.render();
  }

  static async #onShift(event, target) {
    const active = this.active;
    if (!active) return;
    const amount = Number(target.dataset.amount);
    await this.#move(active, CalendarOps.shifted(active, target.dataset.unit === "month" ? { months: amount } : { days: amount }));
  }

  static async #onApply() {
    await this.#apply();
  }

  static async #onToRentDay() {
    const active = this.active;
    if (!active) return;
    await this.#run(() => CalendarOps.toRentDay(active.id));
  }

  static async #onChat() {
    if (this.active) await CalendarOps.toChat(this.active.id);
  }

  static async #onClockStep(event, target) {
    await this.#run(() => Clock.advance(Number(target.dataset.minutes) * 60));
  }

  static #onSmallTime() {
    Clock.toggleSmallTime();
  }

  static #onSkipTime() {
    SkipTimeApp.start();
  }

  /** The Lifestyle window: your own character, or the GM's month overview. */
  static #onLifestyle() {
    game.modules.get(MODULE_ID).api?.openLifestyle();
  }

  /* ---------------------------------------- */
  /*  Notes                                   */
  /* ---------------------------------------- */

  #note(id) {
    return NotesStore.visible(this.active).find((n) => n.id === id) ?? null;
  }

  static #onNoteAdd() {
    this.editing = { id: null, title: "", text: "", shared: false };
    this.render();
  }

  static #onNoteEdit(event, target) {
    const note = this.#note(target.closest("[data-note]").dataset.note);
    if (!note || !NotesStore.canEdit(note)) return;
    this.editing = { id: note.id, title: note.title, text: note.text, shared: note.shared };
    this.render();
  }

  static #onNoteCancel() {
    this.editing = null;
    this.render();
  }

  static async #onNoteSave() {
    const form = this.element.querySelector(".nh-cal-note-form");
    const active = this.active;
    if (!form || !active || !this.editing) return;
    const data = {
      title: form.querySelector("[name=title]").value,
      text: form.querySelector("[name=text]").value,
      shared: form.querySelector("[name=shared]").checked
    };
    if (!data.title.trim() && !data.text.trim()) return ui.notifications.info(L("NEONHUB.Calendar.Notes.Empty"));
    const day = this.noteDay ?? { year: active.year, month: active.month, day: active.day };
    const editing = this.editing;
    this.editing = null;
    await this.#run(async () => {
      if (editing.id === null) await NotesStore.create(active, day, data);
      else {
        const note = this.#note(editing.id);
        if (note) await NotesStore.update(note, data);
      }
    });
  }

  static async #onNoteDelete(event, target) {
    const note = this.#note(target.closest("[data-note]").dataset.note);
    if (!note) return;
    const ok = await Compat.DialogV2.confirm({
      window: { title: L("NEONHUB.Calendar.Notes.Delete"), icon: "fa-solid fa-trash" },
      classes: ["neon-hub", "nh-cal-dialog"],
      content: `<p>${L("NEONHUB.Calendar.Notes.DeleteBody", { title: `<b>${Handlebars.escapeExpression(note.title || L("NEONHUB.Calendar.Notes.Untitled"))}</b>` })}</p>`,
      rejectClose: false
    });
    if (ok) await this.#run(() => NotesStore.remove(note));
  }

  /** Quick show/hide without opening the form. */
  static async #onNoteShare(event, target) {
    const note = this.#note(target.closest("[data-note]").dataset.note);
    if (note && NotesStore.canEdit(note)) await this.#run(() => NotesStore.update(note, { shared: !note.shared }));
  }

  _onClose(options) {
    super._onClose?.(options);
    CalendarApp.instance = null;
  }
}

