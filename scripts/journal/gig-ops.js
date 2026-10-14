import { MODULE_ID } from "../constants.js";
import { CPR } from "../cpr.js";
import { HQOps } from "../hq/hq-ops.js";
import { nextStatus, shares, unpaid, progress } from "./journal-data.js";
import { JournalStore, actorOf, formatDate } from "./journal-store.js";

const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));
const esc = (s) => Handlebars.escapeExpression(String(s ?? ""));
const eb = (n) => `${Math.round(Number(n) || 0).toLocaleString(game.i18n.lang)}eb`;

/**
 * The GM's side of gigs: moving them along, ticking objectives, paying out and posting to chat.
 * Gigs are journal entries the GM owns, so all of this runs on the GM's client.
 */
export const GigOps = {
  _gig(entry) {
    if (!game.user.isGM) throw new Error(L("NEONHUB.Error.GMOnly"));
    const page = JournalStore.recordPage(entry, "gig");
    if (!page) throw new Error(L("NEONHUB.Journal.Error.NoGig"));
    return { page, gig: JournalStore.data(page) };
  },

  /** A new gig, filed under Gigs. */
  async create(name = L("NEONHUB.Journal.Gig.NewName")) {
    if (!game.user.isGM) throw new Error(L("NEONHUB.Error.GMOnly"));
    const today = formatDate(JournalStore.today());
    return JournalStore.createEntry("gigs", { name, kind: "gig", data: { status: "found", dates: { found: today } } });
  },

  /** Take, complete, fail or reopen a gig; stamps the day it happened. */
  async move(entry, action) {
    const { page, gig } = this._gig(entry);
    const status = nextStatus(gig.status, action);
    if (!status) return gig;
    const dates = { ...gig.dates, [status]: formatDate(JournalStore.today(gig.crew)) };
    return JournalStore.save(page, { ...gig, status, dates });
  },

  /** Set an objective open, done or failed. */
  async setObjective(entry, id, state) {
    const { page, gig } = this._gig(entry);
    const objectives = gig.objectives.map((o) => (o.id === id ? { ...o, state } : o));
    return JournalStore.save(page, { ...gig, objectives });
  },

  /**
   * Pay a gig's rewards.
   * @param {JournalEntry} entry
   * @param {{ recipients: string[], rewards: Record<string, { to?: string }> }} plan - recipients:
   *   actor uuids sharing eddies and IP; rewards: the rewards to pay now, by id, with who gets an
   *   item or a home
   * @returns {Promise<string[]>} what was paid, a line each
   */
  async payout(entry, { recipients = [], rewards = {} } = {}) {
    const { page, gig } = this._gig(entry);
    const people = recipients.map(actorOf).filter(Boolean);
    const reason = L("NEONHUB.Journal.Gig.Ledger", { name: entry.name });
    const lines = [];
    const problems = [];
    const next = gig.rewards.map((w) => ({ ...w }));
    for (const w of next) {
      if (w.paid || !rewards[w.id]) continue;
      try {
        const paidTo = await this._pay(w, people, rewards[w.id], reason);
        if (paidTo === null) continue;
        w.paid = true;
        w.paidTo = paidTo;
        lines.push(`${JournalStore.rewardLabel(w)}${paidTo ? ` → ${paidTo}` : ""}`);
      } catch (err) {
        problems.push(`${JournalStore.rewardLabel(w)}: ${err.message}`);
      }
    }
    const payout = lines.length ? { at: Date.now(), by: game.user.name, date: formatDate(JournalStore.today(recipients)) } : gig.payout;
    await JournalStore.save(page, { ...gig, rewards: next, payout });
    if (lines.length) await this._card(entry, L("NEONHUB.Journal.Gig.PaidOut"), `<ul class="nh-jr-card-list">${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`, recipients);
    if (problems.length) ui.notifications.warn(problems.join(" · "));
    return lines;
  },

  /** Pay one reward; the names it went to ("" for a note), or null to skip it. */
  async _pay(w, people, choice, reason) {
    switch (w.kind) {
      case "eddies": {
        if (!people.length) return null;
        const amounts = shares(w.amount, people.length, w.split);
        for (const [i, actor] of people.entries()) if (amounts[i]) await CPR.changeWealth(actor, amounts[i], reason);
        return people.map((a, i) => `${a.name} ${eb(amounts[i])}`).join(", ");
      }
      case "ip": {
        if (!people.length) return null;
        for (const actor of people) await CPR.changeLedger(actor, "improvementPoints", w.amount, reason);
        return people.map((a) => a.name).join(", ");
      }
      case "hqip": {
        await HQOps.awardIP(w.hq, w.amount, reason);
        return game.modules.get(MODULE_ID).api.getHQ(w.hq)?.name ?? "";
      }
      case "item":
      case "housing": {
        const actor = actorOf(choice.to) ?? people[0];
        if (!actor) return null;
        const source = await fromUuid(w.uuid);
        if (!(source instanceof Item)) throw new Error(L("NEONHUB.Journal.Error.NoItem"));
        const data = source.toObject();
        delete data._id;
        delete data.folder;
        delete data.sort;
        delete data.ownership;
        await actor.createEmbeddedDocuments("Item", [data]);
        return actor.name;
      }
      default:
        return "";
    }
  },

  /** Post a gig to chat: its state, objectives and a link to open it. */
  async post(entry) {
    const { gig } = this._gig(entry);
    const p = progress(gig);
    const body = [
      gig.client ? `<p><b>${esc(L("NEONHUB.Journal.Gig.Client"))}:</b> ${esc(gig.client)}</p>` : "",
      gig.location ? `<p><b>${esc(L("NEONHUB.Journal.Gig.Location"))}:</b> ${esc(gig.location)}</p>` : "",
      p.total ? `<ul class="nh-jr-card-list">${gig.objectives.map((o) => `<li class="is-${o.state}">${esc(o.text)}</li>`).join("")}</ul>` : ""
    ].join("");
    return this._card(entry, L(`NEONHUB.Journal.Gig.State.${gig.status}`), body, gig.crew, JournalStore.playersSee(entry));
  },

  async _card(entry, kicker, body, crew = [], everyone = false) {
    const content = `<div class="nh-cal-card nh-jr-card"><div class="nh-cal-card-kicker">// ${esc(L("NEONHUB.Journal.Gig.Title"))} · ${esc(kicker)}</div>`
      + `<div class="nh-cal-card-name">${esc(entry.name)}</div>${body}`
      + `<p class="nh-jr-card-open">@UUID[${entry.uuid}]{${esc(L("NEONHUB.Journal.Open"))}}</p></div>`;
    const whisper = everyone ? [] : this._whisper(crew);
    return ChatMessage.create({ content, speaker: { alias: L("NEONHUB.Journal.Title") }, whisper });
  },

  /** The GMs and whoever owns the crew. */
  _whisper(crew) {
    const out = new Set(game.users.filter((u) => u.isGM).map((u) => u.id));
    for (const actor of crew.map(actorOf).filter(Boolean)) for (const u of game.users) if (!u.isGM && actor.testUserPermission(u, "OWNER")) out.add(u.id);
    return [...out];
  },

  unpaid(entry) {
    const page = JournalStore.recordPage(entry, "gig");
    return page ? unpaid(JournalStore.data(page)) : [];
  }
};
