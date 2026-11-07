import { MODULE_ID, HUB_ID } from "./constants.js";
import { FBCOps } from "./fbc-ops.js";
import { GoMetalApp } from "./fbc-app.js";

const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));

Hooks.once("init", () => {
  game.modules.get(MODULE_ID).api = {
    open: (actor, options) => GoMetalApp.open(actor, options),
    goMetal: (actor, bodyId, options) => FBCOps.goMetal(actor, bodyId, options),
    leaveBody: (actor) => FBCOps.leaveBody(actor),
    isFBC: (actor) => FBCOps.isFBC(actor),
    state: (actor) => FBCOps.state(actor),
    bodies: () => FBCOps.bodies()
  };
});

Hooks.once("ready", () => {
  if (game.user.isGM && !game.modules.get(HUB_ID)?.active) ui.notifications.warn(L("FULLBORG.Error.NoHub"));
});

/* ------------------------------------------ */
/*  Sheet header buttons (GM)                 */
/* ------------------------------------------ */

// Not on compendium actors (the bodies themselves, or anything else locked in a pack).
const canConvert = (actor) => game.user.isGM && ["character", "mook"].includes(actor?.type) && !actor.pack;
const label = (actor) => (FBCOps.isFBC(actor) ? "FULLBORG.ShortMetal" : "FULLBORG.Short");

// CPR 0.92 sheets are Application V1.
Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => {
  const actor = sheet.actor ?? sheet.document;
  if (!canConvert(actor)) return;
  buttons.unshift({ label: label(actor), class: "fbc-go-metal", icon: "fa-solid fa-robot", onclick: () => GoMetalApp.open(actor) });
});
// Application V2 sheets (a later CPR release on Foundry v13+).
Hooks.on("getHeaderControlsActorSheetV2", (sheet, controls) => {
  if (!canConvert(sheet.document)) return;
  controls.unshift({ label: label(sheet.document), icon: "fa-solid fa-robot", action: "fbcGoMetal", onClick: () => GoMetalApp.open(sheet.document) });
});

/* ------------------------------------------ */
/*  Dropping a body package on a character    */
/* ------------------------------------------ */

Hooks.on("createItem", (item, options, userId) => {
  const pkg = item.getFlag(MODULE_ID, "fbcPackage");
  const actor = item.parent;
  if (!pkg || !(actor instanceof Actor) || userId !== game.user.id) return;
  if (game.user.isGM) GoMetalApp.open(actor, { bodyId: pkg.actor, packageItemId: item.id });
  else ui.notifications.info(L("FULLBORG.AskGM", { body: item.name }));
});
