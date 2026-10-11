import { MODULE_ID } from "../constants.js";
import { CalendarStore } from "./cal-store.js";
import { normalizeNote, canView, canEdit, onDay, sortNotes } from "./cal-notes-data.js";

const { deepClone } = foundry.utils;

export const NOTES_SETTING = "calendarNotes";
const USER_FLAG = "calendarNotes";

/**
 * Where notes live. The GM's notes are in a world setting (only GMs write those).
 * Each player's notes are in a flag on their own User, which they can write
 * without a GM online. Hiding is done in the interface: Foundry sends world
 * settings and users to every client, so hidden notes aren't secret from someone
 * reading the game data directly.
 */
export const NotesStore = {
  register() {
    game.settings.register(MODULE_ID, NOTES_SETTING, {
      scope: "world",
      config: false,
      type: Object,
      default: { list: [] },
      onChange: () => Hooks.callAll(`${MODULE_ID}.calendarNotesChanged`)
    });
  },

  _gmNotes() {
    let raw;
    try {
      raw = game.settings.get(MODULE_ID, NOTES_SETTING);
    } catch {
      return [];
    }
    return (raw?.list ?? []).map((n) => normalizeNote({ ...n, gm: true }));
  },

  _userNotes(user) {
    const list = user.getFlag(MODULE_ID, USER_FLAG);
    return (Array.isArray(list) ? list : []).map((n) => normalizeNote({ ...n, gm: false, author: user.id }));
  },

  /** Every note in the world. */
  all() {
    const notes = this._gmNotes();
    for (const user of game.users) if (!user.isGM) notes.push(...this._userNotes(user));
    return notes;
  },

  viewer(user = game.user) {
    return { userId: user.id, isGM: user.isGM };
  },

  /** Notes on a calendar this user can read, optionally on one day. */
  visible(calendar, date = null, user = game.user) {
    if (!calendar) return [];
    const viewer = { ...this.viewer(user), inGroup: CalendarStore.canSee(calendar, user) };
    const notes = this.all().filter((n) => n.calendarId === calendar.id && canView(n, viewer) && (!date || onDay(n, date)));
    return sortNotes(notes);
  },

  canEdit(note, user = game.user) {
    return canEdit(note, this.viewer(user));
  },

  /** Author's display name, for players' notes. */
  authorName(note) {
    if (note.gm) return game.i18n.localize("NEONHUB.Calendar.Notes.GM");
    return game.users.get(note.author)?.name ?? "?";
  },

  /* ---------------------------------------- */
  /*  Writing                                 */
  /* ---------------------------------------- */

  /** Add a note as this user: the GM's go to the world, a player's to their own User. */
  async create(calendar, date, { title = "", text = "", shared = false } = {}) {
    const note = normalizeNote({
      id: foundry.utils.randomID(12),
      calendarId: calendar.id,
      ...date,
      title,
      text,
      shared,
      author: game.user.id,
      gm: game.user.isGM,
      at: Date.now()
    });
    if (!note.title && !note.text.trim()) return null;
    if (note.gm) await this._writeGM((list) => list.push(note));
    else await this._writeUser(game.user, (list) => list.push(note));
    return note;
  },

  async update(note, changes) {
    if (!this.canEdit(note)) throw new Error(game.i18n.localize("NEONHUB.Error.NotAllowed"));
    const apply = (list) => {
      const target = list.find((n) => n.id === note.id);
      if (target) Object.assign(target, normalizeNote({ ...target, ...changes, id: target.id }));
    };
    if (note.gm) return this._writeGM(apply);
    return this._writeUser(game.users.get(note.author), apply);
  },

  async remove(note) {
    if (!this.canEdit(note)) throw new Error(game.i18n.localize("NEONHUB.Error.NotAllowed"));
    const drop = (list) => {
      const i = list.findIndex((n) => n.id === note.id);
      if (i >= 0) list.splice(i, 1);
    };
    if (note.gm) return this._writeGM(drop);
    return this._writeUser(game.users.get(note.author), drop);
  },

  /** GM: when a calendar is deleted, its notes go too. */
  async removeCalendar(calendarId) {
    if (!game.user.isGM) return;
    await this._writeGM((list) => {
      for (let i = list.length - 1; i >= 0; i--) if (list[i].calendarId === calendarId) list.splice(i, 1);
    });
    for (const user of game.users) {
      if (user.isGM || !this._userNotes(user).some((n) => n.calendarId === calendarId)) continue;
      await this._writeUser(user, (list) => {
        for (let i = list.length - 1; i >= 0; i--) if (list[i].calendarId === calendarId) list.splice(i, 1);
      });
    }
  },

  async _writeGM(fn) {
    if (!game.user.isGM) throw new Error(game.i18n.localize("NEONHUB.Error.GMOnly"));
    const list = deepClone(game.settings.get(MODULE_ID, NOTES_SETTING)?.list ?? []);
    fn(list);
    await game.settings.set(MODULE_ID, NOTES_SETTING, { list: list.map((n) => normalizeNote({ ...n, gm: true })) });
  },

  async _writeUser(user, fn) {
    if (!user) throw new Error(game.i18n.localize("NEONHUB.Error.NotAllowed"));
    if (!game.user.isGM && user.id !== game.user.id) throw new Error(game.i18n.localize("NEONHUB.Error.NotAllowed"));
    const list = deepClone(this._userNotes(user));
    fn(list);
    await user.setFlag(MODULE_ID, USER_FLAG, list.map((n) => {
      const { gm, ...rest } = normalizeNote(n);
      return rest;
    }));
  }
};
