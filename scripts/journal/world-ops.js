import { MODULE_ID } from "../constants.js";
import { HubSocket } from "../socket.js";
import { LifestyleStore } from "../lifestyle/ls-store.js";
import { LORE_TYPES, loreTemplate } from "./journal-data.js";
import { JournalStore, ENTRY_FLAG, actorOf, formatDate } from "./journal-store.js";

const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));
const esc = (s) => Handlebars.escapeExpression(String(s ?? ""));

export const WORLDBOOK_PACK = `${MODULE_ID}.worldbook-2070`;

/** An outline to start a new entry's write-up from. */
function outline(type) {
  const h = (k) => `<h2>${esc(L(`NEONHUB.Journal.Lore.Outline.${k}`))}</h2><p></p>`;
  const secret = `<section class="secret"><h2>${esc(L("NEONHUB.Journal.Lore.Outline.Secrets"))}</h2><p></p></section>`;
  const parts = { person: ["Who", "Wants", "Hooks"], place: ["Overview", "People", "Hooks"] }[type] ?? ["Overview", "History", "Hooks"];
  return parts.map(h).join("") + secret;
}

/**
 * Worldbuilding (corporations, gangs, places, organizations, people), and each player character's
 * own journal.
 */
export const WorldOps = {
  init() {
    // Players can't make journal entries themselves: the GM makes a character's journal for its owner.
    HubSocket.register("journal.character", async ({ actor }, user) => {
      const a = actorOf(actor);
      if (!a || !(user.isGM || a.testUserPermission(user, "OWNER"))) throw new Error(L("NEONHUB.Error.NotAllowed"));
      const entry = await this.characterJournal(a);
      return entry.uuid;
    });
  },

  /* ---------------------------------------- */
  /*  Worldbuilding                           */
  /* ---------------------------------------- */

  /** GM: a new worldbuilding entry of a type, from its template. */
  async createLore(type, name = "") {
    if (!game.user.isGM) throw new Error(L("NEONHUB.Error.GMOnly"));
    if (!LORE_TYPES.includes(type)) type = "organization";
    return JournalStore.createEntry("world", {
      name: name || L(`NEONHUB.Journal.Lore.New.${type}`),
      kind: "lore",
      data: { type, facts: loreTemplate(type, (k) => L(`NEONHUB.Journal.Lore.Fact.${k}`)), body: outline(type) }
    });
  },

  /** The Worldbook compendium, if it's there. */
  get worldbook() {
    return game.packs.get(WORLDBOOK_PACK) ?? null;
  },

  /**
   * GM: copy the Worldbook compendium's entries into the world, under Worldbuilding (one folder per
   * kind). Entries already brought in are skipped.
   * @returns {Promise<number>} how many were added
   */
  async importWorldbook() {
    if (!game.user.isGM) throw new Error(L("NEONHUB.Error.GMOnly"));
    const pack = this.worldbook;
    if (!pack) throw new Error(L("NEONHUB.Journal.Lore.Error.NoPack"));
    const have = new Set(game.journal.map((e) => e.getFlag(MODULE_ID, ENTRY_FLAG)?.source).filter(Boolean));
    const docs = (await pack.getDocuments()).filter((d) => !have.has(d.uuid));
    if (!docs.length) return 0;
    const root = await JournalStore.folder("world");
    const folders = {};
    for (const type of LORE_TYPES) {
      const name = L(`NEONHUB.Journal.Lore.Plural.${type}`);
      folders[type] = game.folders.find((f) => f.type === "JournalEntry" && f.folder?.id === root.id && f.name === name)
        ?? await Folder.implementation.create({ name, type: "JournalEntry", folder: root.id, color: "#05d9e8" });
    }
    const data = docs.map((d) => {
      const obj = d.toObject();
      const lore = d.pages.find((p) => JournalStore.kind(p) === "lore");
      const type = lore ? JournalStore.data(lore).type : "organization";
      delete obj._id;
      obj.folder = folders[type]?.id ?? root.id;
      obj.ownership = { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE };
      foundry.utils.setProperty(obj, `flags.${MODULE_ID}.${ENTRY_FLAG}`, { section: "world", created: Date.now(), source: d.uuid });
      return obj;
    });
    const created = await JournalEntry.implementation.createDocuments(data);
    return created.length;
  },

  /* ---------------------------------------- */
  /*  Characters' journals                    */
  /* ---------------------------------------- */

  /** A character's journal entry, if they have one. */
  journalOf(actor) {
    const uuid = typeof actor === "string" ? actor : actor?.uuid;
    return game.journal.find((e) => JournalStore.section(e) === "characters" && e.getFlag(MODULE_ID, ENTRY_FLAG)?.actor === uuid) ?? null;
  },

  /**
   * A character's journal: theirs to write in (their players own it), the GM's to read. Made on
   * first use: from a player's client it's made by the GM.
   */
  async characterJournal(actor) {
    const existing = this.journalOf(actor);
    if (existing) return existing;
    if (!game.user.isGM) {
      const uuid = await HubSocket.request("journal.character", { actor: actor.uuid });
      return fromUuid(uuid);
    }
    const own = CONST.DOCUMENT_OWNERSHIP_LEVELS;
    const ownership = { default: own.NONE };
    for (const u of game.users) if (!u.isGM && actor.testUserPermission(u, "OWNER")) ownership[u.id] = own.OWNER;
    const folder = await JournalStore.folder("characters");
    const profile = JournalStore.pageData("profile", L("NEONHUB.Journal.Profile.Name"), { actor: actor.uuid, handle: actor.name });
    return JournalEntry.implementation.create({
      name: actor.name,
      folder: folder?.id ?? null,
      ownership,
      flags: { [MODULE_ID]: { [ENTRY_FLAG]: { section: "characters", created: Date.now(), actor: actor.uuid } } },
      pages: [profile]
    });
  },

  /** GM: a journal for every player character that hasn't got one. */
  async characterJournals() {
    if (!game.user.isGM) throw new Error(L("NEONHUB.Error.GMOnly"));
    let n = 0;
    for (const actor of LifestyleStore.characters()) {
      if (this.journalOf(actor)) continue;
      await this.characterJournal(actor);
      n++;
    }
    return n;
  },

  /** Characters this user can start a journal for (theirs, or any for the GM) that haven't one. */
  journalless() {
    return LifestyleStore.characters().filter((a) => (game.user.isGM || a.isOwner) && !this.journalOf(a));
  },

  /** A new log entry in a character's journal, dated on their calendar. */
  async addLogEntry(entry) {
    if (!entry?.isOwner) throw new Error(L("NEONHUB.Error.NotAllowed"));
    const actor = actorOf(entry.getFlag(MODULE_ID, ENTRY_FLAG)?.actor);
    const date = formatDate(JournalStore.today(actor ? [actor] : []));
    return JournalStore.addPage(entry, "diary", date ? L("NEONHUB.Journal.Diary.Name", { date }) : L("NEONHUB.Journal.Diary.Untitled"), { date });
  }
};
