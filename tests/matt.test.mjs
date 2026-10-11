import { test } from "node:test";
import assert from "node:assert/strict";

let n = 0;
globalThis.foundry = {
  utils: {
    randomID: () => `id${++n}`,
    deepClone: (o) => structuredClone(o),
    mergeObject: (a, b) => Object.assign(a, b),
    getProperty: (o, k) => k.split(".").reduce((x, p) => x?.[p], o)
  }
};
const { MATT } = await import("../scripts/matt.js");

const play = [{ id: "a1", action: "playsound", data: {} }];

test("working buttons trigger on click and hover, with the hand cursor", () => {
  const flags = MATT.tileFlags(play);
  assert.equal(flags.active, true);
  assert.deepEqual(flags.trigger, ["click", "hoverin", "hoverout"]);
  assert.equal(flags.pointer, true);
});

test("landings run the actions on click only; hovering stops at once", () => {
  const actions = MATT.tileFlags(play).actions;
  assert.deepEqual(actions.map((a) => a.action), ["anchor", "playsound", "anchor", "anchor"]);
  assert.deepEqual(actions[0].data, { tag: "_click", stop: false });
  assert.deepEqual(actions[2].data, { tag: "_hoverin", stop: true });
  assert.deepEqual(actions[3].data, { tag: "_hoverout", stop: true });
  assert.equal(new Set(actions.map((a) => a.id)).size, actions.length, "every action has its own id");
});

test("buttons that do nothing stay inactive click tiles", () => {
  const flags = MATT.tileFlags([]);
  assert.equal(flags.active, false);
  assert.equal(flags.trigger, "click");
  assert.deepEqual(flags.actions, []);
});

test("GM-only buttons can only be triggered by the GM", () => {
  assert.equal(MATT.tileFlags(play, { gmOnly: true }).controlled, "gm");
  assert.equal(MATT.tileFlags(play).controlled, "all");
});
