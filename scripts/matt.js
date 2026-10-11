import { MODULE_ID, MATT_ID, MARKET_ID, MESSENGER_VIEWS } from "./constants.js";
import { HubSocket } from "./socket.js";
import { HQStore } from "./hq/hq-data.js";

/**
 * Everything that knows Monk's Active Tile Triggers' data format.
 *
 * Action shapes were read from MATT 12.02 (the last release for Foundry v12) and
 * checked unchanged in MATT 14.01, so tiles built now keep working after the upgrade.
 * Entity references are stored the way MATT's own action editor stores them: { id: <uuid>, name }.
 */
export const MATT = {
  get active() {
    return !!game.modules.get(MATT_ID)?.active;
  },

  get version() {
    return game.modules.get(MATT_ID)?.version ?? "";
  },

  /** Custom action keys this module registers inside MATT. */
  ACTION_SHOP: `${MODULE_ID}.openshop`,
  ACTION_HQ: `${MODULE_ID}.openhq`,
  ACTION_LIFESTYLE: `${MODULE_ID}.openlifestyle`,
  ACTION_CALENDAR: `${MODULE_ID}.opencalendar`,
  ACTION_MESSENGER: `${MODULE_ID}.openmessenger`,

  makeId() {
    return foundry.utils.randomID(16);
  },

  ref(uuid, name = "") {
    return { id: uuid, name: name || this.nameOf(uuid) };
  },

  nameOf(uuid) {
    try {
      return fromUuidSync(uuid)?.name ?? "";
    } catch {
      return "";
    }
  },

  /** Triggers a working hub button listens to. */
  BUTTON_TRIGGERS: ["click", "hoverin", "hoverout"],

  /**
   * Wrap a button's actions in MATT landings (anchor actions) so one tile can answer
   * clicks and hovers. MATT starts a trigger after the landing named "_" + its trigger,
   * and a landing with "stop when reached" ends the run:
   *   [_click] actions… [_hoverin, stop] [_hoverout, stop]
   * Clicks run the actions; hovers run nothing. (Hover triggers are what put a tile in
   * MATT's hover list, which is where its pointer cursor is applied. The lit image is
   * swapped on each player's own screen by Neon Hub, see hub/hover.js.)
   */
  withLandings(actions) {
    if (!actions.length) return actions;
    const landing = (tag, stop) => ({ id: this.makeId(), action: "anchor", data: { tag, stop } });
    return [landing("_click", false), ...actions, landing("_hoverin", true), landing("_hoverout", true)];
  },

  /**
   * Tile flags for a clickable hub button. Mirrors what MATT itself writes when it
   * creates a click tile from a dropped Scene or Macro, plus the pointer cursor and
   * "works while paused" switches a hub needs. Working buttons also listen to hover,
   * which is what makes MATT show its pointer cursor over them.
   */
  tileFlags(actions, { gmOnly = false } = {}) {
    const live = actions.length > 0;
    return {
      active: live,
      trigger: live ? [...this.BUTTON_TRIGGERS] : "click",
      restriction: "all",
      controlled: gmOnly ? "gm" : "all",
      pertoken: false,
      minrequired: 0,
      chance: 100,
      allowpaused: true,
      pointer: true,
      usealpha: false,
      vision: false,
      record: false,
      actions: this.withLandings(actions)
    };
  },

  /**
   * Turn one hub button into a MATT action list.
   * @param {object} button - a normalized hub button (see hub-data.js)
   * @param {object} hub - the hub it belongs to (for the shared click sound)
   * @returns {object[]} MATT actions, empty for a decorative button
   */
  buildActions(button, hub = {}) {
    const a = button.action ?? {};
    const actions = [];
    const push = (action, data) => actions.push({ id: this.makeId(), action, data });

    const clickSound = button.clickSound || hub.clickSound;
    if (clickSound && a.type !== "none") {
      push("playsound", {
        audiofile: clickSound, audiofor: "trigger", volume: 0.8, loop: false, fade: 0,
        scenerestrict: false, prevent: false, delay: false, playlist: false
      });
    }

    const audience = a.audience || "trigger";
    switch (a.type) {
      case "scene":
        if (!a.target) break;
        push("scene", {
          sceneid: this.ref(a.target),
          activate: a.sceneMode === "activate",
          for: a.sceneMode === "everyone" ? "everyone" : "trigger"
        });
        break;
      case "journal": {
        if (!a.target) break;
        const doc = this._safeSync(a.target);
        const isPage = doc?.documentName === "JournalEntryPage" || /\.JournalEntryPage\./.test(a.target);
        const journalUuid = isPage ? (doc?.parent?.uuid ?? a.target.replace(/\.JournalEntryPage\..*$/, "")) : a.target;
        const pageId = isPage ? (doc?.id ?? a.target.split(".").at(-1)) : "";
        push("openjournal", {
          entity: this.ref(journalUuid),
          page: pageId,
          subsection: "",
          showto: audience,
          asimage: false,
          permission: a.ignorePermission ? "false" : "true",
          enhanced: false
        });
        break;
      }
      case "actor":
        if (a.ownCharacter) push("openactor", { entity: { id: "players", name: game.i18n.localize("NEONHUB.Action.ownCharacter") }, showto: "trigger" });
        else if (a.target) push("openactor", { entity: this.ref(a.target), showto: audience });
        break;
      case "shop":
        if (a.target) push(this.ACTION_SHOP, { entity: this.ref(a.target), showto: audience });
        break;
      case "hq":
        if (a.target) push(this.ACTION_HQ, { hq: a.target, showto: audience });
        break;
      case "lifestyle":
        push(this.ACTION_LIFESTYLE, { showto: audience });
        break;
      case "calendar":
        push(this.ACTION_CALENDAR, { showto: audience });
        break;
      case "messenger":
        push(this.ACTION_MESSENGER, { view: a.view, showto: audience });
        break;
      case "sound":
        if (!a.file) break;
        push("playsound", {
          audiofile: a.file, audiofor: audience, volume: clamp01(a.volume ?? 1), loop: !!a.loop, fade: 0.25,
          scenerestrict: false, prevent: false, delay: false, playlist: true
        });
        break;
      case "playlist":
        if (!a.target) break;
        push("playlist", { entity: this.ref(a.target), play: a.playMode || "play", volume: clamp01(a.volume ?? 1), loop: !!a.loop });
        break;
      case "image":
        if (!a.file) break;
        push("showimage", { imagefile: a.file, caption: a.caption || button.label || "", showfor: audience });
        break;
      case "macro":
        if (!a.target) break;
        push("runmacro", { entity: this.ref(a.target), args: "", runasgm: a.runAs === "gm" ? "gm" : "player" });
        break;
      default:
        break;
    }
    // A decorative button with only a click sound shouldn't click at all.
    if (actions.length === 1 && clickSound && actions[0].action === "playsound" && a.type !== "sound") return [];
    return actions;
  },

  _safeSync(uuid) {
    try {
      return fromUuidSync(uuid);
    } catch {
      return null;
    }
  },

  /* ---------------------------------------- */
  /*  Custom MATT actions                     */
  /* ---------------------------------------- */

  /**
   * Register "Open Neon Market shop", "Open Headquarters", "Open Lifestyle", "Open calendar" and
   * "Open Night City Messenger" in MATT's action list.
   * MATT runs actions on the active GM's client, so each action works out who should
   * see the window and asks those clients to open it.
   */
  registerActions(app) {
    const i18n = (k) => game.i18n.localize(k);
    const showto = {
      everyone: "MonksActiveTiles.for.all",
      players: "MonksActiveTiles.for.players",
      gm: "MonksActiveTiles.for.gm",
      trigger: "MonksActiveTiles.for.triggering",
      token: "MonksActiveTiles.for.token",
      owner: "MonksActiveTiles.for.owner",
      previous: "MonksActiveTiles.for.current"
    };
    const showtoCtrl = { id: "showto", name: "MonksActiveTiles.ctrl.showto", list: "showto", type: "list", subtype: "for", defvalue: "trigger" };
    const forName = (id) => app.forPlayersName?.(id) ?? id;

    app.registerTileGroup(MODULE_ID, i18n("NEONHUB.Matt.Group"));

    app.registerTileAction(MODULE_ID, "openshop", {
      name: "NEONHUB.Matt.OpenShop",
      ctrls: [
        {
          id: "entity",
          name: "MonksActiveTiles.ctrl.select-entity",
          type: "select",
          subtype: "entity",
          options: { show: ["previous"] },
          restrict: (entity) => entity instanceof Actor || entity instanceof Token || entity instanceof TokenDocument,
          required: true,
          defaultType: "actors",
          placeholder: i18n("NEONHUB.Matt.PickShop")
        },
        showtoCtrl
      ],
      values: { showto },
      fn: async (args = {}) => {
        const { action } = args;
        const entities = await app.getEntities(args, "actors");
        // An unlinked token's shop belongs to that token: send the token, which Neon Market resolves itself.
        const source = entities.map((e) => (e instanceof Token ? e.document : e)).find((e) => e instanceof Actor || (e instanceof TokenDocument && e.actor));
        if (!source) return;
        const actor = source instanceof TokenDocument ? source.actor : source;
        const users = app.getForPlayers(action.data.showto || "trigger", args);
        if (users.length) HubSocket.emit("openShop", { uuid: source.uuid }, users);
        return { entities: [actor] };
      },
      content: async (trigger, action) => {
        const name = await app.entityName(action.data?.entity || "previous", "actors");
        return `<span class="action-style">${i18n(trigger.name)}</span> <span class="entity-style">${name}</span> for <span class="value-style">&lt;${forName(action.data?.showto || "trigger")}&gt;</span>`;
      }
    });

    app.registerTileAction(MODULE_ID, "openhq", {
      name: "NEONHUB.Matt.OpenHQ",
      ctrls: [
        {
          id: "hq",
          name: "NEONHUB.Matt.Headquarters",
          type: "list",
          required: true,
          list: () => Object.fromEntries(HQStore.all().map((hq) => [hq.id, hq.name]))
        },
        showtoCtrl
      ],
      values: { showto },
      fn: async (args = {}) => {
        const { action } = args;
        if (!HQStore.get(action.data.hq)) return;
        const users = app.getForPlayers(action.data.showto || "trigger", args);
        if (users.length) HubSocket.emit("openHQ", { id: action.data.hq }, users);
      },
      content: async (trigger, action) => {
        const name = HQStore.get(action.data?.hq)?.name ?? i18n("NEONHUB.Matt.UnknownHQ");
        return `<span class="action-style">${i18n(trigger.name)}</span> <span class="entity-style">${Handlebars.escapeExpression(name)}</span> for <span class="value-style">&lt;${forName(action.data?.showto || "trigger")}&gt;</span>`;
      }
    });

    // Each client opens its own character's Lifestyle (the GM gets the month overview).
    app.registerTileAction(MODULE_ID, "openlifestyle", {
      name: "NEONHUB.Matt.OpenLifestyle",
      ctrls: [showtoCtrl],
      values: { showto },
      fn: async (args = {}) => {
        const { action } = args;
        const users = app.getForPlayers(action.data.showto || "trigger", args);
        if (users.length) HubSocket.emit("openLifestyle", {}, users);
      },
      content: async (trigger, action) => {
        return `<span class="action-style">${i18n(trigger.name)}</span> for <span class="value-style">&lt;${forName(action.data?.showto || "trigger")}&gt;</span>`;
      }
    });

    // Night City Messenger is its own module; each client opens its own window (see messenger.js).
    app.registerTileAction(MODULE_ID, "openmessenger", {
      name: "NEONHUB.Matt.OpenMessenger",
      ctrls: [
        {
          id: "view",
          name: "NEONHUB.Matt.MessengerView",
          type: "list",
          list: () => Object.fromEntries(Object.keys(MESSENGER_VIEWS).map((k) => [k, i18n(`NEONHUB.Messenger.View.${k}`)])),
          defvalue: "inbox"
        },
        showtoCtrl
      ],
      values: { showto },
      fn: async (args = {}) => {
        const { action } = args;
        const users = app.getForPlayers(action.data.showto || "trigger", args);
        if (users.length) HubSocket.emit("openMessenger", { view: action.data.view || "inbox" }, users);
      },
      content: async (trigger, action) => {
        const view = i18n(`NEONHUB.Messenger.View.${MESSENGER_VIEWS[action.data?.view] ? action.data.view : "inbox"}`);
        return `<span class="action-style">${i18n(trigger.name)}</span> <span class="entity-style">${view}</span> for <span class="value-style">&lt;${forName(action.data?.showto || "trigger")}&gt;</span>`;
      }
    });

    app.registerTileAction(MODULE_ID, "opencalendar", {
      name: "NEONHUB.Matt.OpenCalendar",
      ctrls: [showtoCtrl],
      values: { showto },
      fn: async (args = {}) => {
        const users = app.getForPlayers(args.action.data.showto || "trigger", args);
        if (users.length) HubSocket.emit("openCalendar", {}, users);
      },
      content: async (trigger, action) => {
        return `<span class="action-style">${i18n(trigger.name)}</span> for <span class="value-style">&lt;${forName(action.data?.showto || "trigger")}&gt;</span>`;
      }
    });
  },

  /** Open a Neon Market shop on this client, if Neon Market is installed. */
  async openShop(uuid) {
    const api = game.modules.get(MARKET_ID)?.active ? game.modules.get(MARKET_ID).api : null;
    if (!api?.open) return ui.notifications.warn(game.i18n.localize("NEONHUB.Error.NoMarket"));
    return api.open(uuid);
  }
};

function clamp01(n) {
  return Math.min(1, Math.max(0, Number(n) || 0));
}
