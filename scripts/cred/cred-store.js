import { MODULE_ID } from "../constants.js";
import { HubSocket } from "../socket.js";
import { CPR } from "../cpr.js";
import { CalendarStore } from "../calendar/cal-store.js";
import {
  normalizeState, normalizePerson, normalizeFaction, normalizeBond, changeStanding, changeHeat, joinProblem, coolingDue,
  rivalsOf, upsertBond, removeBond, logged, clamp, signed, standingBand, heatBand, capOf, JOIN_AT
} from "./cred-data.js";

const { deepClone } = foundry.utils;
const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));
const esc = (s) => Handlebars.escapeExpression(String(s ?? ""));

export const CRED_SETTING = "streetCred";
export const CRED_CREW_SETTING = "credShowCrew";
export const CRED_BONDS_SETTING = "credPlayersBonds";
export const CRED_ANNOUNCE_SETTING = "credAnnounce";

/** The earned Role a faction kind makes you, by the CPR role item's name. */
const EARNED_ROLE = { gang: "Ganger", corp: "Exec" };

/** World actor for a uuid. */
export function actorOf(uuid) {
  const id = /^Actor\.([^.]+)$/.exec(uuid ?? "")?.[1];
  return id ? game.actors.get(id) ?? null : null;
}

/** A character's calendar date today, or null with no calendar. */
function today(actor) {
  const c = CalendarStore.all().length ? CalendarStore.forActor(actor) : null;
  return c ? { year: c.year, month: c.month, day: c.day } : null;
}

/**
 * Street Cred: who knows you, who likes you and how hot the badge runs. Kept in a world setting the
 * GM writes; players read their own characters' (and everyone's when the GM shares the crew's) and
 * ask the GM to save relationship edits when allowed.
 *
 * Hook on every client: cpr-neon-hub.credChanged().
 */
export const CredStore = {
  _ops: Promise.resolve(),

  serial(fn) {
    const job = this._ops.then(fn);
    this._ops = job.catch(() => null);
    return job;
  },

  register() {
    game.settings.register(MODULE_ID, CRED_SETTING, {
      scope: "world",
      config: false,
      type: Object,
      default: {},
      onChange: () => Hooks.callAll(`${MODULE_ID}.credChanged`)
    });
    game.settings.register(MODULE_ID, CRED_CREW_SETTING, {
      name: "NEONHUB.Cred.Settings.Crew",
      hint: "NEONHUB.Cred.Settings.CrewHint",
      scope: "world",
      config: true,
      type: Boolean,
      default: false,
      onChange: () => Hooks.callAll(`${MODULE_ID}.credChanged`)
    });
    game.settings.register(MODULE_ID, CRED_BONDS_SETTING, {
      name: "NEONHUB.Cred.Settings.Bonds",
      hint: "NEONHUB.Cred.Settings.BondsHint",
      scope: "world",
      config: true,
      type: Boolean,
      default: false,
      onChange: () => Hooks.callAll(`${MODULE_ID}.credChanged`)
    });
    game.settings.register(MODULE_ID, CRED_ANNOUNCE_SETTING, {
      name: "NEONHUB.Cred.Settings.Announce",
      hint: "NEONHUB.Cred.Settings.AnnounceHint",
      scope: "world",
      config: true,
      type: Boolean,
      default: true
    });
  },

  init() {
    HubSocket.register("cred.bond", (payload, user) => this.serial(() => this._bond(payload, user)));
    HubSocket.register("cred.unbond", (payload, user) => this.serial(() => this._unbond(payload, user)));
  },

  state() {
    try {
      return normalizeState(game.settings.get(MODULE_ID, CRED_SETTING) ?? {});
    } catch {
      return normalizeState({});
    }
  },

  factions() {
    return this.state().factions;
  },

  faction(id) {
    return this.factions().find((f) => f.id === id) ?? null;
  },

  person(actor) {
    const uuid = typeof actor === "string" ? actor : actor?.uuid;
    return this.state().people[uuid] ?? normalizePerson({});
  },

  /** Standing with a faction (0 if never met). */
  standing(actor, factionId) {
    return this.person(actor).standing[factionId]?.value ?? 0;
  },

  heat(actor) {
    return this.person(actor).heat;
  },

  /** CPR Reputation from the character's own ledger. */
  reputation(actor) {
    return Math.floor(Number(foundry.utils.getProperty(actor, "system.reputation.value")) || 0);
  },

  /** Characters this user can see in Street Cred. */
  characters(user = game.user) {
    const all = game.actors.filter((a) => a.type === "character" && a.hasPlayerOwner).sort((a, b) => a.name.localeCompare(b.name));
    if (user.isGM || game.settings.get(MODULE_ID, CRED_CREW_SETTING)) return all;
    return all.filter((a) => a.testUserPermission(user, "OWNER"));
  },

  canEditBonds(actor, user = game.user) {
    return user.isGM || (game.settings.get(MODULE_ID, CRED_BONDS_SETTING) && !!actor?.testUserPermission(user, "OWNER"));
  },

  /** The world's Worldbook entry for a faction, if there is one. */
  entryFor(faction) {
    const names = [faction.entry, faction.name].filter(Boolean).map((n) => n.toLowerCase());
    return game.journal.find((j) => names.includes(j.name.toLowerCase()) && j.testUserPermission(game.user, "LIMITED")) ?? null;
  },

  async _write(change) {
    if (!game.user.isGM) throw new Error(L("NEONHUB.Error.GMOnly"));
    const next = change(deepClone(this.state()));
    await game.settings.set(MODULE_ID, CRED_SETTING, next);
    return next;
  },

  async _writePerson(actor, change) {
    let result;
    await this._write((s) => {
      result = change(s.people[actor.uuid] ?? normalizePerson({}), s);
      s.people[actor.uuid] = result.person ?? result;
      return s;
    });
    return result;
  },

  /* ---------------------------------------- */
  /*  Standing and Heat (GM)                  */
  /* ---------------------------------------- */

  /**
   * GM: move a character's Standing with a faction.
   * @param {Actor|string} actor
   * @param {string} factionId
   * @param {number} delta - ignored when `set` is given
   * @param {{ reason?: string, set?: number, rivals?: string[], tell?: boolean }} options - rivals: faction ids that drop by 1
   */
  adjust(actor, factionId, delta, { reason = "", set = null, rivals = [], tell = true } = {}) {
    return this.serial(async () => {
      actor = typeof actor === "string" ? actorOf(actor) ?? (await fromUuid(actor)) : actor;
      if (!actor) throw new Error(L("NEONHUB.Lifestyle.Error.NoActor"));
      const faction = this.faction(factionId);
      if (!faction) throw new Error(L("NEONHUB.Cred.Error.NoFaction"));
      const opts = { reason, by: game.user.name, at: Date.now(), today: today(actor) };
      const results = [];
      await this._writePerson(actor, (person, s) => {
        const r = changeStanding(person, faction, delta, { ...opts, set });
        results.push({ faction, ...r });
        let p = r.person;
        for (const id of rivals) {
          const rival = s.factions.find((f) => f.id === id);
          if (!rival || rival.id === faction.id) continue;
          const rr = changeStanding(p, rival, -1, { ...opts, reason: L("NEONHUB.Cred.EnemyReason", { name: faction.name }) });
          results.push({ faction: rival, ...rr });
          p = rr.person;
        }
        return p;
      });
      for (const r of results) await this._afterStanding(actor, r, { reason, tell });
      return results.map(({ faction: f, from, to }) => ({ faction: f.id, from, to }));
    });
  },

  async _afterStanding(actor, { faction, from, to, crossed, patchedOut, canJoin }, { reason, tell }) {
    if (this.person(actor).member === faction.id) await this._syncRole(actor, faction, to);
    if (patchedOut) {
      await this._card(actor, {
        icon: "fa-solid fa-user-slash",
        title: L(`NEONHUB.Cred.Card.Out.${faction.kind}`, { name: faction.name }),
        body: L("NEONHUB.Cred.Card.OutBody", { name: actor.name, faction: faction.name, value: signed(to) }),
        reason
      }, true);
      return;
    }
    if (!crossed && !canJoin) return;
    const key = standingBand(to);
    await this._card(actor, {
      icon: to >= from ? "fa-solid fa-arrow-trend-up" : "fa-solid fa-arrow-trend-down",
      title: `${faction.name}: ${L(`NEONHUB.Cred.Standing.${key}`)} (${signed(to)})`,
      body: L(`NEONHUB.Cred.StandingGets.${key}`),
      extra: canJoin ? L(`NEONHUB.Cred.Card.CanJoin.${faction.kind}`, { name: faction.name }) : "",
      reason
    }, tell);
  },

  /** GM: move a character's Heat with the NCPD. */
  adjustHeat(actor, delta, { reason = "", set = null, tell = true } = {}) {
    return this.serial(async () => {
      actor = typeof actor === "string" ? actorOf(actor) ?? (await fromUuid(actor)) : actor;
      if (!actor) throw new Error(L("NEONHUB.Lifestyle.Error.NoActor"));
      const r = await this._writePerson(actor, (person) => changeHeat(person, delta, { reason, set, by: game.user.name, at: Date.now(), today: today(actor) }));
      if (r.crossed) {
        const key = heatBand(r.to);
        await this._card(actor, {
          icon: "fa-solid fa-handcuffs",
          title: `${L("NEONHUB.Cred.Heat.Title")}: ${L(`NEONHUB.Cred.Heat.${key}`)} (${signed(r.to)})`,
          body: L(`NEONHUB.Cred.HeatDoes.${key}`),
          reason
        }, tell);
      }
      return { from: r.from, to: r.to };
    });
  },

  /** GM: change Reputation (0–10) on the character's CPR ledger. */
  async adjustReputation(actor, delta, reason = "") {
    if (!game.user.isGM) throw new Error(L("NEONHUB.Error.GMOnly"));
    const from = this.reputation(actor);
    const to = clamp(from + Number(delta || 0), 0, 10);
    if (to === from) return to;
    await CPR.changeLedger(actor, "reputation", to - from, reason || L("NEONHUB.Cred.Title"));
    return to;
  },

  /** GM: a character joins a gang or corp (Standing +4 or better). */
  join(actor, factionId) {
    return this.serial(async () => {
      const faction = this.faction(factionId);
      const problem = joinProblem(this.person(actor), faction);
      if (problem) throw new Error(L(`NEONHUB.Cred.Error.${problem}`, { name: faction?.name ?? "", at: signed(JOIN_AT) }));
      const value = this.standing(actor, factionId);
      await this._writePerson(actor, (p) => logged({ ...p, member: faction.id }, { what: "join", key: faction.id, name: faction.name, from: value, to: value, by: game.user.name, at: Date.now(), date: today(actor) }));
      await this._syncRole(actor, faction, value);
      await this._card(actor, {
        icon: "fa-solid fa-user-plus",
        title: L(`NEONHUB.Cred.Card.In.${faction.kind}`, { name: faction.name }),
        body: L(`NEONHUB.Cred.Card.InBody.${faction.kind}`, { name: actor.name, rank: value })
      }, true);
    });
  },

  /** GM: a character leaves (or is thrown out of) their gang or corp. Standing stays. */
  leave(actor) {
    return this.serial(async () => {
      const person = this.person(actor);
      const faction = this.faction(person.member);
      if (!person.member) return;
      const value = this.standing(actor, person.member);
      await this._writePerson(actor, (p) => logged({ ...p, member: null }, { what: "leave", key: person.member, name: faction?.name ?? person.member, from: value, to: value, by: game.user.name, at: Date.now(), date: today(actor) }));
    });
  },

  /** GM: Standing cools by 1 after three months out of touch (or now marks contact made). */
  coolOff(actor, factionId) {
    return this.adjust(actor, factionId, -1, { reason: L("NEONHUB.Cred.CoolReason") });
  },

  /** GM: they've been in touch; the three months start again. */
  touch(actor, factionId) {
    return this.serial(() => this._writePerson(actor, (p) => {
      const s = p.standing[factionId] ?? { value: 0, contact: null };
      return { ...p, standing: { ...p.standing, [factionId]: { ...s, contact: today(actor) } } };
    }));
  },

  /** Standings due to cool off for a character, as factions. */
  cooling(actor) {
    const due = coolingDue(this.person(actor), today(actor));
    return this.factions().filter((f) => due.includes(f.id));
  },

  rivalsOf(factionId) {
    return rivalsOf(this.state(), this.faction(factionId));
  },

  /** The earned Role's rank follows Standing, when the character has a Ganger or Exec role item. */
  async _syncRole(actor, faction, value) {
    const name = EARNED_ROLE[faction.kind];
    const role = name && actor.items.find((i) => i.type === "role" && i.name.toLowerCase() === name.toLowerCase());
    if (!role) return;
    const rank = Math.max(JOIN_AT, Math.min(10, value));
    if (Number(role.system?.rank) === rank) return;
    try {
      await role.update({ "system.rank": rank });
    } catch (err) {
      console.warn(`${MODULE_ID} | couldn't set ${actor.name}'s ${name} rank`, err);
    }
  },

  /* ---------------------------------------- */
  /*  Factions (GM)                           */
  /* ---------------------------------------- */

  saveFaction(raw) {
    return this.serial(() => this._write((s) => {
      const f = normalizeFaction(raw);
      if (!f) throw new Error(L("NEONHUB.Cred.Error.NoName"));
      const at = s.factions.findIndex((x) => x.id === (raw.originalId || f.id));
      if (at >= 0) s.factions[at] = f;
      else s.factions.push(f);
      // Standing above a new cap comes down to it.
      for (const p of Object.values(s.people)) if (p.standing[f.id]?.value > capOf(f)) p.standing[f.id].value = capOf(f);
      return s;
    }));
  },

  removeFaction(id) {
    return this.serial(() => this._write((s) => {
      s.factions = s.factions.filter((f) => f.id !== id);
      for (const f of s.factions) f.rivals = f.rivals.filter((r) => r !== id);
      for (const p of Object.values(s.people)) {
        delete p.standing[id];
        if (p.member === id) p.member = null;
      }
      return s;
    }));
  },

  /** GM: bring back the Players' Board's factions (keeping every Standing for the ones that stay). */
  resetFactions() {
    return this.serial(() => this._write((s) => ({ ...s, factions: normalizeState({}).factions })));
  },

  /* ---------------------------------------- */
  /*  Relationships                           */
  /* ---------------------------------------- */

  /** Save a relationship (GM, or the owner when players may). Mutual ones are mirrored onto the other character. */
  async saveBond(actor, bond) {
    const payload = { actor: actor.uuid, bond };
    if (game.user.isGM) return this.serial(() => this._bond(payload, game.user));
    return HubSocket.request("cred.bond", payload);
  },

  async removeBond(actor, id) {
    const payload = { actor: actor.uuid, id };
    if (game.user.isGM) return this.serial(() => this._unbond(payload, game.user));
    return HubSocket.request("cred.unbond", payload);
  },

  async _bond({ actor: uuid, bond }, user) {
    const actor = actorOf(uuid);
    if (!actor) throw new Error(L("NEONHUB.Lifestyle.Error.NoActor"));
    if (!this.canEditBonds(actor, user)) throw new Error(L("NEONHUB.Error.NotAllowed"));
    const before = this.person(actor).bonds.find((b) => b.id === bond.id);
    const b = normalizeBond({ ...bond, id: bond.id || foundry.utils.randomID(12) });
    if (!b) throw new Error(L("NEONHUB.Cred.Error.NoName"));
    // Players never see or set the GM's hidden flag.
    if (!user.isGM) b.hidden = before?.hidden ?? false;
    const other = b.mutual ? actorOf(b.target) : null;
    await this._write((s) => {
      s.people[actor.uuid] = upsertBond(s.people[actor.uuid] ?? normalizePerson({}), b);
      if (other?.type === "character" && other.id !== actor.id) {
        const theirs = s.people[other.uuid] ?? normalizePerson({});
        const mirror = theirs.bonds.find((x) => x.target === actor.uuid);
        s.people[other.uuid] = upsertBond(theirs, mirror
          ? { ...mirror, value: b.value, romance: b.romance, mutual: true }
          : { id: foundry.utils.randomID(12), target: actor.uuid, name: actor.name, img: actor.img, value: b.value, romance: b.romance, mutual: true });
      }
      return s;
    });
    return b;
  },

  async _unbond({ actor: uuid, id }, user) {
    const actor = actorOf(uuid);
    if (!actor) throw new Error(L("NEONHUB.Lifestyle.Error.NoActor"));
    if (!this.canEditBonds(actor, user)) throw new Error(L("NEONHUB.Error.NotAllowed"));
    const bond = this.person(actor).bonds.find((b) => b.id === id);
    if (!user.isGM && bond?.hidden) throw new Error(L("NEONHUB.Error.NotAllowed"));
    await this._writePerson(actor, (p) => removeBond(p, id));
  },

  /* ---------------------------------------- */
  /*  Chat                                    */
  /* ---------------------------------------- */

  /** A card to the character's owners and the GMs (only the GMs when `tell` is off or announcing is). */
  async _card(actor, { icon, title, body, extra = "", reason = "" }, tell = true) {
    const owners = game.users.filter((u) => !u.isGM && actor.testUserPermission(u, "OWNER")).map((u) => u.id);
    const gms = game.users.filter((u) => u.isGM).map((u) => u.id);
    const toPlayers = tell && game.settings.get(MODULE_ID, CRED_ANNOUNCE_SETTING);
    const content = `<div class="nh-cal-card nh-cred-card">
      <div class="nh-cal-card-kicker">// ${esc(L("NEONHUB.Cred.Kicker"))} &middot; ${esc(actor.name)}</div>
      <div class="nh-cal-card-name"><i class="${icon}"></i> ${esc(title)}</div>
      ${body ? `<p>${esc(body)}</p>` : ""}${extra ? `<p><strong>${esc(extra)}</strong></p>` : ""}${reason ? `<p class="nh-cred-card-why">${esc(reason)}</p>` : ""}
    </div>`;
    await ChatMessage.create({ content, speaker: { alias: L("NEONHUB.Cred.Title") }, whisper: [...new Set([...gms, ...(toPlayers ? owners : [])])] });
  }
};
