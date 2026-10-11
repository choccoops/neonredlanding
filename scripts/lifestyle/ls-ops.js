import { MODULE_ID, TEMPLATE_PATH } from "../constants.js";
import { Compat } from "../compat.js";
import { CPR } from "../cpr.js";
import { HubSocket } from "../socket.js";
import { HQStore } from "../hq/hq-data.js";
import { HQOps } from "../hq/hq-ops.js";
import {
  LS_FLAG, CATEGORIES, GROUPS, normalizeLifestyle, computeBill, computeMonths, lineCost, reminders,
  payoffAmount, loanTerms, packagesToDeactivate, pushHistory, billStatus
} from "./ls-data.js";
import { LifestyleStore, LS_ACTOR_FLAG } from "./ls-store.js";

const { hasProperty, getProperty } = foundry.utils;
const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));
const esc = (s) => Handlebars.escapeExpression(String(s ?? ""));
const eb = (n) => `${Math.round(Number(n) || 0).toLocaleString(game.i18n.lang)}eb`;

/** Passed with this module's own item writes, so the item hooks in main.js leave them alone. */
export const own = () => ({ neonHub: "lifestyle" });

/** Owners may always do these to their own character: they only spend that character's money. */
const OWNER_OPS = new Set(["pay", "payoff", "buyHome", "call"]);
/** Owners may do these when the GM lets players manage their own lifestyle. */
const MANAGE_OPS = new Set(["add", "toggle", "remove", "setAmount"]);
/** What a player can ask the GM to do. */
const REQUEST_OPS = new Set([...OWNER_OPS, ...MANAGE_OPS]);

/**
 * Everything that changes a character's lifestyle. Money moves through the CPR wealth ledger.
 * Players act on their own characters directly where they're allowed to, and otherwise ask the GM.
 */
export class LifestyleOps {
  static init() {
    HubSocket.register("ls.request", (payload, user) => this.#onRequest(payload, user));
  }

  /** Called from the Lifestyle window. Runs here when allowed, else asks the GM. */
  static async perform(op, payload) {
    if (game.user.isGM) return this.#run(op, payload, game.user);
    const actor = await fromUuid(payload.actor);
    if (!actor?.testUserPermission(game.user, "OWNER")) throw new Error(L("NEONHUB.Error.NotAllowed"));
    if (await this.#allowedFor(op, payload, actor, game.user)) return this.#run(op, payload, game.user);
    return HubSocket.request("ls.request", { op, ...payload });
  }

  /** Whether a (non-GM) owner may run this without asking. */
  static async #allowedFor(op, payload, actor, user) {
    if (OWNER_OPS.has(op)) return true;
    if (!MANAGE_OPS.has(op) || !LifestyleStore.canManage(actor, user)) return false;
    if (op === "add") {
      const source = await fromUuid(payload.source);
      const ls = normalizeLifestyle(source?.getFlag?.(MODULE_ID, LS_FLAG));
      return !ls.perk;
    }
    if (op === "remove") {
      const d = this.#describe(actor, payload.item);
      return d?.category !== "loan";
    }
    return true;
  }

  /** True when a player would have to ask the GM for this. */
  static async needsGM(op, payload) {
    if (game.user.isGM) return false;
    const actor = await fromUuid(payload.actor);
    return !(await this.#allowedFor(op, payload, actor, game.user));
  }

  static async #onRequest(payload, user) {
    const { op } = payload;
    if (!REQUEST_OPS.has(op)) throw new Error(L("NEONHUB.Error.NotAllowed"));
    const actor = await fromUuid(payload.actor);
    if (!actor) throw new Error(L("NEONHUB.Lifestyle.Error.NoActor"));
    if (!actor.testUserPermission(user, "OWNER")) throw new Error(L("NEONHUB.Error.NotAllowed"));
    const what = await this.#describeRequest(op, payload, actor);
    const ok = await Compat.DialogV2.confirm({
      window: { title: L("NEONHUB.Lifestyle.Request.Title") },
      content: `<p>${L("NEONHUB.Lifestyle.Request.Body", { user: esc(user.name), what: esc(what), name: esc(actor.name) })}</p>`,
      rejectClose: false
    });
    if (!ok) throw new Error(L("NEONHUB.Error.Declined"));
    await this.#run(op, payload, user);
    // Results can hold documents; the player only needs to know it worked.
    return true;
  }

  static async #describeRequest(op, payload, actor) {
    const itemName = payload.item ? actor.items.get(payload.item)?.name : (await fromUuid(payload.source))?.name;
    return L(`NEONHUB.Lifestyle.Request.${op}`, { item: itemName ?? "?" });
  }

  static async #run(op, payload, user) {
    switch (op) {
      case "pay": return this.pay(payload.actor, { user });
      case "add": return this.add(payload.actor, payload.source, { principal: payload.principal, user });
      case "toggle": return this.toggle(payload.actor, payload.item, payload.active);
      case "remove": return this.remove(payload.actor, payload.item);
      case "setAmount": return this.setAmount(payload.actor, payload.item, payload.amount);
      case "payoff": return this.payoff(payload.actor, payload.item, { user });
      case "buyHome": return this.buyHome(payload.actor, payload.item, { user });
      case "call": return this.call(payload.actor, payload.item);
      case "markPaid": return this.markPaid(payload.actor, payload.paid);
      case "newMonth": return this.newMonth(payload);
      case "billAll": return this.billAll({ user });
      default: throw new Error(`Unknown lifestyle operation: ${op}`);
    }
  }

  /* ---------------------------------------- */
  /*  Reading                                 */
  /* ---------------------------------------- */

  static async #actor(uuid) {
    const actor = typeof uuid === "string" ? await fromUuid(uuid) : uuid;
    if (!actor) throw new Error(L("NEONHUB.Lifestyle.Error.NoActor"));
    return actor;
  }

  static #describe(actor, itemId) {
    return LifestyleStore.items(actor).find((d) => d.id === itemId) ?? null;
  }

  static #item(actor, itemId) {
    const item = actor.items.get(itemId);
    if (!item?.getFlag(MODULE_ID, LS_FLAG)) throw new Error(L("NEONHUB.Lifestyle.Error.NoItem"));
    return item;
  }

  /**
   * The bill this character would pay now, with everything the window and chat card show.
   * `bill` is one month; `due` covers every month owed (several when the calendar jumped
   * past more than one rent day).
   */
  static billFor(actor) {
    const items = LifestyleStore.items(actor);
    const opts = { moraleDiscount: LifestyleStore.moraleDiscount(actor) };
    const bill = computeBill(items, opts);
    const state = LifestyleStore.actorState(actor);
    const billing = LifestyleStore.billing(actor);
    const due = billing.owed ? computeMonths(items, billing.owed, opts) : null;
    const wallet = CPR.hasWealth(actor) ? CPR.getWealth(actor) : 0;
    return {
      items,
      bill,
      due,
      state,
      billing,
      wallet,
      status: billStatus({ owed: billing.owed, wallet }),
      reminders: reminders(items)
    };
  }

  /* ---------------------------------------- */
  /*  Monthly billing                         */
  /* ---------------------------------------- */

  /**
   * Pay what a character owes: this month, or every month since their last bill.
   * @returns {Promise<object>} what was paid (for the chat card)
   */
  static async pay(actorUuid, { user = game.user, card = true } = {}) {
    const actor = await this.#actor(actorUuid);
    if (!CPR.hasWealth(actor)) throw new Error(L("NEONHUB.Error.NoWealth", { name: actor.name }));
    const { items, due, state, billing, wallet } = this.billFor(actor);
    if (!due) throw new Error(L("NEONHUB.Lifestyle.Error.AlreadyPaid", { name: actor.name }));
    if (!LifestyleStore.allowDebt && wallet < due.total) {
      throw new Error(L("NEONHUB.Error.ShortFunds", { names: `${actor.name} (${eb(wallet)}/${eb(due.total)})` }));
    }
    const label = due.months > 1 ? `${billing.firstLabel} – ${billing.label}` : billing.label;
    if (due.total > 0) await CPR.changeWealth(actor, -due.total, L("NEONHUB.Lifestyle.Ledger.Month", { month: label }), user.name);

    // Installment loans count down; paid-off ones leave the sheet.
    const finishedNames = due.finished.map((id) => actor.items.get(id)?.name).filter(Boolean);
    if (due.loans.length) {
      await actor.updateEmbeddedDocuments("Item", due.loans.map((u) => ({ _id: u.id, [`flags.${MODULE_ID}.${LS_FLAG}.loan.monthsLeft`]: u.monthsLeft })), own());
    }
    if (due.finished.length) await actor.deleteEmbeddedDocuments("Item", due.finished, own());

    const after = CPR.getWealth(actor);
    const entry = {
      month: billing.period,
      months: due.months,
      label,
      total: due.total,
      discount: due.discount,
      after,
      at: Date.now(),
      user: user.name,
      lines: due.lines.filter((l) => l.cost > 0).map((l) => ({ name: l.name, cost: l.cost, group: l.group, months: l.months }))
    };
    const record = { ...state, history: pushHistory(state.history, entry) };
    if (billing.mode === "calendar") record.paidPeriod = billing.period;
    else record.paidMonth = billing.period;
    await actor.setFlag(MODULE_ID, LS_ACTOR_FLAG, record);
    await this.syncActor(actor);

    const result = { actor, bill: due, label, before: wallet, after, finished: finishedNames, reminders: reminders(LifestyleStore.items(actor)) };
    if (card) await this.postBill(result);
    return result;
  }

  /** GM: bill every character who owes, optionally only those living by one calendar. */
  static async billAll({ user = game.user, calendarId = null } = {}) {
    if (!game.user.isGM) throw new Error(L("NEONHUB.Error.GMOnly"));
    const paid = [];
    const failed = [];
    for (const actor of LifestyleStore.characters()) {
      const billing = LifestyleStore.billing(actor);
      if (!billing.owed) continue;
      if (calendarId && billing.calendar?.id !== calendarId) continue;
      try {
        paid.push(await this.pay(actor, { user }));
      } catch (err) {
        failed.push({ name: actor.name, error: err.message });
      }
    }
    return { paid, failed };
  }

  /**
   * GM, without calendars: start the next counter month. Optionally runs every
   * Headquarters' new month too and bills everyone straight away.
   * (With calendars, moving a calendar past its rent day does this.)
   */
  static async newMonth({ hqs = true, bill = false } = {}) {
    if (!game.user.isGM) throw new Error(L("NEONHUB.Error.GMOnly"));
    const month = LifestyleStore.month + 1;
    await LifestyleStore.setState({ month });
    const label = LifestyleStore.monthLabel(month);
    await ChatMessage.create({
      content: `<div class="neon-hub-chat nh-ls-chat"><header><i class="fa-solid fa-calendar-check"></i> <strong>${esc(label)}</strong></header><p>${esc(L("NEONHUB.Lifestyle.Chat.NewMonth"))}</p></div>`,
      speaker: { alias: L("NEONHUB.Lifestyle.Title") }
    });
    const hqResults = [];
    if (hqs) {
      for (const hq of HQStore.all()) {
        if (hq.status === "destroyed") continue;
        try {
          await HQOps.newMonth(hq.id);
          hqResults.push(hq.name);
        } catch (err) {
          console.warn(`${MODULE_ID} | new month for ${hq.name} failed`, err);
        }
      }
    }
    const billing = bill ? await this.billAll() : null;
    return { month, label, hqs: hqResults, billing };
  }

  /** GM bookkeeping: mark what's owed as paid (or this month as due) without moving money. */
  static async markPaid(actorUuid, paid = true) {
    if (!game.user.isGM) throw new Error(L("NEONHUB.Error.GMOnly"));
    const actor = await this.#actor(actorUuid);
    const state = LifestyleStore.actorState(actor);
    const billing = LifestyleStore.billing(actor);
    const record = { ...state };
    if (billing.mode === "calendar") record.paidPeriod = paid ? billing.period : billing.period - 1;
    else record.paidMonth = paid ? billing.period : Math.min(state.paidMonth, billing.period - 1);
    await actor.setFlag(MODULE_ID, LS_ACTOR_FLAG, record);
  }

  /**
   * GM: when calendars start running months, carry everyone's standing over:
   * a character paid up for the counter month is paid for their calendar's current
   * month; anyone else owes it. Runs once per character.
   */
  static async adoptCalendars() {
    if (!game.user.isGM) return;
    for (const actor of LifestyleStore.characters()) {
      const state = LifestyleStore.actorState(actor);
      if (state.paidPeriod !== null) continue;
      const billing = LifestyleStore.billing(actor);
      if (billing.mode !== "calendar") return;
      const paidUp = state.paidMonth >= LifestyleStore.month;
      await actor.setFlag(MODULE_ID, LS_ACTOR_FLAG, { ...state, paidPeriod: paidUp ? billing.period : billing.period - 1 });
    }
  }

  static async postBill({ actor, bill, label, before, after, finished, reminders: notes }) {
    const groups = GROUPS.map((g) => ({
      label: L(`NEONHUB.Lifestyle.Group.${g}`),
      total: bill.groups[g],
      totalText: eb(bill.groups[g]),
      lines: bill.lines.filter((l) => l.group === g && l.cost > 0).map((l) => ({ name: l.name, amount: l.amount > 1 ? l.amount : null, months: l.months > 1 ? l.months : null, cost: eb(l.cost) }))
    })).filter((g) => g.total > 0 || g.lines.length);
    const content = await Compat.renderTemplate(`${TEMPLATE_PATH}/lifestyle/bill-card.hbs`, {
      name: actor.name,
      img: actor.img,
      label,
      months: bill.months > 1 ? bill.months : null,
      groups,
      discount: bill.discount ? eb(bill.discount) : null,
      total: eb(bill.total),
      before: eb(before),
      after: eb(after),
      debt: after < 0,
      finished,
      notes: notes.map((r) => (r.kind === "roughNight"
        ? L("NEONHUB.Lifestyle.Reminder.RoughNight", { name: r.name, dv: r.dv })
        : L("NEONHUB.Lifestyle.Reminder.Check", { name: r.name, skill: r.skill, dv: r.dv }))),
      hqs: LifestyleStore.hqSummary(actor).filter((h) => h.rent > 0).map((h) => ({ ...h, share: eb(h.share), rent: eb(h.rent) }))
    });
    await ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor }), whisper: this.#owners(actor) });
  }

  static #owners(actor) {
    return game.users.filter((u) => u.isGM || actor.testUserPermission(u, "OWNER")).map((u) => u.id);
  }

  /* ---------------------------------------- */
  /*  Items                                   */
  /* ---------------------------------------- */

  /**
   * Put a lifestyle item from a compendium or the world onto a character, active.
   * Furnishings are paid for up front; loans pay out their cash.
   */
  static async add(actorUuid, sourceUuid, { principal = 0, user = game.user } = {}) {
    const actor = await this.#actor(actorUuid);
    const source = await fromUuid(sourceUuid);
    const flag = source?.getFlag?.(MODULE_ID, LS_FLAG);
    if (!(source instanceof Item) || !flag) throw new Error(L("NEONHUB.Lifestyle.Error.NoItem"));
    const ls = normalizeLifestyle(flag);
    if (ls.template) throw new Error(L("NEONHUB.Lifestyle.Error.Template"));

    const data = source.toObject();
    delete data._id;
    delete data.folder;
    delete data.sort;
    delete data.ownership;
    data._stats = { ...(data._stats ?? {}), compendiumSource: source.pack ? source.uuid : (data._stats?.compendiumSource ?? null) };
    data.system.equipped = "equipped";
    data.system.usage = "equipped";

    const reason = L("NEONHUB.Lifestyle.Ledger.Item", { item: source.name });
    let cash = 0;
    if (ls.category === "loan") {
      const terms = loanTerms(ls.loan, ls.loan.principal || principal);
      if (!terms.principal) throw new Error(L("NEONHUB.Lifestyle.Error.NoPrincipal"));
      ls.loan.principal = terms.principal;
      if (terms.monthly !== null) ls.monthly = terms.monthly;
      if (ls.loan.kind === "installment") ls.loan.monthsLeft = terms.monthsLeft;
      cash = terms.cash;
    } else if (CATEGORIES[ls.category].oneTime && data.system.price?.market > 0) {
      cash = -Math.floor(data.system.price.market);
      if (CPR.getWealth(actor) + cash < 0) {
        throw new Error(L("NEONHUB.Error.ShortFunds", { names: `${actor.name} (${eb(CPR.getWealth(actor))}/${eb(-cash)})` }));
      }
    }
    data.flags[MODULE_ID][LS_FLAG] = ls;

    if (cash) {
      if (!CPR.hasWealth(actor)) throw new Error(L("NEONHUB.Error.NoWealth", { name: actor.name }));
      await CPR.changeWealth(actor, cash, reason, user.name);
    }
    let created;
    try {
      [created] = await actor.createEmbeddedDocuments("Item", [data], own());
    } catch (err) {
      if (cash) await CPR.changeWealth(actor, -cash, L("NEONHUB.Ledger.Refund"), user.name).catch(() => null);
      throw err;
    }
    await this.keepOnePackage(actor, created.id);
    await this.syncActor(actor);
    return created;
  }

  static async toggle(actorUuid, itemId, active) {
    const actor = await this.#actor(actorUuid);
    const item = this.#item(actor, itemId);
    const on = active ?? item.system.equipped !== "equipped";
    await item.update({ "system.equipped": on ? "equipped" : "owned" }, own());
    if (on) await this.keepOnePackage(actor, itemId);
    await this.syncActor(actor);
  }

  static async remove(actorUuid, itemId) {
    const actor = await this.#actor(actorUuid);
    this.#item(actor, itemId);
    await actor.deleteEmbeddedDocuments("Item", [itemId], own());
    await this.syncActor(actor);
  }

  static async setAmount(actorUuid, itemId, amount) {
    const actor = await this.#actor(actorUuid);
    const item = this.#item(actor, itemId);
    await item.update({ "system.amount": Math.max(1, Math.floor(Number(amount) || 1)) }, own());
    await this.syncActor(actor);
  }

  /** Clear a loan in one payment. */
  static async payoff(actorUuid, itemId, { user = game.user } = {}) {
    const actor = await this.#actor(actorUuid);
    const d = this.#describe(actor, itemId);
    if (d?.category !== "loan") throw new Error(L("NEONHUB.Lifestyle.Error.NoItem"));
    const amount = payoffAmount(d);
    if (CPR.getWealth(actor) < amount) throw new Error(L("NEONHUB.Error.ShortFunds", { names: `${actor.name} (${eb(CPR.getWealth(actor))}/${eb(amount)})` }));
    if (amount) await CPR.changeWealth(actor, -amount, L("NEONHUB.Lifestyle.Ledger.Payoff", { item: d.name }), user.name);
    await actor.deleteEmbeddedDocuments("Item", [itemId], own());
    await this.syncActor(actor);
    return amount;
  }

  /** Buy a rented home outright: no more rent. */
  static async buyHome(actorUuid, itemId, { user = game.user } = {}) {
    const actor = await this.#actor(actorUuid);
    const d = this.#describe(actor, itemId);
    if (d?.category !== "housing" || !d.buyPrice || d.owned) throw new Error(L("NEONHUB.Lifestyle.Error.NotForSale"));
    if (CPR.getWealth(actor) < d.buyPrice) throw new Error(L("NEONHUB.Error.ShortFunds", { names: `${actor.name} (${eb(CPR.getWealth(actor))}/${eb(d.buyPrice)})` }));
    await CPR.changeWealth(actor, -d.buyPrice, L("NEONHUB.Lifestyle.Ledger.Buy", { item: d.name }), user.name);
    await actor.items.get(itemId).update({ [`flags.${MODULE_ID}.${LS_FLAG}.owned`]: true }, own());
    await this.syncActor(actor);
  }

  /** Health plans: roll how many rounds until help arrives. */
  static async call(actorUuid, itemId) {
    const actor = await this.#actor(actorUuid);
    const d = this.#describe(actor, itemId);
    if (!d?.response) throw new Error(L("NEONHUB.Lifestyle.Error.NoResponse"));
    if (!d.active) throw new Error(L("NEONHUB.Lifestyle.Error.Inactive", { item: d.name }));
    const roll = await new Roll(d.response).evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: L("NEONHUB.Lifestyle.Chat.Response", { item: esc(d.name) })
    });
    return roll.total;
  }

  /** Only one lifestyle package is active at a time. */
  static async keepOnePackage(actor, itemId) {
    const off = packagesToDeactivate(LifestyleStore.items(actor), itemId);
    if (off.length) await actor.updateEmbeddedDocuments("Item", off.map((id) => ({ _id: id, "system.equipped": "owned" })), own());
  }

  /* ---------------------------------------- */
  /*  CPR sheet fields                        */
  /* ---------------------------------------- */

  /**
   * Mirror active housing, lifestyle package and health plans into the CPR actor's
   * own (otherwise unused) system.lifestyle fields, so anything reading them stays right.
   */
  static async syncActor(actor) {
    if (!actor?.isOwner || !hasProperty(actor, "system.lifestyle.housing.cost")) return;
    const active = LifestyleStore.items(actor).filter((d) => d.active);
    const fields = { housing: ["housing"], lifeStyle: ["lifestyle"], traumaTeam: ["health"] };
    const update = {};
    for (const [field, cats] of Object.entries(fields)) {
      const base = `system.lifestyle.${field}`;
      if (!hasProperty(actor, base)) continue;
      const list = active.filter((d) => cats.includes(d.category));
      const cost = list.reduce((sum, d) => sum + lineCost(d), 0);
      const description = list.map((d) => esc(d.name)).join(", ");
      if (hasProperty(actor, `${base}.cost`) && getProperty(actor, `${base}.cost`) !== cost) update[`${base}.cost`] = cost;
      if (getProperty(actor, `${base}.description`) !== description) update[`${base}.description`] = description;
    }
    if (Object.keys(update).length) await actor.update(update);
  }
}
