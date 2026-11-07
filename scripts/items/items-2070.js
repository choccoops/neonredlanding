import { MODULE_ID, SYSTEM_ID } from "../constants.js";
import { Compat } from "../compat.js";

const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));

export const ITEMS_PACK = `${MODULE_ID}.items-2070`;
export const RIDES_PACK = `${MODULE_ID}.rides-2070`;
export const DV_PACK = `${MODULE_ID}.dv-tables-2070`;
export const VAS_ID = "mmutons-cyberpunk-red-vas";
const OFFERED_SETTING = "dvTablesOffered";
/** CPR's own setting for the compendium its DV tables come from (CPR 0.92.4). */
const CPR_DV_SETTING = "dvRollTableCompendium";
const CPR_DV_DEFAULT = "cyberpunk-red-core.internal_dv-tables";

/**
 * The 2070s Item Compendium in Foundry: items, rides (vehicles, ACPAs and cyberpets, set up for
 * MMuton's vehicle sheet) and the 2070 Core Rules' range tables as DV tables. The packs are data; this
 * offers the GM the range tables once and gives macros a switch for them.
 */
export const Items2070 = {
  register() {
    game.settings.register(MODULE_ID, OFFERED_SETTING, { scope: "world", config: false, type: Boolean, default: false });
  },

  /** Which DV table compendium CPR reads, or null if the setting isn't there. */
  get dvCompendium() {
    try {
      return game.settings.get(SYSTEM_ID, CPR_DV_SETTING);
    } catch {
      return null;
    }
  },

  get usingDvTables() {
    return this.dvCompendium === DV_PACK;
  },

  /** GM: point CPR at the 2070 range tables (true) or back at its own (false). */
  async useDvTables(on = true) {
    if (!game.user.isGM) throw new Error(L("NEONHUB.Error.GMOnly"));
    if (this.dvCompendium === null) throw new Error(L("NEONHUB.Items.NoDvSetting"));
    await game.settings.set(SYSTEM_ID, CPR_DV_SETTING, on ? DV_PACK : CPR_DV_DEFAULT);
    ui.notifications.info(L(on ? "NEONHUB.Items.DvOn" : "NEONHUB.Items.DvOff"));
  },

  /** On the GM's first load with these packs: offer the 2070 range tables, once. */
  async offer() {
    if (!game.user.isGM || game.settings.get(MODULE_ID, OFFERED_SETTING) || this.dvCompendium === null || this.usingDvTables) return;
    if (!game.packs.get(DV_PACK)) return;
    await game.settings.set(MODULE_ID, OFFERED_SETTING, true);
    const yes = await Compat.DialogV2.confirm({
      window: { title: L("NEONHUB.Items.OfferTitle"), icon: "fa-solid fa-crosshairs" },
      classes: ["neon-hub", "nh-cal-dialog"],
      content: `<p>${L("NEONHUB.Items.OfferBody")}</p>${game.modules.get(VAS_ID)?.active ? "" : `<p class="hint">${L("NEONHUB.Items.NoVas")}</p>`}`,
      rejectClose: false
    });
    if (yes) await this.useDvTables(true);
  }
};
