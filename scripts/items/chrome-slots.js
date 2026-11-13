import { MODULE_ID } from "../constants.js";
import { Compat } from "../compat.js";

const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));

/**
 * Chrome takes upgrades (2070 Core Rules Ch09: every piece has one Enhancement slot, which is also
 * where an Operating System goes). Cyberpunk RED only lets an upgrade into an item whose
 * "installed items" switch is on, and the Item Compendium's chrome used to ship with it off, so a
 * Sandevistan had to be edited before its Operating System would go in. The compendium now ships
 * it on; this brings the copies already in a world (on sheets, on tokens, in the Items sidebar) up
 * to date, once, and catches older copies as they're dropped on a sheet.
 */
export const SLOTS_SETTING = "chromeSlotsMigration";
/** Raise to run the fix-up again in every world. */
export const SLOTS_VERSION = 1;
/** Cyberfingers have no Enhancement slot: they're the modular part. */
export const NO_ENHANCEMENT = /cyberfinger/i;

/** Is this one of the 2070 Item Compendium's pieces of chrome? */
const ours = (item) => item?.type === "cyberware" && !!item.flags?.[MODULE_ID]?.source2070;

/**
 * What to change on a piece of chrome so upgrades can go in, pure: an update ({ path: value }) or
 * null when it's already open (or has no Enhancement slot, or isn't ours).
 */
export function slotFix(item) {
  if (!ours(item) || NO_ENHANCEMENT.test(item.name ?? "")) return null;
  const ii = item.system?.installedItems ?? {};
  const types = Array.isArray(ii.allowedTypes) ? ii.allowedTypes : [];
  const out = {};
  if (!ii.allowed) out["system.installedItems.allowed"] = true;
  if (!types.includes("itemUpgrade")) out["system.installedItems.allowedTypes"] = [...types, "itemUpgrade"];
  return Object.keys(out).length ? out : null;
}

export const ChromeSlots = {
  init() {
    game.settings.register(MODULE_ID, SLOTS_SETTING, { scope: "world", config: false, type: Number, default: 0 });
    // An older copy (a world compendium, another world's export) arriving on a sheet or in the sidebar.
    Hooks.on("preCreateItem", (item) => {
      const fix = slotFix(item);
      if (fix) item.updateSource(fix);
    });
  },

  /** Once per world (and per SLOTS_VERSION), on the active GM's client. */
  async ready() {
    if (Compat.activeGM?.id !== game.user.id) return;
    if ((Number(game.settings.get(MODULE_ID, SLOTS_SETTING)) || 0) >= SLOTS_VERSION) return;
    const n = await this.migrate();
    await game.settings.set(MODULE_ID, SLOTS_SETTING, SLOTS_VERSION);
    if (n) ui.notifications.info(L("NEONHUB.ChromeSlots.Fixed", { count: n }));
  },

  /** Every actor the world has: the sidebar's, and each unlinked token's own copy. */
  actors() {
    const out = [...(game.actors ?? [])];
    for (const scene of game.scenes ?? []) {
      for (const tok of scene.tokens ?? []) if (!tok.actorLink && tok.actor) out.push(tok.actor);
    }
    return out;
  },

  /** GM: open every 2070 piece of chrome in the world to upgrades. Returns how many were changed. */
  async migrate() {
    if (!game.user.isGM) return 0;
    let n = 0;
    for (const item of game.items ?? []) {
      const fix = slotFix(item);
      if (!fix) continue;
      await item.update(fix);
      n++;
    }
    for (const actor of this.actors()) {
      const updates = [...(actor.items ?? [])].map((i) => ({ fix: slotFix(i), id: i.id })).filter((u) => u.fix).map((u) => ({ _id: u.id, ...u.fix }));
      if (!updates.length) continue;
      try {
        await actor.updateEmbeddedDocuments("Item", updates);
        n += updates.length;
      } catch (err) {
        console.warn(`${MODULE_ID} | chrome upgrade slots: ${actor.name}`, err);
      }
    }
    return n;
  }
};
