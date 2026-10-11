import { MODULE_ID } from "../constants.js";
import { Compat } from "../compat.js";
import { CPR } from "../cpr.js";
import { HubSocket } from "../socket.js";
import {
  HQStore, HQ_COST, IMPROVEMENTS, purchaseBlocker, upgradeBlocker, humanityFormula, monthlyRent,
  lifestyleDiscount, logEntry, maxUpgrades
} from "./hq-data.js";
import { humanityBonus } from "../lifestyle/ls-data.js";
import { LifestyleStore } from "../lifestyle/ls-store.js";

const L =(k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));
const esc = (s) => Handlebars.escapeExpression(String(s ?? ""));
const eb = (n) => `${Math.round(Number(n) || 0).toLocaleString(game.i18n.lang)}eb`;

/**
 * Everything that changes a Headquarters runs here, on the active GM's client.
 * Players send requests; the GM confirms them (the DLC makes HQ spending a crew decision).
 */
export class HQOps {
  static init() {
    HubSocket.register("hq.request", (payload, user) => this.#onRequest(payload, user));
  }

  /** Called from the HQ window. GMs act directly; players send a request to the GM. */
  static async perform(op, payload) {
    if (game.user.isGM) return this.#run(op, payload, game.user);
    return HubSocket.request("hq.request", { op, ...payload });
  }

  static async #onRequest(payload, user) {
    const { op } = payload;
    if (!["purchase", "upgrade", "payRent"].includes(op)) throw new Error(L("NEONHUB.Error.NotAllowed"));
    const hq = HQStore.get(payload.id);
    if (!hq) throw new Error(L("NEONHUB.Error.NoHQ"));
    const what = op === "payRent"
      ? L("NEONHUB.HQ.Request.PayRent", { rent: eb(monthlyRent(hq)) })
      : L(`NEONHUB.HQ.Request.${op}`, { name: L(`NEONHUB.Improvement.${payload.key}.Name`), cost: HQ_COST });
    const ok = await Compat.DialogV2.confirm({
      window: { title: L("NEONHUB.HQ.Request.Title") },
      content: `<p>${L("NEONHUB.HQ.Request.Body", { user: esc(user.name), what: esc(what), hq: esc(hq.name) })}</p>`,
      rejectClose: false
    });
    if (!ok) throw new Error(L("NEONHUB.Error.Declined"));
    return this.#run(op, payload, user);
  }

  static async #run(op, payload, user) {
    switch (op) {
      case "purchase": return this.purchase(payload.id, payload.key, payload.payment, user);
      case "upgrade": return this.upgrade(payload.id, payload.key, user);
      case "payRent": return this.payRent(payload.id, payload.payment, user);
      case "awardIP": return this.awardIP(payload.id, payload.amount, payload.reason, user);
      case "newMonth": return this.newMonth(payload.id, user);
      case "setStatus": return this.setStatus(payload.id, payload.status, user);
      default: throw new Error(`Unknown HQ operation: ${op}`);
    }
  }

  static #load(id) {
    const hq = HQStore.get(id);
    if (!hq) throw new Error(L("NEONHUB.Error.NoHQ"));
    return hq;
  }

  /* ---------------------------------------- */

  static async awardIP(id, amount, reason, user = game.user) {
    const hq = this.#load(id);
    const delta = Math.trunc(Number(amount) || 0);
    if (!delta) return hq;
    if (hq.ip + delta < 0) throw new Error(L("NEONHUB.Error.IPBelowZero"));
    hq.ip += delta;
    logEntry(hq, reason?.trim() || L(delta > 0 ? "NEONHUB.HQ.Log.Awarded" : "NEONHUB.HQ.Log.Removed"), delta);
    return HQStore.save(hq);
  }

  static async purchase(id, key, payment, user = game.user) {
    const hq = this.#load(id);
    const blocker = purchaseBlocker(hq, key);
    if (blocker) throw new Error(L(blocker));
    const def = IMPROVEMENTS[key];
    const name = L(`NEONHUB.Improvement.${key}.Name`);
    let undo = async () => {};
    if (def.eb) undo = await this.#collect(hq, def.eb, payment, L("NEONHUB.Ledger.Improvement", { name, hq: hq.name }), user);
    try {
      hq.ip -= HQ_COST;
      hq.improvements[key].owned = true;
      hq.improvements[key].upgrades = 0;
      logEntry(hq, L("NEONHUB.HQ.Log.Bought", { name }) + (def.eb ? ` (+${eb(def.eb)})` : ""), -HQ_COST);
      const saved = await HQStore.save(hq);
      await this.#announce(saved, L("NEONHUB.HQ.Chat.Bought", { name, hq: saved.name }));
      return saved;
    } catch (err) {
      await undo();
      throw err;
    }
  }

  static async upgrade(id, key, user = game.user) {
    const hq = this.#load(id);
    const blocker = upgradeBlocker(hq, key);
    if (blocker) throw new Error(L(blocker));
    const imp = hq.improvements[key];
    imp.upgrades += 1;
    hq.ip -= HQ_COST;
    const name = L(`NEONHUB.Improvement.${key}.Name`);
    const label = maxUpgrades(key, hq) > 1 ? `${name} ${imp.upgrades}` : name;
    logEntry(hq, L("NEONHUB.HQ.Log.Upgraded", { name: label }), -HQ_COST);
    const saved = await HQStore.save(hq);
    await this.#announce(saved, L("NEONHUB.HQ.Chat.Upgraded", { name: label, hq: saved.name }));
    return saved;
  }

  static async setStatus(id, status, user = game.user) {
    const hq = this.#load(id);
    if (!["active", "lost", "destroyed"].includes(status)) return hq;
    hq.status = status;
    if (status === "destroyed") {
      // The DLC: a destroyed HQ means starting over; every benefit is gone.
      for (const imp of Object.values(hq.improvements)) Object.assign(imp, { owned: false, upgrades: 0 });
    }
    logEntry(hq, L(`NEONHUB.HQ.Log.Status.${status}`));
    return HQStore.save(hq);
  }

  static async payRent(id, payment, user = game.user) {
    const hq = this.#load(id);
    const rent = monthlyRent(hq);
    if (rent > 0) await this.#collect(hq, rent, payment, L("NEONHUB.Ledger.Rent", { hq: hq.name }), user);
    hq.housing.rentPaid = true;
    if (hq.status === "lost") hq.status = "active";
    logEntry(hq, L("NEONHUB.HQ.Log.RentPaid", { rent: eb(rent) }));
    return HQStore.save(hq);
  }

  /**
   * Start a new month: roll Morale Boost Humanity restoration for every crew member,
   * mark rent as due, and post a summary to chat.
   */
  static async newMonth(id, user = game.user) {
    const hq = this.#load(id);
    const formula = humanityFormula(hq);
    const rows = [];
    if (formula) {
      for (const uuid of hq.crew) {
        const actor = await fromUuid(uuid);
        if (!actor || !CPR.hasHumanity(actor)) continue;
        // Lifestyle: a character's best home furnishings add to Humanity recovery.
        const bonus = humanityBonus(LifestyleStore.items(actor));
        const roll = await new Roll(bonus ? `${formula} + ${bonus}` : formula).evaluate();
        const gained = await CPR.restoreHumanity(actor, roll.total, L("NEONHUB.Ledger.Morale", { hq: hq.name }));
        const { value, max } = CPR.getHumanity(actor);
        rows.push({ name: actor.name, rolled: roll.total, bonus, gained, value, max });
      }
    }
    hq.month += 1;
    const rent = monthlyRent(hq);
    hq.housing.rentPaid = rent <= 0;
    logEntry(hq, L("NEONHUB.HQ.Log.NewMonth", { n: hq.month }));
    const saved = await HQStore.save(hq);

    const content = await Compat.renderTemplate(`modules/${MODULE_ID}/templates/hq/month-card.hbs`, {
      hq: saved,
      month: saved.month,
      formula: formula ? L(`NEONHUB.HQ.Formula.${formula.replace(/[^a-z0-9]/gi, "")}`) : null,
      rows,
      rent: rent > 0 ? eb(rent) : null,
      discount: lifestyleDiscount(saved) ? eb(lifestyleDiscount(saved)) : null,
      lost: saved.status !== "active"
    });
    await ChatMessage.create({ content, speaker: { alias: saved.name }, whisper: this.#crewUsers(saved) });
    return saved;
  }

  /* ---------------------------------------- */

  /**
   * Take eurobucks from the crew through the CPR wealth ledger.
   * payment: { mode: "one", uuid } or { mode: "split" } (split evenly across crew wallets).
   * @returns {Function} undo
   */
  static async #collect(hq, amount, payment = {}, reason, user) {
    const payers = [];
    if (payment.mode === "one") {
      const actor = await fromUuid(payment.uuid);
      if (!actor || !hq.crew.includes(actor.uuid)) throw new Error(L("NEONHUB.Error.PayerNotCrew"));
      payers.push({ actor, share: amount });
    } else {
      const wallets = [];
      for (const uuid of hq.crew) {
        const a = await fromUuid(uuid);
        if (CPR.hasWealth(a)) wallets.push(a);
      }
      if (!wallets.length) throw new Error(L("NEONHUB.Error.NoCrewWallets"));
      const base = Math.floor(amount / wallets.length);
      let rest = amount - base * wallets.length;
      for (const actor of wallets) {
        payers.push({ actor, share: base + (rest > 0 ? 1 : 0) });
        rest -= 1;
      }
    }
    const short = payers.filter((p) => CPR.getWealth(p.actor) < p.share);
    if (short.length) {
      throw new Error(L("NEONHUB.Error.ShortFunds", { names: short.map((p) => `${p.actor.name} (${eb(CPR.getWealth(p.actor))}/${eb(p.share)})`).join(", ") }));
    }
    const done = [];
    try {
      for (const p of payers) {
        if (!p.share) continue;
        await CPR.changeWealth(p.actor, -p.share, reason, user.name);
        done.push(p);
      }
    } catch (err) {
      for (const p of done.reverse()) await CPR.changeWealth(p.actor, p.share, L("NEONHUB.Ledger.Refund"), user.name).catch(() => null);
      throw err;
    }
    return async () => {
      for (const p of done.reverse()) await CPR.changeWealth(p.actor, p.share, L("NEONHUB.Ledger.Refund"), user.name).catch(() => null);
    };
  }

  static #crewUsers(hq) {
    const ids = new Set(game.users.filter((u) => u.isGM).map((u) => u.id));
    for (const uuid of hq.crew) {
      let actor = null;
      try { actor = fromUuidSync(uuid); } catch { /* ignore */ }
      if (!actor) continue;
      for (const u of game.users) if (actor.testUserPermission(u, "OWNER")) ids.add(u.id);
    }
    return [...ids];
  }

  static async #announce(hq, text) {
    await ChatMessage.create({
      content: `<div class="neon-hub-chat"><i class="fa-solid fa-house-signal"></i> ${esc(text)}<br><small>${esc(L("NEONHUB.HQ.Chat.IPLeft", { ip: hq.ip }))}</small></div>`,
      speaker: { alias: hq.name },
      whisper: this.#crewUsers(hq)
    });
  }
}
