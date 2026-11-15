/** A mook's vehicle items show under its sheet's Special Gear, which Cyberpunk RED's mook sheet leaves out. */
import { test } from "node:test";
import assert from "node:assert/strict";

const hooks = {};
globalThis.Hooks = { on: (name, fn) => (hooks[name] = fn) };
const { MookRides, vehiclesOf } = await import("../scripts/items/mook-rides.js");

// the least of a DOM the hook touches
const el = (cls = "") => ({ className: cls, dataset: {}, children: [], listeners: {},
  append(...n) { this.children.push(...n); }, addEventListener(t, f) { this.listeners[t] = f; },
  querySelector(sel) { return this.children.find((c) => typeof c === "object" && sel.split(".").filter(Boolean).every((k) => k === "a" || c.className.split(" ").includes(k))) ?? null; } });
globalThis.document = { createElement: () => el() };
const sheetOf = (type, items, existing = []) => {
  const list = el("mook-special-list");
  list.append(...existing);
  const root = { querySelector: (s) => (s === ".mook-special-list" ? list : null) };
  return { list, sheet: { actor: { type, items } }, html: [root] };
};
const opened = [];
const item = (name, type = "vehicle") => ({ id: name, name, type, sheet: { render: () => opened.push(name) } });

test("vehicles are picked out by name order", () => {
  assert.deepEqual(vehiclesOf({ items: [item("Zeta"), item("Knife", "weapon"), item("Atlus")] }).map((i) => i.name), ["Atlus", "Zeta"]);
  assert.deepEqual(vehiclesOf(null), []);
});

test("a mook's vehicles join the Special Gear list, once, and open on a click", () => {
  MookRides.init();
  const gear = el("name item");
  const { list, sheet, html } = sheetOf("mook", [item('Brennan Apollo "Harriet"'), item("Medscanner", "gear")], [gear]);
  hooks.renderActorSheet(sheet, html);
  assert.deepEqual(list.children.length, 3, "the gear, a comma, the ride");
  assert.equal(list.children[1], ", ");
  const link = list.children[2];
  assert.equal(link.textContent, 'Brennan Apollo "Harriet"');
  link.listeners.click({ preventDefault() {} });
  assert.deepEqual(opened, ['Brennan Apollo "Harriet"']);
  hooks.renderActorSheet(sheet, html);
  assert.equal(list.children.length, 3, "a second render of the same element adds nothing");
});

test("nothing is added for a character, or a mook with no vehicle", () => {
  const pc = sheetOf("character", [item("Atlus")]);
  hooks.renderActorSheet(pc.sheet, pc.html);
  assert.equal(pc.list.children.length, 0);
  const mook = sheetOf("mook", [item("Medscanner", "gear")]);
  hooks.renderActorSheet(mook.sheet, mook.html);
  assert.equal(mook.list.children.length, 0);
});
