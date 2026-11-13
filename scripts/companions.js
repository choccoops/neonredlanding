import { MODULE_ID, COMBAT_ID, HOME_ID, COMPANION_MODULES, COMPANION_WINDOWS } from "./constants.js";

const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));

/**
 * The other Neon modules' windows (Neon Combat Manager, Neon At Home). Each ships a Macros compendium with one macro
 * per window, meant for the hotbar, its Action HUD, hub buttons and active tiles. A hub button calls the same API the
 * macro does, here on the clicking client, so it needs no macro imported into the world.
 */
export const COMPANION_CALLS = {
  [`${COMBAT_ID}/map`]: (api) => api.hub.open(),
  [`${COMBAT_ID}/holocall`]: (api, actor) => api.holocall.open(actor),
  [`${COMBAT_ID}/biomon`]: (api) => api.biomon.open(),
  [`${COMBAT_ID}/stakes`]: (api, actor) => api.stakes.open(actor),
  [`${COMBAT_ID}/rebuilds`]: (api, actor) => api.arsenal.menu(actor),
  [`${COMBAT_ID}/lab`]: (api) => api.conditions.openLab(),
  [`${COMBAT_ID}/arsenal`]: (api) => api.arsenal.install(),
  [`${HOME_ID}/home`]: (api, actor) => api.open(actor),
  [`${HOME_ID}/loadout`]: (api, actor) => api.open(actor, "loadout"),
  [`${HOME_ID}/deck`]: (api, actor) => api.open(actor, "deck"),
  [`${HOME_ID}/bay`]: (api, actor) => api.open(actor, "bay"),
  [`${HOME_ID}/bench`]: (api, actor) => api.open(actor, "bench"),
  [`${HOME_ID}/maintenance`]: (api, actor) => api.open(actor, "maintenance"),
  [`${HOME_ID}/downtime`]: (api, actor) => api.open(actor, "downtime"),
  [`${HOME_ID}/biomonitor`]: (api, actor) => api.biomonitor(actor),
  [`${HOME_ID}/deepDive`]: (api, actor) => api.deepDive(actor),
  [`${HOME_ID}/perkTree`]: (api, actor) => api.perkTree(actor),
  [`${HOME_ID}/spendIp`]: (api, actor) => api.spendIp(actor)
};

export const Companions = {
  /** Is the window's module active, with its API up? */
  available(key) {
    const w = COMPANION_WINDOWS[key];
    const mod = w && game.modules.get(w.module);
    return !!(mod?.active && mod.api);
  },

  moduleName(id) {
    return L(COMPANION_MODULES[id] ?? id);
  },

  label(key) {
    const w = COMPANION_WINDOWS[key];
    return w ? L(`NEONHUB.Companion.Window.${key.split("/")[1]}`) : key;
  },

  /** Every window, grouped by module: [{ module, name, active, windows: [{ key, label, gm }] }]. */
  groups() {
    return Object.keys(COMPANION_MODULES).map((id) => ({
      module: id,
      name: this.moduleName(id),
      active: !!game.modules.get(id)?.active,
      windows: Object.entries(COMPANION_WINDOWS)
        .filter(([, w]) => w.module === id)
        .map(([key, w]) => ({ key, label: this.label(key), gm: !!w.gm }))
    }));
  },

  /** Open a companion window on this client, as its macro would: for the selected token's character, else your own. */
  open(key) {
    const w = COMPANION_WINDOWS[key];
    if (!w) return null;
    if (!this.available(key)) {
      ui.notifications.warn(L("NEONHUB.Companion.Missing", { module: this.moduleName(w.module) }));
      return null;
    }
    if (w.gm && !game.user.isGM) {
      ui.notifications.warn(L("NEONHUB.Companion.GMOnly", { window: this.label(key) }));
      return null;
    }
    const actor = w.actor ? canvas?.tokens?.controlled?.map((t) => t.actor).find((a) => a?.isOwner) ?? game.user.character ?? null : null;
    try {
      return COMPANION_CALLS[key](game.modules.get(w.module).api, actor);
    } catch (err) {
      console.error(`${MODULE_ID} | couldn't open ${key}`, err);
      ui.notifications.error(L("NEONHUB.Companion.Failed", { window: this.label(key) }));
      return null;
    }
  }
};
