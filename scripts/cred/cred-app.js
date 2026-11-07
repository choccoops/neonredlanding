import { MODULE_ID, TEMPLATE_PATH } from "../constants.js";
import { Compat } from "../compat.js";
import { CredStore, actorOf } from "./cred-store.js";
import {
  FACTION_KINDS, JOIN_AT, standingBand, heatBand, bondBand, discountAt, signed, barOf, capOf, joinProblem, clamp
} from "./cred-data.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));
const esc = (s) => Handlebars.escapeExpression(String(s ?? ""));
const DIALOG = ["neon-hub", "nh-cal-dialog", "nh-cred-dialog"];
const KIND_ICONS = { gang: "fa-solid fa-skull", corp: "fa-solid fa-building", nomad: "fa-solid fa-truck-pickup", other: "fa-solid fa-circle-nodes" };
const TABS = ["factions", "bonds", "log"];

const warn = (err) => ui.notifications.warn(err?.message ?? String(err));
const dateText = (d) => (d ? `${d.day} ${L(`NEONHUB.Calendar.MonthShort.${d.month}`)} ${d.year}` : "");

/** Ask for a deed: how big, why, and (for Standing gains) which rivals drop by 1. Resolves to { delta, reason, rivals, tell } or null. */
async function deedDialog({ title, rivals = [], sign = 1 }) {
  const sizes = [1, 2, 3].map((n) => `<option value="${n}">${esc(L(`NEONHUB.Cred.Deed.Size${n}`))}</option>`).join("");
  const rivalBoxes = rivals.map((f) => `<label class="nh-cal-player"><input type="checkbox" name="rivals" value="${f.id}"><i></i><span>${esc(f.name)}</span></label>`).join("");
  const content = `
    <div class="form-group"><label>${esc(L("NEONHUB.Cred.Deed.Way"))}</label>
      <select name="sign"><option value="1" ${sign > 0 ? "selected" : ""}>${esc(L("NEONHUB.Cred.Deed.Up"))}</option><option value="-1" ${sign < 0 ? "selected" : ""}>${esc(L("NEONHUB.Cred.Deed.Down"))}</option></select></div>
    <div class="form-group"><label>${esc(L("NEONHUB.Cred.Deed.Size"))}</label><select name="size">${sizes}</select></div>
    <div class="form-group"><label>${esc(L("NEONHUB.Cred.Deed.Reason"))}</label><input type="text" name="reason" maxlength="200" placeholder="${esc(L("NEONHUB.Cred.Deed.ReasonPlaceholder"))}" autofocus></div>
    ${rivals.length ? `<div class="form-group stacked"><label>${esc(L("NEONHUB.Cred.Deed.Rivals"))}</label><p class="hint">${esc(L("NEONHUB.Cred.Deed.RivalsHint"))}</p><div class="nh-cal-players">${rivalBoxes}</div></div>` : ""}
    <label class="nh-check"><input type="checkbox" name="tell" checked> ${esc(L("NEONHUB.Cred.Deed.Tell"))}</label>`;
  return Compat.DialogV2.prompt({
    window: { title, icon: "fa-solid fa-scale-balanced" },
    classes: DIALOG,
    position: { width: 460 },
    content,
    rejectClose: false,
    ok: {
      label: L("NEONHUB.Cred.Deed.Apply"),
      icon: "fa-solid fa-check",
      callback: (event, button) => {
        const f = button.form.elements;
        return {
          delta: Number(f.size.value) * Number(f.sign.value),
          reason: f.reason.value.trim(),
          rivals: Number(f.sign.value) > 0 ? [...button.form.querySelectorAll("input[name=rivals]:checked")].map((i) => i.value) : [],
          tell: f.tell.checked
        };
      }
    }
  });
}

/** Edit (or start) a relationship. Resolves to the bond's fields or null. */
async function bondDialog(bond, { isGM }) {
  const content = `
    <div class="form-group"><label>${esc(L("NEONHUB.Cred.Bond.Name"))}</label><input type="text" name="name" maxlength="80" value="${esc(bond.name)}" ${bond.target ? "" : "autofocus"}></div>
    <div class="form-group"><label>${esc(L("NEONHUB.Cred.Bond.Value"))}</label><input type="number" name="value" min="-10" max="10" value="${bond.value ?? 0}"></div>
    <div class="form-group"><label>${esc(L("NEONHUB.Cred.Bond.Tags"))}</label><input type="text" name="tags" maxlength="200" value="${esc((bond.tags ?? []).join(", "))}" placeholder="${esc(L("NEONHUB.Cred.Bond.TagsPlaceholder"))}"></div>
    <div class="form-group stacked"><label>${esc(L("NEONHUB.Cred.Bond.Notes"))}</label><textarea name="notes" rows="4" maxlength="2000">${esc(bond.notes)}</textarea></div>
    <label class="nh-check"><input type="checkbox" name="romance" ${bond.romance ? "checked" : ""}> ${esc(L("NEONHUB.Cred.Bond.Romance"))}</label>
    ${bond.targetIsCharacter ? `<label class="nh-check"><input type="checkbox" name="mutual" ${bond.mutual ? "checked" : ""}> ${esc(L("NEONHUB.Cred.Bond.Mutual"))}</label>` : ""}
    ${isGM ? `<label class="nh-check"><input type="checkbox" name="hidden" ${bond.hidden ? "checked" : ""}> ${esc(L("NEONHUB.Cred.Bond.Hidden"))}</label>` : ""}`;
  return Compat.DialogV2.prompt({
    window: { title: L(bond.id ? "NEONHUB.Cred.Bond.Edit" : "NEONHUB.Cred.Bond.New"), icon: "fa-solid fa-people-arrows" },
    classes: DIALOG,
    position: { width: 460 },
    content,
    rejectClose: false,
    ok: {
      label: L("NEONHUB.Journal.Save"),
      icon: "fa-solid fa-floppy-disk",
      callback: (event, button) => {
        const f = button.form.elements;
        return {
          name: f.name.value.trim(),
          value: clamp(f.value.value),
          tags: f.tags.value,
          notes: f.notes.value,
          romance: f.romance.checked,
          mutual: !!f.mutual?.checked,
          hidden: !!f.hidden?.checked
        };
      }
    }
  });
}

/** GM: add or edit a faction. Resolves to its fields or null. */
async function factionDialog(faction, all) {
  const kinds = FACTION_KINDS.map((k) => `<option value="${k}" ${faction.kind === k ? "selected" : ""}>${esc(L(`NEONHUB.Cred.Kind.${k}`))}</option>`).join("");
  const rivals = all.filter((f) => f.id !== faction.id).map((f) => `<label class="nh-cal-player"><input type="checkbox" name="rivals" value="${f.id}" ${faction.rivals?.includes(f.id) ? "checked" : ""}><i></i><span>${esc(f.name)}</span></label>`).join("");
  const content = `
    <div class="form-group"><label>${esc(L("NEONHUB.Cred.Faction.Name"))}</label><input type="text" name="name" maxlength="80" value="${esc(faction.name)}" autofocus></div>
    <div class="form-group"><label>${esc(L("NEONHUB.Cred.Faction.Kind"))}</label><select name="kind">${kinds}</select></div>
    <div class="form-group"><label>${esc(L("NEONHUB.Cred.Faction.Turf"))}</label><input type="text" name="turf" maxlength="160" value="${esc(faction.turf)}"></div>
    <div class="form-group"><label>${esc(L("NEONHUB.Cred.Faction.Entry"))}</label><input type="text" name="entry" maxlength="80" value="${esc(faction.entry)}" placeholder="${esc(L("NEONHUB.Cred.Faction.EntryPlaceholder"))}"></div>
    <div class="form-group"><label>${esc(L("NEONHUB.Cred.Faction.Cap"))}</label><input type="number" name="cap" min="-10" max="10" value="${faction.cap ?? ""}" placeholder="10"></div>
    <label class="nh-check"><input type="checkbox" name="joinable" ${faction.joinable !== false ? "checked" : ""}> ${esc(L("NEONHUB.Cred.Faction.Joinable"))}</label>
    <label class="nh-check"><input type="checkbox" name="hidden" ${faction.hidden ? "checked" : ""}> ${esc(L("NEONHUB.Cred.Faction.Hidden"))}</label>
    ${rivals ? `<div class="form-group stacked"><label>${esc(L("NEONHUB.Cred.Faction.Rivals"))}</label><div class="nh-cal-players nh-cred-rivals">${rivals}</div></div>` : ""}`;
  return Compat.DialogV2.prompt({
    window: { title: L(faction.id ? "NEONHUB.Cred.Faction.Edit" : "NEONHUB.Cred.Faction.New"), icon: "fa-solid fa-flag" },
    classes: DIALOG,
    position: { width: 520 },
    content,
    rejectClose: false,
    ok: {
      label: L("NEONHUB.Journal.Save"),
      icon: "fa-solid fa-floppy-disk",
      callback: (event, button) => {
        const f = button.form.elements;
        return {
          originalId: faction.id,
          id: faction.id || undefined,
          name: f.name.value.trim(),
          kind: f.kind.value,
          turf: f.turf.value.trim(),
          entry: f.entry.value.trim(),
          cap: f.cap.value === "" ? null : Number(f.cap.value),
          joinable: f.joinable.checked,
          hidden: f.hidden.checked,
          rivals: [...button.form.querySelectorAll("input[name=rivals]:checked")].map((i) => i.value)
        };
      }
    }
  });
}

/**
 * Street Cred: each character's Reputation, Standing with the Free City's factions, Heat with the
 * NCPD and relationships. Players see their own characters (or the crew's, when the GM shares it);
 * the GM moves the numbers.
 */
export class CredApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static instance = null;

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-cred`,
    classes: ["neon-hub", "nh-cal-app", "nh-cred-app"],
    tag: "div",
    window: { title: "NEONHUB.Cred.Title", icon: "fa-solid fa-ranking-star", resizable: true },
    position: { width: 900, height: 720 },
    actions: {
      pick: CredApp.#onPick,
      // Not "tab": ApplicationV2 handles data-action="tab" itself and never calls ours.
      view: CredApp.#onTab,
      standing: CredApp.#onStanding,
      deed: CredApp.#onDeed,
      heat: CredApp.#onHeat,
      heatDeed: CredApp.#onHeatDeed,
      rep: CredApp.#onRep,
      recognize: CredApp.#onRecognize,
      facedown: CredApp.#onFacedown,
      join: CredApp.#onJoin,
      leave: CredApp.#onLeave,
      cool: CredApp.#onCool,
      touch: CredApp.#onTouch,
      entry: CredApp.#onEntry,
      newFaction: CredApp.#onNewFaction,
      editFaction: CredApp.#onEditFaction,
      removeFaction: CredApp.#onRemoveFaction,
      resetFactions: CredApp.#onResetFactions,
      newBond: CredApp.#onNewBond,
      editBond: CredApp.#onEditBond,
      bondStep: CredApp.#onBondStep,
      removeBond: CredApp.#onRemoveBond,
      openTarget: CredApp.#onOpenTarget,
      setBar: CredApp.#onSetBar
    }
  };

  static PARTS = {
    main: { template: `${TEMPLATE_PATH}/cred/cred.hbs`, scrollable: [".nh-cred-scroll", ".nh-cred-rail-list"] }
  };

  constructor(options = {}) {
    super(options);
    this.actorUuid = options.actorUuid ?? null;
    this.tab = "factions";
  }

  /** Open Street Cred (on a character, by Actor or uuid). */
  static open(actor = null) {
    const uuid = typeof actor === "string" ? actor : actor?.uuid ?? null;
    this.instance ??= new this({ actorUuid: uuid });
    if (uuid) this.instance.actorUuid = uuid;
    this.instance.render({ force: true });
    this.instance.bringToFront?.();
    return this.instance;
  }

  static refresh() {
    if (this.instance?.rendered) this.instance.render();
  }

  get actor() {
    const list = CredStore.characters();
    return list.find((a) => a.uuid === this.actorUuid) ?? list.find((a) => a.id === game.user.character?.id) ?? list[0] ?? null;
  }

  async _prepareContext() {
    const isGM = game.user.isGM;
    const characters = CredStore.characters();
    const actor = this.actor;
    const tab = this.tab === "board" && !isGM ? "factions" : this.tab;
    const context = { isGM, none: !actor, isBoard: tab === "board", isFactions: tab === "factions", isBonds: tab === "bonds", isLog: tab === "log" };
    context.tabs = [...TABS, ...(isGM ? ["board"] : [])].map((id) => ({ id, label: L(`NEONHUB.Cred.Tab.${id}`), active: tab === id }));
    context.rail = characters.map((a) => ({
      uuid: a.uuid,
      name: a.name,
      img: a.img,
      rep: CredStore.reputation(a),
      heat: signed(CredStore.heat(a)),
      hot: CredStore.heat(a) > 0,
      active: a.uuid === actor?.uuid
    }));
    if (!actor) return context;
    const factions = CredStore.factions().filter((f) => isGM || !f.hidden);
    const person = CredStore.person(actor);
    const cooling = new Set(isGM ? CredStore.cooling(actor).map((f) => f.id) : []);
    const member = person.member ? CredStore.faction(person.member) : null;
    const rep = CredStore.reputation(actor);
    const heat = person.heat;

    context.actor = { uuid: actor.uuid, name: actor.name, img: actor.img };
    context.rep = { value: rep, level: L(`NEONHUB.Cred.Rep.${Math.max(0, Math.min(10, rep))}`), hasLedger: !!actor.system?.reputation };
    context.heat = { value: signed(heat), key: heatBand(heat), label: L(`NEONHUB.Cred.Heat.${heatBand(heat)}`), does: L(`NEONHUB.Cred.HeatDoes.${heatBand(heat)}`), bar: barOf(heat), hot: heat > 0 };
    context.member = member ? {
      id: member.id,
      text: L(`NEONHUB.Cred.MemberOf.${member.kind}`, { name: member.name, rank: Math.max(JOIN_AT, person.standing[member.id]?.value ?? 0) })
    } : null;

    context.factions = factions.map((f) => {
      const value = person.standing[f.id]?.value ?? 0;
      const key = standingBand(value);
      const entry = CredStore.entryFor(f);
      return {
        id: f.id,
        name: f.name,
        kind: f.kind,
        kindIcon: KIND_ICONS[f.kind],
        kindLabel: L(`NEONHUB.Cred.Kind.${f.kind}`),
        turf: f.turf,
        hidden: f.hidden,
        value: signed(value),
        raw: value,
        cap: capOf(f),
        status: L(`NEONHUB.Cred.Standing.${key}`),
        key,
        gets: L(`NEONHUB.Cred.StandingGets.${key}`),
        stores: game.i18n.has(`NEONHUB.Cred.StandingStores.${key}`) ? L(`NEONHUB.Cred.StandingStores.${key}`) : "",
        discount: discountAt(value),
        bar: barOf(value),
        side: value > 0 ? "pos" : value < 0 ? "neg" : "zero",
        contact: dateText(person.standing[f.id]?.contact),
        cooling: cooling.has(f.id),
        isMember: person.member === f.id,
        canJoin: isGM && !joinProblem(person, f),
        entry: entry?.uuid ?? null,
        rivals: f.rivals.map((id) => CredStore.faction(id)?.name).filter(Boolean).join(", ")
      };
    }).sort((a, b) => (b.raw !== 0) - (a.raw !== 0) || a.name.localeCompare(b.name));

    const canEditBonds = CredStore.canEditBonds(actor);
    context.canEditBonds = canEditBonds;
    context.bonds = person.bonds.filter((b) => isGM || !b.hidden).map((b) => {
      const key = bondBand(b.value);
      let name = b.name;
      let img = b.img;
      if (b.target) {
        let doc = null;
        try {
          doc = fromUuidSync(b.target);
        } catch { /* gone, or not in this world */ }
        if (doc) {
          name ||= doc.name;
          img ||= doc.img ?? doc.thumb ?? "";
        }
      }
      return {
        id: b.id,
        name: name || "?",
        img: img || "icons/svg/mystery-man.svg",
        value: signed(b.value),
        side: b.value > 0 ? "pos" : b.value < 0 ? "neg" : "zero",
        bar: barOf(b.value),
        status: L(`NEONHUB.Cred.Bond.Band.${key}`),
        tags: b.tags,
        notes: b.notes,
        romance: b.romance,
        mutual: b.mutual,
        hidden: b.hidden,
        target: b.target
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    context.log = person.log.map((e) => ({
      icon: { heat: "fa-solid fa-handcuffs", join: "fa-solid fa-user-plus", leave: "fa-solid fa-user-slash", bond: "fa-solid fa-people-arrows" }[e.what] ?? (e.to >= e.from ? "fa-solid fa-arrow-up" : "fa-solid fa-arrow-down"),
      what: e.what === "join" ? L("NEONHUB.Cred.Log.Join", { name: e.name }) : e.what === "leave" ? L("NEONHUB.Cred.Log.Leave", { name: e.name }) : `${e.name} ${signed(e.from)} → ${signed(e.to)}`,
      reason: e.reason,
      when: dateText(e.date) || new Date(e.at).toLocaleDateString(),
      by: e.by
    }));

    if (context.isBoard) {
      const people = characters;
      context.board = {
        people: people.map((a) => ({ name: a.name, img: a.img, uuid: a.uuid })),
        rows: [
          { name: L("NEONHUB.Cred.Heat.Short"), heat: true, cells: people.map((a) => {
            const v = CredStore.heat(a);
            return { value: signed(v), side: v > 0 ? "neg" : v < 0 ? "pos" : "zero" };
          }) },
          ...factions.map((f) => ({
            name: f.name,
            cells: people.map((a) => {
              const p = CredStore.person(a);
              const v = p.standing[f.id]?.value ?? 0;
              return { value: signed(v), side: v > 0 ? "pos" : v < 0 ? "neg" : "zero", member: p.member === f.id };
            })
          }))
        ]
      };
    }
    return context;
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const bonds = this.element.querySelector(".nh-cred-bonds");
    if (!bonds) return;
    bonds.addEventListener("dragover", (ev) => ev.preventDefault());
    bonds.addEventListener("drop", (ev) => this.#onDrop(ev));
  }

  /** A dropped Actor or Journal entry starts a relationship with them. */
  async #onDrop(event) {
    event.preventDefault();
    const actor = this.actor;
    if (!actor || !CredStore.canEditBonds(actor)) return;
    const data = Compat.getDragEventData(event);
    if (!["Actor", "JournalEntry", "JournalEntryPage"].includes(data?.type) || !data.uuid) return;
    const doc = await fromUuid(data.uuid);
    if (!doc || doc.uuid === actor.uuid) return;
    if (CredStore.person(actor).bonds.some((b) => b.target === doc.uuid)) return ui.notifications.info(L("NEONHUB.Cred.Bond.Already", { name: doc.name }));
    const fields = await bondDialog({ target: doc.uuid, name: doc.name, value: 0, targetIsCharacter: doc.type === "character" }, { isGM: game.user.isGM });
    if (!fields) return;
    try {
      await CredStore.saveBond(actor, { ...fields, target: doc.uuid, img: doc.img ?? "" });
    } catch (err) {
      warn(err);
    }
  }

  /* ---------------------------------------- */
  /*  Actions                                 */
  /* ---------------------------------------- */

  static #onPick(event, target) {
    this.actorUuid = target.dataset.uuid;
    if (this.tab === "board") this.tab = "factions";
    this.render();
  }

  static #onTab(event, target) {
    this.tab = target.dataset.tab;
    this.render();
  }

  static async #onStanding(event, target) {
    const actor = this.actor;
    const id = target.closest("[data-faction]").dataset.faction;
    try {
      await CredStore.adjust(actor, id, Number(target.dataset.step));
    } catch (err) {
      warn(err);
    }
  }

  /** Click along a bar to set the value there (GM). */
  static async #onSetBar(event, target) {
    if (!game.user.isGM) return;
    const rect = target.getBoundingClientRect();
    const value = clamp(Math.round(((event.clientX - rect.left) / rect.width) * 20 - 10));
    const actor = this.actor;
    const factionId = target.closest("[data-faction]")?.dataset.faction;
    const bondId = target.closest("[data-bond]")?.dataset.bond;
    try {
      if (factionId) await CredStore.adjust(actor, factionId, 0, { set: value });
      else if (bondId) {
        const bond = CredStore.person(actor).bonds.find((b) => b.id === bondId);
        if (bond) await CredStore.saveBond(actor, { ...bond, value });
      } else if (target.closest(".nh-cred-heat")) await CredStore.adjustHeat(actor, 0, { set: value });
    } catch (err) {
      warn(err);
    }
  }

  static async #onDeed(event, target) {
    const actor = this.actor;
    const id = target.closest("[data-faction]").dataset.faction;
    const faction = CredStore.faction(id);
    const deed = await deedDialog({ title: `${actor.name} · ${faction.name}`, rivals: CredStore.rivalsOf(id) });
    if (!deed) return;
    try {
      await CredStore.adjust(actor, id, deed.delta, deed);
    } catch (err) {
      warn(err);
    }
  }

  static async #onHeat(event, target) {
    try {
      await CredStore.adjustHeat(this.actor, Number(target.dataset.step));
    } catch (err) {
      warn(err);
    }
  }

  static async #onHeatDeed() {
    const actor = this.actor;
    const deed = await deedDialog({ title: `${actor.name} · ${L("NEONHUB.Cred.Heat.Title")}` });
    if (!deed) return;
    try {
      await CredStore.adjustHeat(actor, deed.delta, deed);
    } catch (err) {
      warn(err);
    }
  }

  static async #onRep(event, target) {
    const actor = this.actor;
    const step = Number(target.dataset.step);
    const reason = await Compat.DialogV2.prompt({
      window: { title: `${actor.name} · ${L("NEONHUB.Cred.Rep.Title")}`, icon: "fa-solid fa-star" },
      classes: DIALOG,
      content: `<p class="hint">${esc(L(step > 0 ? "NEONHUB.Cred.Rep.UpHint" : "NEONHUB.Cred.Rep.DownHint"))}</p>
        <div class="form-group"><label>${esc(L("NEONHUB.Cred.Deed.Reason"))}</label><input type="text" name="reason" maxlength="200" autofocus></div>`,
      rejectClose: false,
      ok: { label: L("NEONHUB.Cred.Deed.Apply"), icon: "fa-solid fa-check", callback: (ev, button) => button.form.elements.reason.value.trim() }
    });
    if (reason === null || reason === undefined) return;
    try {
      await CredStore.adjustReputation(actor, step, reason);
      this.render();
    } catch (err) {
      warn(err);
    }
  }

  /** Someone new rolls 1d10: under the Reputation, they've heard of you. */
  static async #onRecognize() {
    const actor = this.actor;
    const rep = CredStore.reputation(actor);
    const roll = await new Roll("1d10").evaluate();
    const known = roll.total < rep;
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `<b>${esc(L("NEONHUB.Cred.Rep.Recognize"))}</b> (${esc(L("NEONHUB.Cred.Rep.Title"))} ${rep})<br>${esc(L(known ? "NEONHUB.Cred.Rep.Known" : "NEONHUB.Cred.Rep.Unknown", { name: actor.name }))}`
    });
  }

  /** A Facedown: COOL + Reputation + 1d10. */
  static async #onFacedown() {
    const actor = this.actor;
    const cool = Number(foundry.utils.getProperty(actor, "system.stats.cool.value")) || 0;
    const rep = CredStore.reputation(actor);
    const roll = await new Roll(`1d10 + ${cool} + ${rep}`).evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `<b>${esc(L("NEONHUB.Cred.Rep.Facedown"))}</b><br>${esc(L("NEONHUB.Cred.Rep.FacedownHint", { cool, rep }))}`
    });
  }

  static async #onJoin(event, target) {
    const actor = this.actor;
    const faction = CredStore.faction(target.closest("[data-faction]").dataset.faction);
    const ok = await Compat.DialogV2.confirm({
      window: { title: L(`NEONHUB.Cred.Join.${faction.kind}`) },
      classes: DIALOG,
      content: `<p>${esc(L(`NEONHUB.Cred.JoinBody.${faction.kind}`, { name: actor.name, faction: faction.name }))}</p>`,
      rejectClose: false
    });
    if (!ok) return;
    try {
      await CredStore.join(actor, faction.id);
    } catch (err) {
      warn(err);
    }
  }

  static async #onLeave() {
    const actor = this.actor;
    const ok = await Compat.DialogV2.confirm({
      window: { title: L("NEONHUB.Cred.Leave") },
      classes: DIALOG,
      content: `<p>${esc(L("NEONHUB.Cred.LeaveBody", { name: actor.name }))}</p>`,
      rejectClose: false
    });
    if (ok) await CredStore.leave(actor).catch(warn);
  }

  static async #onCool(event, target) {
    await CredStore.coolOff(this.actor, target.closest("[data-faction]").dataset.faction).catch(warn);
  }

  static async #onTouch(event, target) {
    await CredStore.touch(this.actor, target.closest("[data-faction]").dataset.faction).catch(warn);
  }

  static async #onEntry(event, target) {
    const doc = await fromUuid(target.dataset.uuid);
    doc?.sheet?.render(true);
  }

  static async #onNewFaction() {
    const fields = await factionDialog({ name: "", kind: "gang", rivals: [] }, CredStore.factions());
    if (fields) await CredStore.saveFaction(fields).catch(warn);
  }

  static async #onEditFaction(event, target) {
    const faction = CredStore.faction(target.closest("[data-faction]").dataset.faction);
    const fields = await factionDialog(faction, CredStore.factions());
    if (fields) await CredStore.saveFaction(fields).catch(warn);
  }

  static async #onRemoveFaction(event, target) {
    const faction = CredStore.faction(target.closest("[data-faction]").dataset.faction);
    const ok = await Compat.DialogV2.confirm({
      window: { title: L("NEONHUB.Cred.Faction.Remove") },
      classes: DIALOG,
      content: `<p>${esc(L("NEONHUB.Cred.Faction.RemoveBody", { name: faction.name }))}</p>`,
      rejectClose: false
    });
    if (ok) await CredStore.removeFaction(faction.id).catch(warn);
  }

  static async #onResetFactions() {
    const ok = await Compat.DialogV2.confirm({
      window: { title: L("NEONHUB.Cred.Faction.Reset") },
      classes: DIALOG,
      content: `<p>${esc(L("NEONHUB.Cred.Faction.ResetBody"))}</p>`,
      rejectClose: false
    });
    if (ok) await CredStore.resetFactions().catch(warn);
  }

  static async #onNewBond() {
    const actor = this.actor;
    const fields = await bondDialog({ name: "", value: 0 }, { isGM: game.user.isGM });
    if (fields) await CredStore.saveBond(actor, fields).catch(warn);
  }

  static async #onEditBond(event, target) {
    const actor = this.actor;
    const bond = CredStore.person(actor).bonds.find((b) => b.id === target.closest("[data-bond]").dataset.bond);
    if (!bond) return;
    const other = actorOf(bond.target);
    const fields = await bondDialog({ ...bond, targetIsCharacter: other?.type === "character" }, { isGM: game.user.isGM });
    if (fields) await CredStore.saveBond(actor, { ...bond, ...fields }).catch(warn);
  }

  static async #onBondStep(event, target) {
    const actor = this.actor;
    const bond = CredStore.person(actor).bonds.find((b) => b.id === target.closest("[data-bond]").dataset.bond);
    if (bond) await CredStore.saveBond(actor, { ...bond, value: clamp(bond.value + Number(target.dataset.step)) }).catch(warn);
  }

  static async #onRemoveBond(event, target) {
    const actor = this.actor;
    const bond = CredStore.person(actor).bonds.find((b) => b.id === target.closest("[data-bond]").dataset.bond);
    if (!bond) return;
    const ok = await Compat.DialogV2.confirm({
      window: { title: L("NEONHUB.Cred.Bond.Remove") },
      classes: DIALOG,
      content: `<p>${esc(L("NEONHUB.Cred.Bond.RemoveBody", { name: bond.name || "?" }))}</p>`,
      rejectClose: false
    });
    if (ok) await CredStore.removeBond(actor, bond.id).catch(warn);
  }

  static async #onOpenTarget(event, target) {
    const doc = await fromUuid(target.dataset.uuid);
    doc?.sheet?.render(true);
  }

  _onClose(options) {
    super._onClose?.(options);
    if (CredApp.instance === this) CredApp.instance = null;
  }
}
