import { MODULE_ID, SYSTEM_ID, MATT_ID, TEMPLATE_PATH } from "./constants.js";
import { Compat } from "./compat.js";
import { HubSocket } from "./socket.js";
import { MATT } from "./matt.js";
import { HQStore } from "./hq/hq-data.js";
import { HQOps } from "./hq/hq-ops.js";
import { HQApp } from "./hq/hq-app.js";
import { HubBuilder } from "./hub/builder.js";
import { HubEditor } from "./hub/hub-editor.js";

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

  Compat.loadTemplates([
    `${TEMPLATE_PATH}/hub/editor.hbs`,
    `${TEMPLATE_PATH}/hq/hq.hbs`,
    `${TEMPLATE_PATH}/hq/month-card.hbs`
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
    apps: { HubEditor, HQApp }
  };
});

Hooks.once("ready", () => {
  HubSocket.init();
  HQOps.init();
  HubSocket.on("openShop", ({ uuid }) => MATT.openShop(uuid));
  HubSocket.on("openHQ", ({ id }) => HQApp.open(id));

  if (!game.user.isGM) return;
  if (game.system.id !== SYSTEM_ID) ui.notifications.warn(L("NEONHUB.Error.WrongSystem", { system: game.system.title }));
  if (!game.modules.get(MATT_ID)?.active) ui.notifications.warn(L("NEONHUB.Error.NoMatt"));
});

/* ------------------------------------------ */
/*  Keep open windows current                 */
/* ------------------------------------------ */

Hooks.on(`${MODULE_ID}.hqChanged`, () => HQApp.refreshAll());
Hooks.on("updateActor", (actor) => {
  for (const app of HQApp.instances.values()) if (app.hq?.crew.includes(actor.uuid)) app.render();
});

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
  if (!game.user.isGM && !HQStore.visibleTo().length) return;
  addHeaderButton(html, { cls: "neon-hub-hq", icon: "fa-solid fa-house-signal", label: L("NEONHUB.UI.Headquarters"), onClick: () => chooseHQ() });
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
    classes: ["neon-hub-choose"],
    rejectClose: false
  });
  if (!choice) return;
  if (choice === "__new") return HQApp.create();
  return HQApp.open(choice);
}
