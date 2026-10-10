import { MODULE_ID, ROLES } from "./constants.js";

const { getProperty, hasProperty, deepClone } = foundry.utils;

/**
 * The few Cyberpunk RED - CORE data paths this module touches,
 * verified against the v0.92.4 source. Each checks before use so a system
 * update that renames a field degrades instead of throwing.
 */
export const CPR = {
  hasWealth(actor) {
    return !!actor
      && hasProperty(actor, "system.wealth.value")
      && Array.isArray(getProperty(actor, "system.wealth.transactions"));
  },

  getWealth(actor) {
    return Math.floor(Number(getProperty(actor, "system.wealth.value")) || 0);
  },

  /**
   * Change eurobucks and record it in the CPR wealth ledger, awaiting the update.
   * Writes the same entry CPRActor.deltaLedgerProperty writes (which does not await its own update).
   */
  async changeWealth(actor, delta, reason, userName = game.user.name) {
    delta = Math.trunc(Number(delta) || 0);
    if (!delta) return;
    if (!this.hasWealth(actor)) throw new Error(game.i18n.format("NEONHUB.Error.NoWealth", { name: actor.name }));
    const total = this.getWealth(actor) + delta;
    const transactions = deepClone(getProperty(actor, "system.wealth.transactions") ?? []);
    transactions.push([this._ledgerSentence("wealth", delta, total), userName ? `${reason} - ${userName}` : reason]);
    await actor.update({ "system.wealth.value": total, "system.wealth.transactions": transactions });
  },

  _ledgerSentence(property, delta, total) {
    const key = delta > 0 ? "CPR.ledger.increaseSentence" : "CPR.ledger.decreaseSentence";
    if (game.i18n.has(key)) return game.i18n.format(key, { property, amount: Math.abs(delta), total });
    return `${property} ${delta > 0 ? "increased" : "decreased"} by ${Math.abs(delta)} to ${total}`;
  },

  /* ---------------------------------------- */
  /*  Humanity                                */
  /* ---------------------------------------- */

  hasHumanity(actor) {
    return hasProperty(actor, "system.derivedStats.humanity.value") && hasProperty(actor, "system.derivedStats.humanity.max");
  },

  getHumanity(actor) {
    const h = getProperty(actor, "system.derivedStats.humanity") ?? {};
    return { value: Number(h.value) || 0, max: Number(h.max) || 0 };
  },

  /**
   * Restore Humanity up to maximum, record it in the Humanity ledger, then let CPR
   * re-sync EMP from Humanity the way the system does after any Humanity change.
   * @returns {number} the amount actually restored
   */
  async restoreHumanity(actor, amount, reason) {
    if (!this.hasHumanity(actor)) return 0;
    const { value, max } = this.getHumanity(actor);
    const gained = Math.max(0, Math.min(Math.floor(amount), max - value));
    if (!gained) return 0;
    const total = value + gained;
    const update = { "system.derivedStats.humanity.value": total };
    const ledger = getProperty(actor, "system.derivedStats.humanity.transactions");
    if (Array.isArray(ledger)) {
      update["system.derivedStats.humanity.transactions"] = [
        ...deepClone(ledger),
        [this._ledgerSentence("humanity", gained, total), `${reason} - ${game.user.name}`]
      ];
    }
    await actor.update(update);
    if (typeof actor.setMaxHumanity === "function") {
      try {
        await actor.setMaxHumanity();
      } catch (err) {
        console.warn(`${MODULE_ID} | setMaxHumanity failed for ${actor.name}`, err);
      }
    }
    return gained;
  },

  /* ---------------------------------------- */
  /*  Roles                                   */
  /* ---------------------------------------- */

  /** Every core role this actor has, by role item name and active role. */
  roles(actor) {
    const names = new Set();
    const active = getProperty(actor, "system.roleInfo.activeRole");
    if (active) names.add(String(active));
    for (const item of actor?.items ?? []) if (item.type === "role") names.add(item.name);
    return ROLES.filter((r) => [...names].some((n) => n.toLowerCase() === r.toLowerCase()));
  },

  isCharacter(actor) {
    return actor?.type === "character";
  }
};
