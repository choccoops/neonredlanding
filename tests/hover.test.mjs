import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.foundry = { utils: { getProperty: (o, k) => k.split(".").reduce((x, p) => x?.[p], o) } };
globalThis.game = { user: { isGM: false } };
const { HubHover } = await import("../scripts/hub/hover.js");

const normal = { name: "normal" }, lit = { name: "lit" };
function makeTile(id, x, y, { hidden = false, sort = 0 } = {}) {
  const tile = {
    id, texture: normal, refreshed: 0,
    mesh: { texture: normal, destroyed: false },
    document: { x, y, width: 100, height: 50, hidden, sort, getFlag: () => "lit.webp" },
    _refreshMesh() { this.refreshed++; }
  };
  return tile;
}
function stage(tiles, pos) {
  globalThis.canvas = {
    ready: true,
    tokens: { active: true },
    tiles: { get: (id) => tiles.find((t) => t.id === id) },
    stage: {},
    app: { renderer: { events: { pointer: { getLocalPosition: () => pos } } } }
  };
  HubHover.current = null;
  HubHover.lit = new Map(tiles.map((t) => [t.id, lit]));
}

test("hovering a button shows its lit image on the tile and its mesh, and leaving restores it", () => {
  const a = makeTile("a", 0, 0);
  stage([a], { x: 50, y: 25 });
  HubHover.move();
  assert.equal(a.texture, lit);
  assert.equal(a.mesh.texture, lit);
  assert.equal(a.refreshed, 1, "the mesh is refitted to the tile");
  canvas.app.renderer.events.pointer.getLocalPosition = () => ({ x: 500, y: 500 });
  HubHover.move();
  assert.equal(a.texture, normal);
  assert.equal(a.mesh.texture, normal);
  assert.equal(HubHover.current, null);
});

test("only the topmost button lights up, and hidden ones never do for players", () => {
  const low = makeTile("low", 0, 0, { sort: 1 }), high = makeTile("high", 0, 0, { sort: 2, hidden: true });
  stage([low, high], { x: 10, y: 10 });
  HubHover.move();
  assert.equal(high.mesh.texture, normal);
  assert.equal(low.mesh.texture, lit);
  HubHover.leave();
  game.user.isGM = true;
  HubHover.move();
  assert.equal(high.mesh.texture, lit);
  game.user.isGM = false;
  HubHover.leave();
});

test("off the token layer, buttons show as they are", () => {
  const a = makeTile("a", 0, 0);
  stage([a], { x: 50, y: 25 });
  HubHover.move();
  canvas.tokens.active = false;
  HubHover.move();
  assert.equal(a.mesh.texture, normal);
});
