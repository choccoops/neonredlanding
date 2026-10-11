import { MODULE_ID, SYSTEM_ID, MATT_ID, TEMPLATE_PATH } from "./constants.js";
import { Compat } from "./compat.js";
import { HubSocket } from "./socket.js";
import { MATT } from "./matt.js";
import { HQStore } from "./hq/hq-data.js";
import { HQOps } from "./hq/hq-ops.js";
import { HQApp } from "./hq/hq-app.js";
import { HubBuilder } from "./hub/builder.js";
import { HubEditor } from "./hub/hub-editor.js";
import { LS_FLAG } from "./lifestyle/ls-data.js";
import { LifestyleStore } from "./lifestyle/ls-store.js";
import { LifestyleOps } from "./lifestyle/ls-ops.js";
import { LifestyleApp } from "./lifestyle/ls-app.js";
import { LifestyleItemConfig } from "./lifestyle/ls-item-config.js";
import { CalendarStore } from "./calendar/cal-store.js";
import { CalendarOps } from "./calendar/cal-ops.js";
import { CalendarApp } from "./calendar/cal-app.js";
import { NotesStore } from "./calendar/cal-notes.js";
import { Messenger } from "./messenger.js";
import { HubHover } from "./hub/hover.js";
import { Clock } from "./calendar/clock.js";
import { parseTime, minutesOfDay } from "./calendar/clock-time.js";
import { sameDate } from "./calendar/cal-dates.js";

const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));
const esc = (s) => Handlebars.escapeExpression(String(s ?? ""));

// MATT fires this during its own init, so it has to be hooked as soon as the script loads.
Hooks.on("setupTileActions", (app) => {
  try {
    MATT.registerActions(app);
  } catch (err) {
    console.error(`${MODULE_ID} | could not register Monk's Active Tile Triggers actions`, err);
  }
});

Hooks.once("init", () => {
  HQStore.register();
  LifestyleStore.register();
  CalendarStore.register();
  NotesStore.register();
  Clock.register();
  Clock.init();
  HubHover.init();

  Compat.loadTemplates([
    `${TEMPLATE_PATH}/hub/editor.hbs`,
    `${TEMPLATE_PATH}/hq/hq.hbs`,
    `${TEMPLATE_PATH}/hq/month-card.hbs`,
    `${TEMPLATE_PATH}/lifestyle/lifestyle.hbs`,
    `${TEMPLATE_PATH}/lifestyle/bill-card.hbs`,
    `${TEMPLATE_PATH}/lifestyle/item-config.hbs`,
    `${TEMPLATE_PATH}/calendar/calendar.hbs`,
    `${TEMPLATE_PATH}/calendar/date-card.hbs`,
    `${TEMPLATE_PATH}/calendar/rent-card.hbs`
  ]);

  game.modules.get(MODULE_ID).api = {
    /** GM: open the hub editor, for an existing hub scene or a new one. */
    editHub: async (scene = null) => HubEditor.open(typeof scene === "string" ? await fromUuid(scene) : scene),
    /** GM: rebuild a hub scene from its saved layout (e.g. after changing a target document's name). */
    rebuildHub: async (scene) => {
      scene = typeof scene === "string" ? await fromUuid(scene) : scene;
      const hub = HubBuilder.getHub(scene);
      if (!hub) throw new Error("Not a hub scene");
      return HubBuilder.build(hub, scene);
    },
    isHub: (scene) => HubBuilder.isHub(scene),
    /** Open a Headquarters on this client. */
    openHQ: (id) => HQApp.open(id),
    /** GM: open a Headquarters on players' screens (all, or the listed user ids). */
    showHQ: (id, userIds = null) => HubSocket.emit("openHQ", { id }, userIds ?? game.users.filter((u) => u.active).map((u) => u.id)),
    listHQs: () => HQStore.visibleTo(),
    getHQ: (id) => HQStore.get(id),
    /** GM: give a Headquarters HQ IP (the DLC: equal to the Group IP from a mission). */
    awardHQIP: (id, amount, reason) => HQOps.awardIP(id, amount, reason),
    createHQ: () => HQApp.create(),

    /** Open the Lifestyle window on this client (an Actor or uuid; default: your own character). */
    openLifestyle: (actor = null) => LifestyleApp.open(actor),
    /** GM: open each listed user's own Lifestyle window (default: every connected player). */
    showLifestyle: (userIds = null) => HubSocket.emit("openLifestyle", {}, userIds ?? game.users.filter((u) => u.active).map((u) => u.id)),
    /** This month's bill for a character: { items, bill: { lines, groups, discount, total }, wallet, status, ... }. */
    lifestyleBill: async (actor) => LifestyleOps.billFor(typeof actor === "string" ? await fromUuid(actor) : actor),
    /** Pay this month's lifestyle bill for a character (owners and GM). */
    payLifestyle: async (actor) => LifestyleOps.perform("pay", { actor: typeof actor === "string" ? actor : actor.uuid }),
    /** GM: start the next month. Options: { hqs: true, bill: false }. */
    newLifestyleMonth: (options = {}) => LifestyleOps.newMonth(options),
    /** GM: charge every character whose bill is due. */
    billLifestyles: () => LifestyleOps.billAll(),
    lifestyleMonth: () => LifestyleStore.month,

    /** Open the calendar window on this client. */
    openCalendar: () => CalendarApp.open(),
    /** GM: open it on every connected player's screen (or the listed user ids). */
    showCalendar: (userIds = null) => HubSocket.emit("openCalendar", {}, userIds ?? game.users.filter((u) => u.active).map((u) => u.id)),
    /** Calendars this user can see. */
    listCalendars: () => CalendarStore.visibleTo(),
    /** { year, month, day } of a calendar (by id or name), if this user can see it. */
    getDate: (idOrName) => {
      const c = CalendarStore.get(idOrName);
      return c && CalendarStore.canSee(c) ? { year: c.year, month: c.month, day: c.day } : null;
    },
    /** GM: set a calendar's date; passing its rent day starts the new month ({ rent: false } skips billing). */
    setDate: (idOrName, date, options = {}) => CalendarOps.setDate(idOrName, date, options),
    /** GM: move a calendar by days (negative goes back). */
    addDays: (idOrName, days) => CalendarOps.shift(idOrName, { days }),
    /** GM: jump a calendar to its next rent day. */
    toRentDay: (idOrName) => CalendarOps.toRentDay(idOrName),
    /** Post a calendar's date to chat. */
    dateToChat: (idOrName) => CalendarOps.toChat(idOrName),
    /** Notes on a calendar this user can read (all, or one { year, month, day }). */
    notes: (idOrName, date = null) => NotesStore.visible(CalendarStore.get(idOrName), date),
    /** Add a note as this user: { title, text, shared }. */
    addNote: (idOrName, date, data) => {
      const c = CalendarStore.get(idOrName);
      return c && CalendarStore.canSee(c) ? NotesStore.create(c, date, data) : null;
    },

    /** Time of day on the world clock (SmallTime's clock): { minutes, time } where time is "HH:MM". */
    time: () => {
      const minutes = minutesOfDay(game.time.worldTime);
      return { minutes, time: `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}` };
    },
    /** GM: move the world clock by minutes (negative goes back). Calendars that follow it change day at midnight. */
    advanceTime: (minutes) => Clock.advance(Number(minutes) * 60),
    /** GM: set the time of day, "HH:MM" or minutes after midnight, without changing the day. */
    setTime: (time) => {
      const minutes = typeof time === "string" ? parseTime(time) : Number(time);
      if (minutes === null || !Number.isFinite(minutes)) throw new Error(`Not a time: ${time}`);
      return Clock.setTime(minutes);
    },

    /** Open a Night City Messenger window here (inbox, compose, contacts; GM: networks, admin). Needs that module. */
    openMessenger: (view = "inbox") => Messenger.open(view),
    /** GM: open a messenger window on every connected player's screen (or the listed user ids). */
    showMessenger: (view = "inbox", userIds = null) => HubSocket.emit("openMessenger", { view }, userIds ?? game.users.filter((u) => u.active).map((u) => u.id)),

    /** Troubleshooting: the lit button images loaded on this client and the button under the pointer. */
    hoverStatus: () => HubHover.status(),

    apps: { HubEditor, HQApp, LifestyleApp, LifestyleItemConfig, CalendarApp }
  };
});

Hooks.once("ready", () => {
  HubSocket.init();
  HQOps.init();
  LifestyleOps.init();
  HubSocket.on("openShop", ({ uuid }) => MATT.openShop(uuid));
  HubSocket.on("openHQ", ({ id }) => HQApp.open(id));
  HubSocket.on("openLifestyle", () => LifestyleApp.open());
  HubSocket.on("openCalendar", () => CalendarApp.open());
  HubSocket.on("openMessenger", ({ view }) => Messenger.open(view));
  calendarSnapshot = CalendarStore.all();
  if (game.user.isGM) LifestyleOps.adoptCalendars().catch((err) => console.warn(`${MODULE_ID} | lifestyle calendar adoption failed`, err));

  if (!game.user.isGM) return;
  if (game.system.id !== SYSTEM_ID) ui.notifications.warn(L("NEONHUB.Error.WrongSystem", { system: game.system.title }));
  if (!game.modules.get(MATT_ID)?.active) ui.notifications.warn(L("NEONHUB.Error.NoMatt"));
});

/* ------------------------------------------ */
/*  Keep open windows current                 */
/* ------------------------------------------ */

Hooks.on(`${MODULE_ID}.hqChanged`, () => {
  HQApp.refreshAll();
  LifestyleApp.refresh();
});
Hooks.on(`${MODULE_ID}.lifestyleChanged`, () => LifestyleApp.refresh());

/* ------------------------------------------ */
/*  Calendars                                 */
/* ------------------------------------------ */

let calendarSnapshot = [];

/** Every window that shows dates or what's due follows the calendars. */
Hooks.on(`${MODULE_ID}.calendarChanged`, (list) => {
  CalendarApp.refresh();
  LifestyleApp.refresh();
  HQApp.refreshAll();
  if (!list) return;
  const before = new Map(calendarSnapshot.map((c) => [c.id, c]));
  calendarSnapshot = CalendarStore.all();
  if (game.user.isGM) {
    LifestyleOps.adoptCalendars().catch((err) => console.warn(`${MODULE_ID} | lifestyle calendar adoption failed`, err));
    return;
  }
  if (!game.settings.get(MODULE_ID, "calendarNotify")) return;
  for (const c of calendarSnapshot) {
    const old = before.get(c.id);
    if (!old || sameDate(old, c) || !CalendarStore.canSee(c)) continue;
    ui.notifications.info(L("NEONHUB.Calendar.Notify", { name: c.name, date: `${L(`NEONHUB.Calendar.Month.${c.month}`)} ${c.day}, ${c.year}` }));
  }
});

Hooks.on(`${MODULE_ID}.calendarNotesChanged`, () => CalendarApp.refresh());
Hooks.on("updateWorldTime", () => CalendarApp.instance?.updateClock());
// Players' notes live on their User.
Hooks.on("updateUser", (user, changes) => {
  if (foundry.utils.hasProperty(changes, `flags.${MODULE_ID}`)) CalendarApp.refresh();
});

/**
 * A calendar button in the left toolbar's Token Controls, for everyone.
 * v12 passes an array of control groups; v13 an object of them keyed by name.
 */
Hooks.on("getSceneControlButtons", (controls) => {
  const tool = { name: "neonHubCalendar", title: "NEONHUB.Calendar.Title", icon: "fa-solid fa-calendar-days", button: true, visible: true };
  if (Array.isArray(controls)) {
    controls.find((c) => c.name === "token")?.tools.push({ ...tool, onClick: () => CalendarApp.toggle() });
    return;
  }
  const token = controls.tokens ?? controls.token;
  if (!token) return;
  token.tools.neonHubCalendar = { ...tool, order: Object.keys(token.tools).length, onChange: () => CalendarApp.toggle() };
});

// With no scene on the canvas Foundry ignores tool clicks, but a calendar is still useful then.
Hooks.on("renderSceneControls", (app, html) => {
  if (canvas?.ready) return;
  const button = Compat.element(html)?.querySelector('[data-tool="neonHubCalendar"]');
  if (!button || button.dataset.neonHub) return;
  button.dataset.neonHub = "1";
  button.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    CalendarApp.toggle();
  });
});
Hooks.on("updateActor", (actor) => {
  for (const app of HQApp.instances.values()) if (app.hq?.crew.includes(actor.uuid)) app.render();
  LifestyleApp.refreshFor(actor);
});

/* ------------------------------------------ */
/*  Lifestyle items                           */
/* ------------------------------------------ */

/**
 * Keep lifestyle state right however an item changes, including from the CPR sheet's own
 * equip toggle: one lifestyle package active at a time, and the CPR actor's
 * system.lifestyle fields mirrored. Writes made by LifestyleOps are tagged and skipped here.
 */
function onLifestyleItem(item, options, userId, { activated = false, touched = false } = {}) {
  const flagged = !!item.getFlag?.(MODULE_ID, LS_FLAG);
  const actor = item.parent;
  if (!(actor instanceof Actor)) {
    // A world or compendium item: the catalog may have changed.
    if (flagged || touched) LifestyleApp.refresh({ catalog: true });
    return;
  }
  LifestyleApp.refreshFor(actor);
  if (!flagged || userId !== game.user.id || options?.neonHub === "lifestyle") return;
  (async () => {
    if (activated) await LifestyleOps.keepOnePackage(actor, item.id);
    await LifestyleOps.syncActor(actor);
  })().catch((err) => console.warn(`${MODULE_ID} | lifestyle sync failed for ${actor.name}`, err));
}

Hooks.on("createItem", (item, options, userId) => onLifestyleItem(item, options, userId, { activated: item.system?.equipped === "equipped" }));
Hooks.on("updateItem", (item, changes, options, userId) => {
  const touched = foundry.utils.hasProperty(changes, `flags.${MODULE_ID}`);
  if (!item.getFlag?.(MODULE_ID, LS_FLAG) && !touched) return;
  onLifestyleItem(item, options, userId, { activated: foundry.utils.getProperty(changes, "system.equipped") === "equipped", touched });
});
Hooks.on("deleteItem", (item, options, userId) => onLifestyleItem(item, options, userId));

/* ------------------------------------------ */
/*  Entry points in the sidebar               */
/* ------------------------------------------ */

function addHeaderButton(html, { cls, icon, label, onClick }) {
  const root = Compat.element(html);
  const actions = root?.querySelector(".header-actions");
  if (!actions || actions.querySelector(`.${cls}`)) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = cls;
  btn.innerHTML = `<i class="${icon}"></i> ${esc(label)}`;
  btn.addEventListener("click", (ev) => {
    ev.preventDefault();
    onClick();
  });
  actions.appendChild(btn);
}

Hooks.on("renderSceneDirectory", (app, html) => {
  if (!game.user.isGM) return;
  addHeaderButton(html, { cls: "neon-hub-new", icon: "fa-solid fa-table-cells-large", label: L("NEONHUB.UI.NewHub"), onClick: () => HubEditor.open() });
});

Hooks.on("renderActorDirectory", (app, html) => {
  if (game.user.isGM || HQStore.visibleTo().length) {
    addHeaderButton(html, { cls: "neon-hub-hq", icon: "fa-solid fa-house-signal", label: L("NEONHUB.UI.Headquarters"), onClick: () => chooseHQ() });
  }
  if (game.user.isGM || LifestyleStore.viewable().length) {
    addHeaderButton(html, { cls: "neon-hub-lifestyle", icon: "fa-solid fa-wallet", label: L("NEONHUB.Lifestyle.Title"), onClick: () => LifestyleApp.open() });
  }
});

/* ------------------------------------------ */
/*  Sheet header buttons                      */
/* ------------------------------------------ */

const lifestyleForActor = (actor) => actor?.type === "character" && (game.user.isGM || actor.isOwner);
const lifestyleForItem = (item) => game.user.isGM && item?.type === "gear";

// CPR 0.92 sheets are Application V1.
Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => {
  const actor = sheet.actor ?? sheet.document;
  if (!lifestyleForActor(actor)) return;
  buttons.unshift({ label: "NEONHUB.Lifestyle.Title", class: "neon-hub-lifestyle", icon: "fa-solid fa-wallet", onclick: () => LifestyleApp.open(actor) });
});
Hooks.on("getItemSheetHeaderButtons", (sheet, buttons) => {
  const item = sheet.item ?? sheet.document;
  if (!lifestyleForItem(item)) return;
  buttons.unshift({ label: "NEONHUB.Lifestyle.Short", class: "neon-hub-lifestyle", icon: "fa-solid fa-wallet", onclick: () => LifestyleItemConfig.open(item) });
});
// Application V2 sheets (a later CPR release on Foundry v13+).
Hooks.on("getHeaderControlsActorSheetV2", (sheet, controls) => {
  if (!lifestyleForActor(sheet.document)) return;
  controls.unshift({ label: "NEONHUB.Lifestyle.Title", icon: "fa-solid fa-wallet", action: "neonHubLifestyle", onClick: () => LifestyleApp.open(sheet.document) });
});
Hooks.on("getHeaderControlsItemSheetV2", (sheet, controls) => {
  if (!lifestyleForItem(sheet.document)) return;
  controls.unshift({ label: "NEONHUB.Lifestyle.Short", icon: "fa-solid fa-wallet", action: "neonHubLifestyle", onClick: () => LifestyleItemConfig.open(sheet.document) });
});

const sceneContext = (_app, options) => {
  options.push({
    name: "NEONHUB.UI.EditHub",
    icon: '<i class="fa-solid fa-table-cells-large"></i>',
    condition: (li) => game.user.isGM && HubBuilder.isHub(sceneFromLi(li)),
    callback: (li) => HubEditor.open(sceneFromLi(li))
  });
  options.push({
    name: "NEONHUB.UI.MakeHub",
    icon: '<i class="fa-solid fa-table-cells-large"></i>',
    condition: (li) => game.user.isGM && !HubBuilder.isHub(sceneFromLi(li)) && !sceneFromLi(li)?.tiles.size,
    callback: (li) => HubEditor.open(sceneFromLi(li))
  });
};
Hooks.on("getSceneDirectoryEntryContext", sceneContext);
Hooks.on("getSceneContextOptions", sceneContext);

function sceneFromLi(li) {
  const el = Compat.element(li);
  const id = el?.dataset.documentId ?? el?.dataset.entryId ?? el?.dataset.sceneId;
  return game.scenes.get(id);
}

/** Pick a Headquarters to open (GMs can also start a new one). */
async function chooseHQ() {
  const hqs = HQStore.visibleTo();
  if (hqs.length === 1 && !game.user.isGM) return HQApp.open(hqs[0].id);
  const buttons = hqs.map((hq) => ({ action: hq.id, label: hq.name, icon: "fa-solid fa-house-signal" }));
  if (game.user.isGM) buttons.push({ action: "__new", label: L("NEONHUB.HQ.New"), icon: "fa-solid fa-plus" });
  if (!buttons.length) return ui.notifications.info(L("NEONHUB.HQ.NoneVisible"));
  const choice = await Compat.DialogV2.wait({
    window: { title: L("NEONHUB.UI.Headquarters"), icon: "fa-solid fa-house-signal" },
    content: `<p>${esc(L(hqs.length ? "NEONHUB.HQ.Choose" : "NEONHUB.HQ.NoneYet"))}</p>`,
    buttons,
    classes: ["neon-hub", "nh-cal-dialog", "neon-hub-choose"],
    rejectClose: false
  });
  if (!choice) return;
  if (choice === "__new") return HQApp.create();
  return HQApp.open(choice);
}
