import { MODULE_ID, TILE_FLAG, HOVER_FLAG } from "../constants.js";
import { Compat } from "../compat.js";

/**
 * Lights hub buttons up under the pointer.
 *
 * Monk's Active Tile Triggers gives button tiles the hand cursor (their hover triggers only
 * land on a stop, so hovering never runs the click actions). The lit image itself is swapped
 * in here, on each user's own screen: MATT only runs hover actions for the GM while a GM is
 * connected, and a swap of the tile's texture changes nothing in the scene, so no one else
 * sees another player's hover.
 */
export const HubHover = {
  /** { tile, mesh, original } for the button under the pointer. */
  current: null,
  /** Lit images of the buttons on the viewed scene: tile id -> texture. */
  lit: new Map(),

  init() {
    // Same pointer source as MATT's own hover triggers.
    document.body.addEventListener("pointermove", () => this.move());
    Hooks.on("canvasReady", () => this.prepare());
    Hooks.on("canvasTearDown", () => this.reset());
    Hooks.on("createTile", (doc) => this.changed(doc));
    Hooks.on("updateTile", (doc) => this.changed(doc));
    Hooks.on("deleteTile", (doc) => this.changed(doc));
    Hooks.on("canvasPan", () => this.leave());
  },

  /** Load the lit images of the scene's buttons and listen to the pointer. */
  async prepare() {
    this.reset();
    const scene = canvas.scene;
    for (const doc of scene?.tiles ?? []) await this.load(doc, scene);
  },

  async load(doc, scene = canvas.scene) {
    const src = doc.getFlag(MODULE_ID, HOVER_FLAG);
    if (!src || !doc.getFlag(MODULE_ID, TILE_FLAG)) return this.lit.delete(doc.id);
    try {
      const texture = await Compat.loadTexture(src);
      if (texture && canvas.scene === scene) this.lit.set(doc.id, texture);
    } catch (err) {
      console.warn(`${MODULE_ID} | Couldn't load the lit image ${src}:`, err);
    }
  },

  /** A tile was added, rebuilt or removed: drop its hover and reload its lit image. */
  changed(doc) {
    if (doc.parent !== canvas.scene) return;
    if (this.current?.tile.document === doc) this.leave();
    this.lit.delete(doc.id);
    if (doc.parent.tiles.has(doc.id)) this.load(doc);
  },

  reset() {
    this.leave();
    this.lit.clear();
  },

  move() {
    if (!this.lit.size || !canvas?.ready) return;
    // Buttons are clicked from the token layer (like MATT's hover); on other layers, show tiles as they are.
    if (!canvas.tokens?.active) return this.leave();
    const pointer = canvas.app?.renderer?.events?.pointer;
    if (!pointer) return;
    const tile = this.tileAt(pointer.getLocalPosition(canvas.stage));
    if (tile === this.current?.tile && tile?.mesh === this.current?.mesh) return;
    this.leave();
    if (tile) this.enter(tile);
  },

  /** The topmost visible button with a lit image under a point. */
  tileAt({ x, y }) {
    let best = null;
    for (const id of this.lit.keys()) {
      const tile = canvas.tiles?.get(id);
      if (!tile?.mesh || (tile.document.hidden && !game.user.isGM)) continue;
      const { x: tx, y: ty, width, height } = tile.document;
      const left = Math.min(tx, tx + width), top = Math.min(ty, ty + height);
      if (x < left || x > left + Math.abs(width) || y < top || y > top + Math.abs(height)) continue;
      if (!best || tile.document.sort > best.document.sort) best = tile;
    }
    return best;
  },

  enter(tile) {
    const texture = this.lit.get(tile.id);
    if (!texture) return;
    this.current = { tile, mesh: tile.mesh, original: tile.texture ?? tile.mesh.texture };
    this.show(tile, texture);
  },

  leave() {
    const hovered = this.current;
    this.current = null;
    if (hovered && !hovered.mesh.destroyed && hovered.tile.mesh === hovered.mesh) this.show(hovered.tile, hovered.original);
  },

  /**
   * Put a texture on a tile the way MATT's own image actions do: the tile keeps its texture
   * and redraws its mesh from it, so both must change, then the mesh is fitted to the tile.
   */
  show(tile, texture) {
    tile.texture = texture;
    tile.mesh.texture = texture;
    tile._refreshMesh?.();
  },

  /** For troubleshooting from the console. */
  status() {
    return {
      scene: canvas.scene?.name,
      tokenLayer: !!canvas.tokens?.active,
      lit: [...this.lit.keys()].map((id) => canvas.tiles?.get(id)?.document?.getFlag(MODULE_ID, HOVER_FLAG)),
      hovered: this.current?.tile.id ?? null
    };
  }
};
