import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

globalThis.foundry = { utils: { randomID: () => "x".repeat(16) } };
const { COMPANION_WINDOWS, COMPANION_MODULES, NIGHT_CITY_MAP, MESSENGER_VIEWS, BUTTON_ACTIONS } = await import("../scripts/constants.js");
const { COMPANION_CALLS } = await import("../scripts/companions.js");
const { normalizeButton, validateHub, defaultHub } = await import("../scripts/hub/hub-data.js");
const { MATT } = await import("../scripts/matt.js");

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const lang = JSON.parse(readFileSync(path.join(root, "lang/en.json"), "utf8")).NEONHUB;

test("every companion window has a call, a label and a known module", () => {
  assert.deepEqual(Object.keys(COMPANION_CALLS).sort(), Object.keys(COMPANION_WINDOWS).sort());
  for (const [key, w] of Object.entries(COMPANION_WINDOWS)) {
    assert.ok(COMPANION_MODULES[w.module], key);
    assert.ok(key.startsWith(`${w.module}/`), key);
    assert.ok(lang.Companion.Window[key.split("/")[1]], `label for ${key}`);
    assert.match(w.icon, /^fa-solid fa-/);
  }
  for (const k of Object.values(COMPANION_MODULES)) assert.ok(lang.Companion.Module[k.split(".").at(-1)], k);
  assert.ok(COMPANION_WINDOWS[NIGHT_CITY_MAP], "the Night City Map is one of them");
});

// The sibling modules' own macros, when their sources are on this machine (CI doesn't have them).
const SOURCES = {
  "cpr-neon-combat-manager": process.env.NEON_COMBAT_SRC ?? "/home/eduardo/Documents/neonencountermanager",
  "cpr-neon-at-home": process.env.NEON_HOME_SRC ?? "/home/eduardo/Documents/neonathome"
};
const NAMES = {
  "Night City Map": "map", Holocall: "holocall", "Biomon Link": "biomon", "Plot Die": "stakes", "Weapon Rebuilds": "rebuilds", "Condition Lab": "lab",
  "Install Weapon Animations": "arsenal", Home: "home",
  Loadout: "loadout", Cyberdeck: "deck", "Vehicle Bay": "bay", Weaponbench: "bench", Maintenance: "maintenance", Downtime: "downtime",
  Biomonitor: "biomonitor", "Deep Dive": "deepDive", "Perk Tree": "perkTree", "Spend IP": "spendIp"
};

test("each window opens through the same API call as its module's macro", (t) => {
  let checked = 0;
  for (const [id, src] of Object.entries(SOURCES)) {
    const dir = path.join(src, "packs/_source/macros");
    if (!existsSync(dir)) {
      t.diagnostic(`${id}: macro sources not found, skipped`);
      continue;
    }
    const macros = readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8"))).filter((m) => m.command);
    const ours = Object.keys(COMPANION_WINDOWS).filter((k) => k.startsWith(`${id}/`)).sort();
    const theirs = macros.map((m) => `${id}/${NAMES[m.name.split(": ")[1]]}`).sort();
    assert.deepEqual(ours, theirs, `${id}: one window per macro`);
    for (const m of macros) {
      const key = `${id}/${NAMES[m.name.split(": ")[1]]}`;
      const call = m.command.split("\n").find((l) => l.startsWith("return ")).replace(/^return (ncm|home)\./, "api.").replace(/\bwho\b/g, "actor").replace(/;$/, "");
      const ourCall = COMPANION_CALLS[key].toString().replace(/^\([^)]*\)\s*=>\s*/, "");
      assert.equal(ourCall, call, key);
      assert.equal(!!COMPANION_WINDOWS[key].gm, /isGM\)/.test(m.command), `${key}: GM-only like the macro`);
      checked++;
    }
  }
  if (checked) t.diagnostic(`${checked} macros matched`);
});

test("companion buttons keep a known window, the Night City Map by default", () => {
  assert.equal(normalizeButton({ action: { type: "companion" } }).action.window, NIGHT_CITY_MAP);
  assert.equal(normalizeButton({ action: { type: "companion", window: "nope/nothing" } }).action.window, NIGHT_CITY_MAP);
  assert.equal(normalizeButton({ action: { type: "companion", window: "cpr-neon-at-home/perkTree" } }).action.window, "cpr-neon-at-home/perkTree");
  const hub = defaultHub({ buttons: [{ id: "b1", label: "Map", action: { type: "companion" } }] });
  assert.deepEqual(validateHub(hub), {}, "needs no target");
  assert.ok(BUTTON_ACTIONS.companion);
});

test("a companion button becomes Neon Hub's own MATT action, for the chosen audience", () => {
  const button = normalizeButton({ label: "Night City", action: { type: "companion", window: NIGHT_CITY_MAP, audience: "everyone" } });
  const actions = MATT.buildActions(button);
  assert.deepEqual(actions.map((a) => [a.action, a.data]), [["cpr-neon-hub.opencompanion", { window: NIGHT_CITY_MAP, showto: "everyone" }]]);
});

test("the messenger's GM contacts window is the GM's", () => {
  assert.equal(MESSENGER_VIEWS.gmContacts.gm, true);
  assert.equal(normalizeButton({ action: { type: "messenger", view: "gmContacts" } }).action.view, "gmContacts");
});

test("Neon Hub's own Macros compendium: one macro per window, each calling the API with an icon that exists", () => {
  const dir = path.join(root, "packs/_source/macros");
  const macros = readdirSync(dir).map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")));
  assert.equal(macros.length, 9);
  const main = readFileSync(path.join(root, "scripts/main.js"), "utf8");
  const manifest = JSON.parse(readFileSync(path.join(root, "module.json"), "utf8"));
  assert.ok(manifest.packs.some((p) => p.name === "macros" && p.type === "Macro"), "module.json lists the pack");
  for (const m of macros) {
    assert.equal(m.type, "script");
    assert.equal(m._key, `!macros!${m._id}`);
    assert.ok(existsSync(path.join(root, m.img.replace("modules/cpr-neon-hub/", ""))), `${m.name}: icon`);
    const call = m.command.match(/^return hub\.([\w.]+)\(/m)[1];
    const last = call.split(".").at(-1);
    assert.match(main, new RegExp(`\\b${last}: `), `${m.name}: api.${call} exists`);
    assert.equal(/isGM\)/.test(m.command), m.flags["cpr-neon-hub"].gm, `${m.name}: GM check`);
  }
  assert.equal(new Set(macros.map((m) => m._id)).size, macros.length);
});
