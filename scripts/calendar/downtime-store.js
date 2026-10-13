import { MODULE_ID, TEMPLATE_PATH } from "../constants.js";
import { Compat } from "../compat.js";
import { HubSocket } from "../socket.js";
import { CalendarStore } from "./cal-store.js";
import { CalendarOps } from "./cal-ops.js";
import { Clock } from "./clock.js";
import { SkipTimeApp } from "./skip-app.js";
import { daysCrossed } from "./clock-time.js";
import {
  normalizeCall, normalizeEntry, addEntry, removeEntry, spendProblem, allSpent, summary, balance, timeline, formatDuration
} from "./downtime-data.js";

const { deepClone } = foundry.utils;
const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));

export const DT_SETTING = "downtime";
const MAX_HISTORY = 20;

/** World actor for a uuid. */
export function actorOf(uuid) {
  const id = /^Actor\.([^.]+)$/.exec(uuid ?? "")?.[1];
  return id ? game.actors.get(id) ?? null : null;
}

/** Users who own an actor, plus the GMs. */
function ownersOf(uuids) {
  const out = new Set(game.users.filter((u) => u.isGM).map((u) => u.id));
  for (const uuid of uuids) {
    const actor = actorOf(uuid);
    if (actor) for (const u of game.users) if (actor.testUserPermission(u, "OWNER")) out.add(u.id);
  }
  return [...out];
}

/**
 * Downtime: the GM calls a stretch of it, each character taking part gets that much time to spend,
 * and downtime actions (from the HUD or other modules, through the API) spend it into a log.
 * Stored in a world setting the GM's client writes; players' spends are carried out by the GM.
 *
 * Hooks, on every client: cpr-neon-hub.downtimeStarted(call), .downtimeSpent(call, entry),
 * .downtimeRefunded(call, entry), .downtimeAllSpent(call), .downtimeCompleted(call), .downtimeCancelled(call).
 */
export const Downtime = {
  _ops: Promise.resolve(),

  serial(fn) {
    const job = this._ops.then(fn);
    this._ops = job.catch(() => null);
    return job;
  },

  register() {
    game.settings.register(MODULE_ID, DT_SETTING, {
      scope: "world",
      config: false,
      type: Object,
      default: { current: null, history: [] },
      onChange: () => Hooks.callAll(`${MODULE_ID}.downtimeChanged`)
    });
  },

  init() {
    HubSocket.register("dt.spend", (payload, user) => this.serial(() => this._spend(payload, user)));
    HubSocket.register("dt.refund", (payload, user) => this.serial(() => this._refund(payload, user)));
    HubSocket.on("dt.event", ({ type, call, entry }) => Hooks.callAll(`${MODULE_ID}.downtime${type}`, normalizeCall(call), entry ? normalizeEntry(entry) : undefined));
    Hooks.on(`${MODULE_ID}.timeSkipped`, (skip) => this._landed(skip));
  },

  _raw() {
    try {
      return game.settings.get(MODULE_ID, DT_SETTING) ?? {};
    } catch {
      return {};
    }
  },

  /** The open call, or null. */
  current() {
    return normalizeCall(this._raw().current);
  },

  history() {
    return Array.isArray(this._raw().history) ? this._raw().history : [];
  },

  /** A character's balance in the open call: { total, spent, left, taking }. */
  balance(actor) {
    return balance(this.current(), typeof actor === "string" ? actor : actor?.uuid);
  },

  /** A character's spends in the open call, placed in the downtime. */
  log(actor) {
    return timeline(this.current(), typeof actor === "string" ? actor : actor?.uuid);
  },

  /** The calendar date a character's downtime starts on. */
  startDate(call, actorUuid) {
    return call?.starts?.[actorUuid] ?? call?.start ?? null;
  },

  async _write(change) {
    if (!game.user.isGM) throw new Error(L("NEONHUB.Error.GMOnly"));
    const raw = deepClone(this._raw());
    const next = change({ current: raw.current ?? null, history: raw.history ?? [] });
    await game.settings.set(MODULE_ID, DT_SETTING, next);
  },

  _emit(type, call, entry = null, users = null) {
    HubSocket.emit("dt.event", { type, call, entry }, users ?? game.users.filter((u) => u.active).map((u) => u.id));
  },

  /* ---------------------------------------- */
  /*  Calling and ending downtime (GM)        */
  /* ---------------------------------------- */

  /**
   * GM: call downtime. Each participant gets `total` minutes to spend; a card goes to everyone.
   * @param {{ total: number, label?: string, participants: string[] }} options - participants: actor uuids
   */
  start({ total, label = "", participants = [] }) {
    return this.serial(async () => {
      if (this.current()) throw new Error(L("NEONHUB.Downtime.Error.AlreadyOpen"));
      const people = participants.map(actorOf).filter(Boolean);
      if (!people.length) throw new Error(L("NEONHUB.Downtime.Error.NoOne"));
      const starts = {};
      for (const a of people) {
        const c = CalendarStore.forActor(a);
        if (c) starts[a.uuid] = { year: c.year, month: c.month, day: c.day };
      }
      const first = CalendarStore.forActor(people[0]);
      const call = normalizeCall({
        starts,
        id: foundry.utils.randomID(12),
        label,
        total,
        participants: people.map((a) => a.uuid),
        start: first ? { year: first.year, month: first.month, day: first.day } : null,
        worldTime: game.time.worldTime,
        status: "open",
        entries: [],
        startedAt: Date.now()
      });
      if (!call.total) throw new Error(L("NEONHUB.Downtime.Error.NoTime"));
      await this._write((d) => ({ ...d, current: call }));
      const content = await Compat.renderTemplate(`${TEMPLATE_PATH}/calendar/downtime-card.hbs`, {
        kicker: L("NEONHUB.Downtime.Kicker"),
        label: call.label || L("NEONHUB.Downtime.Title"),
        total: formatDuration(call.total),
        names: people.map((a) => a.name).join(", "),
        body: L("NEONHUB.Downtime.Card.Started")
      });
      await ChatMessage.create({ content, speaker: { alias: L("NEONHUB.Downtime.Title") } });
      this._emit("Started", call);
      return call;
    });
  },

  /**
   * GM, after review: end the downtime. The Skip time clock winds through it on everyone's screen
   * and moves the world clock on; calendars follow (directly, without SmallTime).
   */
  complete() {
    return this.serial(async () => {
      const call = this.current();
      if (!call) throw new Error(L("NEONHUB.Downtime.Error.NoCall"));
      const done = { ...call, status: "done" };
      await this._write((d) => ({ current: null, history: [summary(done), ...d.history].slice(0, MAX_HISTORY) }));
      const rows = call.participants.map(actorOf).filter(Boolean).map((a) => {
        const b = balance(call, a.uuid);
        return { name: a.name, spent: formatDuration(b.spent), left: b.left ? L("NEONHUB.Downtime.Unused", { left: formatDuration(b.left) }) : null };
      });
      const content = await Compat.renderTemplate(`${TEMPLATE_PATH}/calendar/downtime-card.hbs`, {
        kicker: L("NEONHUB.Downtime.Kicker"),
        label: call.label || L("NEONHUB.Downtime.Title"),
        total: formatDuration(call.total),
        body: L("NEONHUB.Downtime.Card.Done"),
        rows
      });
      await ChatMessage.create({ content, speaker: { alias: L("NEONHUB.Downtime.Title") } });
      this._emit("Completed", done);
      this._winding = { id: SkipTimeApp.auto(call.total, { label: call.label || L("NEONHUB.Downtime.Title") }), from: game.time.worldTime, minutes: call.total };
      return done;
    });
  },

  /** The downtime's skip has landed: without SmallTime, move the calendars that follow the clock ourselves. */
  async _landed({ id, minutes, from } = {}) {
    if (!game.user.isGM || this._winding?.id !== id) return;
    this._winding = null;
    if (Clock.active) return;
    const days = daysCrossed(from, from + minutes * 60);
    if (!days) return;
    for (const calendar of Clock.followers()) {
      try {
        await CalendarOps.shift(calendar.id, { days });
      } catch (err) {
        console.error(`${MODULE_ID} | moving ${calendar.name} after downtime failed`, err);
      }
    }
  },

  /** GM: call it off without passing any time. */
  cancel() {
    return this.serial(async () => {
      const call = this.current();
      if (!call) return null;
      const cancelled = { ...call, status: "cancelled" };
      await this._write((d) => ({ current: null, history: [summary(cancelled), ...d.history].slice(0, MAX_HISTORY) }));
      this._emit("Cancelled", cancelled);
      return cancelled;
    });
  },

  /* ---------------------------------------- */
  /*  Spending                                */
  /* ---------------------------------------- */

  /**
   * Spend a character's downtime on something. Works from any client: a player's spend is checked
   * and saved by the GM. Throws when there's no open call, they aren't taking part, or not enough is left.
   * @param {Actor|string} actor - the character (or its uuid)
   * @param {number} minutes
   * @param {{ label?: string, source?: string, data?: object }} details - source: who logged it ("manual", a module id…)
   * @returns {Promise<object>} the log entry
   */
  async spend(actor, minutes, { label = "", source = "", data = null } = {}) {
    const payload = { actor: typeof actor === "string" ? actor : actor?.uuid, minutes, label, source, data };
    if (game.user.isGM) return this.serial(() => this._spend(payload, game.user));
    return HubSocket.request("dt.spend", payload);
  },

  async _spend({ actor: actorUuid, minutes, label, source, data }, user) {
    const actor = actorOf(actorUuid);
    if (!actor) throw new Error(L("NEONHUB.Lifestyle.Error.NoActor"));
    if (!user.isGM && !actor.testUserPermission(user, "OWNER")) throw new Error(L("NEONHUB.Error.NotAllowed"));
    const call = this.current();
    const problem = spendProblem(call, actor.uuid, minutes);
    if (problem) throw new Error(L(`NEONHUB.Downtime.Error.${problem}`, { name: actor.name, left: formatDuration(balance(call, actor.uuid).left) }));
    const entry = normalizeEntry({
      id: foundry.utils.randomID(12),
      actor: actor.uuid,
      minutes,
      label: label || L("NEONHUB.Downtime.Title"),
      source: source || "manual",
      user: user.name,
      at: Date.now(),
      data
    });
    let next = addEntry(call, entry);
    const finished = allSpent(next) && !next.allSpentNotified;
    if (finished) next = { ...next, allSpentNotified: true };
    await this._write((d) => ({ ...d, current: next }));
    this._emit("Spent", next, entry);
    if (finished) {
      this._emit("AllSpent", next);
      await ChatMessage.create({
        content: `<div class="nh-cal-card nh-dt-card"><div class="nh-cal-card-kicker">// ${L("NEONHUB.Downtime.Kicker")}</div><div class="nh-cal-card-name">${L("NEONHUB.Downtime.AllSpent")}</div><p>${L("NEONHUB.Downtime.AllSpentHint")}</p></div>`,
        speaker: { alias: L("NEONHUB.Downtime.Title") },
        whisper: game.users.filter((u) => u.isGM).map((u) => u.id)
      });
    }
    return entry;
  },

  /** Take a spend back: the GM any, a player their own logged by hand. */
  async refund(entryId) {
    if (game.user.isGM) return this.serial(() => this._refund({ entry: entryId }, game.user));
    return HubSocket.request("dt.refund", { entry: entryId });
  },

  async _refund({ entry: entryId }, user) {
    const call = this.current();
    const entry = call?.entries.find((e) => e.id === entryId);
    if (!entry) throw new Error(L("NEONHUB.Downtime.Error.NoEntry"));
    const actor = actorOf(entry.actor);
    if (!user.isGM && !(actor?.testUserPermission(user, "OWNER") && entry.source === "manual")) throw new Error(L("NEONHUB.Error.NotAllowed"));
    const next = { ...removeEntry(call, entryId), allSpentNotified: false };
    await this._write((d) => ({ ...d, current: next }));
    this._emit("Refunded", next, entry);
    return entry;
  },

  /** Whose screens to open the HUD on: the participants' owners and the GMs. */
  audience(call) {
    return ownersOf(call?.participants ?? []).filter((id) => game.users.get(id)?.active);
  }
};
