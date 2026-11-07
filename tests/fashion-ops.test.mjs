import { test } from "node:test";
import assert from "node:assert/strict";

const settings = new Map([["lifestyleEra", "2070"], ["credShowCrew", false], ["calendars", []]]);
const get = (o, k) => k.split(".").reduce((x, p) => x?.[p], o);
globalThis.foundry = {
  utils: {
    randomID: () => "x",
    deepClone: (o) => structuredClone(o),
    getProperty: get,
    hasProperty: (o, k) => get(o, k) !== undefined,
    setProperty: (o, k, v) => {
      const parts = k.split(".");
      const last = parts.pop();
      parts.reduce((x, p) => (x[p] ??= {}), o)[last] = v;
    }
  }
};
globalThis.Handlebars = { escapeExpression: (s) => String(s) };
globalThis.Hooks = { callAll() {}, on() {}, once() {} };

const item = (type, name, system, flags = {}) => ({
  type, name, system, uuid: `Item.${name}`,
  getFlag: (mod, key) => flags[key],
  toObject() {
    return { name, type, system: structuredClone(system), flags: { "cpr-neon-hub": structuredClone(flags) } };
  }
});
const created = [];
const updated = [];
const v = {
  id: "v", uuid: "Actor.v", name: "V", type: "character", hasPlayerOwner: true, isOwner: true, bonuses: {},
  system: { stats: { cool: { value: 7 }, int: { value: 6 } }, wealth: { value: 600, transactions: [] } },
  items: [
    item("clothing", "Holo-Print Tee", { type: "top", style: "genericChic", equipped: "equipped", price: { market: 20 } }, { fashion: { style: "kitsch" } }),
    item("clothing", "Old Leisure Pants", { type: "bottoms", style: "leisurewear", equipped: "equipped", price: { market: 20 } }),
    item("clothing", "Neon Tyger Jacket", { type: "jacket", style: "gangColors", equipped: "equipped", price: { market: 50 } }, { fashion: { style: "gangColors", faction: "tyger-claws" } }),
    item("clothing", "Spare Hat", { type: "hats", style: "genericChic", equipped: "carried", price: { market: 10 } }),
    item("cyberware", "Cyberarm", { type: "cyberArm", isInstalled: true, isFoundational: true }),
    item("cyberware", "Cybereye", { type: "cyberEye", isInstalled: true, isFoundational: true }),
    item("cyberware", "Cybereye", { type: "cyberEye", isInstalled: true, isFoundational: true }),
    item("cyberware", "Techhair", { type: "fashionware", isInstalled: true }),
    item("cyberware", "Neural Link", { type: "neuralWare", isInstalled: true }),
    item("cyberware", "Spare Cyberleg", { type: "cyberLeg", isInstalled: false, isFoundational: true }),
    item("weapon", "Pistol", { equipped: "equipped", concealable: { concealable: true, isConcealed: false } }),
    item("weapon", "Holdout", { equipped: "carried", concealable: { concealable: true, isConcealed: false } }),
    item("weapon", "Rifle", { equipped: "carried", concealable: { concealable: false } }),
    item("armor", "Light Armorjack", { equipped: "equipped", isBodyLocation: true, bodyLocation: { sp: 11 } }),
    item("skill", "Wardrobe & Style", { level: 5 }),
    item("skill", "Personal Grooming", { level: 3 })
  ],
  getFlag: () => null,
  async update(data) {
    for (const [k, val] of Object.entries(data)) globalThis.foundry.utils.setProperty(this, k, val);
  },
  async updateEmbeddedDocuments(type, data) {
    updated.push(...data);
  },
  async createEmbeddedDocuments(type, data) {
    created.push(...data);
    return data;
  }
};
const shop = {
  "Compendium.cpr-neon-hub.fashion-2070.Item.a": item("clothing", "Light-Up Platforms", { type: "footwear", style: "genericChic", equipped: "owned", price: { market: 20 } }, { fashion: { style: "kitsch" } }),
  "Compendium.cpr-neon-hub.fashion-2070.Item.b": item("clothing", "Plastic Bling", { type: "jewelry", style: "genericChic", equipped: "owned", price: { market: 50 } }, { fashion: { style: "kitsch" } })
};
globalThis.fromUuid = async (u) => shop[u] ?? null;
const translations = { CPR: { global: { clothing: { style: { bagLadyChic: "Bag Lady Chic", businessWear: "Businesswear", asiaPop: "Asia Pop", gangColors: "Gang Colors" } } } } };
const pack = {
  getIndex: async () => Object.entries(shop).map(([uuid, i]) => ({ uuid, name: i.name, type: i.type, img: "i", system: i.system, flags: { "cpr-neon-hub": { fashion: i.getFlag("x", "fashion") } } }))
};
globalThis.game = {
  user: { id: "gm", isGM: true, name: "GM" },
  users: [],
  actors: [v],
  items: [],
  journal: [],
  packs: new Map([["cpr-neon-hub.fashion-2070", pack]]),
  i18n: { translations, localize: (k) => ({ "NEONHUB.Fashion.Style.entropism": "Entropism", "NEONHUB.Fashion.Style.neoMilitarism": "Neo-Militarism", "NEONHUB.Fashion.Style.kitsch": "Kitsch", "NEONHUB.Fashion.Style.gangColors": "Gang Colors" }[k] ?? k), format: (k) => k, has: () => true },
  settings: { register() {}, get: (m, k) => settings.get(k) ?? {}, set: async (m, k, val) => settings.set(k, val) }
};

const { FashionOps } = await import("../scripts/fashion/fashion-ops.js");

test("a character's kit: worn clothes in 2070 styles, chrome, weapons and armor in sight", () => {
  const kit = FashionOps.kitOf(v);
  assert.deepEqual(kit.clothing.map((c) => [c.name, c.style, c.faction]), [
    ["Holo-Print Tee", "kitsch", null], ["Old Leisure Pants", "kitsch", null], ["Neon Tyger Jacket", "gangColors", "tyger-claws"]
  ], "only what's worn, old styles read as their heir");
  assert.deepEqual(kit.chrome, { visible: 2, hidden: 1, fashionware: 1, frames: 0 }, "the arm and the eyes (once); not the uninstalled leg");
  assert.deepEqual(kit.weapons, { visible: 2, hidden: 1 }, "the drawn pistol and the slung rifle; the holdout's tucked away");
  assert.equal(kit.armor.visible, 1);
  assert.deepEqual(kit.skills, { ws: 5, pg: 3, hp: 0, cool: 7, int: 6 });
});

test("in the 2070s the sheet's classic style names show their heir", () => {
  FashionOps.relabel();
  const s = translations.CPR.global.clothing.style;
  assert.equal(s.bagLadyChic, "Entropism");
  assert.equal(s.businessWear, "Neo-Militarism");
  assert.equal(s.asiaPop, "Kitsch (Asia Pop)");
  assert.equal(s.gangColors, "Gang Colors");
});

test("the catalog reads the fashion compendium; buying pays, takes off and puts on", async () => {
  const catalog = await FashionOps.catalog();
  assert.deepEqual(catalog.map((c) => [c.name, c.type, c.style]), [["Light-Up Platforms", "footwear", "kitsch"], ["Plastic Bling", "jewelry", "kitsch"]]);
  await FashionOps.buy(v, Object.keys(shop));
  assert.equal(v.system.wealth.value, 530);
  assert.equal(v.system.wealth.transactions.length, 1);
  assert.deepEqual(created.map((c) => [c.name, c.system.equipped]), [["Light-Up Platforms", "equipped"], ["Plastic Bling", "equipped"]]);
  v.system.wealth.value = 10;
  await assert.rejects(() => FashionOps.buy(v, Object.keys(shop)), /TooPoor/);
});

test("district fit and reads include Street Cred", () => {
  const fit = FashionOps.fit(v, "japantown");
  assert.ok(fit.reasons.some((r) => r.key === "ownTurf"));
  assert.equal(FashionOps.reads(v)[0].id, "tyger-claws");
  assert.equal(FashionOps.fit(v, "nowhere"), null);
});
