import { MODULE_ID, TEMPLATE_PATH } from "../constants.js";
import { HubSocket } from "../socket.js";
import { CalendarStore } from "./cal-store.js";
import { Clock } from "./clock.js";
import { formatTime, minutesOfDay, DAY_MINUTES } from "./clock-time.js";
import { phaseEvents, localMidnight, litPath } from "./moon.js";
import { skyModel, sunAt, moonAt, skyEvents, skyColors, groupCall, skipLabel, windDuration } from "./skip-sky.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));

const STEP = 5;
const DIAL_R = 96;
const SKY = { w: 400, h: 150, horizon: 118, left: 34, right: 366, height: 88 };
const DAY_MS = 86400000;
const ICONS = { sunrise: "fa-sun", sunset: "fa-sun", moonrise: "fa-moon", moonset: "fa-moon", midnight: "fa-calendar-day" };

const mod = (n, m) => ((n % m) + m) % m;
const round = (n) => Math.round(n * 100) / 100;
const polar = (minutes, r) => {
  const a = ((minutes / DAY_MINUTES) * 360 - 90) * (Math.PI / 180);
  return [round(Math.cos(a) * r), round(Math.sin(a) * r)];
};
/** Deterministic "random" numbers, so every client draws the same stars and skyline. */
function seeded(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

/**
 * Skip time, Cyberpunk 2077 style. The GM opens it for everyone online; each player
 * drags the dial to how long they'd skip and votes; the GM goes with the group's call
 * (the median vote), any one vote or their own dial. Then every screen winds the clock
 * through the skip, with the sun and moon rising and setting over Night City, and the
 * world clock moves on at the end (calendars that follow it change day at midnight).
 */
export class SkipTimeApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static instance = null;
  /** { id, gmId, users, votes: { userId: minutes }, running } */
  static session = null;

  constructor(options = {}) {
    super(options);
    this.minutes = 60;
    this.voted = null;
    this.wind = null;
  }

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-skip`,
    classes: ["neon-hub", "nh-cal-app", "nh-skip-app"],
    tag: "div",
    window: { title: "NEONHUB.Skip.Title", icon: "fa-solid fa-forward-fast" },
    position: { width: 780, height: "auto" },
    actions: {
      nudge: SkipTimeApp.#onNudge,
      vote: SkipTimeApp.#onVote,
      adopt: SkipTimeApp.#onAdopt,
      run: SkipTimeApp.#onRun,
      cancel: SkipTimeApp.#onCancel
    }
  };

  static PARTS = {
    stage: { template: `${TEMPLATE_PATH}/calendar/skip-stage.hbs` },
    side: { template: `${TEMPLATE_PATH}/calendar/skip-side.hbs` }
  };

  /* ---------------------------------------- */
  /*  Session (sockets)                       */
  /* ---------------------------------------- */

  static registerSocket() {
    HubSocket.on("skipOpen", (payload, sender) => sender?.isGM && this.#open(payload, sender));
    HubSocket.on("skipVote", (payload, sender) => this.#vote(payload, sender));
    HubSocket.on("skipRun", (payload, sender) => sender?.isGM && this.instance?.runWind(payload));
    HubSocket.on("skipClose", (payload, sender) => {
      if (!sender?.isGM || sender.isSelf || payload.id !== this.session?.id) return;
      this.session = null;
      this.instance?.close({ fromSocket: true });
    });
  }

  /** GM: open the skip window on every connected user's screen. */
  static start() {
    if (!game.user.isGM) throw new Error(L("NEONHUB.Error.GMOnly"));
    if (this.session && this.instance?.rendered) return this.instance.bringToFront?.();
    const users = game.users.filter((u) => u.active).map((u) => u.id);
    HubSocket.emit("skipOpen", { id: foundry.utils.randomID(12), users }, users);
  }

  static #open({ id, users }, sender) {
    this.session = { id, gmId: sender.id, users, votes: {}, running: false };
    this.instance?.close({ fromSocket: true });
    this.instance = new this();
    this.instance.render({ force: true });
  }

  static #vote({ id, minutes }, sender) {
    if (!this.session || id !== this.session.id || this.session.running || !sender) return;
    const value = Math.round(Number(minutes));
    if (!(value > 0 && value <= DAY_MINUTES)) return;
    this.session.votes[sender.id] = value;
    if (this.instance?.rendered) this.instance.render({ parts: ["side"] });
  }

  /** Everyone: the users to tell about a change in this session. */
  get audience() {
    return SkipTimeApp.session?.users ?? [game.user.id];
  }

  /* ---------------------------------------- */
  /*  The sky                                 */
  /* ---------------------------------------- */

  /** Sky model for a skip starting at this world time. */
  #sky(worldTime) {
    const options = Clock.options;
    const tod = minutesOfDay(worldTime);
    // The Moon's age at the midnight starting today, on the date of the clock's first calendar.
    const calendar = Clock.followers()[0] ?? CalendarStore.all()[0];
    let midnight = Date.now() - tod * 60000;
    if (calendar) midnight = localMidnight(calendar, CalendarStore.zone);
    const news = phaseEvents(midnight - 32 * DAY_MS, midnight).filter((e) => e.type === "new");
    const age = news.length ? (midnight - news.at(-1).ms) / DAY_MS : 0;
    return { start: tod, model: skyModel(options, age), hour12: options.hour12 };
  }

  /* ---------------------------------------- */
  /*  Context                                 */
  /* ---------------------------------------- */

  async _preparePartContext(partId, context) {
    context = await super._preparePartContext(partId, context);
    const session = SkipTimeApp.session;
    const isGM = game.user.isGM;
    context.isGM = isGM;
    context.running = !!session?.running;
    if (partId === "stage") return Object.assign(context, this.#stageContext());

    const votes = session?.votes ?? {};
    const call = groupCall(votes);
    context.users = (session?.users ?? []).map((id) => game.users.get(id)).filter((u) => u && !u.isGM).map((u) => ({
      id: u.id,
      name: u.name,
      color: u.color?.css ?? u.color,
      self: u.id === game.user.id,
      minutes: votes[u.id] ?? null,
      label: votes[u.id] ? skipLabel(votes[u.id]) : null
    }));
    context.call = call ? { minutes: call, label: skipLabel(call), count: Object.keys(votes).length } : null;
    context.dial = skipLabel(this.minutes);
    context.voted = votes[game.user.id] ?? null;
    return context;
  }

  #stageContext() {
    const { model, hour12 } = this.#sky(game.time.worldTime);
    const ticks = Array.from({ length: 24 }, (_, h) => {
      const [x1, y1] = polar(h * 60, DIAL_R + 8);
      const [x2, y2] = polar(h * 60, DIAL_R + (h % 6 ? 13 : 18));
      return { x1, y1, x2, y2, major: h % 6 === 0 };
    });
    const numerals = [0, 6, 12, 18].map((h) => {
      const [x, y] = polar(h * 60, DIAL_R + 30);
      return { x, y, text: hour12 ? `${h % 12 || 12}${h < 12 ? "A" : "P"}` : String(h).padStart(2, "0") };
    });
    const marker = (minutes, kind) => {
      const [x, y] = polar(minutes, DIAL_R - 14);
      return { x, y, kind };
    };
    const markers = [marker(model.sunrise, "sun"), marker(model.sunset, "sun")];
    for (const e of skyEvents(model, 0, DAY_MINUTES)) if (e.type === "moonrise" || e.type === "moonset") markers.push(marker(mod(e.at, DAY_MINUTES), "moon"));

    const rand = seeded(2077);
    const stars = Array.from({ length: 46 }, () => ({ x: round(rand() * SKY.w), y: round(rand() * (SKY.horizon - 20)), r: round(0.4 + rand() * 1.1) }));
    const buildings = [];
    const windows = [];
    for (let x = 0; x < SKY.w;) {
      const w = 12 + Math.round(rand() * 26);
      const h = 10 + Math.round(rand() * (rand() > 0.82 ? 64 : 34));
      buildings.push(`M${x} ${SKY.h}V${SKY.h - h}H${x + w}V${SKY.h}Z`);
      for (let wy = SKY.h - h + 5; wy < SKY.h - 4; wy += 7) {
        for (let wx = x + 3; wx < x + w - 3; wx += 6) {
          if (rand() > 0.72) windows.push({ x: wx, y: wy, c: rand() > 0.5 ? "pink" : "cyan" });
        }
      }
      x += w + Math.round(rand() * 3);
    }
    return { ticks, numerals, markers, stars, skyline: buildings.join(""), windows, sky: SKY, r: DIAL_R };
  }

  /* ---------------------------------------- */
  /*  Rendering                               */
  /* ---------------------------------------- */

  _onRender(context, options) {
    super._onRender?.(context, options);
    if (this.wind) return;
    this.#draw(minutesOfDay(game.time.worldTime), this.minutes);
    const dial = this.element.querySelector(".nh-skip-dial");
    if (!dial || dial.dataset.bound || SkipTimeApp.session?.running) return;
    dial.dataset.bound = "1";
    dial.addEventListener("pointerdown", (ev) => {
      dial.setPointerCapture(ev.pointerId);
      this.#drag(ev);
    });
    dial.addEventListener("pointermove", (ev) => {
      if (dial.hasPointerCapture(ev.pointerId)) this.#drag(ev);
    });
  }

  /** Dragging the hand: the skip runs clockwise from now to where it points. */
  #drag(ev) {
    if (SkipTimeApp.session?.running) return;
    const dial = this.element.querySelector(".nh-skip-dial");
    const box = dial.getBoundingClientRect();
    const angle = Math.atan2(ev.clientY - (box.top + box.height / 2), ev.clientX - (box.left + box.width / 2));
    const pointed = mod(((angle * 180) / Math.PI + 90) / 360 * DAY_MINUTES, DAY_MINUTES);
    let skip = Math.round(mod(pointed - minutesOfDay(game.time.worldTime), DAY_MINUTES) / STEP) * STEP;
    // Past the top of a full turn counts as a full day rather than nothing.
    if (skip <= 0 || skip >= DAY_MINUTES) skip = this.minutes > DAY_MINUTES / 2 ? DAY_MINUTES : STEP;
    this.#setMinutes(skip);
  }

  #setMinutes(minutes) {
    this.minutes = Math.min(DAY_MINUTES, Math.max(STEP, Math.round(minutes / STEP) * STEP));
    this.#draw(minutesOfDay(game.time.worldTime), this.minutes);
    const label = skipLabel(this.minutes);
    for (const el of this.element.querySelectorAll("[data-dial-label]")) el.textContent = label;
  }

  /**
   * Draw the dial and sky for a skip of `skip` minutes from `start` (time of day),
   * with the clock at the end of it.
   */
  #draw(start, skip, { toast = null } = {}) {
    const root = this.element;
    if (!root) return;
    const { model, hour12 } = this.#sky(game.time.worldTime);
    const now = start + skip;

    // Dial: the swept arc, the hand and the readout.
    const arc = root.querySelector(".nh-skip-arc");
    if (arc) {
      const [x0, y0] = polar(start, DIAL_R);
      const [x1, y1] = polar(now, DIAL_R);
      if (skip >= DAY_MINUTES) {
        const [xm, ym] = polar(start + DAY_MINUTES / 2, DIAL_R);
        arc.setAttribute("d", `M${x0} ${y0}A${DIAL_R} ${DIAL_R} 0 1 1 ${xm} ${ym}A${DIAL_R} ${DIAL_R} 0 1 1 ${x0} ${y0}`);
      } else arc.setAttribute("d", skip > 0 ? `M${x0} ${y0}A${DIAL_R} ${DIAL_R} 0 ${skip > DAY_MINUTES / 2 ? 1 : 0} 1 ${x1} ${y1}` : "");
    }
    const [hx, hy] = polar(now, DIAL_R);
    root.querySelector(".nh-skip-hand")?.setAttribute("x2", hx);
    root.querySelector(".nh-skip-hand")?.setAttribute("y2", hy);
    root.querySelector(".nh-skip-knob")?.setAttribute("transform", `translate(${hx} ${hy})`);
    const [sx, sy] = polar(start, DIAL_R);
    root.querySelector(".nh-skip-start")?.setAttribute("transform", `translate(${sx} ${sy})`);
    const set = (sel, text) => {
      const el = root.querySelector(sel);
      if (el) el.textContent = text;
    };
    set(".nh-skip-amount", skipLabel(Math.round(skip)).replace("+", "+ "));
    set(".nh-skip-to", formatTime(mod(Math.round(now), DAY_MINUTES), hour12));
    set(".nh-skip-from", `${L("NEONHUB.Skip.From")} ${formatTime(start, hour12)}`);
    const days = Math.floor(now / DAY_MINUTES);
    set(".nh-skip-days", days ? L(days > 1 ? "NEONHUB.Skip.Days" : "NEONHUB.Skip.Day", { n: days }) : "");

    // Sky: colours, stars, sun and moon. Until the clock winds, it's the sky right now.
    const skyTime = this.wind ? now : start;
    const colors = skyColors(model, skyTime);
    root.querySelector(".nh-skip-sky-top")?.setAttribute("stop-color", colors.top);
    root.querySelector(".nh-skip-sky-bottom")?.setAttribute("stop-color", colors.bottom);
    root.querySelector(".nh-skip-stars")?.setAttribute("opacity", round(colors.stars));
    const place = (sel, body) => {
      const el = root.querySelector(sel);
      if (!el) return;
      el.setAttribute("opacity", body.up ? 1 : 0);
      const x = SKY.left + body.arc * (SKY.right - SKY.left);
      const y = SKY.horizon - Math.sin(body.arc * Math.PI) * SKY.height;
      el.setAttribute("transform", `translate(${round(x)} ${round(y)})`);
    };
    place(".nh-skip-sun", sunAt(model, skyTime));
    const moon = moonAt(model, skyTime);
    place(".nh-skip-moon", moon);
    root.querySelector(".nh-skip-moon-lit")?.setAttribute("d", litPath(moon.fraction, moon.waxing, 9));
    set(".nh-skip-clock", formatTime(mod(Math.round(skyTime), DAY_MINUTES), hour12));

    // What happens along the way.
    const list = root.querySelector(".nh-skip-events");
    if (list && !this.wind) {
      const events = skyEvents(model, start, start + skip);
      list.innerHTML = events.length
        ? events.map((e) => `<li class="is-${e.type}"><i class="fa-solid ${ICONS[e.type]}"></i> ${L(`NEONHUB.Skip.Event.${e.type}`)} <span>${formatTime(mod(e.at, DAY_MINUTES), hour12)}</span></li>`).join("")
        : `<li class="is-none">${L("NEONHUB.Skip.Nothing")}</li>`;
    }
    if (toast) {
      const el = root.querySelector(".nh-skip-toast");
      if (el) {
        el.innerHTML = `<i class="fa-solid ${ICONS[toast.type]}"></i> ${L(`NEONHUB.Skip.Event.${toast.type}`)} <b>${formatTime(mod(toast.at, DAY_MINUTES), hour12)}</b>`;
        el.className = `nh-skip-toast is-${toast.type}`;
        void el.offsetWidth;
        el.classList.add("is-shown");
      }
    }
  }

  /* ---------------------------------------- */
  /*  Winding the clock                       */
  /* ---------------------------------------- */

  /** Every client: wind the clock through the skip; the GM who ran it moves the world clock at the end. */
  async runWind({ id, minutes, from }) {
    const session = SkipTimeApp.session;
    if (!session || session.id !== id || session.running) return;
    session.running = true;
    this.minutes = minutes;
    await this.render();
    const start = minutesOfDay(from);
    const { model } = this.#sky(from);
    const events = skyEvents(model, start, start + minutes);
    const duration = windDuration(minutes);
    const ease = (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
    this.element.classList.add("is-winding");
    await new Promise((resolve) => {
      const t0 = performance.now();
      this.wind = { resolve };
      const frame = (now) => {
        if (!this.rendered) return resolve();
        const p = Math.min(1, (now - t0) / duration);
        const skip = ease(p) * minutes;
        let toast = null;
        while (events.length && events[0].at <= start + skip) toast = events.shift();
        this.#draw(start, skip, { toast });
        if (p < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
    this.wind = null;
    if (game.user.id === session.gmId) {
      try {
        await Clock.advance(minutes * 60);
      } catch (err) {
        ui.notifications.error(err.message);
      }
    }
    this.element?.classList.add("is-done");
    setTimeout(() => {
      if (SkipTimeApp.session?.id === id) SkipTimeApp.session = null;
      if (SkipTimeApp.instance === this) this.close({ fromSocket: true });
    }, 1800);
  }

  /* ---------------------------------------- */
  /*  Actions                                 */
  /* ---------------------------------------- */

  static #onNudge(event, target) {
    this.#setMinutes(this.minutes + Number(target.dataset.minutes));
  }

  static #onVote() {
    const session = SkipTimeApp.session;
    if (!session) return;
    HubSocket.emit("skipVote", { id: session.id, minutes: this.minutes }, this.audience);
  }

  static #onAdopt(event, target) {
    this.#setMinutes(Number(target.dataset.minutes));
  }

  static #onRun() {
    const session = SkipTimeApp.session;
    if (!game.user.isGM || !session || session.running) return;
    HubSocket.emit("skipRun", { id: session.id, minutes: this.minutes, from: game.time.worldTime }, this.audience);
  }

  static #onCancel() {
    this.close();
  }

  async close(options = {}) {
    const session = SkipTimeApp.session;
    // The GM closing the window calls the skip off for everyone.
    if (!options.fromSocket && game.user.isGM && session && !session.running && session.gmId === game.user.id) {
      const others = session.users.filter((id) => id !== game.user.id);
      SkipTimeApp.session = null;
      if (others.length) HubSocket.emit("skipClose", { id: session.id }, others);
    }
    return super.close(options);
  }

  _onClose(options) {
    super._onClose?.(options);
    this.wind?.resolve();
    if (SkipTimeApp.instance === this) SkipTimeApp.instance = null;
  }
}
