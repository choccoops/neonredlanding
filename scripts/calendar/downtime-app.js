import { MODULE_ID, TEMPLATE_PATH } from "../constants.js";
import { Compat } from "../compat.js";
import { HubSocket } from "../socket.js";
import { LifestyleStore } from "../lifestyle/ls-store.js";
import { addDays } from "./cal-dates.js";
import { groupCall } from "./skip-sky.js";
import { MINUTES, toMinutes, split, formatDuration, balance, timeline, allSpent } from "./downtime-data.js";
import { Downtime, actorOf } from "./downtime-store.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));
const esc = (s) => Handlebars.escapeExpression(String(s ?? ""));
const DIALOG = ["neon-hub", "nh-cal-dialog", "nh-dt-dialog"];
const PRESETS = [["1d", 1440], ["3d", 4320], ["1w", 10080], ["2w", 20160], ["1mo", 43200]];

/** "14 Nov" for a date; the downtime's start plus some minutes. */
function dateAt(start, minutes) {
  if (!start) return null;
  const d = addDays(start, Math.floor(minutes / MINUTES.day));
  return `${d.day} ${L(`NEONHUB.Calendar.MonthShort.${d.month}`)}`;
}

/** Days / hours / minutes inputs. */
function durationFields(prefix = "", value = 0) {
  const v = split(value);
  return `<div class="nh-dt-duration">
    <label><input type="number" name="${prefix}days" min="0" max="366" value="${v.days}"> ${esc(L("NEONHUB.Downtime.Days"))}</label>
    <label><input type="number" name="${prefix}hours" min="0" max="23" value="${v.hours}"> ${esc(L("NEONHUB.Downtime.Hours"))}</label>
    <label><input type="number" name="${prefix}minutes" min="0" max="59" value="${v.minutes}"> ${esc(L("NEONHUB.Downtime.Minutes"))}</label>
  </div>`;
}
const readDuration = (form, prefix = "") => toMinutes({
  days: form.elements[`${prefix}days`]?.value, hours: form.elements[`${prefix}hours`]?.value, minutes: form.elements[`${prefix}minutes`]?.value
});

/* ------------------------------------------ */
/*  Dialogs                                   */
/* ------------------------------------------ */

/** GM: call downtime. Resolves to { label, participants, how: "set"|"vote", total } or null. */
export async function callDialog() {
  const characters = LifestyleStore.characters();
  const people = characters.map((a) => `<label class="nh-cal-player"><input type="checkbox" name="people" value="${a.uuid}" checked><i></i><span>${esc(a.name)}</span></label>`).join("");
  const content = `
    <p class="hint">${esc(L("NEONHUB.Downtime.Call.Intro"))}</p>
    <div class="form-group"><label>${esc(L("NEONHUB.Downtime.Call.Label"))}</label><input type="text" name="label" maxlength="80" placeholder="${esc(L("NEONHUB.Downtime.Call.LabelPlaceholder"))}"></div>
    <div class="form-group stacked"><label>${esc(L("NEONHUB.Downtime.Call.Who"))}</label>${characters.length ? `<div class="nh-cal-players">${people}</div>` : `<p class="hint">${esc(L("NEONHUB.Lifestyle.NoCharacters"))}</p>`}</div>
    <div class="form-group stacked"><label>${esc(L("NEONHUB.Downtime.Call.How"))}</label>
      <label class="nh-check"><input type="radio" name="how" value="set" checked> ${esc(L("NEONHUB.Downtime.Call.Set"))}</label>
      ${durationFields("", MINUTES.day * 3)}
      <label class="nh-check"><input type="radio" name="how" value="vote"> ${esc(L("NEONHUB.Downtime.Call.Vote"))}</label>
    </div>`;
  return Compat.DialogV2.prompt({
    window: { title: L("NEONHUB.Downtime.Call.Title"), icon: "fa-solid fa-mug-hot" },
    classes: DIALOG,
    position: { width: 500 },
    content,
    rejectClose: false,
    ok: {
      label: L("NEONHUB.Downtime.Call.Go"),
      icon: "fa-solid fa-bullhorn",
      callback: (event, button) => {
        const form = button.form;
        return {
          label: form.elements.label.value.trim(),
          participants: [...form.querySelectorAll("input[name=people]:checked")].map((i) => i.value),
          how: form.querySelector("input[name=how]:checked")?.value ?? "set",
          total: readDuration(form)
        };
      }
    }
  });
}

/** Log a spend by hand. Resolves to { actor, label, minutes } or null. */
async function logDialog(actors, left) {
  const options = actors.map((a) => `<option value="${a.uuid}">${esc(a.name)} (${esc(formatDuration(left[a.uuid]))} ${esc(L("NEONHUB.Downtime.LeftShort"))})</option>`).join("");
  const content = `
    ${actors.length > 1 ? `<div class="form-group"><label>${esc(L("NEONHUB.Downtime.Log.Who"))}</label><select name="actor">${options}</select></div>` : `<input type="hidden" name="actor" value="${actors[0].uuid}">`}
    <div class="form-group"><label>${esc(L("NEONHUB.Downtime.Log.What"))}</label><input type="text" name="label" maxlength="120" placeholder="${esc(L("NEONHUB.Downtime.Log.WhatPlaceholder"))}" autofocus></div>
    <div class="form-group stacked"><label>${esc(L("NEONHUB.Downtime.Log.Time"))}</label>${durationFields("", MINUTES.day)}</div>`;
  return Compat.DialogV2.prompt({
    window: { title: L("NEONHUB.Downtime.Log.Title"), icon: "fa-solid fa-pen" },
    classes: DIALOG,
    position: { width: 440 },
    content,
    rejectClose: false,
    ok: {
      label: L("NEONHUB.Downtime.Log.Spend"),
      icon: "fa-solid fa-hourglass-half",
      callback: (event, button) => ({ actor: button.form.elements.actor.value, label: button.form.elements.label.value.trim(), minutes: readDuration(button.form) })
    }
  });
}

/** The full-screen alert for the GM: everyone has spent their downtime. */
export function allSpentAlert(call) {
  document.querySelector(".nh-dt-alert")?.remove();
  const el = document.createElement("div");
  el.className = "nh-dt-alert";
  el.innerHTML = `<div class="nh-dt-alert-box">
    <span class="nh-dt-alert-kicker">// ${esc(L("NEONHUB.Downtime.Kicker"))}${call?.label ? ` · ${esc(call.label)}` : ""}</span>
    <strong data-text="${esc(L("NEONHUB.Downtime.AllSpent"))}">${esc(L("NEONHUB.Downtime.AllSpent"))}</strong>
    <span class="nh-dt-alert-sub">${esc(L("NEONHUB.Downtime.AllSpentHint"))}</span>
    <button type="button"><i class="fa-solid fa-mug-hot"></i> ${esc(L("NEONHUB.Downtime.Review"))}</button>
  </div>`;
  const close = () => el.remove();
  el.addEventListener("click", (ev) => {
    if (ev.target.closest("button")) DowntimeApp.open();
    close();
  });
  document.body.append(el);
  setTimeout(close, 9000);
  try {
    const audio = foundry.audio?.AudioHelper ?? globalThis.AudioHelper;
    audio?.play({ src: "sounds/notify.wav", volume: 0.6, autoplay: true, loop: false }, false);
  } catch { /* no sound, no matter */ }
}

/* ------------------------------------------ */
/*  The Downtime window                       */
/* ------------------------------------------ */

/**
 * Downtime: what each character has to spend and what they've spent it on. Players see their own
 * characters; the GM sees everyone, calls downtime and completes it.
 */
export class DowntimeApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static instance = null;

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-downtime`,
    classes: ["neon-hub", "nh-cal-app", "nh-dt-app"],
    tag: "div",
    window: { title: "NEONHUB.Downtime.Title", icon: "fa-solid fa-mug-hot", resizable: true },
    position: { width: 640, height: 680 },
    actions: {
      call: DowntimeApp.#onCall,
      log: DowntimeApp.#onLog,
      refund: DowntimeApp.#onRefund,
      complete: DowntimeApp.#onComplete,
      cancel: DowntimeApp.#onCancel
    }
  };

  static PARTS = {
    main: { template: `${TEMPLATE_PATH}/calendar/downtime.hbs`, scrollable: [".nh-dt-scroll"] }
  };

  static open() {
    this.instance ??= new this();
    this.instance.render({ force: true });
    this.instance.bringToFront?.();
    return this.instance;
  }

  static refresh() {
    if (this.instance?.rendered) this.instance.render();
  }

  async _prepareContext() {
    const isGM = game.user.isGM;
    const call = Downtime.current();
    const context = { isGM, call: null, history: [] };
    if (!call) {
      context.history = Downtime.history().slice(0, 6).map((h) => ({
        label: h.label || L("NEONHUB.Downtime.Title"),
        total: formatDuration(h.total),
        status: L(`NEONHUB.Downtime.Status.${h.status}`),
        when: h.start ? `${h.start.day}.${h.start.month}.${h.start.year}` : ""
      }));
      return context;
    }
    const people = call.participants.map(actorOf).filter((a) => a && (isGM || a.isOwner));
    context.call = {
      label: call.label || L("NEONHUB.Downtime.Title"),
      total: formatDuration(call.total),
      when: call.start ? `${call.start.day}.${call.start.month}.${call.start.year}` : null,
      allSpent: allSpent(call),
      taking: call.participants.length,
      spentCount: call.participants.filter((u) => balance(call, u).left === 0).length
    };
    context.people = people.map((a) => {
      const b = balance(call, a.uuid);
      const start = Downtime.startDate(call, a.uuid);
      return {
        uuid: a.uuid,
        name: a.name,
        img: a.img,
        left: formatDuration(b.left),
        spent: formatDuration(b.spent),
        pct: call.total ? Math.round((b.spent / call.total) * 100) : 0,
        done: b.left === 0,
        canLog: b.left > 0 && (isGM || a.isOwner),
        entries: timeline(call, a.uuid).map((e) => {
          const from = dateAt(start, e.from);
          const to = dateAt(start, Math.max(e.from, e.to - 1));
          return {
            id: e.id,
            label: e.label,
            time: formatDuration(e.minutes),
            when: from ? (from === to ? from : `${from} – ${to}`) : null,
            source: e.source === "manual" ? L("NEONHUB.Downtime.ByHand") : e.source,
            by: e.user,
            canRefund: isGM || (a.isOwner && e.source === "manual")
          };
        })
      };
    });
    context.none = !people.length;
    return context;
  }

  static async #onCall() {
    const choice = await callDialog();
    if (!choice) return;
    if (!choice.participants.length) return ui.notifications.warn(L("NEONHUB.Downtime.Error.NoOne"));
    try {
      if (choice.how === "vote") DowntimeVoteApp.start({ label: choice.label, participants: choice.participants, total: choice.total });
      else await Downtime.start(choice);
    } catch (err) {
      ui.notifications.warn(err.message);
    }
  }

  static async #onLog() {
    const call = Downtime.current();
    if (!call) return;
    const actors = call.participants.map(actorOf).filter((a) => a && (game.user.isGM || a.isOwner) && balance(call, a.uuid).left > 0);
    if (!actors.length) return;
    const left = Object.fromEntries(actors.map((a) => [a.uuid, balance(call, a.uuid).left]));
    const spend = await logDialog(actors, left);
    if (!spend) return;
    try {
      await Downtime.spend(spend.actor, spend.minutes, { label: spend.label, source: "manual" });
    } catch (err) {
      ui.notifications.warn(err.message);
    }
  }

  static async #onRefund(event, target) {
    try {
      await Downtime.refund(target.closest("[data-entry]").dataset.entry);
    } catch (err) {
      ui.notifications.warn(err.message);
    }
  }

  static async #onComplete() {
    const call = Downtime.current();
    if (!call) return;
    if (!allSpent(call)) {
      const ok = await Compat.DialogV2.confirm({
        window: { title: L("NEONHUB.Downtime.Complete") },
        classes: ["neon-hub", "nh-cal-dialog"],
        content: `<p>${esc(L("NEONHUB.Downtime.CompleteEarly"))}</p>`,
        rejectClose: false
      });
      if (!ok) return;
    }
    try {
      await Downtime.complete();
    } catch (err) {
      ui.notifications.warn(err.message);
    }
  }

  static async #onCancel() {
    const ok = await Compat.DialogV2.confirm({
      window: { title: L("NEONHUB.Downtime.Cancel") },
      classes: ["neon-hub", "nh-cal-dialog"],
      content: `<p>${esc(L("NEONHUB.Downtime.CancelBody"))}</p>`,
      rejectClose: false
    });
    if (ok) await Downtime.cancel();
  }

  _onClose(options) {
    super._onClose?.(options);
    if (DowntimeApp.instance === this) DowntimeApp.instance = null;
  }
}

/* ------------------------------------------ */
/*  Voting on how much downtime               */
/* ------------------------------------------ */

/**
 * The vote on how much downtime: everyone online sees it, players propose an amount, the GM sees
 * the votes and the group's call (the median) and starts the downtime with an amount.
 */
export class DowntimeVoteApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static instance = null;
  /** { id, gmId, users, votes: { userId: minutes }, label, participants } */
  static session = null;

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-downtime-vote`,
    classes: ["neon-hub", "nh-cal-app", "nh-dt-app", "nh-dt-vote-app"],
    tag: "div",
    window: { title: "NEONHUB.Downtime.Vote.Title", icon: "fa-solid fa-hand" },
    position: { width: 480, height: "auto" },
    actions: {
      preset: DowntimeVoteApp.#onPreset,
      vote: DowntimeVoteApp.#onVote,
      useCall: DowntimeVoteApp.#onUseCall,
      startIt: DowntimeVoteApp.#onStart,
      callOff: DowntimeVoteApp.#onCallOff
    }
  };

  static PARTS = {
    main: { template: `${TEMPLATE_PATH}/calendar/downtime-vote.hbs` }
  };

  constructor(options = {}) {
    super(options);
    this.minutes = DowntimeVoteApp.session?.proposed ?? MINUTES.day * 3;
  }

  static registerSocket() {
    HubSocket.on("dtv.open", (payload, sender) => sender?.isGM && this.#open(payload, sender));
    HubSocket.on("dtv.vote", (payload, sender) => this.#vote(payload, sender));
    HubSocket.on("dtv.close", (payload, sender) => {
      if (!sender?.isGM || payload.id !== this.session?.id) return;
      this.session = null;
      this.instance?.close();
    });
  }

  /** GM: open the vote on everyone's screen. */
  static start({ label = "", participants = [], total = 0 } = {}) {
    if (!game.user.isGM) throw new Error(L("NEONHUB.Error.GMOnly"));
    const users = game.users.filter((u) => u.active).map((u) => u.id);
    HubSocket.emit("dtv.open", { id: foundry.utils.randomID(12), users, label, participants, proposed: total }, users);
  }

  static #open(payload, sender) {
    this.session = { ...payload, gmId: sender.id, votes: {} };
    this.instance?.close();
    this.instance = new this();
    this.instance.render({ force: true });
  }

  static #vote({ id, minutes }, sender) {
    if (!this.session || id !== this.session.id || !sender) return;
    const value = Math.round(Number(minutes));
    if (!(value > 0)) return;
    this.session.votes[sender.id] = value;
    this.instance?.render();
  }

  async _prepareContext() {
    const session = DowntimeVoteApp.session;
    const votes = session?.votes ?? {};
    const call = groupCall(votes);
    const v = split(this.minutes);
    return {
      isGM: game.user.isGM,
      label: session?.label || L("NEONHUB.Downtime.Title"),
      days: v.days,
      hours: v.hours,
      mins: v.minutes,
      amount: formatDuration(this.minutes),
      amountTag: `<span class="nh-dt-amount">${formatDuration(this.minutes)}</span>`,
      presets: PRESETS.map(([key, minutes]) => ({ minutes, label: L(`NEONHUB.Downtime.Preset.${key}`) })),
      users: (session?.users ?? []).map((id) => game.users.get(id)).filter((u) => u && !u.isGM).map((u) => ({
        name: u.name,
        self: u.id === game.user.id,
        color: u.color?.css ?? u.color,
        vote: votes[u.id] ? formatDuration(votes[u.id]) : null
      })),
      call: call ? { minutes: call, label: formatDuration(call) } : null,
      voted: !!votes[game.user.id]
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    // Typing updates the amount in place: re-rendering here would swap the Vote/Start button out
    // from under a click that follows straight on from the field.
    for (const input of this.element.querySelectorAll(".nh-dt-duration input")) {
      input.addEventListener("input", () => this.#readFields());
    }
  }

  /** Take the amount from the fields, and show it on the buttons. */
  #readFields() {
    const inputs = [...(this.element?.querySelectorAll(".nh-dt-duration input") ?? [])];
    if (inputs.length) this.minutes = readDuration({ elements: Object.fromEntries(inputs.map((i) => [i.name, i])) }) || this.minutes;
    for (const el of this.element?.querySelectorAll(".nh-dt-amount") ?? []) el.textContent = formatDuration(this.minutes);
  }

  /** A preset sets the amount; for a player it's their vote, cast straight away. */
  static #onPreset(event, target) {
    this.minutes = Number(target.dataset.minutes) || this.minutes;
    const session = DowntimeVoteApp.session;
    if (!game.user.isGM && session) HubSocket.emit("dtv.vote", { id: session.id, minutes: this.minutes }, session.users);
    else this.render();
  }

  static #onVote() {
    const session = DowntimeVoteApp.session;
    this.#readFields();
    if (session) HubSocket.emit("dtv.vote", { id: session.id, minutes: this.minutes }, session.users);
  }

  static #onUseCall() {
    const call = groupCall(DowntimeVoteApp.session?.votes ?? {});
    if (call) {
      this.minutes = call;
      this.render();
    }
  }

  static async #onStart() {
    const session = DowntimeVoteApp.session;
    if (!session || !game.user.isGM) return;
    this.#readFields();
    try {
      await Downtime.start({ total: this.minutes, label: session.label, participants: session.participants });
      const others = session.users.filter((id) => id !== game.user.id);
      if (others.length) HubSocket.emit("dtv.close", { id: session.id }, others);
      DowntimeVoteApp.session = null;
      this.close();
    } catch (err) {
      ui.notifications.warn(err.message);
    }
  }

  static #onCallOff() {
    const session = DowntimeVoteApp.session;
    if (session) {
      const others = session.users.filter((id) => id !== game.user.id);
      if (others.length) HubSocket.emit("dtv.close", { id: session.id }, others);
    }
    DowntimeVoteApp.session = null;
    this.close();
  }

  _onClose(options) {
    super._onClose?.(options);
    if (DowntimeVoteApp.instance === this) DowntimeVoteApp.instance = null;
  }
}
