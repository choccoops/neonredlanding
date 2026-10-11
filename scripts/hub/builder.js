import { MODULE_ID, MATT_ID, HUB_FLAG, TILE_FLAG, HOVER_FLAG, THEMES } from "../constants.js";
import { Compat } from "../compat.js";
import { MATT } from "../matt.js";
import { normalizeHub, computeLayout, hashOf, slugify } from "./hub-data.js";
import { renderBackground, renderButton, canvasToFile } from "./render.js";

const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));

/**
 * Turns a hub layout into a real Scene: renders the background and button images,
 * uploads them to the world's folder, and creates or updates one MATT click tile per button.
 * Rebuilding the same hub updates its tiles in place instead of adding new ones.
 */
export class HubBuilder {
  static getHub(scene) {
    const raw = scene?.getFlag?.(MODULE_ID, HUB_FLAG);
    return raw ? normalizeHub(raw) : null;
  }

  static isHub(scene) {
    return !!scene?.getFlag?.(MODULE_ID, HUB_FLAG);
  }

  /** Tiles this module generated on a scene, by button id. */
  static ownTiles(scene) {
    const map = new Map();
    for (const tile of scene?.tiles ?? []) {
      const id = tile.getFlag(MODULE_ID, TILE_FLAG);
      if (id) map.set(id, tile);
    }
    return map;
  }

  /** In manual layout, the geometry the GM gave each tile by moving or resizing it on the canvas. */
  static manualPositions(scene) {
    const out = {};
    for (const [id, tile] of this.ownTiles(scene)) {
      out[id] = { x: Math.round(tile.x), y: Math.round(tile.y), w: Math.round(Math.abs(tile.width)), h: Math.round(Math.abs(tile.height)) };
    }
    return out;
  }

  /**
   * Build or rebuild a hub scene.
   * @param {object} hubData - the hub layout (normalized here)
   * @param {Scene|null} scene - the scene to rebuild, or null to create one
   * @param {Function} [progress] - called with (done, total) while images upload
   * @returns {Promise<Scene>}
   */
  static async build(hubData, scene = null, progress = () => {}) {
    if (!game.user.isGM) throw new Error(L("NEONHUB.Error.GMOnly"));
    if (!MATT.active) throw new Error(L("NEONHUB.Error.NoMatt"));
    const hub = normalizeHub(hubData);
    const manual = scene && hub.layout === "manual" ? this.manualPositions(scene) : {};
    const { frame, rects } = computeLayout(hub, manual);
    const theme = THEMES[hub.theme];

    if (!scene) {
      scene = await Scene.create({
        name: hub.title || L("NEONHUB.Editor.DefaultName"),
        width: frame.width,
        height: frame.height,
        padding: 0,
        backgroundColor: theme.bg,
        grid: { type: CONST.GRID_TYPES.GRIDLESS, size: 100 },
        tokenVision: false,
        fog: { exploration: false },
        navigation: true,
        navName: hub.title,
        flags: { [MODULE_ID]: { [HUB_FLAG]: hub } }
      });
    }

    const folder = await this.#ensureFolder(`${slugify(hub.title)}-${scene.id}`);
    // Working buttons also get a lit image for hover.
    const lit = (button) => hub.hover && MATT.buildActions(button, hub).length > 0;
    const total = 1 + hub.buttons.reduce((n, b) => n + (rects[b.id] ? (lit(b) ? 2 : 1) : 0), 0);
    let done = 0;

    // Background
    const bgCanvas = await renderBackground(hub);
    const bgPath = await this.#upload(bgCanvas, folder, `page-${hashOf({ hub: { ...hub, buttons: [] }, v: 2 })}`);
    progress(++done, total);

    // Buttons
    const tileData = [];
    const existing = this.ownTiles(scene);
    let sort = 1000;
    for (const button of hub.buttons) {
      const r = rects[button.id];
      if (!r) continue;
      const canvas = await renderButton(button, hub, r.w, r.h);
      const key = hashOf({ button, theme: hub.theme, w: r.w, h: r.h, v: 3 });
      const path = await this.#upload(canvas, folder, `btn-${button.id}-${key}`);
      progress(++done, total);
      let hoverPath = "";
      if (lit(button)) {
        hoverPath = await this.#upload(await renderButton(button, hub, r.w, r.h, { hover: true }), folder, `btn-${button.id}-${key}-lit`);
        progress(++done, total);
      }
      const actions = MATT.buildActions(button, hub);
      const data = {
        x: r.x,
        y: r.y,
        width: r.w,
        height: r.h,
        texture: { src: path },
        sort: sort++,
        hidden: button.gmOnly,
        locked: hub.layout !== "manual",
        flags: {
          [MATT_ID]: MATT.tileFlags(actions, { gmOnly: button.gmOnly }),
          [MODULE_ID]: { [TILE_FLAG]: button.id, [HOVER_FLAG]: hoverPath }
        }
      };
      const tile = existing.get(button.id);
      if (tile) {
        data._id = tile.id;
        existing.delete(button.id);
      }
      tileData.push(data);
    }

    const updates = tileData.filter((d) => d._id);
    const creates = tileData.filter((d) => !d._id);
    const removed = [...existing.values()].map((t) => t.id);

    await scene.update({
      width: frame.width,
      height: frame.height,
      padding: 0,
      backgroundColor: theme.bg,
      background: { src: bgPath },
      navName: hub.title,
      [`flags.${MODULE_ID}.${HUB_FLAG}`]: hub
    });
    if (removed.length) await scene.deleteEmbeddedDocuments("Tile", removed);
    // MATT action lists are replaced wholesale, never merged.
    if (updates.length) await scene.updateEmbeddedDocuments("Tile", updates, { recursive: true, diff: false });
    if (creates.length) await scene.createEmbeddedDocuments("Tile", creates);
    for (const u of updates) {
      const tile = scene.tiles.get(u._id);
      const actions = u.flags[MATT_ID].actions;
      if (tile && JSON.stringify(tile.getFlag(MATT_ID, "actions")) !== JSON.stringify(actions)) {
        await tile.update({ [`flags.${MATT_ID}.actions`]: actions });
      }
    }
    return scene;
  }

  static async #ensureFolder(name) {
    const FP = Compat.FilePicker;
    const source = Compat.uploadSource;
    const parts = ["worlds", game.world.id, MODULE_ID, name];
    let path = "";
    for (const part of parts) {
      path = path ? `${path}/${part}` : part;
      if (part === "worlds" || part === game.world.id) continue;
      try {
        await FP.createDirectory(source, path, {});
      } catch (err) {
        if (!/EEXIST|already exists/i.test(String(err?.message ?? err))) {
          // Some hosts can't create folders but still accept uploads into them; carry on.
          console.debug(`${MODULE_ID} | createDirectory ${path}:`, err);
        }
      }
    }
    return path;
  }

  static async #upload(canvas, folder, baseName) {
    const file = await canvasToFile(canvas, baseName);
    const FP = Compat.FilePicker;
    const result = await FP.upload(Compat.uploadSource, folder, file, {}, { notify: false });
    if (!result || result.status === "error") throw new Error(L("NEONHUB.Error.Upload", { file: file.name }));
    return result.path ?? `${folder}/${file.name}`;
  }
}
