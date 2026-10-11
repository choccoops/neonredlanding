import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

// Foundry v12 declares its classes with top-level `class` statements in classic scripts:
// global names, but not properties of globalThis. Recreate that, then load Compat.
vm.runInThisContext(`
  class FilePicker { static upload() { return "uploaded"; } }
  class TextEditor { static getDragEventData() { return { type: "Actor" }; } }
  class FormDataExtended { constructor() { this.object = { a: 1 }; } }
  class ForgeVTT { static usingTheForge = true; }
`);
globalThis.foundry = { utils: { getProperty: (o, k) => k.split(".").reduce((x, p) => x?.[p], o) } };
const { Compat } = await import("../scripts/compat.js");

test("v12 class globals aren't on globalThis (the bug this guards against)", () => {
  assert.equal(globalThis.FilePicker, undefined);
});

test("Compat finds v12 globals declared as classes", () => {
  assert.equal(Compat.FilePicker?.upload(), "uploaded");
  assert.deepEqual(Compat.getDragEventData({}), { type: "Actor" });
  assert.deepEqual(new Compat.FormDataExtended().object, { a: 1 });
  assert.equal(Compat.uploadSource, "forgevtt", "The Forge is detected, so uploads go to the asset library");
});

test("v13's namespaced classes win when present", () => {
  class V13Picker { static upload() { return "v13"; } }
  foundry.applications = { apps: { FilePicker: { implementation: V13Picker } } };
  assert.equal(Compat.FilePicker.upload(), "v13");
  delete foundry.applications;
});
