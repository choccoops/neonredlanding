import { MODULE_ID, TEMPLATE_PATH } from "../constants.js";
import { Compat } from "../compat.js";
import { SECTIONS, GIG_STATUSES, LORE_TYPES, objectiveGroups, progress, unpaid, storyGroups } from "./journal-data.js";
import { WorldOps } from "./world-ops.js";
import { CPR } from "../cpr.js";
import { JournalStore, actorOf } from "./journal-store.js";
import { GigOps } from "./gig-ops.js";
import { Records } from "./records.js";
import { GigEditor, SessionEditor, ScreamEditor, LoreEditor, ProfileEditor, DiaryEditor, payoutDialog, generatorDialog } from "./journal-editors.js";
import { ScreamOps } from "./scream-ops.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));
const esc = (s) => Handlebars.escapeExpression(String(s ?? ""));

const SECTION_ICONS = {
  journals: "fa-solid fa-book",
  gigs: "fa-solid fa-briefcase",
  screamsheets: "fa-solid fa-newspaper",
  world: "fa-solid fa-earth-americas",
  characters: "fa-solid fa-id-badge",
  story: "fa-solid fa-scroll",
  downtime: "fa-solid fa-mug-hot"
};
const KIND_ICONS = { gig: "fa-solid fa-briefcase", screamsheet: "fa-solid fa-newspaper", lore: "fa-solid fa-earth-americas", profile: "fa-solid fa-id-card", diary: "fa-solid fa-feather", session: "fa-solid fa-clapperboard", downtime: "fa-solid fa-mug-hot", text: "fa-solid fa-file-lines", image: "fa-solid fa-image", video: "fa-solid fa-film", pdf: "fa-solid fa-file-pdf" };
const GIG_MOVES = { found: ["take", "complete", "fail"], active: ["complete", "fail"], completed: ["reopen"], failed: ["reopen"] };
const MOVE_ICONS = { take: "fa-solid fa-handshake", complete: "fa-solid fa-circle-check", fail: "fa-solid fa-skull", reopen: "fa-solid fa-rotate-left" };

/** The core v12 journal window, for "classic view" (v13 moved it). */
function coreSheetClass() {
  return foundry.utils.getProperty(globalThis, "foundry.applications.sheets.journal.JournalEntrySheet")
    ?? (typeof JournalSheet === "undefined" ? null : JournalSheet);
}

/**
 * The Neon Journal: every journal in one window, with Neon Hub's sections (gigs, the story, the
 * downtime log) beside the rest. Opening any journal in Foundry lands here (see journal-sheet.js).
 */
export class NeonJournal extends HandlebarsApplicationMixin(ApplicationV2) {
  static instance = null;

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-journal`,
    classes: ["neon-hub", "nh-cal-app", "nh-jr-app"],
    tag: "div",
    window: { title: "NEONHUB.Journal.Title", icon: "fa-solid fa-book-open", resizable: true },
    position: { width: 1100, height: 760 },
    actions: {
      section: NeonJournal.#onSection,
      openEntry: NeonJournal.#onOpenEntry,
      openPage: NeonJournal.#onOpenPage,
      back: NeonJournal.#onBack,
      forward: NeonJournal.#onForward,
      filter: NeonJournal.#onFilter,
      create: NeonJournal.#onCreate,
      edit: NeonJournal.#onEdit,
      addPage: NeonJournal.#onAddPage,
      addSession: NeonJournal.#onAddSession,
      deletePage: NeonJournal.#onDeletePage,
      show: NeonJournal.#onShow,
      ownership: NeonJournal.#onOwnership,
      players: NeonJournal.#onPlayers,
      remove: NeonJournal.#onRemove,
      classic: NeonJournal.#onClassic,
      rename: NeonJournal.#onRename,
      move: NeonJournal.#onMove,
      objective: NeonJournal.#onObjective,
      payout: NeonJournal.#onPayout,
      post: NeonJournal.#onPost,
      openActor: NeonJournal.#onOpenActor,
      popout: NeonJournal.#onPopout,
      generate: NeonJournal.#onGenerate,
      tables: NeonJournal.#onTables,
      publish: NeonJournal.#onPublish,
      loreFilter: NeonJournal.#onLoreFilter,
      importWorldbook: NeonJournal.#onImportWorldbook,
      addLog: NeonJournal.#onAddLog
    }
  };

  static PARTS = {
    main: { template: `${TEMPLATE_PATH}/journal/journal.hbs`, scrollable: [".nh-jr-list-scroll", ".nh-jr-page-scroll"] }
  };

  constructor(options = {}) {
    super(options);
    this.section = "gigs";
    this.entryId = null;
    this.pageId = null;
    this.gigFilter = "open";
    this.loreFilter = "all";
    this.search = "";
    this.history = [];
    this.future = [];
    // Entries the GM showed this user without giving them permission.
    this.temp = new Set();
  }

  /** Turned on (per player) to open journals here. */
  static get enabled() {
    try {
      return game.settings.get(MODULE_ID, "journalTakeover") !== false;
    } catch {
      return true;
    }
  }

  /**
   * Open the journal, at an entry (and page) if given.
   * @param {JournalEntry|string|null} entry
   * @param {{ pageId?: string, section?: string, temp?: boolean }} options
   */
  static async open(entry = null, { pageId = null, section = null, temp = false } = {}) {
    this.instance ??= new this();
    const app = this.instance;
    if (typeof entry === "string") entry = await fromUuid(entry);
    if (entry instanceof JournalEntryPage) {
      pageId = entry.id;
      entry = entry.parent;
    }
    if (entry instanceof JournalEntry) {
      if (temp) app.temp.add(entry.id);
      app.go({ section: JournalStore.section(entry), entryId: entry.id, pageId });
    } else if (section && SECTIONS.includes(section)) {
      app.go({ section, entryId: null, pageId: null });
    }
    await app.render({ force: true });
    app.bringToFront?.();
    return app;
  }

  static toggle() {
    if (this.instance?.rendered) return this.instance.close();
    return this.open();
  }

  static refresh() {
    clearTimeout(this._refreshTimer);
    this._refreshTimer = setTimeout(() => {
      if (this.instance?.rendered) this.instance.render();
    }, 60);
  }

  /** Move to a place, remembering where we were for Back. */
  go(place, { record = true } = {}) {
    const here = { section: this.section, entryId: this.entryId, pageId: this.pageId };
    if (record && (here.section !== place.section || here.entryId !== place.entryId || here.pageId !== place.pageId)) {
      this.history.push(here);
      if (this.history.length > 50) this.history.shift();
      this.future = [];
    }
    this.section = place.section;
    this.entryId = place.entryId;
    this.pageId = place.pageId;
  }

  canSee(entry) {
    return !!entry && (entry.testUserPermission(game.user, "LIMITED") || this.temp.has(entry.id));
  }

  pageVisible(entry, page) {
    return page.testUserPermission(game.user, "OBSERVER") || this.temp.has(entry.id);
  }

  get entry() {
    const e = this.entryId ? game.journal.get(this.entryId) : null;
    return this.canSee(e) ? e : null;
  }

  #canCreate() {
    const isGM = game.user.isGM;
    switch (this.section) {
      case "journals": return JournalEntry.canUserCreate?.(game.user) ?? isGM;
      case "characters": return isGM || WorldOps.journalless().length > 0;
      case "downtime": return false;
      default: return isGM;
    }
  }

  /* ---------------------------------------- */
  /*  Context                                 */
  /* ---------------------------------------- */

  async _prepareContext() {
    const isGM = game.user.isGM;
    const entry = this.entry;
    const context = {
      isGM,
      section: this.section,
      search: this.search,
      canBack: this.history.length > 0,
      canForward: this.future.length > 0,
      sections: SECTIONS.map((key) => ({
        key,
        label: L(`NEONHUB.Journal.Section.${key}`),
        icon: SECTION_ICONS[key],
        count: JournalStore.entries(key).length,
        active: key === this.section
      })),
      sectionLabel: L(`NEONHUB.Journal.Section.${this.section}`),
      canCreate: this.#canCreate(),
      createLabel: L(`NEONHUB.Journal.New.${this.section}`),
      canImport: isGM && this.section === "world" && !!WorldOps.worldbook
    };
    Object.assign(context, this.#listContext(entry));
    context.entry = entry ? await this.#entryContext(entry) : null;
    return context;
  }

  #listContext(current) {
    const entries = JournalStore.entries(this.section);
    const row = (e, extra = {}) => ({ id: e.id, name: e.name, active: e.id === current?.id, search: e.name.toLowerCase(), hidden: game.user.isGM && !JournalStore.anyPlayerSees(e), ...extra });
    if (this.section === "gigs") {
      const filters = ["open", ...GIG_STATUSES, "all"].map((key) => ({ key, label: L(`NEONHUB.Journal.Gig.Filter.${key}`), active: key === this.gigFilter }));
      const rows = entries.map((e) => {
        const page = JournalStore.recordPage(e, "gig");
        const gig = page ? JournalStore.data(page) : null;
        if (!gig) return null;
        const show = this.gigFilter === "all" || (this.gigFilter === "open" ? ["found", "active"].includes(gig.status) : gig.status === this.gigFilter);
        if (!show) return null;
        const p = progress(gig);
        return row(e, {
          status: gig.status,
          statusLabel: L(`NEONHUB.Journal.Gig.State.${gig.status}`),
          sub: [gig.client, gig.location].filter(Boolean).join(" · "),
          progress: p.total ? `${p.done}/${p.total}` : "",
          pct: p.pct,
          search: `${e.name} ${gig.client} ${gig.location}`.toLowerCase()
        });
      }).filter(Boolean);
      return { gigFilters: filters, groups: [{ rows }], listEmpty: !rows.length };
    }
    if (this.section === "journals") {
      const groups = [];
      for (const e of entries) {
        const folder = e.folder?.name ?? "";
        let g = groups.at(-1);
        if (!g || g.folder !== folder) groups.push(g = { folder, rows: [] });
        g.rows.push(row(e, { sub: L("NEONHUB.Journal.Pages", { n: e.pages.size }) }));
      }
      return { groups, listEmpty: !entries.length };
    }
    if (this.section === "world") {
      const filters = ["all", ...LORE_TYPES].map((key) => ({ key, label: L(key === "all" ? "NEONHUB.Journal.Gig.Filter.all" : `NEONHUB.Journal.Lore.Plural.${key}`), active: key === this.loreFilter }));
      const rows = [];
      for (const e of entries) {
        const page = JournalStore.recordPage(e, "lore");
        const lore = page ? JournalStore.data(page) : null;
        const type = lore?.type ?? "";
        if (this.loreFilter !== "all" && type !== this.loreFilter) continue;
        rows.push(row(e, {
          icon: LORE_ICONS[type] ?? "fa-solid fa-file-lines",
          sub: lore ? [L(`NEONHUB.Journal.Lore.Type.${type}`), lore.tagline].filter(Boolean).join(" · ") : "",
          search: `${e.name} ${lore?.tagline ?? ""} ${(lore?.facts ?? []).map((f) => f.value).join(" ")}`.toLowerCase()
        }));
      }
      rows.sort((a, b) => a.name.localeCompare(b.name));
      return { loreFilters: filters, groups: [{ rows }], listEmpty: !rows.length };
    }
    if (this.section === "characters") {
      return {
        groups: [{ rows: entries.map((e) => {
          const actor = actorOf(e.getFlag(MODULE_ID, "journal")?.actor);
          return row(e, { img: actor?.img, sub: L("NEONHUB.Journal.Diary.Count", { n: e.pages.filter((p) => JournalStore.kind(p) === "diary").length }) });
        }).sort((a, b) => a.name.localeCompare(b.name)) }],
        listEmpty: !entries.length
      };
    }
    if (this.section === "screamsheets") {
      return {
        groups: [{ rows: entries.map((e) => {
          const page = JournalStore.recordPage(e, "screamsheet");
          const sheet = page ? JournalStore.data(page) : null;
          if (!sheet) return row(e);
          const lead = storyGroups(sheet)[0]?.stories[0];
          return row(e, {
            status: sheet.published ? "published" : "draft",
            statusLabel: game.user.isGM ? L(sheet.published ? "NEONHUB.Journal.Scream.Published" : "NEONHUB.Journal.Scream.Draft") : "",
            sub: [sheet.date, lead?.headline].filter(Boolean).join(" · "),
            search: `${e.name} ${sheet.stories.map((st) => st.headline).join(" ")}`.toLowerCase()
          });
        }) }],
        listEmpty: !entries.length
      };
    }
    if (this.section === "downtime") {
      return {
        groups: [{ rows: entries.map((e) => {
          const page = JournalStore.recordPage(e, "downtime");
          const r = page ? JournalStore.data(page) : null;
          return row(e, { sub: r ? [r.totalText, r.people.map((p) => p.name).join(", ")].filter(Boolean).join(" · ") : "" });
        }) }],
        listEmpty: !entries.length
      };
    }
    // story
    return {
      groups: [{ rows: entries.map((e) => row(e, { sub: L("NEONHUB.Journal.Story.Sessions", { n: e.pages.filter((p) => JournalStore.kind(p) === "session").length }) })) }],
      listEmpty: !entries.length
    };
  }

  async #entryContext(entry) {
    const isGM = game.user.isGM;
    const pages = entry.pages.contents.sort((a, b) => a.sort - b.sort).filter((p) => this.pageVisible(entry, p));
    let page = pages.find((p) => p.id === this.pageId) ?? pages[0] ?? null;
    const section = JournalStore.section(entry);
    return {
      id: entry.id,
      name: entry.name,
      section,
      sectionLabel: L(`NEONHUB.Journal.Section.${section}`),
      canEdit: entry.isOwner,
      playersSee: JournalStore.playersSee(entry),
      gmOnly: !JournalStore.anyPlayerSees(entry),
      isStory: section === "story",
      isCharacter: section === "characters",
      limited: !pages.length,
      pages: pages.length > 1 || entry.isOwner ? pages.map((p) => ({
        id: p.id,
        name: p.name,
        icon: KIND_ICONS[JournalStore.kind(p) ?? p.type] ?? "fa-solid fa-file",
        active: p.id === page?.id
      })) : [],
      page: page ? await this.#pageContext(entry, page) : null,
      isGM
    };
  }

  async #pageContext(entry, page) {
    const kind = JournalStore.kind(page);
    const base = { id: page.id, name: page.name, kind: kind ?? page.type, canEdit: page.isOwner && kind !== "downtime", showTitle: page.title?.show ?? true };
    const enrich = (html) => Compat.TextEditor.enrichHTML(html ?? "", { secrets: page.isOwner, relativeTo: page, async: true });
    if (kind === "gig") return { ...base, isGig: true, gig: await this.#gigContext(entry, page, enrich) };
    if (kind === "session") {
      const s = JournalStore.data(page);
      return {
        ...base,
        isSession: true,
        session: {
          ...s,
          crew: s.crew.map(actorOf).filter(Boolean).map((a) => ({ uuid: a.uuid, name: a.name, img: a.img })),
          summary: await enrich(s.summary)
        }
      };
    }
    if (kind === "downtime") return { ...base, isDowntime: true, record: JournalStore.data(page) };
    if (kind === "screamsheet") return { ...base, isScream: true, sheet: this.#screamContext(page) };
    if (kind === "lore") {
      const lore = JournalStore.data(page);
      return {
        ...base,
        isLore: true,
        lore: { ...lore, typeLabel: L(`NEONHUB.Journal.Lore.Type.${lore.type}`), icon: LORE_ICONS[lore.type], body: await enrich(lore.body), facts: lore.facts.filter((f) => f.value) }
      };
    }
    if (kind === "profile") {
      const profile = JournalStore.data(page);
      const actor = actorOf(profile.actor);
      return {
        ...base,
        isProfile: true,
        profile: {
          ...profile,
          name: actor?.name ?? page.parent.name,
          img: actor?.img ?? "",
          uuid: actor?.uuid ?? "",
          roles: actor ? CPR.roles(actor).join(", ") : "",
          notes: await enrich(profile.notes)
        }
      };
    }
    if (kind === "diary") {
      const diary = JournalStore.data(page);
      return { ...base, isDiary: true, diary: { ...diary, body: await enrich(diary.body) } };
    }
    switch (page.type) {
      case "text": return { ...base, isText: true, html: await enrich(page.text?.content) };
      case "image": return { ...base, isImage: true, src: page.src, caption: page.image?.caption ?? "" };
      case "video": return { ...base, isVideo: true, src: page.src };
      case "pdf": return { ...base, isPDF: true, src: page.src };
      default: return { ...base, isOther: true };
    }
  }

  async #gigContext(entry, page, enrich) {
    const gig = JournalStore.data(page);
    const isGM = game.user.isGM;
    const groups = objectiveGroups(gig);
    const label = (o) => ({ ...o, stateLabel: L(`NEONHUB.Journal.Objective.${o.state}`) });
    const p = progress(gig);
    return {
      ...gig,
      statusLabel: L(`NEONHUB.Journal.Gig.State.${gig.status}`),
      briefing: await enrich(gig.briefing),
      facts: [
        ["Client", gig.client, "fa-solid fa-user-tie"],
        ["Location", gig.location, "fa-solid fa-location-dot"],
        ["Deadline", gig.deadline, "fa-solid fa-hourglass-half"],
        ["Danger", gig.danger, "fa-solid fa-triangle-exclamation"]
      ].filter(([, v]) => v).map(([k, value, icon]) => ({ label: L(`NEONHUB.Journal.Gig.${k}`), value, icon })),
      dateRows: GIG_STATUSES.filter((s) => gig.dates[s]).map((s) => ({ label: L(`NEONHUB.Journal.Gig.Date.${s}`), value: gig.dates[s] })),
      crew: gig.crew.map(actorOf).filter(Boolean).map((a) => ({ uuid: a.uuid, name: a.name, img: a.img })),
      objectiveGroups: ["open", "done", "failed"].map((state) => ({
        state,
        label: L(`NEONHUB.Journal.Objective.Group.${state}`),
        rows: groups[state].map(label)
      })).filter((g) => g.rows.length),
      progress: p,
      rewards: gig.rewards.map((w) => ({ ...w, label: JournalStore.rewardLabel(w), kindLabel: L(`NEONHUB.Journal.Reward.Kind.${w.kind}`), icon: REWARD_ICONS[w.kind] })),
      moves: isGM ? (GIG_MOVES[gig.status] ?? []).map((m) => ({ key: m, label: L(`NEONHUB.Journal.Gig.Move.${m}`), icon: MOVE_ICONS[m] })) : [],
      canPay: isGM && gig.status === "completed" && unpaid(gig).length > 0,
      paidOut: gig.payout
    };
  }

  #screamContext(page) {
    const sheet = JournalStore.data(page);
    const paras = (body) => body.split(/\n+/).map((t) => t.trim()).filter(Boolean);
    const groups = storyGroups(sheet).map((g) => ({
      type: g.type,
      label: L(`NEONHUB.Journal.Scream.Type.${g.type}`),
      stories: g.stories.map((st, i) => ({ ...st, paras: paras(st.body), style: i % 3 }))
    }));
    return {
      ...sheet,
      masthead: sheet.masthead || L("NEONHUB.Journal.Scream.DefaultMasthead"),
      groups,
      empty: !groups.length,
      isGM: game.user.isGM,
      publishLabel: L(sheet.published ? "NEONHUB.Journal.Scream.Resend" : "NEONHUB.Journal.Scream.Publish")
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const search = this.element.querySelector(".nh-jr-search");
    if (search) {
      const apply = () => {
        this.search = search.value.trim().toLowerCase();
        for (const row of this.element.querySelectorAll(".nh-jr-row")) row.hidden = !!this.search && !row.dataset.search.includes(this.search);
      };
      search.addEventListener("input", apply);
      if (this.search) apply();
    }
    // Pages' own links (@UUID, inline rolls) work through Foundry's listeners on the document body.
  }

  _onClose(options) {
    super._onClose?.(options);
    if (NeonJournal.instance === this) NeonJournal.instance = null;
  }

  /* ---------------------------------------- */
  /*  Actions                                 */
  /* ---------------------------------------- */

  static #onSection(event, target) {
    const section = target.dataset.section;
    if (section === this.section && !this.entryId) return;
    const keep = this.entry && JournalStore.section(this.entry) === section;
    this.go({ section, entryId: keep ? this.entryId : null, pageId: keep ? this.pageId : null });
    this.render();
  }

  static #onOpenEntry(event, target) {
    this.go({ section: this.section, entryId: target.closest("[data-entry]").dataset.entry, pageId: null });
    this.render();
  }

  static #onOpenPage(event, target) {
    this.go({ section: this.section, entryId: this.entryId, pageId: target.dataset.page });
    this.render();
  }

  static #onBack() {
    const place = this.history.pop();
    if (!place) return;
    this.future.push({ section: this.section, entryId: this.entryId, pageId: this.pageId });
    this.go(place, { record: false });
    this.render();
  }

  static #onForward() {
    const place = this.future.pop();
    if (!place) return;
    this.history.push({ section: this.section, entryId: this.entryId, pageId: this.pageId });
    this.go(place, { record: false });
    this.render();
  }

  static #onFilter(event, target) {
    this.gigFilter = target.dataset.filter;
    this.render();
  }

  static async #onCreate() {
    try {
      let entry = null;
      if (this.section === "gigs") entry = await GigOps.create();
      else if (this.section === "screamsheets") entry = await ScreamOps.create();
      else if (this.section === "world") {
        const type = await loreTypeDialog();
        if (!type) return;
        entry = await WorldOps.createLore(type);
        this.go({ section: "world", entryId: entry.id, pageId: null });
        await this.render();
        return LoreEditor.open(JournalStore.recordPage(entry, "lore"));
      } else if (this.section === "characters") {
        const choice = await characterDialog();
        if (!choice) return;
        if (choice === "__all") {
          const n = await WorldOps.characterJournals();
          ui.notifications.info(L("NEONHUB.Journal.Profile.Made", { n }));
          return this.render();
        }
        entry = await WorldOps.characterJournal(actorOf(choice));
      }
      else if (this.section === "story") entry = await Records.newChapter();
      else if (this.section === "journals") entry = await JournalEntry.implementation.createDialog({}, { renderSheet: false });
      if (!entry) return;
      this.go({ section: this.section, entryId: entry.id, pageId: null });
      await this.render();
      if (this.section === "gigs") GigEditor.open(entry);
    } catch (err) {
      ui.notifications.warn(err.message);
    }
  }

  #currentPage() {
    const entry = this.entry;
    if (!entry) return null;
    return entry.pages.get(this.element.querySelector(".nh-jr-page[data-page]")?.dataset.page) ?? null;
  }

  static #onEdit() {
    const page = this.#currentPage();
    if (!page?.isOwner) return;
    const kind = JournalStore.kind(page);
    if (kind === "gig") return GigEditor.open(page.parent);
    if (kind === "session") return SessionEditor.open(page);
    if (kind === "screamsheet") return ScreamEditor.open(page);
    if (kind === "lore") return LoreEditor.open(page);
    if (kind === "profile") return ProfileEditor.open(page);
    if (kind === "diary") return DiaryEditor.open(page);
    if (kind === "downtime") return ui.notifications.info(L("NEONHUB.Journal.RecordFixed"));
    return page.sheet.render(true);
  }

  static async #onAddPage() {
    const entry = this.entry;
    if (!entry?.isOwner) return;
    const page = await JournalEntryPage.implementation.createDialog({}, { parent: entry, renderSheet: false });
    if (!page) return;
    this.go({ section: this.section, entryId: entry.id, pageId: page.id });
    await this.render();
    page.sheet.render(true);
  }

  static async #onAddSession() {
    const entry = this.entry;
    if (!entry) return;
    try {
      const page = await Records.addSession(entry);
      this.go({ section: this.section, entryId: entry.id, pageId: page.id });
      await this.render();
      SessionEditor.open(page);
    } catch (err) {
      ui.notifications.warn(err.message);
    }
  }

  static async #onDeletePage() {
    const page = this.#currentPage();
    if (page?.isOwner) await page.deleteDialog();
  }

  static #onShow() {
    const entry = this.entry;
    if (!entry || !game.user.isGM) return;
    const Collection = foundry.utils.getProperty(globalThis, "foundry.documents.collections.Journal") ?? (typeof Journal === "undefined" ? null : Journal);
    return Collection?.showDialog ? Collection.showDialog(entry) : entry.show(true);
  }

  static #onOwnership() {
    const entry = this.entry;
    if (!entry || !game.user.isGM) return;
    const V2 = foundry.utils.getProperty(globalThis, "foundry.applications.apps.DocumentOwnershipConfig");
    if (V2) return new V2({ document: entry }).render({ force: true });
    if (typeof DocumentOwnershipConfig !== "undefined") return new DocumentOwnershipConfig(entry).render(true);
  }

  static async #onPlayers() {
    const entry = this.entry;
    if (entry && game.user.isGM) await JournalStore.setPlayersSee(entry, !JournalStore.playersSee(entry));
  }

  static async #onRemove() {
    const entry = this.entry;
    if (!entry || !game.user.isGM) return;
    const gone = await entry.deleteDialog();
    if (gone) {
      this.entryId = null;
      this.render();
    }
  }

  static #onClassic() {
    const entry = this.entry;
    const Sheet = coreSheetClass();
    if (!entry || !Sheet) return;
    const sheet = Sheet.prototype instanceof ApplicationV2 ? new Sheet({ document: entry }) : new Sheet(entry);
    sheet.render(true);
  }

  static async #onRename() {
    const entry = this.entry;
    if (!entry?.isOwner) return;
    const name = await Compat.DialogV2.prompt({
      window: { title: L("NEONHUB.Journal.Rename") },
      classes: ["neon-hub", "nh-cal-dialog"],
      content: `<div class="form-group"><input type="text" name="name" value="${esc(entry.name)}" autofocus></div>`,
      ok: { callback: (event, button) => button.form.elements.name.value.trim() },
      rejectClose: false
    });
    if (name) await entry.update({ name });
  }

  static async #onMove(event, target) {
    try {
      await GigOps.move(this.entry, target.dataset.move);
    } catch (err) {
      ui.notifications.warn(err.message);
    }
  }

  static async #onObjective(event, target) {
    if (!game.user.isGM) return;
    const order = ["open", "done", "failed"];
    const id = target.closest("[data-objective]").dataset.objective;
    const state = target.dataset.state ?? order[(order.indexOf(target.closest("[data-objective]").dataset.current) + 1) % 3];
    try {
      await GigOps.setObjective(this.entry, id, state);
    } catch (err) {
      ui.notifications.warn(err.message);
    }
  }

  static async #onPayout() {
    const entry = this.entry;
    if (!entry || !game.user.isGM) return;
    const plan = await payoutDialog(entry);
    if (!plan) return;
    try {
      const lines = await GigOps.payout(entry, plan);
      if (lines.length) ui.notifications.info(L("NEONHUB.Journal.Gig.PaidCount", { n: lines.length }));
    } catch (err) {
      ui.notifications.warn(err.message);
    }
  }

  static async #onPost() {
    try {
      await GigOps.post(this.entry);
    } catch (err) {
      ui.notifications.warn(err.message);
    }
  }

  static async #onOpenActor(event, target) {
    const actor = actorOf(target.dataset.uuid);
    if (actor?.testUserPermission(game.user, "LIMITED")) actor.sheet.render(true);
  }

  static async #onGenerate() {
    const entry = this.entry;
    if (!entry || !game.user.isGM) return;
    try {
      const n = await ScreamOps.generate(entry);
      ui.notifications.info(L("NEONHUB.Journal.Scream.Generated", { n }));
    } catch (err) {
      ui.notifications.warn(err.message);
    }
  }

  static async #onTables() {
    if (game.user.isGM) await generatorDialog();
  }

  static async #onPublish() {
    const entry = this.entry;
    if (!entry || !game.user.isGM) return;
    try {
      const page = JournalStore.recordPage(entry, "screamsheet");
      const resend = !!JournalStore.data(page)?.published;
      const result = await ScreamOps.publish(entry, { resend });
      if (result?.sent) ui.notifications.info(L("NEONHUB.Journal.Scream.SentInboxes", { n: result.sent }));
    } catch (err) {
      ui.notifications.warn(err.message);
    }
  }

  static #onLoreFilter(event, target) {
    this.loreFilter = target.dataset.filter;
    this.render();
  }

  static async #onImportWorldbook() {
    if (!game.user.isGM) return;
    const ok = await Compat.DialogV2.confirm({
      window: { title: L("NEONHUB.Journal.Lore.Import") },
      classes: ["neon-hub", "nh-cal-dialog"],
      content: `<p>${esc(L("NEONHUB.Journal.Lore.ImportBody"))}</p>`,
      rejectClose: false
    });
    if (!ok) return;
    try {
      const n = await WorldOps.importWorldbook();
      ui.notifications.info(L("NEONHUB.Journal.Lore.Imported", { n }));
    } catch (err) {
      ui.notifications.warn(err.message);
    }
  }

  static async #onAddLog() {
    const entry = this.entry;
    if (!entry?.isOwner) return;
    try {
      const page = await WorldOps.addLogEntry(entry);
      this.go({ section: this.section, entryId: entry.id, pageId: page.id });
      await this.render();
      DiaryEditor.open(page);
    } catch (err) {
      ui.notifications.warn(err.message);
    }
  }

  static #onPopout(event, target) {
    const src = target.dataset.src;
    if (!src) return;
    const Popout = Compat.ImagePopout;
    const title = this.entry?.name ?? "";
    if (Popout.prototype instanceof ApplicationV2) new Popout({ src, window: { title } }).render({ force: true });
    else new Popout(src, { title }).render(true);
  }
}

const LORE_ICONS = {
  corporation: "fa-solid fa-building",
  gang: "fa-solid fa-skull-crossbones",
  place: "fa-solid fa-city",
  organization: "fa-solid fa-sitemap",
  person: "fa-solid fa-user-secret"
};

/** GM: which kind of worldbuilding entry to start. */
function loreTypeDialog() {
  return Compat.DialogV2.wait({
    window: { title: L("NEONHUB.Journal.New.world"), icon: "fa-solid fa-earth-americas" },
    classes: ["neon-hub", "nh-cal-dialog", "neon-hub-choose"],
    content: `<p>${esc(L("NEONHUB.Journal.Lore.Pick"))}</p>`,
    buttons: LORE_TYPES.map((type) => ({ action: type, label: L(`NEONHUB.Journal.Lore.Type.${type}`), icon: LORE_ICONS[type] })),
    rejectClose: false
  });
}

/** Whose journal to start: a character (or, for the GM, everyone without one). */
function characterDialog() {
  const list = WorldOps.journalless();
  if (!list.length) {
    ui.notifications.info(L("NEONHUB.Journal.Profile.AllHave"));
    return Promise.resolve(null);
  }
  if (list.length === 1 && !game.user.isGM) return Promise.resolve(list[0].uuid);
  const buttons = list.map((a) => ({ action: a.uuid, label: a.name, icon: "fa-solid fa-id-badge" }));
  if (game.user.isGM && list.length > 1) buttons.push({ action: "__all", label: L("NEONHUB.Journal.Profile.All"), icon: "fa-solid fa-users" });
  return Compat.DialogV2.wait({
    window: { title: L("NEONHUB.Journal.New.characters"), icon: "fa-solid fa-id-badge" },
    classes: ["neon-hub", "nh-cal-dialog", "neon-hub-choose"],
    content: `<p>${esc(L("NEONHUB.Journal.Profile.Pick"))}</p>`,
    buttons,
    rejectClose: false
  });
}

const REWARD_ICONS = {
  eddies: "fa-solid fa-coins",
  item: "fa-solid fa-box-open",
  housing: "fa-solid fa-house",
  ip: "fa-solid fa-arrow-trend-up",
  hqip: "fa-solid fa-house-signal",
  text: "fa-solid fa-quote-left"
};
