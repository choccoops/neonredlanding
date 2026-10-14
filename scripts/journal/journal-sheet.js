import { MODULE_ID } from "../constants.js";
import { NeonJournal } from "./journal-app.js";

/** Foundry's journal sheet class: v12's global, or v13's AppV2 one. */
function coreJournalSheet() {
  return foundry.utils.getProperty(globalThis, "foundry.applications.sheets.journal.JournalEntrySheet")
    ?? (typeof JournalSheet === "undefined" ? null : JournalSheet);
}

function sheetConfig() {
  return foundry.utils.getProperty(globalThis, "foundry.applications.apps.DocumentSheetConfig")
    ?? (typeof DocumentSheetConfig === "undefined" ? null : DocumentSheetConfig);
}

/**
 * The Neon Journal takes over opening journals: a journal sheet that, instead of drawing itself,
 * opens the entry in the Neon Journal. Everything Foundry does to open a journal (the sidebar,
 * links, "Show players") goes through the entry's sheet, so it all lands there. With the setting
 * off it's Foundry's own sheet.
 */
export const JournalTakeover = {
  register() {
    game.settings.register(MODULE_ID, "journalTakeover", {
      name: "NEONHUB.Journal.Setting.Takeover",
      hint: "NEONHUB.Journal.Setting.TakeoverHint",
      scope: "client",
      config: true,
      type: Boolean,
      default: true
    });

    const Base = coreJournalSheet();
    const Config = sheetConfig();
    if (!Base || !Config) return;

    class NeonJournalSheet extends Base {
      render(...args) {
        // Compendium entries (and anything else not in the world's journal) open as usual.
        if (!NeonJournal.enabled || this.document.pack || !game.journal.has(this.document.id)) return super.render(...args);
        // v12 sheets take (force, options); v13's one options object.
        let [force, options = {}] = args;
        if (force && typeof force === "object") {
          options = force;
          force = options.force;
        }
        // Only a deliberate open (render(true)); refreshes have nothing to draw here.
        if (force) {
          NeonJournal.open(this.document, { pageId: options.pageId ?? null, temp: !!options.tempOwnership }).catch((err) => console.error(`${MODULE_ID} | couldn't open the Neon Journal`, err));
        }
        return this;
      }
    }

    Config.registerSheet(JournalEntry, MODULE_ID, NeonJournalSheet, { label: "NEONHUB.Journal.SheetLabel", makeDefault: true });
  }
};
