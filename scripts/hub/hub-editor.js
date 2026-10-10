import { MODULE_ID, MARKET_ID, TEMPLATE_PATH, THEMES, PAGE_SIZES, BUTTON_SIZES, BUTTON_ACTIONS, AUDIENCES } from "../constants.js";
import { Compat } from "../compat.js";
import { MATT } from "../matt.js";
import { HQStore } from "../hq/hq-data.js";
import { HQApp } from "../hq/hq-app.js";
import { defaultHub, defaultButton, normalizeHub, normalizeButton, computeLayout, validateHub } from "./hub-data.js";
import { renderBackground, renderButton } from "./render.js";
import { HubBuilder } from "./builder.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { deepClone, getProperty, setProperty, debounce } = foundry.utils;
const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));

/** Which document types each action accepts, and the action a dropped document implies. */
const DROP_TYPES = {
  Scene: "scene",
  JournalEntry: "journal",
  JournalEntryPage: "journal",
  Actor: "actor",
  Playlist: "playlist",
  PlaylistSound: "playlist",
  Macro: "macro"
};

/**
 * GM editor for one hub page: page settings on the left, a live preview in the middle,
 * the selected button on the right. "Build" turns it into a scene of MATT click tiles.
 */
export class HubEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  static instances = new Map();

  constructor(scene = null, options = {}) {
    super({ id: `${MODULE_ID}-editor-${scene?.id ?? foundry.utils.randomID(6)}`, ...options });
    this.scene = scene;
    this.draft = scene ? HubBuilder.getHub(scene) ?? defaultHub() : HubEditor.#starterHub();
    this.selected = this.draft.buttons[0]?.id ?? null;
    this.dirty = !scene;
    this.building = false;
    this.progress = null;
    this._drawPreview = debounce(() => this.#drawPreview(), 150);
  }

  static DEFAULT_OPTIONS = {
    classes: ["neon-hub", "nh-editor"],
    tag: "div",
    window: { title: "NEONHUB.Editor.Title", icon: "fa-solid fa-table-cells-large", resizable: true },
    position: { width: 1320, height: 840 },
    actions: {
      select: HubEditor.#onSelect,
      addButton: HubEditor.#onAddButton,
      removeButton: HubEditor.#onRemoveButton,
      duplicateButton: HubEditor.#onDuplicateButton,
      moveButton: HubEditor.#onMoveButton,
      pickFile: HubEditor.#onPickFile,
      clearTarget: HubEditor.#onClearTarget,
      newHQ: HubEditor.#onNewHQ,
      build: HubEditor.#onBuild,
      viewScene: HubEditor.#onViewScene,
      activateScene: HubEditor.#onActivateScene
    }
  };

  static PARTS = {
    body: { template: `${TEMPLATE_PATH}/hub/editor.hbs`, scrollable: [".nh-ed-left", ".nh-ed-right", ".nh-ed-list"] }
  };

  static open(scene = null) {
    if (!game.user.isGM) return ui.notifications.warn(L("NEONHUB.Error.GMOnly"));
    if (!MATT.active) ui.notifications.warn(L("NEONHUB.Error.NoMatt"));
    const key = scene?.id ?? "new";
    let app = scene ? this.instances.get(key) : null;
    if (!app) {
      app = new this(scene);
      if (scene) this.instances.set(key, app);
    }
    app.render({ force: true });
    return app;
  }

  /** A new hub starts with a few useful buttons so the GM sees how it works. */
  static #starterHub() {
    return defaultHub({
      title: L("NEONHUB.Editor.DefaultName"),
      subtitle: L("NEONHUB.Editor.DefaultSubtitle"),
      buttons: [
        defaultButton({ label: L("NEONHUB.Starter.Map"), subtitle: L("NEONHUB.Starter.MapSub"), icon: "fa-solid fa-map-location-dot", action: { type: "scene" } }),
        defaultButton({ label: L("NEONHUB.Starter.Sheet"), subtitle: L("NEONHUB.Starter.SheetSub"), icon: "fa-solid fa-id-card", action: { type: "actor", ownCharacter: true } }),
        defaultButton({ label: L("NEONHUB.Starter.HQ"), subtitle: L("NEONHUB.Starter.HQSub"), icon: "fa-solid fa-house-signal", action: { type: "hq" } }),
        defaultButton({ label: L("NEONHUB.Starter.Market"), subtitle: L("NEONHUB.Starter.MarketSub"), icon: "fa-solid fa-store", action: { type: "shop" } })
      ]
    });
  }

  get title() {
    return this.scene ? `${L("NEONHUB.Editor.Title")}: ${this.scene.name}` : L("NEONHUB.Editor.TitleNew");
  }

  get selectedIndex() {
    return this.draft.buttons.findIndex((b) => b.id === this.selected);
  }

  /* ---------------------------------------- */
  /*  Context                                 */
  /* ---------------------------------------- */

  async _prepareContext() {
    const d = this.draft;
    const issues = validateHub(d, { hqExists: (id) => !!HQStore.get(id) });
    const idx = this.selectedIndex;
    const b = idx >= 0 ? d.buttons[idx] : null;
    const opt = (entries, value) => entries.map(([key, label]) => ({ key, label, selected: key === value }));

    let sel = null;
    if (b) {
      const a = b.action;
      sel = {
        ...b,
        index: idx,
        issue: issues[b.id] ? L(issues[b.id]) : null,
        actionTypes: opt(Object.entries(BUTTON_ACTIONS).map(([k, v]) => [k, L(v.label)]), a.type),
        sizes: opt(Object.keys(BUTTON_SIZES).map((k) => [k, L(`NEONHUB.Size.${k}`)]), b.size),
        audiences: opt(Object.entries(AUDIENCES).map(([k, v]) => [k, L(v)]), a.audience),
        sceneModes: opt(["trigger", "everyone", "activate"].map((k) => [k, L(`NEONHUB.SceneMode.${k}`)]), a.sceneMode),
        playModes: opt(["play", "stop", "pause", "next", "prev"].map((k) => [k, L(`NEONHUB.PlayMode.${k}`)]), a.playMode),
        colorValue: b.color || THEMES[d.theme].accent,
        is: Object.fromEntries(Object.keys(BUTTON_ACTIONS).map((k) => [k, a.type === k])),
        usesAudience: ["journal", "actor", "shop", "hq", "sound", "image"].includes(a.type) && !(a.type === "actor" && a.ownCharacter),
        targetName: a.target ? this.#nameOf(a.type, a.target) : null,
        targetOptions: this.#targetOptions(a.type, a.target),
        marketMissing: a.type === "shop" && !game.modules.get(MARKET_ID)?.active
      };
    }

    return {
      d,
      themes: opt(Object.entries(THEMES).map(([k, t]) => [k, L(t.label)]), d.theme),
      sizes: opt(Object.keys(PAGE_SIZES).map((k) => [k, k.replace("x", " × ")]), d.size),
      layouts: opt([["grid", L("NEONHUB.Editor.LayoutGrid")], ["manual", L("NEONHUB.Editor.LayoutManual")]], d.layout),
      buttons: d.buttons.map((x, i) => ({
        id: x.id,
        index: i,
        label: x.label || L("NEONHUB.Editor.Untitled"),
        icon: x.icon || BUTTON_ACTIONS[x.action.type].icon,
        action: L(BUTTON_ACTIONS[x.action.type].label),
        selected: x.id === this.selected,
        issue: !!issues[x.id],
        gmOnly: x.gmOnly,
        first: i === 0,
        last: i === d.buttons.length - 1
      })),
      sel,
      issueCount: Object.keys(issues).length,
      scene: this.scene ? { name: this.scene.name, active: this.scene.active } : null,
      dirty: this.dirty,
      building: this.building,
      progress: this.progress,
      mattMissing: !MATT.active,
      mattVersion: MATT.version
    };
  }

  #nameOf(type, uuid) {
    if (type === "hq") return HQStore.get(uuid)?.name ?? L("NEONHUB.Matt.UnknownHQ");
    try {
      const doc = fromUuidSync(uuid);
      if (!doc) return L("NEONHUB.Editor.Missing");
      return doc.parent && doc.documentName !== "Actor" ? `${doc.parent.name}: ${doc.name}` : doc.name;
    } catch {
      return L("NEONHUB.Editor.Missing");
    }
  }

  /** Dropdown choices for the selected action's target. */
  #targetOptions(type, value) {
    const one = (doc, label = doc.name) => ({ key: doc.uuid, label, selected: doc.uuid === value });
    const sorted = (c) => [...c].sort((a, b) => a.name.localeCompare(b.name));
    switch (type) {
      case "scene":
        return [{ group: null, options: sorted(game.scenes.filter((s) => s.id !== this.scene?.id)).map((s) => one(s)) }];
      case "journal":
        return sorted(game.journal).map((j) => ({
          group: j.name,
          options: [one(j, L("NEONHUB.Editor.WholeJournal")), ...j.pages.contents.sort((a, b) => a.sort - b.sort).map((p) => one(p))]
        }));
      case "actor":
        return [{ group: null, options: sorted(game.actors).map((a) => one(a)) }];
      case "shop": {
        const shops = sorted(game.actors.filter((a) => a.getFlag?.(MARKET_ID, "shop")?.enabled));
        return [{ group: null, options: shops.map((a) => one(a, a.getFlag(MARKET_ID, "shop")?.identity?.name || a.name)) }];
      }
      case "hq":
        return [{ group: null, options: HQStore.all().map((hq) => ({ key: hq.id, label: hq.name, selected: hq.id === value })) }];
      case "playlist":
        return sorted(game.playlists).map((p) => ({
          group: p.name,
          options: [one(p, L("NEONHUB.Editor.WholePlaylist")), ...p.sounds.contents.map((s) => one(s))]
        }));
      case "macro":
        return [{ group: null, options: sorted(game.macros).map((m) => one(m)) }];
      default:
        return [];
    }
  }

  /* ---------------------------------------- */
  /*  Rendering                               */
  /* ---------------------------------------- */

  _onRender(context, options) {
    super._onRender?.(context, options);
    const root = this.element;
    for (const input of root.querySelectorAll("[data-path]")) {
      const live = input.matches("input[type=text], textarea, input[type=range], input[type=color]");
      input.addEventListener(live ? "input" : "change", (ev) => this.#onField(ev, live));
      if (live) input.addEventListener("change", () => this.render());
    }
    for (const zone of root.querySelectorAll("[data-drop]")) {
      zone.addEventListener("dragover", (ev) => {
        ev.preventDefault();
        zone.classList.add("drag-over");
      });
      zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
      zone.addEventListener("drop", (ev) => {
        zone.classList.remove("drag-over");
        this.#onDrop(ev, zone.dataset.drop);
      });
    }
    const preview = root.querySelector("canvas.nh-preview");
    preview?.addEventListener("click", (ev) => this.#onPreviewClick(ev));
    this.#drawPreview();
  }

  async #drawPreview() {
    const canvas = this.element?.querySelector("canvas.nh-preview");
    if (!canvas) return;
    const token = (this._previewToken = Symbol("preview"));
    const hub = normalizeHub(this.draft);
    const manual = this.scene && hub.layout === "manual" ? HubBuilder.manualPositions(this.scene) : {};
    const { frame, rects, overflow } = computeLayout(hub, manual);
    const box = canvas.parentElement.getBoundingClientRect();
    const scale = Math.min((box.width || 640) / frame.width, (box.height || 360) / frame.height);
    canvas.width = Math.round(frame.width * scale);
    canvas.height = Math.round(frame.height * scale);
    this._previewScale = scale;
    this._previewRects = rects;

    const bg = await renderBackground(hub);
    if (token !== this._previewToken) return;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
    for (const button of hub.buttons) {
      const r = rects[button.id];
      if (!r) continue;
      const img = await renderButton(button, hub, r.w, r.h);
      if (token !== this._previewToken) return;
      ctx.globalAlpha = button.gmOnly ? 0.6 : 1;
      ctx.drawImage(img, r.x * scale, r.y * scale, r.w * scale, r.h * scale);
      ctx.globalAlpha = 1;
      if (button.id === this.selected) {
        ctx.strokeStyle = "#ffffff";
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 2;
        ctx.strokeRect(r.x * scale - 3, r.y * scale - 3, r.w * scale + 6, r.h * scale + 6);
        ctx.setLineDash([]);
      }
    }
    this.element?.querySelector(".nh-overflow")?.classList.toggle("visible", overflow);
  }

  #onPreviewClick(ev) {
    const canvas = ev.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = (ev.clientX - rect.left) * (canvas.width / rect.width) / this._previewScale;
    const y = (ev.clientY - rect.top) * (canvas.height / rect.height) / this._previewScale;
    for (const [id, r] of Object.entries(this._previewRects ?? {})) {
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        this.selected = id;
        this.render();
        return;
      }
    }
  }

  #coerce(input) {
    const raw = input.type === "checkbox" ? input.checked : input.value;
    switch (input.dataset.dtype) {
      case "Boolean": return !!raw;
      case "Number": return raw === "" ? 0 : Number(raw);
      default: return String(raw);
    }
  }

  #onField(ev, live) {
    const input = ev.currentTarget;
    const path = input.dataset.path;
    const value = this.#coerce(input);
    const before = getProperty(this.draft, path);
    setProperty(this.draft, path, value);
    this.dirty = true;
    this.element.querySelector(".nh-dirty")?.classList.add("visible");

    // Switching action type: swap a default icon for the new type's icon and drop the old target.
    const m = /^buttons\.(\d+)\.action\.type$/.exec(path);
    if (m) {
      const b = this.draft.buttons[Number(m[1])];
      if (!b.icon || b.icon === BUTTON_ACTIONS[before]?.icon) b.icon = BUTTON_ACTIONS[value].icon;
      b.action.target = "";
      b.action.file = "";
    }
    this.draft = normalizeHub(this.draft);
    if (live) this._drawPreview();
    else this.render();
  }

  async #onDrop(ev, zone) {
    ev.preventDefault();
    const data = Compat.getDragEventData(ev);
    if (!data?.type) return;
    const type = DROP_TYPES[data.type];
    if (!type || !data.uuid) return ui.notifications.warn(L("NEONHUB.Editor.DropUnsupported"));
    const doc = await fromUuid(data.uuid);
    if (!doc) return;

    let button;
    if (zone === "list") {
      button = defaultButton({ label: doc.name, icon: BUTTON_ACTIONS[type].icon, action: { type } });
      this.draft.buttons.push(button);
    } else {
      button = this.draft.buttons[this.selectedIndex];
      if (!button) return;
      if (button.action.type !== type && !(button.action.type === "shop" && type === "actor")) {
        if (!button.icon || button.icon === BUTTON_ACTIONS[button.action.type]?.icon) button.icon = BUTTON_ACTIONS[type].icon;
        button.action.type = type;
      }
    }
    button.action.target = doc.uuid;
    button.action.ownCharacter = false;
    // A Neon Market shop dropped as an actor becomes a shop button.
    if (type === "actor" && doc.getFlag?.(MARKET_ID, "shop")?.enabled) {
      button.action.type = "shop";
      if (button.icon === BUTTON_ACTIONS.actor.icon) button.icon = BUTTON_ACTIONS.shop.icon;
    }
    if (!button.label || button.label === "New button") button.label = doc.name;
    this.selected = button.id;
    this.draft = normalizeHub(this.draft);
    this.dirty = true;
    this.render();
  }

  /* ---------------------------------------- */
  /*  Actions                                 */
  /* ---------------------------------------- */

  static #onSelect(event, target) {
    this.selected = target.dataset.id;
    this.render();
  }

  static #onAddButton() {
    const b = defaultButton({ label: L("NEONHUB.Editor.NewButton") });
    this.draft.buttons.push(b);
    this.selected = b.id;
    this.dirty = true;
    this.render();
  }

  static #onDuplicateButton() {
    const idx = this.selectedIndex;
    if (idx < 0) return;
    const copy = normalizeButton({ ...deepClone(this.draft.buttons[idx]), id: "" });
    this.draft.buttons.splice(idx + 1, 0, copy);
    this.selected = copy.id;
    this.dirty = true;
    this.render();
  }

  static #onRemoveButton() {
    const idx = this.selectedIndex;
    if (idx < 0) return;
    this.draft.buttons.splice(idx, 1);
    this.selected = this.draft.buttons[Math.min(idx, this.draft.buttons.length - 1)]?.id ?? null;
    this.dirty = true;
    this.render();
  }

  static #onMoveButton(event, target) {
    const idx = Number(target.dataset.index);
    const to = idx + Number(target.dataset.dir);
    const list = this.draft.buttons;
    if (to < 0 || to >= list.length) return;
    [list[idx], list[to]] = [list[to], list[idx]];
    this.dirty = true;
    this.render();
  }

  static #onPickFile(event, target) {
    const path = target.dataset.target;
    const FP = Compat.FilePicker;
    new FP({
      type: target.dataset.type ?? "image",
      current: getProperty(this.draft, path) || "",
      callback: (file) => {
        setProperty(this.draft, path, file);
        this.draft = normalizeHub(this.draft);
        this.dirty = true;
        this.render();
      }
    }).render(true);
  }

  static #onClearTarget() {
    const b = this.draft.buttons[this.selectedIndex];
    if (!b) return;
    b.action.target = "";
    this.dirty = true;
    this.render();
  }

  static async #onNewHQ() {
    const hq = await HQApp.create();
    const b = this.draft.buttons[this.selectedIndex];
    if (hq && b) {
      b.action.target = hq.id;
      this.dirty = true;
      this.render();
    }
  }

  static async #onBuild() {
    if (this.building) return;
    const issues = validateHub(this.draft, { hqExists: (id) => !!HQStore.get(id) });
    if (Object.keys(issues).length) {
      const ok = await Compat.DialogV2.confirm({
        window: { title: L("NEONHUB.Editor.Build") },
        content: `<p>${L("NEONHUB.Editor.BuildWithIssues", { n: Object.keys(issues).length })}</p>`,
        rejectClose: false
      });
      if (!ok) return;
    }
    this.building = true;
    this.progress = "0%";
    this.render();
    try {
      this.scene = await HubBuilder.build(this.draft, this.scene, (done, total) => {
        this.progress = `${Math.round((done / total) * 100)}%`;
        const el = this.element?.querySelector(".nh-progress");
        if (el) el.textContent = this.progress;
      });
      HubEditor.instances.set(this.scene.id, this);
      this.draft = HubBuilder.getHub(this.scene);
      this.dirty = false;
      ui.notifications.info(L("NEONHUB.Editor.Built", { name: this.scene.name }));
    } catch (err) {
      console.error(`${MODULE_ID} | build failed`, err);
      ui.notifications.error(L("NEONHUB.Editor.BuildFailed", { error: err.message }));
    } finally {
      this.building = false;
      this.progress = null;
      if (this.rendered) this.render();
    }
  }

  static #onViewScene() {
    this.scene?.view();
  }

  static async #onActivateScene() {
    await this.scene?.activate();
    this.render();
  }

  async close(options = {}) {
    if (this.dirty && !options.force && this.draft.buttons.length) {
      const ok = await Compat.DialogV2.confirm({
        window: { title: L("NEONHUB.Editor.Unsaved") },
        content: `<p>${L("NEONHUB.Editor.UnsavedBody")}</p>`,
        rejectClose: false
      });
      if (!ok) return this;
    }
    return super.close(options);
  }

  _onClose(options) {
    super._onClose?.(options);
    if (this.scene) HubEditor.instances.delete(this.scene.id);
  }
}
