import { MODULE_ID, TEMPLATE_PATH, THEMES } from "../constants.js";
import { Compat } from "../compat.js";
import { CPR } from "../cpr.js";
import {
  HQStore, IMPROVEMENTS, HQ_COST, MORALE_LEVELS, newHQ, purchaseBlocker, upgradeBlocker, maxUpgrades,
  beds, monthlyRent, moraleLevel, activeMoraleLevels, luckBonus, healingBodyBonus, lifestyleDiscount, canView, logEntry
} from "./hq-data.js";
import { HQOps } from "./hq-ops.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));
const eb = (n) => `${Math.round(Number(n) || 0).toLocaleString(game.i18n.lang)}eb`;
const esc = (s) => Handlebars.escapeExpression(String(s ?? ""));

/**
 * The Headquarters screen. Everyone with access sees the same HQ; the GM edits it,
 * players propose purchases that the GM confirms.
 */
export class HQApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static instances = new Map();

  constructor(hqId, options = {}) {
    super({ id: `${MODULE_ID}-hq-${hqId}`, ...options });
    this.hqId = hqId;
    this.tab = "improvements";
    this.focus = "moraleBoost";
    this.busy = false;
  }

  static DEFAULT_OPTIONS = {
    classes: ["neon-hub", "nh-hq-app"],
    tag: "div",
    window: { title: "NEONHUB.HQ.Title", icon: "fa-solid fa-house-signal", resizable: true },
    position: { width: 1120, height: 780 },
    actions: {
      tab: HQApp.#onTab,
      focus: HQApp.#onFocus,
      purchase: HQApp.#onPurchase,
      upgrade: HQApp.#onUpgrade,
      award: HQApp.#onAward,
      newMonth: HQApp.#onNewMonth,
      payRent: HQApp.#onPayRent,
      removeCrew: HQApp.#onRemoveCrew,
      openCrew: HQApp.#onOpenCrew,
      openLink: HQApp.#onOpenLink,
      clearLink: HQApp.#onClearLink,
      pickImage: HQApp.#onPickImage,
      toggleImprovement: HQApp.#onToggleImprovement,
      deleteHQ: HQApp.#onDeleteHQ,
      openLifestyle: HQApp.#onOpenLifestyle
    }
  };

  static PARTS = {
    body: { template: `${TEMPLATE_PATH}/hq/hq.hbs`, scrollable: [".nh-hq-scroll", ".nh-hq-detail-body"] }
  };

  /* ---------------------------------------- */

  static open(id) {
    const hq = HQStore.get(id);
    if (!hq) return ui.notifications.warn(L("NEONHUB.Error.NoHQ"));
    if (!canView(hq)) return ui.notifications.warn(L("NEONHUB.Error.NotCrew"));
    let app = this.instances.get(id);
    if (!app) {
      app = new this(id);
      this.instances.set(id, app);
    }
    app.render({ force: true });
    app.bringToFront?.();
    return app;
  }

  /** GM: make a new HQ and open it. */
  static async create() {
    if (!game.user.isGM) return;
    const hq = await HQStore.save(newHQ());
    const app = this.open(hq.id);
    if (app) app.tab = "setup";
    app?.render();
    return hq;
  }

  static refreshAll() {
    for (const app of this.instances.values()) if (app.rendered) app.render();
  }

  get hq() {
    return HQStore.get(this.hqId);
  }

  get title() {
    return this.hq?.name ?? L("NEONHUB.HQ.Title");
  }

  /* ---------------------------------------- */
  /*  Context                                 */
  /* ---------------------------------------- */

  async _prepareContext() {
    const hq = this.hq;
    if (!hq) return { missing: true };
    const isGM = game.user.isGM;
    const theme = THEMES[hq.theme] ?? THEMES.neon;

    const crew = [];
    for (const uuid of hq.crew) {
      const actor = await fromUuid(uuid).catch(() => null);
      crew.push(actor
        ? { uuid, name: actor.name, img: actor.img, roles: CPR.roles(actor), wealth: CPR.hasWealth(actor) ? eb(CPR.getWealth(actor)) : null, missing: false }
        : { uuid, name: L("NEONHUB.HQ.MissingActor"), img: "icons/svg/mystery-man.svg", roles: [], missing: true });
    }
    const crewByRole = (roles) => crew.filter((c) => c.roles.some((r) => roles.includes(r))).map((c) => c.name);

    const cards = Object.entries(IMPROVEMENTS).map(([key, def]) => {
      const imp = hq.improvements[key];
      const max = maxUpgrades(key, hq);
      const benefits = [...new Set([...crewByRole(def.roles), ...(imp.upgrades ? crewByRole(def.upgradeRoles) : [])])];
      return {
        key,
        icon: def.icon,
        name: L(`NEONHUB.Improvement.${key}.Name`),
        tagline: L(`NEONHUB.Improvement.${key}.Tag`),
        owned: imp.owned,
        upgrades: imp.upgrades,
        max,
        pips: max > 1 ? Array.from({ length: max }, (_, i) => ({ on: i < imp.upgrades })) : null,
        upgraded: imp.owned && imp.upgrades >= max,
        focused: this.focus === key,
        benefits: benefits.join(", "),
        crewWide: def.crewWide
      };
    });

    const focus = this.#focusContext(hq, crewByRole);

    return {
      hq,
      isGM,
      tab: { improvements: this.tab === "improvements", setup: this.tab === "setup", log: this.tab === "log" },
      themeClass: `theme-${hq.theme}${theme.light ? " is-light" : ""}`,
      style: `--nh-accent:${theme.accent};--nh-accent-2:${theme.accent2};--nh-bg:${theme.bg};--nh-bg-2:${theme.bg2};--nh-panel:${theme.panel};--nh-text:${theme.text};--nh-muted:${theme.muted};--nh-display:"${theme.display}";`,
      statusLabel: L(`NEONHUB.HQ.Status.${hq.status}`),
      inactive: hq.status !== "active",
      crew,
      cards,
      focus,
      stats: {
        ip: hq.ip,
        cost: HQ_COST,
        rent: monthlyRent(hq) ? eb(monthlyRent(hq)) : L("NEONHUB.HQ.RentFree"),
        rentPaid: hq.housing.rentPaid,
        beds: beds(hq),
        morale: moraleLevel(hq),
        luck: luckBonus(hq),
        healing: healingBodyBonus(hq),
        lifestyle: lifestyleDiscount(hq) ? eb(lifestyleDiscount(hq)) : null
      },
      log: [...hq.log].reverse().map((e) => ({
        ...e,
        date: new Date(e.t).toLocaleString(game.i18n.lang, { dateStyle: "medium", timeStyle: "short" }),
        deltaText: e.delta ? `${e.delta > 0 ? "+" : ""}${e.delta} HQ IP` : "",
        positive: e.delta > 0
      })),
      themes: Object.entries(THEMES).map(([key, t]) => ({ key, label: L(t.label), selected: key === hq.theme })),
      statuses: ["active", "lost", "destroyed"].map((s) => ({ key: s, label: L(`NEONHUB.HQ.Status.${s}`), selected: s === hq.status })),
      busy: this.busy
    };
  }

  #focusContext(hq, crewByRole) {
    const key = this.focus;
    const def = IMPROVEMENTS[key];
    if (!def) return null;
    const imp = hq.improvements[key];
    const max = maxUpgrades(key, hq);
    const buyBlock = purchaseBlocker(hq, key);
    const upBlock = upgradeBlocker(hq, key);
    let link = null;
    if (def.link && imp.link) {
      let doc = null;
      try { doc = fromUuidSync(imp.link); } catch { /* ignore */ }
      link = { uuid: imp.link, name: doc?.name ?? L("NEONHUB.HQ.MissingLink"), img: doc?.img ?? doc?.thumb ?? "" };
    }
    const ctx = {
      key,
      icon: def.icon,
      name: L(`NEONHUB.Improvement.${key}.Name`),
      base: L(`NEONHUB.Improvement.${key}.Base`),
      upgrade: L(`NEONHUB.Improvement.${key}.Upgrade`),
      owned: imp.owned,
      upgrades: imp.upgrades,
      max,
      notes: imp.notes,
      eb: def.eb ? eb(def.eb) : null,
      cost: HQ_COST,
      canBuy: !buyBlock,
      buyBlock: buyBlock && !imp.owned ? L(buyBlock) : null,
      canUpgrade: !upBlock,
      upBlock: upBlock && imp.owned && imp.upgrades < max ? L(upBlock) : null,
      maxed: imp.owned && imp.upgrades >= max,
      repeatable: max > 1,
      baseCrew: crewByRole(def.roles).join(", "),
      upgradeCrew: crewByRole(def.upgradeRoles).join(", "),
      crewWide: def.crewWide,
      linkKind: def.link ?? null,
      linkLabel: def.link ? L(`NEONHUB.HQ.Link.${def.link}`) : null,
      link,
      isMorale: key === "moraleBoost",
      isRent: key === "rentReduction"
    };
    if (ctx.isMorale) {
      const active = activeMoraleLevels(hq);
      ctx.levels = Array.from({ length: MORALE_LEVELS }, (_, i) => {
        const n = i + 1;
        return { n, text: L(`NEONHUB.Morale.${n}`), owned: n <= imp.upgrades && imp.owned, active: active.includes(n), next: imp.owned && n === imp.upgrades + 1 };
      });
    }
    return ctx;
  }

  /* ---------------------------------------- */
  /*  Rendering and fields                    */
  /* ---------------------------------------- */

  _onRender(context, options) {
    super._onRender?.(context, options);
    const root = this.element;
    if (context.missing) return;

    if (game.user.isGM) {
      for (const input of root.querySelectorAll("[data-path]")) {
        const evt = input.matches("textarea, input[type=text], input[type=number]") ? "change" : "change";
        input.addEventListener(evt, (ev) => this.#onField(ev));
      }
      const drop = root.querySelector("[data-drop=crew]");
      drop?.addEventListener("dragover", (ev) => ev.preventDefault());
      drop?.addEventListener("drop", (ev) => this.#onDropCrew(ev));
      const linkDrop = root.querySelector("[data-drop=link]");
      linkDrop?.addEventListener("dragover", (ev) => ev.preventDefault());
      linkDrop?.addEventListener("drop", (ev) => this.#onDropLink(ev));
    }
  }

  async #onField(ev) {
    const input = ev.currentTarget;
    const hq = this.hq;
    let value = input.type === "checkbox" ? input.checked : input.value;
    if (input.dataset.dtype === "Number") value = value === "" ? 0 : Number(value);
    if (input.dataset.dtype === "NumberOrNull") value = value === "" ? null : Number(value);
    const path = input.dataset.path;
    if (path === "status") return this.#perform("setStatus", { id: hq.id, status: value });
    foundry.utils.setProperty(hq, path, value);
    await HQStore.save(hq);
  }

  async #onDropCrew(ev) {
    ev.preventDefault();
    const data = Compat.getDragEventData(ev);
    if (data?.type !== "Actor") return;
    const actor = await fromUuid(data.uuid);
    if (!actor) return;
    if (!CPR.isCharacter(actor)) ui.notifications.info(L("NEONHUB.HQ.NotCharacter", { name: actor.name }));
    const hq = this.hq;
    if (!hq.crew.includes(actor.uuid)) hq.crew.push(actor.uuid);
    await HQStore.save(hq);
  }

  async #onDropLink(ev) {
    ev.preventDefault();
    const data = Compat.getDragEventData(ev);
    const def = IMPROVEMENTS[this.focus];
    if (!def?.link || !data?.uuid) return;
    const doc = await fromUuid(data.uuid);
    const ok = {
      vehicle: (d) => (d instanceof Item && d.type === "vehicle") || d instanceof Actor,
      netarch: (d) => (d instanceof Item && d.type === "netarch") || d instanceof Scene,
      teamMember: (d) => d instanceof Actor
    }[def.link];
    if (!doc || !ok?.(doc)) return ui.notifications.warn(L(`NEONHUB.HQ.LinkHint.${def.link}`));
    const hq = this.hq;
    hq.improvements[this.focus].link = doc.uuid;
    await HQStore.save(hq);
  }

  async #perform(op, payload, { success } = {}) {
    if (this.busy) return null;
    this.busy = true;
    this.render();
    try {
      const result = await HQOps.perform(op, payload);
      if (success) ui.notifications.info(success);
      return result;
    } catch (err) {
      ui.notifications.warn(err.message);
      return null;
    } finally {
      this.busy = false;
      if (this.rendered) this.render();
    }
  }

  /** Ask who pays eurobucks: one crew member, or split evenly. */
  async #askPayment(amount, titleKey) {
    const hq = this.hq;
    const options = [`<option value="split">${esc(L("NEONHUB.HQ.Pay.Split"))}</option>`];
    for (const uuid of hq.crew) {
      const a = await fromUuid(uuid).catch(() => null);
      if (!a || !CPR.hasWealth(a)) continue;
      if (!game.user.isGM && !a.testUserPermission(game.user, "OWNER")) continue;
      options.push(`<option value="${esc(uuid)}">${esc(a.name)} (${eb(CPR.getWealth(a))})</option>`);
    }
    const choice = await Compat.DialogV2.prompt({
      window: { title: L(titleKey) },
      content: `<p>${esc(L("NEONHUB.HQ.Pay.Body", { amount: eb(amount) }))}</p><div class="form-group"><select name="payer">${options.join("")}</select></div>`,
      ok: { label: L("NEONHUB.HQ.Pay.Confirm"), callback: (event, button) => button.form.elements.payer.value },
      rejectClose: false
    });
    if (!choice) return null;
    return choice === "split" ? { mode: "split" } : { mode: "one", uuid: choice };
  }

  /* ---------------------------------------- */
  /*  Actions                                 */
  /* ---------------------------------------- */

  static #onTab(event, target) {
    this.tab = target.dataset.tab;
    this.render();
  }

  static #onFocus(event, target) {
    this.focus = target.dataset.key;
    this.render();
  }

  static async #onPurchase(event, target) {
    const key = target.dataset.key ?? this.focus;
    const def = IMPROVEMENTS[key];
    const name = L(`NEONHUB.Improvement.${key}.Name`);
    let payment = null;
    if (def.eb) {
      payment = await this.#askPayment(def.eb, "NEONHUB.HQ.Pay.ServerRoom");
      if (!payment) return;
    } else {
      const ok = await Compat.DialogV2.confirm({
        window: { title: name },
        content: `<p>${esc(L(game.user.isGM ? "NEONHUB.HQ.Confirm.Buy" : "NEONHUB.HQ.Confirm.Propose", { name, cost: HQ_COST }))}</p>`,
        rejectClose: false
      });
      if (!ok) return;
    }
    await this.#perform("purchase", { id: this.hqId, key, payment }, { success: L("NEONHUB.HQ.Done.Bought", { name }) });
  }

  static async #onUpgrade(event, target) {
    const key = target.dataset.key ?? this.focus;
    const name = L(`NEONHUB.Improvement.${key}.Name`);
    const ok = await Compat.DialogV2.confirm({
      window: { title: name },
      content: `<p>${esc(L(game.user.isGM ? "NEONHUB.HQ.Confirm.Upgrade" : "NEONHUB.HQ.Confirm.ProposeUpgrade", { name, cost: HQ_COST }))}</p>`,
      rejectClose: false
    });
    if (!ok) return;
    await this.#perform("upgrade", { id: this.hqId, key }, { success: L("NEONHUB.HQ.Done.Upgraded", { name }) });
  }

  static async #onAward() {
    const amount = Number(this.element.querySelector("[name=awardAmount]")?.value) || 0;
    const reason = this.element.querySelector("[name=awardReason]")?.value ?? "";
    if (!amount) return ui.notifications.info(L("NEONHUB.HQ.AwardHint"));
    await this.#perform("awardIP", { id: this.hqId, amount, reason });
  }

  static async #onNewMonth() {
    const ok = await Compat.DialogV2.confirm({
      window: { title: L("NEONHUB.HQ.NewMonth") },
      content: `<p>${esc(L("NEONHUB.HQ.NewMonthConfirm"))}</p>`,
      rejectClose: false
    });
    if (ok) await this.#perform("newMonth", { id: this.hqId });
  }

  static async #onPayRent() {
    const rent = monthlyRent(this.hq);
    let payment = { mode: "split" };
    if (rent > 0) {
      payment = await this.#askPayment(rent, "NEONHUB.HQ.Pay.Rent");
      if (!payment) return;
    }
    await this.#perform("payRent", { id: this.hqId, payment }, { success: L("NEONHUB.HQ.Done.RentPaid") });
  }

  static async #onRemoveCrew(event, target) {
    const hq = this.hq;
    hq.crew = hq.crew.filter((u) => u !== target.dataset.uuid);
    await HQStore.save(hq);
  }

  static async #onOpenCrew(event, target) {
    const actor = await fromUuid(target.dataset.uuid);
    if (actor?.testUserPermission(game.user, "LIMITED")) actor.sheet.render(true);
  }

  static async #onOpenLink(event, target) {
    const doc = await fromUuid(target.dataset.uuid);
    if (!doc) return;
    if (doc instanceof Scene) return doc.view();
    if (doc.testUserPermission?.(game.user, "LIMITED")) doc.sheet?.render(true);
  }

  static async #onClearLink() {
    const hq = this.hq;
    hq.improvements[this.focus].link = "";
    await HQStore.save(hq);
  }

  static #onPickImage() {
    const FP = Compat.FilePicker;
    new FP({
      type: "image",
      current: this.hq.img,
      callback: async (path) => {
        const hq = this.hq;
        hq.img = path;
        await HQStore.save(hq);
      }
    }).render(true);
  }

  /** GM bookkeeping: mark an Improvement owned or not without spending HQ IP (for HQs started mid-campaign). */
  static async #onToggleImprovement(event, target) {
    const hq = this.hq;
    const imp = hq.improvements[target.dataset.key];
    imp.owned = !imp.owned;
    if (!imp.owned) imp.upgrades = 0;
    logEntry(hq, L(imp.owned ? "NEONHUB.HQ.Log.MarkedOwned" : "NEONHUB.HQ.Log.MarkedRemoved", { name: L(`NEONHUB.Improvement.${target.dataset.key}.Name`) }));
    await HQStore.save(hq);
  }

  static async #onDeleteHQ() {
    const ok = await Compat.DialogV2.confirm({
      window: { title: L("NEONHUB.HQ.Delete") },
      content: `<p>${esc(L("NEONHUB.HQ.DeleteConfirm", { name: this.hq.name }))}</p>`,
      rejectClose: false
    });
    if (!ok) return;
    await HQStore.delete(this.hqId);
    this.close();
  }

  /** The crew's monthly expenses. Through the API so the two windows don't import each other. */
  static #onOpenLifestyle() {
    game.modules.get(MODULE_ID).api?.openLifestyle();
  }

  _onClose(options) {
    super._onClose?.(options);
    HQApp.instances.delete(this.hqId);
  }
}
