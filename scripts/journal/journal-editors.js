import { MODULE_ID, TEMPLATE_PATH } from "../constants.js";
import { Compat } from "../compat.js";
import { HQStore } from "../hq/hq-data.js";
import { LifestyleStore } from "../lifestyle/ls-store.js";
import { REWARD_KINDS, SPLITS, STORY_TYPES, LORE_TYPES, normalizeGig, normalizeSession, normalizeScreamsheet, normalizeLore, normalizeProfile, normalizeDiary, unpaid, rowId } from "./journal-data.js";
import { ScreamOps } from "./scream-ops.js";
import { JournalStore, actorOf } from "./journal-store.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));
const esc = (s) => Handlebars.escapeExpression(String(s ?? ""));
const crewOf = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);
const list = (v) => (Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : []);

/**
 * A form's fields as an object ("rows.0.text" expanded). Checkboxes with a value (the crew) give
 * the list of ticked values; ones without give true or false.
 */
function readForm(form) {
  const flat = {};
  const named = new Map();
  for (const el of form.elements) {
    if (!el.name || el.disabled || el.type === "button" || el.type === "submit") continue;
    if (!named.has(el.name)) named.set(el.name, []);
    named.get(el.name).push(el);
  }
  for (const [name, els] of named) {
    const boxes = els.filter((e) => e.type === "checkbox");
    if (boxes.length && boxes[0].hasAttribute("value")) flat[name] = boxes.filter((e) => e.checked).map((e) => e.value);
    else if (boxes.length) flat[name] = boxes[0].checked;
    else if (els[0].type === "radio") flat[name] = els.find((e) => e.checked)?.value ?? null;
    else flat[name] = els[0].value;
  }
  return foundry.utils.expandObject(flat);
}

/** The rich-text editor element (v12+), or null to fall back to a textarea. */
function proseMirror() {
  return foundry.utils.getProperty(globalThis, "foundry.applications.elements.HTMLProseMirrorElement") ?? null;
}

/**
 * A form for one record: works on a draft so rows can be added, removed and re-kinded without
 * losing what's been typed, and saves the whole record when submitted.
 */
class RecordForm extends HandlebarsApplicationMixin(ApplicationV2) {
  static instances = new Map();

  static DEFAULT_OPTIONS = {
    classes: ["neon-hub", "nh-cal-app", "nh-jr-app", "nh-jr-editor"],
    tag: "form",
    window: { resizable: true },
    position: { width: 640, height: 760 },
    form: { submitOnChange: false, closeOnSubmit: true },
    actions: {
      addRow: RecordForm.#onAddRow,
      removeRow: RecordForm.#onRemoveRow,
      pickImage: RecordForm.#onPickImage,
      cancel: RecordForm.#onCancel
    }
  };

  /** The field holding rich text, mounted as an editor after each render. */
  static RICH = "";

  constructor(page, options = {}) {
    super({ id: `${MODULE_ID}-record-${page.id}`, ...options });
    this.page = page;
    this.draft = { name: page.parent.name, players: JournalStore.playersSee(page.parent), ...JournalStore.data(page) };
  }

  static openFor(page) {
    if (!page?.isOwner) return null;
    let app = this.instances.get(page.uuid);
    if (!app) {
      app = new this(page);
      this.instances.set(page.uuid, app);
    }
    app.render({ force: true });
    app.bringToFront?.();
    return app;
  }

  get title() {
    return `${L(this.constructor.TITLE)}: ${this.page.parent.name}`;
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const field = this.constructor.RICH;
    const host = this.element.querySelector(".nh-jr-rich");
    if (field && host) {
      const PM = proseMirror();
      if (PM?.create) {
        // Written out as HTML and built by the browser, as Foundry's own sheets do: the element reads
        // its starting text when it's constructed, so an element made in code and given the text
        // afterwards opens empty (and saving it would wipe the write-up).
        const value = this.draft[field] ?? "";
        host.innerHTML = PM.create({ name: field, value, toggled: false, compact: false }).outerHTML;
        const editor = host.querySelector("prose-mirror");
        editor?.classList.add("nh-jr-prose");
        if (editor && value && !editor.value) editor.value = value;
      } else {
        const area = document.createElement("textarea");
        area.name = field;
        area.value = this.draft[field] ?? "";
        area.rows = 10;
        host.replaceChildren(area);
      }
    }
    // A select that changes which fields a row has re-draws the form.
    for (const el of this.element.querySelectorAll("[data-redraw]")) {
      el.addEventListener("change", () => {
        this.sync();
        this.render();
      });
    }
  }

  /** Read the form into the draft. */
  sync() {
    if (!this.element) return this.draft;
    const data = readForm(this.element);
    const field = this.constructor.RICH;
    if (field) {
      const rich = this.element.querySelector(`[name="${field}"]`);
      // An editor that hasn't started yet has nothing new: keep what was there.
      const idle = rich?.tagName === "PROSE-MIRROR" && !rich.classList.contains("active");
      if (rich && !(idle && !rich.value)) data[field] = rich.value ?? "";
      else data[field] = this.draft[field];
    }
    this.draft = this.read(data);
    return this.draft;
  }

  /** Form data to draft (subclasses). */
  read(data) {
    return { ...this.draft, ...data };
  }

  async _onSubmitForm(formConfig, event) {
    event.preventDefault();
    this.sync();
    try {
      await this.save(this.draft);
      if (formConfig.closeOnSubmit) await this.close();
    } catch (err) {
      ui.notifications.warn(err.message);
    }
  }

  _onClose(options) {
    super._onClose?.(options);
    this.constructor.instances.delete(this.page.uuid);
  }

  static #onAddRow(event, target) {
    this.sync();
    const key = target.dataset.list;
    this.draft[key] = [...list(this.draft[key]), this.newRow(key, target.dataset)];
    this.render();
  }

  static #onRemoveRow(event, target) {
    this.sync();
    const key = target.dataset.list;
    const id = target.closest("[data-row]").dataset.row;
    this.draft[key] = list(this.draft[key]).filter((r) => r.id !== id);
    this.render();
  }

  static #onPickImage() {
    this.sync();
    new Compat.FilePicker({
      type: "image",
      current: this.draft.image,
      callback: (path) => {
        this.draft.image = path;
        this.render();
      }
    }).render(true);
  }

  static #onCancel() {
    this.close();
  }

  newRow() {
    return { id: rowId() };
  }

  /** Characters to tick, with the draft's crew ticked. */
  characters() {
    const crew = new Set(this.draft.crew ?? []);
    const people = LifestyleStore.characters();
    for (const uuid of crew) {
      const a = actorOf(uuid);
      if (a && !people.includes(a)) people.push(a);
    }
    return people.map((a) => ({ uuid: a.uuid, name: a.name, img: a.img, checked: crew.has(a.uuid) }));
  }
}

/* ------------------------------------------ */
/*  Gigs                                      */
/* ------------------------------------------ */

export class GigEditor extends RecordForm {
  static TITLE = "NEONHUB.Journal.Gig.Edit";
  static RICH = "briefing";

  static DEFAULT_OPTIONS = {
    window: { icon: "fa-solid fa-briefcase" }
  };

  static PARTS = {
    form: { template: `${TEMPLATE_PATH}/journal/gig-editor.hbs` }
  };

  static open(entry) {
    return this.openFor(JournalStore.recordPage(entry, "gig"));
  }

  async _prepareContext() {
    const d = this.draft;
    const hqs = HQStore.all();
    return {
      ...d,
      characters: this.characters(),
      objectives: list(d.objectives).map((o, i) => ({ ...o, i, states: ["open", "done", "failed"].map((s) => ({ key: s, label: L(`NEONHUB.Journal.Objective.${s}`), selected: s === o.state })) })),
      rewards: list(d.rewards).map((w, i) => ({
        ...w,
        i,
        kinds: REWARD_KINDS.map((k) => ({ key: k, label: L(`NEONHUB.Journal.Reward.Kind.${k}`), selected: k === w.kind })),
        splits: SPLITS.map((k) => ({ key: k, label: L(`NEONHUB.Journal.Reward.Split.${k}`), selected: k === w.split })),
        hqs: hqs.map((hq) => ({ id: hq.id, name: hq.name, selected: hq.id === w.hq })),
        hasAmount: ["eddies", "ip", "hqip"].includes(w.kind),
        isEddies: w.kind === "eddies",
        isHQ: w.kind === "hqip",
        isItem: w.kind === "item" || w.kind === "housing",
        isText: w.kind === "text"
      })),
      noHQs: !hqs.length
    };
  }

  read(data) {
    const prev = new Map(list(this.draft.rewards).map((w) => [w.id, w]));
    return {
      ...this.draft,
      name: (data.name ?? this.draft.name).trim(),
      players: !!data.players,
      client: data.client ?? "",
      location: data.location ?? "",
      deadline: data.deadline ?? "",
      danger: data.danger ?? "",
      image: data.image ?? this.draft.image,
      briefing: data.briefing ?? this.draft.briefing,
      crew: crewOf(data.crew),
      objectives: list(data.objectives).map((o) => ({ id: o.id, text: o.text ?? "", state: o.state })),
      rewards: list(data.rewards).map((w) => {
        const old = prev.get(w.id) ?? {};
        return { ...old, id: w.id, kind: w.kind, amount: Number(w.amount) || 0, split: w.split ?? old.split, hq: w.hq ?? old.hq, text: w.text ?? old.text ?? "" };
      })
    };
  }

  newRow(key) {
    return key === "rewards" ? { id: rowId(), kind: "eddies", amount: 0, split: "each" } : { id: rowId(), text: "", state: "open" };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    // Drop an item on a reward row (or the rewards list) to give it.
    for (const zone of this.element.querySelectorAll("[data-drop-item]")) {
      zone.addEventListener("dragover", (ev) => ev.preventDefault());
      zone.addEventListener("drop", (ev) => this.#onDropItem(ev, zone.dataset.dropItem));
    }
  }

  async #onDropItem(event, rowId_) {
    event.preventDefault();
    // A row sits inside the rewards list, which takes drops too.
    event.stopPropagation();
    const data = Compat.getDragEventData(event);
    if (data?.type !== "Item" || !data.uuid) return;
    const item = await fromUuid(data.uuid);
    if (!item) return;
    this.sync();
    const housing = item.getFlag?.(MODULE_ID, "lifestyle")?.category === "housing";
    const rows = list(this.draft.rewards);
    const row = rows.find((w) => w.id === rowId_);
    if (row) Object.assign(row, { kind: row.kind === "housing" || housing ? "housing" : "item", uuid: item.uuid, name: item.name });
    else rows.push({ id: rowId(), kind: housing ? "housing" : "item", uuid: item.uuid, name: item.name });
    this.draft.rewards = rows;
    this.render();
  }

  async save(draft) {
    const gig = normalizeGig({ ...JournalStore.data(this.page), ...draft });
    await JournalStore.save(this.page, gig, draft.name && draft.name !== this.page.name ? { name: draft.name } : {});
    const entry = this.page.parent;
    if (draft.name && draft.name !== entry.name) await entry.update({ name: draft.name });
    if (game.user.isGM && !!draft.players !== JournalStore.playersSee(entry)) await JournalStore.setPlayersSee(entry, !!draft.players);
  }
}

/* ------------------------------------------ */
/*  Story sessions                            */
/* ------------------------------------------ */

export class SessionEditor extends RecordForm {
  static TITLE = "NEONHUB.Journal.Session.Edit";
  static RICH = "summary";

  static DEFAULT_OPTIONS = {
    window: { icon: "fa-solid fa-clapperboard" }
  };

  static PARTS = {
    form: { template: `${TEMPLATE_PATH}/journal/session-editor.hbs` }
  };

  static open(page) {
    return this.openFor(page);
  }

  constructor(page, options) {
    super(page, options);
    this.draft.name = page.name;
  }

  get title() {
    return `${L(this.constructor.TITLE)}: ${this.page.name}`;
  }

  async _prepareContext() {
    return { ...this.draft, characters: this.characters(), events: list(this.draft.events).map((e, i) => ({ ...e, i })) };
  }

  read(data) {
    return {
      ...this.draft,
      name: (data.name ?? this.draft.name).trim(),
      number: Number(data.number) || 0,
      date: data.date ?? "",
      played: data.played ?? "",
      summary: data.summary ?? this.draft.summary,
      crew: crewOf(data.crew),
      events: list(data.events).map((e) => ({ id: e.id, text: e.text ?? "", key: !!e.key }))
    };
  }

  newRow() {
    return { id: rowId(), text: "", key: false };
  }

  async save(draft) {
    const session = normalizeSession({ ...JournalStore.data(this.page), ...draft });
    await JournalStore.save(this.page, session, draft.name ? { name: draft.name } : {});
  }
}

/* ------------------------------------------ */
/*  Screamsheets                              */
/* ------------------------------------------ */

export class ScreamEditor extends RecordForm {
  static TITLE = "NEONHUB.Journal.Scream.Edit";

  static DEFAULT_OPTIONS = {
    window: { icon: "fa-solid fa-newspaper" },
    position: { width: 720, height: 800 }
  };

  static PARTS = {
    form: { template: `${TEMPLATE_PATH}/journal/scream-editor.hbs` }
  };

  static open(page) {
    return this.openFor(page);
  }

  async _prepareContext() {
    const d = this.draft;
    return {
      ...d,
      masthead: d.masthead || L("NEONHUB.Journal.Scream.DefaultMasthead"),
      addTypes: STORY_TYPES.map((t) => ({ key: t, label: L(`NEONHUB.Journal.Scream.Type.${t}`) })),
      stories: list(d.stories).map((st, i) => ({
        ...st,
        i,
        isDeveloping: st.type === "developing",
        types: STORY_TYPES.map((t) => ({ key: t, label: L(`NEONHUB.Journal.Scream.Type.${t}`), selected: t === st.type }))
      }))
    };
  }

  read(data) {
    const prev = new Map(list(this.draft.stories).map((st) => [st.id, st]));
    return {
      ...this.draft,
      name: (data.name ?? this.draft.name).trim(),
      masthead: (data.masthead ?? "").trim(),
      issue: Number(data.issue) || 0,
      date: data.date ?? "",
      stories: list(data.stories).map((st) => ({
        ...(prev.get(st.id) ?? {}),
        id: st.id,
        type: st.type,
        headline: st.headline ?? "",
        source: st.source ?? "",
        body: st.body ?? "",
        followUp: !!st.followUp
      }))
    };
  }

  newRow(key, data = {}) {
    return { id: rowId(), type: STORY_TYPES.includes(data.type) ? data.type : "news", headline: "", body: "", source: "" };
  }

  async save(draft) {
    const sheet = normalizeScreamsheet({ ...JournalStore.data(this.page), ...draft });
    await JournalStore.save(this.page, sheet);
    const entry = this.page.parent;
    if (draft.name && draft.name !== entry.name) await entry.update({ name: draft.name });
  }

  constructor(page, options) {
    super(page, options);
    this.draft.name = page.parent.name;
  }
}

/* ------------------------------------------ */
/*  Worldbuilding                             */
/* ------------------------------------------ */

export class LoreEditor extends RecordForm {
  static TITLE = "NEONHUB.Journal.Lore.Edit";
  static RICH = "body";

  static DEFAULT_OPTIONS = {
    window: { icon: "fa-solid fa-earth-americas" }
  };

  static PARTS = {
    form: { template: `${TEMPLATE_PATH}/journal/lore-editor.hbs` }
  };

  static open(page) {
    return this.openFor(page);
  }

  async _prepareContext() {
    const d = this.draft;
    return {
      ...d,
      isGM: game.user.isGM,
      types: LORE_TYPES.map((t) => ({ key: t, label: L(`NEONHUB.Journal.Lore.Type.${t}`), selected: t === d.type })),
      facts: list(d.facts).map((f, i) => ({ ...f, i }))
    };
  }

  read(data) {
    return {
      ...this.draft,
      name: (data.name ?? this.draft.name).trim(),
      players: !!data.players,
      type: data.type ?? this.draft.type,
      tagline: data.tagline ?? "",
      source: data.source ?? "",
      image: data.image ?? this.draft.image,
      body: data.body ?? this.draft.body,
      facts: list(data.facts).map((f) => ({ id: f.id, label: f.label ?? "", value: f.value ?? "" }))
    };
  }

  newRow() {
    return { id: rowId(), label: "", value: "" };
  }

  async save(draft) {
    const lore = normalizeLore({ ...JournalStore.data(this.page), ...draft });
    await JournalStore.save(this.page, lore, draft.name ? { name: draft.name } : {});
    const entry = this.page.parent;
    if (draft.name && draft.name !== entry.name) await entry.update({ name: draft.name });
    if (game.user.isGM && !!draft.players !== JournalStore.playersSee(entry)) await JournalStore.setPlayersSee(entry, !!draft.players);
  }
}

/* ------------------------------------------ */
/*  Characters' journals                      */
/* ------------------------------------------ */

export class ProfileEditor extends RecordForm {
  static TITLE = "NEONHUB.Journal.Profile.Edit";
  static RICH = "notes";

  static DEFAULT_OPTIONS = {
    window: { icon: "fa-solid fa-id-card" }
  };

  static PARTS = {
    form: { template: `${TEMPLATE_PATH}/journal/profile-editor.hbs` }
  };

  static open(page) {
    return this.openFor(page);
  }

  async _prepareContext() {
    const d = this.draft;
    return { ...d, goals: list(d.goals).map((g, i) => ({ ...g, i })), contacts: list(d.contacts).map((c, i) => ({ ...c, i })) };
  }

  read(data) {
    return {
      ...this.draft,
      handle: data.handle ?? "",
      origin: data.origin ?? "",
      notes: data.notes ?? this.draft.notes,
      goals: list(data.goals).map((g) => ({ id: g.id, text: g.text ?? "", done: !!g.done })),
      contacts: list(data.contacts).map((c) => ({ id: c.id, name: c.name ?? "", note: c.note ?? "" }))
    };
  }

  newRow(key) {
    return key === "contacts" ? { id: rowId(), name: "", note: "" } : { id: rowId(), text: "", done: false };
  }

  async save(draft) {
    await JournalStore.save(this.page, normalizeProfile({ ...JournalStore.data(this.page), ...draft }));
  }
}

export class DiaryEditor extends RecordForm {
  static TITLE = "NEONHUB.Journal.Diary.Edit";
  static RICH = "body";

  static DEFAULT_OPTIONS = {
    window: { icon: "fa-solid fa-feather" },
    position: { width: 640, height: 620 }
  };

  static PARTS = {
    form: { template: `${TEMPLATE_PATH}/journal/diary-editor.hbs` }
  };

  static open(page) {
    return this.openFor(page);
  }

  constructor(page, options) {
    super(page, options);
    this.draft.name = page.name;
  }

  get title() {
    return `${L(this.constructor.TITLE)}: ${this.page.name}`;
  }

  async _prepareContext() {
    return { ...this.draft };
  }

  read(data) {
    return { ...this.draft, name: (data.name ?? this.draft.name).trim(), date: data.date ?? "", location: data.location ?? "", body: data.body ?? this.draft.body };
  }

  async save(draft) {
    await JournalStore.save(this.page, normalizeDiary({ ...JournalStore.data(this.page), ...draft }), draft.name ? { name: draft.name } : {});
  }
}

/** GM: which roll tables the screamsheet generator uses, and how many stories of each. */
export async function generatorDialog() {
  const current = ScreamOps.generator();
  const tables = await ScreamOps.tableChoices();
  const rows = STORY_TYPES.map((type) => {
    const options = [`<option value="">${esc(L("NEONHUB.Journal.Scream.NoTableOption"))}</option>`]
      .concat(tables.map((t) => `<option value="${esc(t.uuid)}"${t.uuid === current[type].uuid ? " selected" : ""}>${esc(t.name)}</option>`)).join("");
    return `<div class="nh-jr-gen-row"><label>${esc(L(`NEONHUB.Journal.Scream.Type.${type}`))}</label>`
      + `<select name="table-${type}">${options}</select>`
      + `<input type="number" name="count-${type}" value="${current[type].count}" min="0" max="12" step="1"></div>`;
  }).join("");
  const choice = await Compat.DialogV2.prompt({
    window: { title: L("NEONHUB.Journal.Scream.Tables"), icon: "fa-solid fa-dice" },
    classes: ["neon-hub", "nh-cal-dialog", "nh-jr-dialog"],
    position: { width: 560 },
    content: `<p class="hint">${esc(L("NEONHUB.Journal.Scream.TablesIntro"))}</p><div class="nh-jr-gen">${rows}</div>`,
    rejectClose: false,
    ok: {
      label: L("NEONHUB.Journal.Save"),
      icon: "fa-solid fa-floppy-disk",
      callback: (event, button) => Object.fromEntries(STORY_TYPES.map((type) => [type, {
        uuid: button.form.elements[`table-${type}`].value,
        count: button.form.elements[`count-${type}`].value
      }]))
    }
  });
  if (choice) await ScreamOps.saveGenerator(choice);
  return choice;
}

/* ------------------------------------------ */
/*  Paying a gig out                          */
/* ------------------------------------------ */

/**
 * GM: who gets a completed gig's rewards. Resolves to { recipients, rewards } for GigOps.payout,
 * or null.
 */
export async function payoutDialog(entry) {
  const page = JournalStore.recordPage(entry, "gig");
  const gig = page ? JournalStore.data(page) : null;
  if (!gig) return null;
  const owed = unpaid(gig);
  if (!owed.length) return null;
  const crew = new Set(gig.crew);
  const people = LifestyleStore.characters();
  for (const uuid of crew) {
    const a = actorOf(uuid);
    if (a && !people.includes(a)) people.push(a);
  }
  const ticked = (a) => (crew.size ? crew.has(a.uuid) : true);
  const options = (sel) => people.map((a) => `<option value="${a.uuid}"${a.uuid === sel ? " selected" : ""}>${esc(a.name)}</option>`).join("");
  const firstCrew = people.find(ticked)?.uuid;
  const rows = owed.map((w) => `<li class="nh-jr-pay-row">
      <label class="nh-check"><input type="checkbox" name="pay" value="${w.id}" checked> <span>${esc(JournalStore.rewardLabel(w))}</span></label>
      ${w.kind === "item" || w.kind === "housing" ? `<select name="to-${w.id}">${options(firstCrew)}</select>` : ""}
      ${w.kind === "text" ? `<small>${esc(L("NEONHUB.Journal.Payout.Noted"))}</small>` : ""}
    </li>`).join("");
  const content = `
    <p class="hint">${esc(L("NEONHUB.Journal.Payout.Intro"))}</p>
    <div class="form-group stacked"><label>${esc(L("NEONHUB.Journal.Payout.Who"))}</label>
      <div class="nh-cal-players">${people.map((a) => `<label class="nh-cal-player"><input type="checkbox" name="people" value="${a.uuid}"${ticked(a) ? " checked" : ""}><i></i><span>${esc(a.name)}</span></label>`).join("")}</div>
    </div>
    <div class="form-group stacked"><label>${esc(L("NEONHUB.Journal.Gig.Rewards"))}</label><ul class="nh-jr-pay">${rows}</ul></div>`;
  return Compat.DialogV2.prompt({
    window: { title: `${L("NEONHUB.Journal.Payout.Title")}: ${entry.name}`, icon: "fa-solid fa-coins" },
    classes: ["neon-hub", "nh-cal-dialog", "nh-jr-dialog"],
    position: { width: 520 },
    content,
    rejectClose: false,
    ok: {
      label: L("NEONHUB.Journal.Payout.Go"),
      icon: "fa-solid fa-coins",
      callback: (event, button) => {
        const form = button.form;
        const rewards = {};
        for (const box of form.querySelectorAll("input[name=pay]:checked")) rewards[box.value] = { to: form.elements[`to-${box.value}`]?.value ?? null };
        return { recipients: [...form.querySelectorAll("input[name=people]:checked")].map((i) => i.value), rewards };
      }
    }
  });
}
