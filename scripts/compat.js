/**
 * Compatibility layer.
 *
 * Foundry v12 exposes many classes as globals; v13+ moves them under `foundry.*`
 * and later removes the globals. Every lookup prefers the namespaced path and
 * falls back to the v12 global, so nothing else in the module touches a global
 * that is on its way out.
 */
const ns = (path) => foundry.utils.getProperty(globalThis, path);

export const Compat = {
  get generation() {
    return Number(game.release?.generation ?? 12);
  },

  get DialogV2() {
    return foundry.applications.api.DialogV2;
  },

  get FilePicker() {
    return ns("foundry.applications.apps.FilePicker.implementation") ?? globalThis.FilePicker;
  },

  get TextEditor() {
    return ns("foundry.applications.ux.TextEditor.implementation") ?? globalThis.TextEditor;
  },

  get ImagePopout() {
    return ns("foundry.applications.apps.ImagePopout") ?? globalThis.ImagePopout;
  },

  get FormDataExtended() {
    return ns("foundry.applications.ux.FormDataExtended") ?? globalThis.FormDataExtended;
  },

  renderTemplate(path, data) {
    const fn = ns("foundry.applications.handlebars.renderTemplate") ?? globalThis.renderTemplate;
    return fn(path, data);
  },

  loadTemplates(paths) {
    const fn = ns("foundry.applications.handlebars.loadTemplates") ?? globalThis.loadTemplates;
    return fn(paths);
  },

  getDragEventData(event) {
    return this.TextEditor.getDragEventData(event);
  },

  /** v12 hooks hand AppV1 apps jQuery; AppV2 hands HTMLElement. */
  element(html) {
    if (!html) return null;
    if (html instanceof HTMLElement) return html;
    return html[0] ?? null;
  },

  /** First active GM, the one who runs requests. */
  get activeGM() {
    return game.users.activeGM ?? game.users.find((u) => u.isGM && u.active) ?? null;
  },

  /** Where generated images are uploaded: The Forge's asset library when hosted there, else the Data folder. */
  get uploadSource() {
    const forge = globalThis.ForgeVTT;
    if (forge?.usingTheForge) return "forgevtt";
    return "data";
  }
};
