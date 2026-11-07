import { MODULE_ID, TEMPLATE_PATH } from "../constants.js";
import { Compat } from "../compat.js";
import { CPR } from "../cpr.js";
import { CredStore } from "../cred/cred-store.js";
import { FashionOps } from "./fashion-ops.js";
import {
  TYPES, CORE, DISTRICTS, district, analyze, fitIn, readAs, disguiseOf, disguiseBase, watcherBase, crewCohesion, targetStyle,
  shoppingList, feedTopics, seeded, rulesOf, lookOf
} from "./fashion-data.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));
const esc = (s) => Handlebars.escapeExpression(String(s ?? ""));
const DIALOG = ["neon-hub", "nh-cal-dialog", "nh-fashion-dialog"];
const TABS = ["look", "districts", "factions", "shop", "feed"];
const warn = (err) => ui.notifications.warn(err?.message ?? String(err));
/** How many lines each street feed topic has in lang/en.json (NEONHUB.Fashion.Feed.<topic>.<n>). */
export const FEED_LINES = {
  sharp: 5, ok: 4, rough: 5, fits: 4, outOfPlace: 5, meh: 3, rival: 4, chrome: 4, armed: 4, rich: 4,
  "look.entropism": 3, "look.nomadLeathers": 3, "look.kitsch": 3, "look.neoMilitarism": 3, "look.neoKitsch": 3, "look.highFashion": 3, "look.gangColors": 3
};
const HANDLES = 16;

const styleName = (s) => (s ? L(`NEONHUB.Fashion.Style.${s}`) : L("NEONHUB.Fashion.Mixed"));
const factionName = (id) => FashionOps.faction(id)?.name ?? CredStore.faction(id)?.name ?? id;
const reasonText = (r) => L(`NEONHUB.Fashion.Reason.${r.key}`, { ...r.data, style: styleName(r.data?.style), faction: factionName(r.data?.faction) });
const warningText = (w) => L(`NEONHUB.Fashion.Warning.${w.key}`, { ...w.data, faction: factionName(w.data?.faction) });
const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");
const eb = (n) => `${Number(n || 0).toLocaleString()}eb`;

/** The street feed for a look in a district: a few in-world comments, the same until the look changes. */
export function feedFor(actor, analysis, fit, count = 6) {
  const topics = feedTopics(analysis, fit);
  const rand = seeded(`${actor.id}|${fit?.district ?? ""}|${analysis.score}|${analysis.look ?? analysis.dominant}`);
  const d = fit ? district(fit.district) : null;
  const lines = [];
  const used = new Set();
  for (let i = 0; i < count * 4 && lines.length < count; i++) {
    const topic = topics[Math.floor(rand() * topics.length)];
    const n = 1 + Math.floor(rand() * (FEED_LINES[topic] ?? 1));
    const key = `${topic}.${n}`;
    if (used.has(key)) continue;
    used.add(key);
    const handle = L(`NEONHUB.Fashion.Handle.${1 + Math.floor(rand() * HANDLES)}`);
    lines.push({
      handle,
      text: L(`NEONHUB.Fashion.Feed.${key}`, { name: actor.name, district: d?.name ?? L("NEONHUB.Fashion.TheCity"), style: styleName(analysis.look ?? analysis.dominant) }),
      likes: Math.floor(rand() * 900) + 3,
      bad: ["rough", "outOfPlace", "rival", "meh"].includes(topic)
    });
  }
  return lines;
}

/**
 * Style Check: how a character's look reads on the streets of 2070s Night City. A score and grade,
 * how they fit each district, which faction they read as and how good a disguise it makes, a
 * shopping list, the street's comments, and for the GM the whole scene at once.
 */
export class FashionApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static instance = null;

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-fashion`,
    classes: ["neon-hub", "nh-cal-app", "nh-cred-app", "nh-fashion-app"],
    tag: "div",
    window: { title: "NEONHUB.Fashion.Title", icon: "fa-solid fa-shirt", resizable: true },
    position: { width: 940, height: 740 },
    actions: {
      pick: FashionApp.#onPick,
      tab: FashionApp.#onTab,
      disguise: FashionApp.#onDisguise,
      buy: FashionApp.#onBuy,
      openItem: FashionApp.#onOpenItem,
      postFeed: FashionApp.#onPostFeed,
      openCred: FashionApp.#onOpenCred
    }
  };

  static PARTS = {
    main: { template: `${TEMPLATE_PATH}/fashion/fashion.hbs`, scrollable: [".nh-cred-scroll", ".nh-cred-rail-list"] }
  };

  constructor(options = {}) {
    super(options);
    this.actorUuid = options.actorUuid ?? null;
    this.tab = "look";
    this.district = null;
    this.disguiseAs = null;
    this.shopFor = null;
    this.budget = null;
  }

  static open(actor = null, { tab = null } = {}) {
    const uuid = typeof actor === "string" ? actor : actor?.uuid ?? null;
    this.instance ??= new this({ actorUuid: uuid });
    if (uuid) this.instance.actorUuid = uuid;
    if (tab) this.instance.tab = tab;
    this.instance.render({ force: true });
    this.instance.bringToFront?.();
    return this.instance;
  }

  static refresh() {
    if (this.instance?.rendered) this.instance.render();
  }

  /** Re-render when something an open window shows changes (an actor, its items, the scene). */
  static refreshFor(actor) {
    const app = this.instance;
    if (!app?.rendered) return;
    if (!actor || app.tab === "scene" || app.actor?.id === actor.id) app.render();
  }

  get actor() {
    const list = CredStore.characters();
    return list.find((a) => a.uuid === this.actorUuid) ?? list.find((a) => a.id === game.user.character?.id) ?? list[0] ?? null;
  }

  /** The district in view: picked here, else the scene's. */
  get districtId() {
    return this.district ?? FashionOps.sceneDistrict() ?? "kabuki";
  }

  async _prepareContext() {
    const isGM = game.user.isGM;
    const characters = CredStore.characters();
    const actor = this.actor;
    const tab = this.tab === "scene" && !isGM ? "look" : this.tab;
    const context = { isGM, none: !actor, [`is_${tab}`]: true };
    context.tabs = [...TABS, ...(isGM ? ["scene"] : [])].map((id) => ({ id, label: L(`NEONHUB.Fashion.Tab.${id}`), active: tab === id }));
    const sceneDistrict = FashionOps.sceneDistrict();
    context.districtOptions = DISTRICTS.map((d) => ({ id: d.id, name: `${d.name} (${d.borough})`, selected: d.id === this.districtId }));
    context.rail = characters.map((a) => {
      const an = FashionOps.analyze(a);
      return { uuid: a.uuid, name: a.name, img: a.img, grade: an.grade, look: styleName(an.look ?? an.dominant), active: a.uuid === actor?.uuid };
    });
    if (tab === "scene") return Object.assign(context, await this.#sceneContext(sceneDistrict));
    if (!actor) return context;

    const an = FashionOps.analyze(actor);
    const fit = FashionOps.fit(actor, this.districtId, an);
    context.actor = { uuid: actor.uuid, name: actor.name, img: actor.img };
    context.an = {
      score: an.score,
      grade: an.grade,
      gradeLabel: L(`NEONHUB.Fashion.Grade.${an.grade}`),
      look: an.look ? styleName(an.look) : null,
      dominant: styleName(an.dominant),
      cohesion: an.cohesion,
      cost: eb(an.cost),
      missing: an.missing.map((t) => L(`NEONHUB.Fashion.Type.${t}`)).join(", "),
      parts: Object.entries(an.parts).map(([k, v]) => ({ label: L(`NEONHUB.Fashion.Part.${k}`), value: v, max: { coverage: 30, cohesion: 25, quality: 20, flair: 10, skill: 15 }[k] }))
        .map((p) => ({ ...p, pct: Math.round((p.value / p.max) * 100) })),
      chrome: an.kit.chrome,
      weapons: an.kit.weapons,
      armor: an.kit.armor.visible
    };
    context.slots = TYPES.map((type) => {
      const p = an.kit.clothing.find((c) => c.type === type);
      return {
        type: L(`NEONHUB.Fashion.Type.${type}`),
        core: CORE.includes(type),
        piece: p ? { name: p.name, style: styleName(p.style), styleKey: p.style, price: eb(p.price), faction: p.faction ? factionName(p.faction) : null, uuid: p.uuid } : null
      };
    });
    const d = district(this.districtId);
    context.fit = fit && this.#fitRow(fit);
    context.district = { name: d.name, zone: L(`NEONHUB.Fashion.Zone.${d.zone}`), sc: d.sc, uc: d.uc, isScene: d.id === sceneDistrict, rules: rulesOf(d) };

    if (tab === "districts") context.fits = FashionOps.fits(actor, an).map((f) => this.#fitRow(f));

    if (tab === "factions") {
      const readList = FashionOps.reads(actor, an);
      context.reads = readList.slice(0, 8).map((r) => ({ ...r, band: L(`NEONHUB.Fashion.Disguise.${disguiseOf(r.score).key}`) }));
      const target = FashionOps.faction(this.disguiseAs) ?? FashionOps.faction(readList[0]?.id);
      context.factionOptions = FashionOps.readableFactions().map((f) => ({ id: f.id, name: f.name, selected: f.id === target?.id }));
      if (target) {
        const score = readAs(an, target);
        const dg = disguiseOf(score);
        const look = lookOf(target);
        context.disguise = {
          id: target.id,
          name: target.name,
          score,
          key: dg.key,
          band: L(`NEONHUB.Fashion.Disguise.${dg.key}`),
          modifier: dg.modifier === null ? null : signed(dg.modifier),
          canRoll: dg.modifier !== null && actor.isOwner,
          base: disguiseBase(an.kit),
          wants: Object.entries(look.styles).sort((a, b) => b[1] - a[1]).map(([s, share]) => `${styleName(s)} ${Math.round(share * 100)}%`).join(", "),
          chrome: L(`NEONHUB.Fashion.Chrome.${look.chrome}`)
        };
      }
    }

    if (tab === "shop") {
      const target = this.shopFor ?? `d:${this.districtId}`;
      const [kind, id] = target.split(":");
      const faction = kind === "f" ? FashionOps.faction(id) : null;
      const shopDistrict = kind === "d" ? district(id) : null;
      const style = targetStyle({ district: shopDistrict, faction });
      const wallet = CPR.hasWealth(actor) ? CPR.getWealth(actor) : 0;
      const budget = this.budget ?? wallet;
      const list = shoppingList(an, await FashionOps.catalog(), { style, faction: faction?.id ?? null, budget });
      const after = analyze(list.kit);
      const scoreFor = (a) => (faction ? readAs(a, faction) : fitIn(a, shopDistrict, FashionOps.credContext(actor)).fit);
      context.shop = {
        targets: [
          ...DISTRICTS.map((x) => ({ value: `d:${x.id}`, label: x.name, selected: target === `d:${x.id}` })),
          ...FashionOps.readableFactions().map((f) => ({ value: `f:${f.id}`, label: L("NEONHUB.Fashion.Shop.PassAs", { name: f.name }), selected: target === `f:${f.id}` }))
        ],
        style: styleName(style),
        budget,
        wallet: eb(wallet),
        isFaction: !!faction,
        buy: list.buy.map((b) => ({ ...b, typeLabel: L(`NEONHUB.Fashion.Type.${b.type}`), price: eb(b.price), faction: b.faction ? factionName(b.faction) : null })),
        spent: eb(list.spent),
        canBuy: actor.isOwner && list.buy.length && list.spent <= wallet,
        uuids: list.buy.map((b) => b.uuid).join(","),
        before: { grade: an.grade, score: scoreFor(an) },
        after: { grade: after.grade, score: scoreFor(after) },
        unit: faction ? "%" : ""
      };
    }

    if (tab === "feed") context.feed = feedFor(actor, an, fit);
    return context;
  }

  #fitRow(f) {
    const d = district(f.district);
    return {
      id: d.id,
      name: d.name,
      borough: d.borough,
      zone: L(`NEONHUB.Fashion.Zone.${d.zone}`),
      fit: signed(f.fit),
      side: f.fit > 0 ? "pos" : f.fit < 0 ? "neg" : "zero",
      band: L(`NEONHUB.Fashion.Fit.${f.band}`),
      modifier: signed(f.modifier),
      bar: { left: f.fit >= 0 ? 50 : 50 - Math.abs(f.fit) * 5, width: Math.abs(f.fit) * 5 },
      reasons: f.reasons.map((r) => ({ text: reasonText(r), n: signed(r.n), side: r.n > 0 ? "pos" : "neg" })),
      warnings: f.warnings.map(warningText)
    };
  }

  /** The GM's view of the scene: every token's look, the crew as a whole, and what could go wrong. */
  async #sceneContext(sceneDistrict) {
    const scene = canvas?.scene;
    if (!scene) return { scene: null };
    const d = district(sceneDistrict);
    const tokens = scene.tokens.filter((t) => t.actor && !t.hidden);
    const pcs = [];
    const npcs = [];
    const seen = new Set();
    for (const t of tokens) {
      const a = t.actor;
      if (seen.has(a.id) && a.type === "character") continue;
      seen.add(a.id);
      const an = FashionOps.analyze(a);
      const read = FashionOps.reads(a, an)[0];
      const row = {
        name: t.name,
        img: t.texture?.src ?? a.img,
        grade: an.grade,
        look: styleName(an.look ?? an.dominant),
        read: read && read.score >= 40 ? `${read.name} ${read.score}%` : L("NEONHUB.Fashion.NoRead"),
        weapons: an.kit.weapons.visible,
        chrome: an.kit.chrome.visible,
        armor: an.kit.armor.visible,
        an,
        actor: a
      };
      if (a.type === "character" && a.hasPlayerOwner) {
        const fit = d ? fitIn(an, d, FashionOps.credContext(a)) : null;
        Object.assign(row, fit ? { fit: signed(fit.fit), side: fit.fit > 0 ? "pos" : fit.fit < 0 ? "neg" : "zero", band: L(`NEONHUB.Fashion.Fit.${fit.band}`), modifier: signed(fit.modifier), warnings: fit.warnings.map(warningText), fitValue: fit.fit } : {});
        pcs.push(row);
      } else {
        const known = FashionOps.knownFaction(a, an);
        row.uuid = a.uuid;
        row.faction = known?.id ?? "";
        row.tagged = !!known?.tagged;
        row.factionOptions = FashionOps.readableFactions().map((f) => ({ id: f.id, name: f.name, selected: f.id === a.getFlag(MODULE_ID, "faction") }));
        npcs.push(row);
      }
    }
    // Flashpoints: a PC in colors an NPC faction here hates, Marked or worse with them, or hot with cops around.
    const flash = [];
    for (const pc of pcs) {
      for (const npc of npcs.filter((n) => n.faction)) {
        const rivals = new Set(CredStore.rivalsOf(npc.faction).map((f) => f.id));
        const colors = [...new Set(pc.an.kit.clothing.map((p) => p.faction).filter(Boolean))];
        for (const c of colors.filter((c) => rivals.has(c))) flash.push(L("NEONHUB.Fashion.Flash.Colors", { pc: pc.name, npc: npc.name, faction: factionName(c) }));
        const standing = npc.faction === "ncpd" ? null : CredStore.standing(pc.actor, npc.faction);
        if (standing !== null && standing <= -5) flash.push(L("NEONHUB.Fashion.Flash.Marked", { pc: pc.name, npc: npc.name, faction: factionName(npc.faction), value: signed(standing) }));
        if (npc.faction === "ncpd" && CredStore.heat(pc.actor) >= 3) flash.push(L("NEONHUB.Fashion.Flash.Heat", { pc: pc.name, npc: npc.name, heat: signed(CredStore.heat(pc.actor)) }));
      }
    }
    const crew = crewCohesion(pcs.map((p) => p.an));
    const weakest = pcs.filter((p) => p.fitValue !== undefined).sort((a, b) => a.fitValue - b.fitValue)[0];
    const strip = (rows) => rows.map(({ an, actor, ...rest }) => rest);
    return {
      scene: { name: scene.name, district: d ? `${d.name} (${L(`NEONHUB.Fashion.Zone.${d.zone}`)}, SC ${d.sc})` : null },
      sceneDistrictOptions: [{ id: "", name: L("NEONHUB.Fashion.Scene.NoDistrict"), selected: !d }, ...DISTRICTS.map((x) => ({ id: x.id, name: `${x.name} (${x.borough})`, selected: x.id === d?.id }))],
      pcs: strip(pcs),
      npcs: strip(npcs),
      crew: pcs.length ? { style: styleName(crew.style), percent: crew.percent, weakest: weakest ? `${weakest.name} (${weakest.fit})` : null } : null,
      flash: [...new Set(flash)]
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const el = this.element;
    el.querySelector("select[name=district]")?.addEventListener("change", (ev) => {
      this.district = ev.target.value;
      this.render();
    });
    el.querySelector("select[name=disguiseAs]")?.addEventListener("change", (ev) => {
      this.disguiseAs = ev.target.value;
      this.render();
    });
    el.querySelector("select[name=shopFor]")?.addEventListener("change", (ev) => {
      this.shopFor = ev.target.value;
      this.render();
    });
    el.querySelector("input[name=budget]")?.addEventListener("change", (ev) => {
      this.budget = Math.max(0, Math.round(Number(ev.target.value) || 0));
      this.render();
    });
    el.querySelector("select[name=sceneDistrict]")?.addEventListener("change", async (ev) => {
      if (!canvas?.scene) return;
      await FashionOps.setSceneDistrict(canvas.scene, ev.target.value).catch(warn);
      this.district = null;
      this.render();
    });
    for (const sel of el.querySelectorAll("select[data-tag-faction]")) {
      sel.addEventListener("change", async (ev) => {
        const actor = await fromUuid(ev.target.dataset.tagFaction);
        if (actor) await FashionOps.tagFaction(actor, ev.target.value).catch(warn);
        this.render();
      });
    }
    for (const row of el.querySelectorAll("[data-drag-uuid]")) {
      row.addEventListener("dragstart", (ev) => ev.dataTransfer.setData("text/plain", JSON.stringify({ type: "Item", uuid: row.dataset.dragUuid })));
    }
  }

  static #onPick(event, target) {
    this.actorUuid = target.dataset.uuid;
    if (this.tab === "scene") this.tab = "look";
    this.render();
  }

  static #onTab(event, target) {
    this.tab = target.dataset.tab;
    this.render();
  }

  /** Roll the disguise check: COOL + Wardrobe & Style + 1d10 + the look's modifier. */
  static async #onDisguise() {
    const actor = this.actor;
    const faction = FashionOps.faction(this.disguiseAs) ?? FashionOps.faction(FashionOps.reads(actor)[0]?.id);
    if (!faction) return;
    const an = FashionOps.analyze(actor);
    const { modifier, key } = disguiseOf(readAs(an, faction));
    if (modifier === null) return ui.notifications.warn(L("NEONHUB.Fashion.Disguise.CantPass", { name: faction.name }));
    const roll = await new Roll(`1d10 + ${disguiseBase(an.kit)} + ${modifier}`).evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `<b>${esc(L("NEONHUB.Fashion.Disguise.Roll", { name: faction.name }))}</b> (${esc(L(`NEONHUB.Fashion.Disguise.${key}`))}, ${signed(modifier)})<br>${esc(L("NEONHUB.Fashion.Disguise.Against", { watcher: L("NEONHUB.Fashion.Disguise.WatcherFormula") }))}`
    });
  }

  static async #onBuy(event, target) {
    const actor = this.actor;
    const uuids = target.dataset.uuids.split(",").filter(Boolean);
    const ok = await Compat.DialogV2.confirm({
      window: { title: L("NEONHUB.Fashion.Shop.Buy") },
      classes: DIALOG,
      content: `<p>${esc(L("NEONHUB.Fashion.Shop.BuyBody", { name: actor.name, n: uuids.length, total: target.dataset.total }))}</p>`,
      rejectClose: false
    });
    if (!ok) return;
    try {
      await FashionOps.buy(actor, uuids);
      ui.notifications.info(L("NEONHUB.Fashion.Shop.Bought", { name: actor.name }));
    } catch (err) {
      warn(err);
    }
  }

  static async #onOpenItem(event, target) {
    (await fromUuid(target.dataset.uuid))?.sheet?.render(true);
  }

  static async #onPostFeed() {
    const actor = this.actor;
    const an = FashionOps.analyze(actor);
    const fit = FashionOps.fit(actor, this.districtId, an);
    const lines = feedFor(actor, an, fit, 4);
    const content = `<div class="nh-cal-card nh-fashion-card">
      <div class="nh-cal-card-kicker">// ${esc(L("NEONHUB.Fashion.Feed.Kicker"))} &middot; ${esc(district(this.districtId)?.name ?? "")}</div>
      <div class="nh-cal-card-name">${esc(actor.name)} &middot; ${esc(an.grade)}</div>
      ${lines.map((l) => `<p class="${l.bad ? "is-bad" : ""}"><b>${esc(l.handle)}</b> ${esc(l.text)}</p>`).join("")}
    </div>`;
    await ChatMessage.create({ content, speaker: { alias: L("NEONHUB.Fashion.Feed.Kicker") } });
  }

  static #onOpenCred() {
    game.modules.get(MODULE_ID).api.cred.open(this.actor);
  }

  _onClose(options) {
    super._onClose?.(options);
    if (FashionApp.instance === this) FashionApp.instance = null;
  }
}
