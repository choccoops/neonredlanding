import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultHub, defaultButton, normalizeHub, normalizeButton, validateHub } from "../scripts/hub/hub-data.js";
import { THEMES, DEFAULT_THEME, BUTTON_ACTIONS, MESSENGER_VIEWS } from "../scripts/constants.js";

test("new hubs use the Night City chrome theme; unknown themes fall back to it", () => {
  assert.equal(DEFAULT_THEME, "chrome");
  assert.ok(THEMES.chrome.chrome);
  assert.equal(defaultHub().theme, "chrome");
  assert.equal(normalizeHub({ theme: "nope" }).theme, "chrome");
  assert.equal(normalizeHub({ theme: "neon" }).theme, "neon", "existing hubs keep their theme");
});

test("messenger buttons open a known window, inbox by default", () => {
  assert.ok(BUTTON_ACTIONS.messenger);
  assert.equal(normalizeButton({ action: { type: "messenger" } }).action.view, "inbox");
  assert.equal(normalizeButton({ action: { type: "messenger", view: "admin" } }).action.view, "admin");
  assert.equal(normalizeButton({ action: { type: "messenger", view: "hack" } }).action.view, "inbox");
  assert.deepEqual(Object.keys(MESSENGER_VIEWS), ["inbox", "compose", "contacts", "networks", "admin"]);
  assert.ok(MESSENGER_VIEWS.admin.gm && !MESSENGER_VIEWS.inbox.gm);
});

test("messenger, calendar and lifestyle buttons need no target", () => {
  const hub = normalizeHub(defaultHub({
    buttons: ["messenger", "calendar", "lifestyle"].map((type) => defaultButton({ label: type, action: { type } }))
  }));
  assert.deepEqual(validateHub(hub), {});
});

test("buttons light up on hover unless the page turns it off", () => {
  assert.equal(defaultHub().hover, true);
  assert.equal(normalizeHub({}).hover, true, "pages built before 1.4.0 get it");
  assert.equal(normalizeHub({ hover: false }).hover, false);
});
