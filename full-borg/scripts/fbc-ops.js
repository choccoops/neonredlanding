import { MODULE_ID, BODIES_PACK, ITEMS_PACK, FBC_FLAG, BODY_FLAG } from "./constants.js";
import { planBody, oldChrome, coreBoxes, boxUpdate, hlFormula, isBiosystem } from "./fbc-plan.js";

const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));
const esc = (s) => Handlebars.escapeExpression(String(s ?? ""));
const itemClass = () => CONFIG.Item.documentClass;

/**
 * Going metal on a CPR actor: the old chrome comes out, a Biosystem goes in (if there isn't one), the body's chassis
 * and chrome are created installed where the body has them, the core Internal and External boxes are doubled, and the
 * package's Humanity Loss is rolled once (CPR's own roller only reads a formula's first die, and the book's
 * "[1d6/2] + 17d6" needs both). Items are created and deleted through the Item class with the actor as parent, past
 * CPR's sheet-drop handling (stacking, mook auto-install prompts), and every installed list is written in one update,
 * so nothing races.
 */
export const FBCOps = {
  /** The actor's FBC record, or null for meat. */
  state(actor) {
    return actor?.getFlag(MODULE_ID, FBC_FLAG) ?? null;
  },

  isFBC(actor) {
    return !!this.state(actor)?.body;
  },

  /** Every body in the pack: { id, name, img, maker, info } sorted by maker, then name. */
  async bodies() {
    const pack = game.packs.get(BODIES_PACK);
    if (!pack) return [];
    const index = await pack.getIndex({ fields: ["img", "folder", `flags.${MODULE_ID}.fbcBody`] });
    return [...index]
      .map((e) => ({ id: e._id, name: e.name, img: e.img, maker: pack.folders?.get(e.folder)?.name ?? "", info: e.flags?.[MODULE_ID]?.fbcBody ?? {} }))
      .sort((a, b) => a.maker.localeCompare(b.maker) || a.name.localeCompare(b.name));
  },

  async body(id) {
    return id ? (await game.packs.get(BODIES_PACK)?.getDocument(id)) ?? null : null;
  },

  hasBiosystem(actor) {
    return actor.items.some((i) => isBiosystem(i) && i.system.isInstalled);
  },

  /**
   * Put a body on an actor (or switch bodies).
   * @param {Actor} actor
   * @param {string} bodyId      an Actor id in the bodies pack
   * @param {object} [options]
   * @param {"roll"|"static"|"none"} [options.hl="roll"]  roll the Humanity Loss, take the average, or none
   * @param {boolean} [options.biosystem=true]  install a Biosystem if the actor has none
   * @param {boolean} [options.stripOld=true]   uninstall the meat body's chrome (it stays on the sheet as gear)
   */
  async goMetal(actor, bodyId, { hl = "roll", biosystem = true, stripOld = true } = {}) {
    if (!game.user.isGM) throw new Error(L("FULLBORG.Error.GMOnly"));
    const body = await this.body(bodyId);
    if (!body) throw new Error(L("FULLBORG.Error.NoBody"));
    const info = body.getFlag(MODULE_ID, "fbcBody") ?? {};
    const before = this.state(actor) ?? {};
    const switching = !!before.body;
    if (switching) await removeBody(actor);
    else if (stripOld) await uninstallOld(actor);

    const own = actor.items.map((i) => i.toObject());
    const core = coreBoxes(own);
    const plan = planBody(body.items.map((i) => i.toObject()), body.system.installedItems?.list ?? [], core, () => foundry.utils.randomID(), body.id);
    const create = [...plan.create];
    const top = [...plan.top];
    const bio = biosystem && !this.hasBiosystem(actor) ? await biosystemData() : null;
    if (bio) {
      create.push(bio);
      top.push(bio._id);
    }
    await itemClass().createDocuments(create, { parent: actor, keepId: true });

    const sizes = Object.fromEntries(create.map((d) => [d._id, d.system?.size ?? 0]));
    const coreSlots = { ...(before.coreSlots ?? {}) };
    const boxes = Object.values(core).map((box) => {
      coreSlots[box._id] ??= box.system.installedItems.slots;
      return boxUpdate(box, plan.intoCore[box._id] ?? [], sizes);
    });
    if (boxes.length) await actor.updateEmbeddedDocuments("Item", boxes);
    const worn = [...new Set([...(before.worn ?? []), body.id])];
    await actor.update({
      "system.installedItems.list": [...(actor.system.installedItems?.list ?? []), ...top],
      [`flags.${MODULE_ID}.${FBC_FLAG}`]: { body: { id: body.id, name: body.name }, since: game.time.worldTime, worn, coreSlots }
    });

    const losses = [{ name: body.name, hl: info.hl }];
    if (bio) losses.push({ name: bio.name, hl: bio.system.humanityLoss });
    const lost = await loseHumanity(actor, losses, hl);
    await report(actor, L(switching ? "FULLBORG.Chat.Switched" : "FULLBORG.Chat.WentMetal", { name: esc(actor.name), body: esc(body.name) }), [
      L("FULLBORG.Chat.Body", { body: info.body ?? "?", frame: info.frame ?? "" }),
      hl === "none" ? L("FULLBORG.Chat.NoHL") : L("FULLBORG.Chat.HLTotal", { n: lost }),
      bio ? L("FULLBORG.Chat.Biosystem") : null,
      !switching && stripOld ? L("FULLBORG.Chat.OldChrome") : null
    ]);
    return { body, lost, biosystem: !!bio };
  },

  /** Take the body off: its chrome goes, the Biosystem stays, the core boxes get their old slots back. */
  async leaveBody(actor) {
    if (!game.user.isGM) throw new Error(L("FULLBORG.Error.GMOnly"));
    const state = this.state(actor);
    if (!state?.body) return;
    await removeBody(actor);
    const restore = Object.entries(state.coreSlots ?? {})
      .map(([id, slots]) => actor.items.get(id) && { _id: id, name: actor.items.get(id).name.replace(/\(\d+ Option Slots\)/, `(${slots} Option Slots)`), "system.installedItems.slots": slots })
      .filter(Boolean);
    if (restore.length) await actor.updateEmbeddedDocuments("Item", restore);
    await actor.update({ [`flags.${MODULE_ID}.${FBC_FLAG}`]: { body: null, coreSlots: null } });
    if (typeof actor.setMaxHumanity === "function") await actor.setMaxHumanity();
    await report(actor, L("FULLBORG.Chat.Left", { name: esc(actor.name), body: esc(state.body.name) }), [L("FULLBORG.Chat.LeftHint")]);
  }
};

/** The meat's chrome comes out (CPR's own uninstall), one container at a time. */
async function uninstallOld(actor) {
  const out = oldChrome(actor.items.map((i) => i.toObject()), actor.system.installedItems?.list ?? []);
  const byTarget = new Map();
  for (const { id, from } of out) byTarget.set(from, [...(byTarget.get(from) ?? []), id]);
  for (const [from, ids] of byTarget) {
    const target = from === "actor" ? actor : actor.items.get(from);
    const items = ids.map((id) => actor.items.get(id)).filter(Boolean);
    if (target && items.length) await target.uninstallItems(items);
  }
}

/** Delete everything a body put in. Lists that point at those items are cleaned in one update first. */
async function removeBody(actor) {
  const gone = new Set(actor.items.filter((i) => i.getFlag(MODULE_ID, BODY_FLAG)).map((i) => i.id));
  if (!gone.size) return;
  const lists = actor.items
    .filter((i) => !gone.has(i.id) && i.system.installedItems?.list?.some((id) => gone.has(id)))
    .map((i) => {
      const list = i.system.installedItems.list.filter((id) => !gone.has(id));
      const used = list.reduce((n, id) => n + (actor.items.get(id)?.system.size ?? 0), 0);
      return { _id: i.id, "system.installedItems.list": list, "system.installedItems.usedSlots": used };
    });
  if (lists.length) await actor.updateEmbeddedDocuments("Item", lists);
  await actor.update({ "system.installedItems.list": (actor.system.installedItems?.list ?? []).filter((id) => !gone.has(id)) });
  await itemClass().deleteDocuments([...gone], { parent: actor });
}

/** The Biosystem from the module's own pack, ready to create. */
async function biosystemData() {
  const pack = game.packs.get(ITEMS_PACK);
  const index = await pack?.getIndex({ fields: [`flags.${MODULE_ID}.biosystem`] });
  const entry = index && [...index].find((e) => e.flags?.[MODULE_ID]?.biosystem);
  const doc = entry ? await pack.getDocument(entry._id) : null;
  if (!doc) return null;
  const data = doc.toObject();
  data._id = foundry.utils.randomID();
  delete data.folder;
  return data;
}

/** Roll (or take) each Humanity Loss, post it, lower Humanity and let CPR set the new maximum. Returns the total. */
async function loseHumanity(actor, losses, mode) {
  let total = 0;
  for (const { name, hl } of losses) {
    const formula = hlFormula(hl, mode);
    if (formula === "0") continue;
    const roll = await new Roll(formula).evaluate();
    total += roll.total;
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: L("FULLBORG.Chat.HLRoll", { name: esc(name) }) });
  }
  const h = actor.system.derivedStats?.humanity;
  if (h && total) {
    const value = (Number.isInteger(h.value) ? h.value : h.max) - total;
    await actor.update({ "system.derivedStats.humanity.value": value });
    if (value <= 0) ui.notifications.warn(L("FULLBORG.Warn.Cyberpsycho", { name: actor.name }));
  }
  if (typeof actor.setMaxHumanity === "function") await actor.setMaxHumanity();
  return total;
}

async function report(actor, title, lines) {
  const owners = game.users.filter((u) => u.isGM || actor.testUserPermission(u, "OWNER")).map((u) => u.id);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    whisper: owners,
    content: `<div class="fbc-chat"><h3><i class="fa-solid fa-robot"></i> ${title}</h3>${lines
      .filter(Boolean)
      .map((l) => `<p>${l}</p>`)
      .join("")}</div>`
  });
}
