import { MODULE_ID, MESSENGER_VIEWS } from "./constants.js";

/**
 * Night City Messenger (christinophrappuccino, MIT) is a separate module with its own
 * look. When it's installed and active, Neon Hub opens its windows from hub buttons and
 * the API. Its global is game.nightcity; the launchers below are the ones its own
 * toolbar buttons call.
 */
export const MESSENGER_ID = "night-city-messenger";

const LAUNCHERS = {
  inbox: (nc) => (nc.openNCM ?? nc.openInbox)?.call(nc),
  compose: (nc) => nc.composeMessage?.(),
  contacts: (nc) => nc.openContacts?.(),
  networks: (nc) => nc.openNetworkManagement?.(),
  admin: (nc) => nc.openAdmin?.()
};

export const Messenger = {
  get installed() {
    return !!game.modules.get(MESSENGER_ID)?.active;
  },

  /** Active and booted (its global exists). */
  get ready() {
    return this.installed && !!globalThis.game?.nightcity;
  },

  /**
   * Open a messenger window on this client. GM-only windows (networks, admin) fall
   * back to the inbox for players.
   * @param {"inbox"|"compose"|"contacts"|"networks"|"admin"} view
   */
  open(view = "inbox") {
    if (!this.ready) {
      ui.notifications.warn(game.i18n.localize(this.installed ? "NEONHUB.Messenger.NotReady" : "NEONHUB.Messenger.Missing"));
      return null;
    }
    let key = MESSENGER_VIEWS[view] ? view : "inbox";
    if (MESSENGER_VIEWS[key].gm && !game.user.isGM) key = "inbox";
    try {
      return LAUNCHERS[key](game.nightcity);
    } catch (err) {
      console.error(`${MODULE_ID} | couldn't open Night City Messenger (${key})`, err);
      ui.notifications.error(game.i18n.localize("NEONHUB.Messenger.Failed"));
      return null;
    }
  }
};
