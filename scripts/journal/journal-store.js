import { MODULE_ID } from "../constants.js";
import { CalendarStore } from "../calendar/cal-store.js";
import { OWN_SECTIONS, KINDS, normalizeKind, snapshot } from "./journal-data.js";

const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));
const eb = (n) => `${Math.round(Number(n) || 0).toLocaleString(game.i18n.lang)}eb`;

/** Entry flag: which section of the Neon Journal it belongs to. Page flag: its kind and data. */
export const ENTRY_FLAG = "journal";
export const PAGE_FLAG = "page";

const OWNER = () => CONST.DOCUMENT_OWNERSHIP_LEVELS;

/** World actor for a uuid. */
export function actorOf(uuid) {
  const id = /^Actor\.([^.]+)$/.exec(uuid ?? "")?.[1];
  return id ? game.actors.get(id) ?? null : null;
}

/** "14 Mar 2045" for a calendar date. */
export function formatDate(d) {
  return d?.year ? `${d.day} ${L(`NEONHUB.Calendar.MonthShort.${d.month}`)} ${d.year}` : "";
}

/**
 * Journal entries and pages that hold Neon Journal records. Records are text pages: the data in
 * the page's flags, a readable copy in its text (see snapshot).
 */
export const JournalStore = {
  /** The section an entry belongs to: one of Neon Hub's, or "journals". */
  section(entry) {
    const s = entry?.getFlag?.(MODULE_ID, ENTRY_FLAG)?.section;
    return OWN_SECTIONS.includes(s) ? s : "journals";
  },

  /** A page's kind ("gig", "session", "downtime") or null for Foundry's own pages. */
  kind(page) {
    const k = page?.getFlag?.(MODULE_ID, PAGE_FLAG)?.kind;
    return KINDS.includes(k) ? k : null;
  },

  /** A page's record, normalized for its kind. */
  data(page) {
    const kind = this.kind(page);
    return kind ? normalizeKind(kind, page.getFlag(MODULE_ID, PAGE_FLAG)?.data) : null;
  },

  /** The page holding an entry's record of a kind (a gig's gig page). */
  recordPage(entry, kind) {
    return entry?.pages?.contents.sort((a, b) => a.sort - b.sort).find((p) => this.kind(p) === kind) ?? null;
  },

  /** Entries in a section this user can see, newest first for records, by name otherwise. */
  entries(section, user = game.user) {
    const list = game.journal.filter((e) => this.section(e) === section && e.testUserPermission(user, "LIMITED"));
    if (section === "journals") return list.sort((a, b) => (a.folder?.name ?? "").localeCompare(b.folder?.name ?? "") || a.sort - b.sort || a.name.localeCompare(b.name));
    return list.sort((a, b) => (b.getFlag(MODULE_ID, ENTRY_FLAG)?.created ?? 0) - (a.getFlag(MODULE_ID, ENTRY_FLAG)?.created ?? 0));
  },

  /** Today's in-world date for a set of characters (their calendar, else the first one). */
  today(actors = []) {
    const actor = actors.map((a) => (typeof a === "string" ? actorOf(a) : a)).find(Boolean);
    const cal = actor ? CalendarStore.forActor(actor) : CalendarStore.all()[0];
    return cal ? { year: cal.year, month: cal.month, day: cal.day } : null;
  },

  /** The readable text of a record. */
  snapshot(kind, data) {
    const names = {};
    for (const uuid of data.crew ?? []) names[uuid] = actorOf(uuid)?.name ?? "";
    return snapshot(kind, data, L, { names, rewards: (w) => this.rewardLabel(w) });
  },

  /** "500eb each", "Kiroshi Optics", "10 HQ IP (Afterlife Crew)". */
  rewardLabel(w) {
    switch (w.kind) {
      case "eddies": return L(w.split === "split" ? "NEONHUB.Journal.Reward.EddiesSplit" : "NEONHUB.Journal.Reward.EddiesEach", { amount: eb(w.amount) });
      case "ip": return L("NEONHUB.Journal.Reward.IPEach", { amount: w.amount });
      case "hqip": return L("NEONHUB.Journal.Reward.HQIP", { amount: w.amount, hq: game.modules.get(MODULE_ID)?.api?.getHQ?.(w.hq)?.name ?? "?" });
      case "item": return w.name || L("NEONHUB.Journal.Reward.Kind.item");
      case "housing": return w.name || L("NEONHUB.Journal.Reward.Kind.housing");
      default: return w.text;
    }
  },

  /* ---------------------------------------- */
  /*  Writing                                 */
  /* ---------------------------------------- */

  /** The folder Neon Hub files a section's entries in, made on first use. */
  async folder(section) {
    const name = L(`NEONHUB.Journal.Folder.${section}`);
    const found = game.folders.find((f) => f.type === "JournalEntry" && f.getFlag(MODULE_ID, ENTRY_FLAG)?.section === section)
      ?? game.folders.find((f) => f.type === "JournalEntry" && f.name === name && !f.folder);
    if (found) return found;
    return Folder.implementation.create({ name, type: "JournalEntry", color: "#ff2a6d", flags: { [MODULE_ID]: { [ENTRY_FLAG]: { section } } } });
  },

  /**
   * A new entry in a section, with a record page of a kind (or none).
   * @param {string} section
   * @param {{ name: string, kind?: string, data?: object, players?: boolean, pages?: object[] }} options
   */
  async createEntry(section, { name, kind = null, data = {}, players = false, pages = [] } = {}) {
    const folder = await this.folder(section);
    const own = OWNER();
    const recordPages = kind ? [this.pageData(kind, name, data)] : [];
    return JournalEntry.implementation.create({
      name,
      folder: folder?.id ?? null,
      ownership: { default: players ? own.OBSERVER : own.NONE },
      flags: { [MODULE_ID]: { [ENTRY_FLAG]: { section, created: Date.now() } } },
      pages: [...recordPages, ...pages]
    });
  },

  /** Data for a new record page. */
  pageData(kind, name, data) {
    const normalized = normalizeKind(kind, data);
    return {
      name,
      type: "text",
      text: { content: this.snapshot(kind, normalized), format: CONST.JOURNAL_ENTRY_PAGE_FORMATS?.HTML ?? 1 },
      flags: { [MODULE_ID]: { [PAGE_FLAG]: { kind, data: normalized } } }
    };
  },

  /** Add a record page to an entry. */
  async addPage(entry, kind, name, data) {
    const [page] = await entry.createEmbeddedDocuments("JournalEntryPage", [{ ...this.pageData(kind, name, data), sort: (Math.max(0, ...entry.pages.map((p) => p.sort)) + 100000) }]);
    return page;
  },

  /** Save a record page's data (whole), and its readable text. */
  async save(page, data, extra = {}) {
    const kind = this.kind(page);
    const normalized = normalizeKind(kind, data);
    await page.update({
      [`flags.${MODULE_ID}.${PAGE_FLAG}`]: { kind, data: normalized },
      "text.content": this.snapshot(kind, normalized),
      ...extra
    });
    return normalized;
  },

  /** All players can see an entry (its default permission): what the eye button toggles. */
  playersSee(entry) {
    return (entry.ownership?.default ?? 0) >= OWNER().LIMITED;
  },

  /** Any player can see an entry, by default or by their own permission. */
  anyPlayerSees(entry) {
    if (this.playersSee(entry)) return true;
    const own = entry.ownership ?? {};
    return game.users.some((u) => !u.isGM && (own[u.id] ?? -1) >= OWNER().LIMITED);
  },

  async setPlayersSee(entry, on) {
    const own = OWNER();
    return entry.update({ "ownership.default": on ? own.OBSERVER : own.NONE });
  }
};
