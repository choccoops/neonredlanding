import { CPR } from "../cpr.js";
import { HubSocket } from "../socket.js";
import { LifestyleStore } from "./ls-store.js";
import { HouseholdStore } from "./ls-households.js";
import { contribute, poolStatus } from "./ls-household-data.js";

const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));
const eb = (n) => `${Math.round(Number(n) || 0).toLocaleString(game.i18n.lang)}eb`;
const esc = (s) => Handlebars.escapeExpression(String(s ?? ""));

/**
 * Households at the table. The GM sets them up; inhabitants pay their share in their own bill, or
 * chip into the pool here. The household record is a world setting, so a player's contribution is
 * carried out by the GM's client.
 */
export const HouseholdOps = {
  init() {
    HubSocket.register("hh.contribute", (payload, user) => this._contribute(payload, user));
  },

  /** The month a household pays for: its first inhabitant's (by their calendar, or the counter). */
  period(hh) {
    const first = HouseholdStore.inhabitants(hh)[0];
    return first ? LifestyleStore.billing(first).period : LifestyleStore.month;
  },

  /** The pool this month. */
  pool(hh) {
    return poolStatus(hh, this.period(hh));
  },

  /** Chip into a household's rent pool from a character's wallet. */
  async contribute(householdId, actorUuid, amount) {
    if (game.user.isGM) return this._contribute({ householdId, actor: actorUuid, amount }, game.user);
    return HubSocket.request("hh.contribute", { householdId, actor: actorUuid, amount });
  },

  async _contribute({ householdId, actor: actorUuid, amount }, user) {
    const hh = HouseholdStore.get(householdId);
    if (!hh) throw new Error(L("NEONHUB.Household.Error.Missing"));
    const actor = await fromUuid(actorUuid);
    if (!actor || !hh.inhabitants.includes(actor.uuid)) throw new Error(L("NEONHUB.Household.Error.NotInhabitant"));
    if (!user.isGM && !actor.testUserPermission(user, "OWNER")) throw new Error(L("NEONHUB.Error.NotAllowed"));
    if (hh.rentMode !== "pool") throw new Error(L("NEONHUB.Household.Error.NotPool"));
    if (!CPR.hasWealth(actor)) throw new Error(L("NEONHUB.Error.NoWealth", { name: actor.name }));

    const period = this.period(hh);
    const want = Math.max(0, Math.floor(Number(amount) || 0));
    const result = contribute(hh, period, actor.uuid, want);
    if (!result.taken) throw new Error(L("NEONHUB.Household.Error.NothingToPay"));
    if (!LifestyleStore.allowDebt && CPR.getWealth(actor) < result.taken) {
      throw new Error(L("NEONHUB.Error.ShortFunds", { names: `${actor.name} (${eb(CPR.getWealth(actor))}/${eb(result.taken)})` }));
    }
    await CPR.changeWealth(actor, -result.taken, L("NEONHUB.Household.Ledger", { name: hh.name }), user.name);
    await HouseholdStore.update(hh.id, { pool: result.pool });

    const s = result.status;
    const whisper = new Set(game.users.filter((u) => u.isGM).map((u) => u.id));
    for (const a of HouseholdStore.inhabitants(hh)) for (const u of game.users) if (a.testUserPermission(u, "OWNER")) whisper.add(u.id);
    await ChatMessage.create({
      content: `<div class="neon-hub-chat nh-ls-chat"><header><i class="fa-solid fa-people-roof"></i> <strong>${esc(hh.name)}</strong></header>`
        + `<p>${esc(L("NEONHUB.Household.Chat.ChippedIn", { name: actor.name, amount: eb(result.taken) }))}</p>`
        + `<ul class="nh-ls-totals"><li><span>${esc(L("NEONHUB.Household.Pool"))}</span><b>${eb(s.total)} / ${eb(s.rent)}</b></li></ul>`
        + (s.covered ? `<p><i class="fa-solid fa-circle-check"></i> ${esc(L("NEONHUB.Household.Chat.Covered"))}</p>` : "")
        + "</div>",
      speaker: ChatMessage.getSpeaker({ actor }),
      whisper: [...whisper]
    });
    return { taken: result.taken, ...s };
  }
};

