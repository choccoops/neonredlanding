import { MODULE_ID, TEMPLATE_PATH } from "../constants.js";
import { Compat } from "../compat.js";
import { CPR } from "../cpr.js";
import { LS_FLAG, activeTier, normalizeLifestyle } from "./ls-data.js";
import {
  ENVIRONMENT, ART_TIERS, ART_SKILLS, PERFORMED_BY, MEMBERSHIP_CATEGORIES,
  monthlyCheck, rollCheck, belowTier, bedroomFurnishing, artTierFor, artHumanity
} from "./ls-2070.js";
import { LifestyleStore, LS_ACTOR_FLAG } from "./ls-store.js";

const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));
const eb = (n) => `${Math.round(Number(n) || 0).toLocaleString(game.i18n.lang)}eb`;
/** Passed with this module's own item writes, so the item hooks in main.js leave them alone. */
const own = () => ({ neonHub: "lifestyle" });

async function roll(formula) {
  return new Roll(formula).evaluate();
}

/** GMs and the actor's owners. */
function owners(actor) {
  return game.users.filter((u) => u.isGM || actor.testUserPermission(u, "OWNER")).map((u) => u.id);
}

/**
 * The 2070s Living & Humanity Rework, at the table: memberships that start on rent day and lapse
 * with the lifestyle, the rent-day Humanity check, one-time Humanity incidents, and making art.
 */
export const Lifestyle2070 = {
  /* ---------------------------------------- */
  /*  Memberships and tiers                   */
  /* ---------------------------------------- */

  /**
   * Adding an item: memberships need the lifestyle for them, and bought after this month's bill
   * is paid they wait for rent day. Throws if the lifestyle is too low.
   * @returns {{ pending: boolean }}
   */
  addRule(actor, ls) {
    const tier = activeTier(LifestyleStore.items(actor))?.tier ?? 0;
    if (ls.minTier > tier && !game.user.isGM) {
      throw new Error(L("NEONHUB.Lifestyle.Error.NeedsTier", { tier: L(`NEONHUB.Lifestyle.Tier.${ls.minTier}`) }));
    }
    return { pending: MEMBERSHIP_CATEGORIES.has(ls.category) && !LifestyleStore.billing(actor).owed };
  },

  /** Switching an item on mid-month: a waiting membership stays waiting for players. */
  toggleRule(actor, d) {
    if (game.user.isGM) return;
    if (d.pending) throw new Error(L("NEONHUB.Lifestyle.Error.StartsOnRentDay", { item: d.name }));
    const tier = activeTier(LifestyleStore.items(actor))?.tier ?? 0;
    if (d.minTier > tier) throw new Error(L("NEONHUB.Lifestyle.Error.NeedsTier", { tier: L(`NEONHUB.Lifestyle.Tier.${d.minTier}`) }));
  },

  /**
   * Rent day, before the bill: waiting memberships start, then any the lifestyle no longer
   * covers are cancelled (switched off) for the month.
   * @returns {{ started: string[], cancelled: string[] }}
   */
  async rentDay(actor) {
    const started = LifestyleStore.items(actor).filter((d) => d.pending);
    if (started.length) {
      await actor.updateEmbeddedDocuments("Item", started.map((d) => ({
        _id: d.id, "system.equipped": "equipped", [`flags.${MODULE_ID}.${LS_FLAG}.pending`]: false
      })), own());
    }
    const lapsed = belowTier(LifestyleStore.items(actor));
    if (lapsed.length) {
      await actor.updateEmbeddedDocuments("Item", lapsed.map((d) => ({ _id: d.id, "system.equipped": "owned" })), own());
    }
    return { started: started.map((d) => d.name), cancelled: lapsed.map((d) => d.name) };
  },

  /* ---------------------------------------- */
  /*  Rent-day Humanity                       */
  /* ---------------------------------------- */

  /** Whether this character's rent-day Humanity check is waiting. */
  checkDue(actor) {
    const state = LifestyleStore.actorState(actor);
    return state.humanityDue !== null && state.humanityDue !== state.humanityPeriod;
  },

  /**
   * GM: the monthly environmental Humanity check. Effects worked out from the character's items
   * plus what the GM ticked are rolled, the furnishing modifiers and the home's tax or credit
   * added, displayed art counted, and the net change applied through the Humanity ledger.
   */
  async humanityCheck(actorUuid, ticked = {}) {
    if (!game.user.isGM) throw new Error(L("NEONHUB.Error.GMOnly"));
    const actor = typeof actorUuid === "string" ? await fromUuid(actorUuid) : actorUuid;
    if (!actor) throw new Error(L("NEONHUB.Lifestyle.Error.NoActor"));
    if (!CPR.hasHumanity(actor)) throw new Error(L("NEONHUB.Lifestyle.Error.NoHumanity", { name: actor.name }));

    const check = monthlyCheck(LifestyleStore.items(actor), ticked);
    const rolls = [];
    for (const r of check.rolls) rolls.push(await roll(r.dice));
    let i = 0;
    const result = rollCheck(check, () => rolls[i++].total);

    const billing = LifestyleStore.billing(actor);
    const reason = L("NEONHUB.Lifestyle.Humanity.Ledger", { month: billing.label });
    const before = CPR.getHumanity(actor);
    let applied = 0;
    if (result.net > 0) applied = await CPR.restoreHumanity(actor, result.net, reason);
    else if (result.net < 0) applied = -(await CPR.loseHumanity(actor, -result.net, reason));
    const after = CPR.getHumanity(actor);

    const state = LifestyleStore.actorState(actor);
    const period = state.humanityDue ?? billing.period;
    await actor.setFlag(MODULE_ID, LS_ACTOR_FLAG, { ...state, humanityPeriod: period, humanityDue: period });

    const row = (r) => ({
      label: L(`NEONHUB.Lifestyle.Env.${r.key}`),
      kind: r.kind,
      dice: r.dice,
      result: r.result,
      mod: r.mod ? `+${r.mod}` : null,
      total: r.total,
      auto: r.auto
    });
    const content = await Compat.renderTemplate(`${TEMPLATE_PATH}/lifestyle/humanity-card.hbs`, {
      name: actor.name,
      img: actor.img,
      title: L("NEONHUB.Lifestyle.Humanity.CardTitle", { month: billing.label }),
      losses: result.rolls.filter((r) => r.kind === "loss").map(row),
      gains: result.rolls.filter((r) => r.kind === "gain").map(row),
      tax: result.tax || null,
      credit: result.credit || null,
      art: result.art || null,
      loss: result.loss,
      gain: result.gain,
      net: result.net > 0 ? `+${result.net}` : String(result.net),
      negative: result.net < 0,
      before: before.value,
      after: after.value,
      max: after.max,
      capped: result.net > 0 && applied < result.net ? result.net - applied : null,
      psycho: after.value <= 0
    });
    await ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor }), whisper: owners(actor), rolls });
    return { ...result, applied, before: before.value, after: after.value };
  },

  /**
   * GM: a one-time Humanity incident for one or more characters. Each rolls the incident's dice;
   * their furnishings add to Humanity Loss or Gain rolls as they do every month.
   * @param {string[]} actorUuids
   * @param {{ kind: "loss"|"gain", dice: string, label: string }} incident
   */
  async incident(actorUuids, { kind, dice, label }) {
    if (!game.user.isGM) throw new Error(L("NEONHUB.Error.GMOnly"));
    if (!["loss", "gain"].includes(kind) || !/^\d+d\d+$/.test(dice)) throw new Error("Bad incident");
    const rows = [];
    const rolls = [];
    const whisper = new Set(game.users.filter((u) => u.isGM).map((u) => u.id));
    for (const uuid of actorUuids) {
      const actor = await fromUuid(uuid);
      if (!actor || !CPR.hasHumanity(actor)) continue;
      const furnishing = bedroomFurnishing(LifestyleStore.items(actor));
      const mod = (kind === "loss" ? furnishing?.lossMod : furnishing?.gainMod) ?? 0;
      const r = await roll(dice);
      rolls.push(r);
      const total = Math.max(0, r.total + mod);
      const reason = L("NEONHUB.Lifestyle.Incident.Ledger", { incident: label });
      const before = CPR.getHumanity(actor).value;
      const applied = kind === "gain" ? await CPR.restoreHumanity(actor, total, reason) : await CPR.loseHumanity(actor, total, reason);
      const after = CPR.getHumanity(actor).value;
      for (const id of owners(actor)) whisper.add(id);
      rows.push({ name: actor.name, img: actor.img, result: r.total, mod: mod || null, total, applied, before, after, capped: kind === "gain" && applied < total, psycho: after <= 0 });
    }
    if (!rows.length) return [];
    const content = await Compat.renderTemplate(`${TEMPLATE_PATH}/lifestyle/incident-card.hbs`, { label, kind, dice, gain: kind === "gain", rows });
    await ChatMessage.create({ content, speaker: { alias: L("NEONHUB.Lifestyle.Title") }, whisper: [...whisper], rolls });
    return rows;
  },

  /* ---------------------------------------- */
  /*  Art                                     */
  /* ---------------------------------------- */

  /** The art skills a character has, best first: [{ name, base }]. */
  artSkills(actor) {
    return (actor?.items ?? [])
      .filter((i) => i.type === "skill" && ART_SKILLS.some((s) => i.name === s || i.name.startsWith(`${s} (`) || i.name.startsWith(`${s}:`)))
      .map((i) => ({ name: i.name, family: ART_SKILLS.find((s) => i.name.startsWith(s)), base: CPR.skillBase(actor, i.name)?.base ?? 0 }))
      .sort((a, b) => b.base - a.base);
  },

  /** A Cyberpunk RED skill check: 1d10 + base, a 10 adds another d10, a 1 takes one away. */
  async skillCheck(base) {
    const first = await roll("1d10");
    const rolls = [first];
    let die = first.total;
    if (first.total === 10 || first.total === 1) {
      const crit = await roll("1d10");
      rolls.push(crit);
      die += first.total === 10 ? crit.total : -crit.total;
    }
    return { total: base + die, die, rolls, crit: first.total === 10, fumble: first.total === 1 };
  },

  /**
   * Make a piece of art: pay the tier's materials, roll the skill against its DV, and on a success
   * the piece joins the character's lifestyle (active, ready to display on an ARAD).
   * Composition and Acting can be performed too: the second skill's roll sets a tier whose cost is
   * paid and whose Humanity is added; missing every DV costs the first tier's time and materials again.
   * @param {object} opts - { skill, tier (index into ART_TIERS), extraMonths, title, perform }
   */
  async makeArt(actorUuid, { skill, tier = 0, extraMonths = 0, title = "", perform = false } = {}, { user = game.user } = {}) {
    const actor = typeof actorUuid === "string" ? await fromUuid(actorUuid) : actorUuid;
    if (!actor) throw new Error(L("NEONHUB.Lifestyle.Error.NoActor"));
    const def = ART_TIERS[Math.min(ART_TIERS.length - 1, Math.max(0, Math.floor(Number(tier) || 0)))];
    const extra = def.extra ? Math.max(0, Math.floor(Number(extraMonths) || 0)) : 0;
    const base = CPR.skillBase(actor, skill);
    if (!base) throw new Error(L("NEONHUB.Lifestyle.Art.NoSkill", { skill }));
    const materials = def.cost * (1 + extra);
    if (!CPR.hasWealth(actor)) throw new Error(L("NEONHUB.Error.NoWealth", { name: actor.name }));
    if (!LifestyleStore.allowDebt && CPR.getWealth(actor) < materials) {
      throw new Error(L("NEONHUB.Error.ShortFunds", { names: `${actor.name} (${eb(CPR.getWealth(actor))}/${eb(materials)})` }));
    }
    const name = title.trim() || L("NEONHUB.Lifestyle.Art.Untitled");
    await CPR.changeWealth(actor, -materials, L("NEONHUB.Lifestyle.Art.Ledger", { title: name }), user.name);

    const check = await this.skillCheck(base.base);
    const rolls = [...check.rolls];
    const success = check.total >= def.dv;
    let hg = success ? artHumanity(def, extra) : 0;
    let spent = materials;
    let second = null;

    const family = ART_SKILLS.find((s) => skill === s || skill.startsWith(s));
    const performer = PERFORMED_BY[family];
    if (success && perform && performer) {
      const options = this.artSkills(actor).filter((s) => s.family === performer);
      const by = options[0];
      if (by) {
        const check2 = await this.skillCheck(by.base);
        rolls.push(...check2.rolls);
        const reached = artTierFor(check2.total);
        second = { skill: by.name, total: check2.total, die: check2.die, reached: reached ? L(`NEONHUB.Lifestyle.Art.Tier.${reached.scarcity}`) : null };
        const cost = reached ? reached.cost : def.cost;
        await CPR.changeWealth(actor, -cost, L("NEONHUB.Lifestyle.Art.LedgerPerform", { title: name }), user.name);
        spent += cost;
        if (reached) hg += reached.hg;
      } else {
        second = { skill: performer, missing: true };
      }
    }

    let created = null;
    if (success) {
      const ls = normalizeLifestyle({ category: "art", scarcity: def.scarcity, hg, era: "2070" });
      const description = `<p>${L("NEONHUB.Lifestyle.Art.Description", { skill, tier: L(`NEONHUB.Lifestyle.Art.Tier.${def.scarcity}`), total: check.total, dv: def.dv, hg })}</p>`
        + (second && !second.missing ? `<p>${L("NEONHUB.Lifestyle.Art.Performed", { skill: second.skill, total: second.total, tier: second.reached ?? "—" })}</p>` : "");
      [created] = await actor.createEmbeddedDocuments("Item", [{
        name,
        type: "gear",
        img: `modules/${MODULE_ID}/assets/lifestyle/art.svg`,
        system: { description: { value: description }, price: { market: spent }, equipped: "equipped", usage: "equipped", amount: 1 },
        flags: { [MODULE_ID]: { [LS_FLAG]: ls } }
      }], own());
    }

    const content = await Compat.renderTemplate(`${TEMPLATE_PATH}/lifestyle/art-card.hbs`, {
      name: actor.name,
      img: actor.img,
      title: name,
      skill,
      tier: L(`NEONHUB.Lifestyle.Art.Tier.${def.scarcity}`),
      dv: def.dv,
      total: check.total,
      die: check.die,
      crit: check.crit,
      fumble: check.fumble,
      success,
      hg,
      spent: eb(spent),
      second
    });
    await ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor }), rolls });
    return { success, hg, item: created };
  },

  /** Effect keys the GM can tick in the rent-day check, grouped for the dialog. */
  tickable() {
    const out = { loss: [], gain: [] };
    for (const [key, def] of Object.entries(ENVIRONMENT)) {
      if (def.auto) continue;
      out[def.kind].push({ key, dice: def.dice, count: !!def.count, label: L(`NEONHUB.Lifestyle.Env.${key}`) });
    }
    return out;
  }
};
