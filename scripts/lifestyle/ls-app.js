import { MODULE_ID, TEMPLATE_PATH, THEMES, DEFAULT_THEME } from "../constants.js";
import { Compat } from "../compat.js";
import { CPR } from "../cpr.js";
import { HQApp } from "../hq/hq-app.js";
import { HQStore } from "../hq/hq-data.js";
import {
  LS_FLAG, CATEGORIES, GROUPS, normalizeLifestyle, lineCost, payoffAmount, humanityBonus, activeTier,
  excerpt, changeKeyLabel, cprSlug
} from "./ls-data.js";
import { LifestyleStore, LS_PACK } from "./ls-store.js";
import { LifestyleOps } from "./ls-ops.js";
import { LifestyleItemConfig } from "./ls-item-config.js";
import { CalendarStore } from "../calendar/cal-store.js";
import { nextRentDay } from "../calendar/cal-dates.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));
const eb = (n) => `${Math.round(Number(n) || 0).toLocaleString(game.i18n.lang)}eb`;
const esc = (s) => Handlebars.escapeExpression(String(s ?? ""));

/**
 * The Lifestyle window: one character's rent, lifestyle package, memberships, transport,
 * loans and furnishings, a catalog to add more, their bills, and (for the GM) the month.
 */
export class LifestyleApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static instance = null;

  constructor(options = {}) {
    super({ id: `${MODULE_ID}-lifestyle`, ...options });
    this.actorId = null;
    this.tab = "current";
    this.filter = "all";
    this.search = "";
    this.busy = false;
    this._catalog = null;
  }

  static DEFAULT_OPTIONS = {
    classes: ["neon-hub", "nh-hq-app", "nh-ls-app"],
    tag: "div",
    window: { title: "NEONHUB.Lifestyle.Title", icon: "fa-solid fa-wallet", resizable: true },
    position: { width: 1100, height: 800 },
    actions: {
      // Not "tab": ApplicationV2 handles data-action="tab" itself and never calls ours.
      view: LifestyleApp.#onTab,
      filter: LifestyleApp.#onFilter,
      toggle: LifestyleApp.#onToggle,
      remove: LifestyleApp.#onRemove,
      payoff: LifestyleApp.#onPayoff,
      buyHome: LifestyleApp.#onBuyHome,
      call: LifestyleApp.#onCall,
      openItem: LifestyleApp.#onOpenItem,
      configItem: LifestyleApp.#onConfigItem,
      add: LifestyleApp.#onAdd,
      copyTemplate: LifestyleApp.#onCopyTemplate,
      newHomebrew: LifestyleApp.#onNewHomebrew,
      pay: LifestyleApp.#onPay,
      payFor: LifestyleApp.#onPayFor,
      markPaid: LifestyleApp.#onMarkPaid,
      viewActor: LifestyleApp.#onViewActor,
      newMonth: LifestyleApp.#onNewMonth,
      billAll: LifestyleApp.#onBillAll,
      openHQ: LifestyleApp.#onOpenHQ,
      openCalendar: LifestyleApp.#onOpenCalendar,
      toRentDay: LifestyleApp.#onToRentDay,
      openSheet: LifestyleApp.#onOpenSheet
    }
  };

  static PARTS = {
    body: { template: `${TEMPLATE_PATH}/lifestyle/lifestyle.hbs`, scrollable: [".nh-hq-scroll"] }
  };

  /* ---------------------------------------- */

  /**
   * Open the window. With no actor: the user's own character, else their first one;
   * a GM with no character picked lands on the month overview.
   * @param {Actor|string|null} actor - an Actor or its uuid
   */
  static async open(actor = null, { tab } = {}) {
    if (typeof actor === "string") actor = await fromUuid(actor);
    if (actor?.isToken) actor = actor.baseActor ?? actor;
    const viewable = LifestyleStore.viewable();
    if (actor && !viewable.includes(actor) && !(game.user.isGM && actor.type === "character")) actor = null;
    if (!actor) {
      const own = game.user.character;
      actor = own && viewable.includes(own) ? own : (game.user.isGM ? null : viewable[0] ?? null);
    }
    if (!actor && !game.user.isGM) return ui.notifications.info(L("NEONHUB.Lifestyle.NoCharacter"));
    const app = (this.instance ??= new this());
    app.actorId = actor?.id ?? null;
    app.tab = tab ?? (actor ? (app.tab === "month" ? "current" : app.tab) : "month");
    await app.render({ force: true });
    app.bringToFront?.();
    return app;
  }

  static refresh({ catalog = false } = {}) {
    const app = this.instance;
    if (!app?.rendered) return;
    if (catalog) app._catalog = null;
    app.render();
  }

  /** Re-render only if the change touches what's on screen. */
  static refreshFor(actor) {
    const app = this.instance;
    if (!app?.rendered) return;
    if (app.tab === "month" || actor?.id === app.actorId) app.render();
  }

  get actor() {
    return this.actorId ? game.actors.get(this.actorId) ?? null : null;
  }

  get title() {
    const actor = this.actor;
    return actor ? `${L("NEONHUB.Lifestyle.Title")}: ${actor.name}` : L("NEONHUB.Lifestyle.Title");
  }

  /* ---------------------------------------- */
  /*  Context                                 */
  /* ---------------------------------------- */

  async _prepareContext() {
    const isGM = game.user.isGM;
    const state = LifestyleStore.state;
    const theme = THEMES[state.theme] ?? THEMES[DEFAULT_THEME];
    const actor = this.actor;
    // Without a character, the GM can still browse the catalog and run the month.
    if (!actor && !(isGM && ["month", "catalog"].includes(this.tab))) this.tab = isGM ? "month" : "current";

    const context = {
      isGM,
      themeClass: `theme-${state.theme}${theme.light ? " is-light" : ""}`,
      style: `--nh-accent:${theme.accent};--nh-accent-2:${theme.accent2};--nh-bg:${theme.bg};--nh-bg-2:${theme.bg2};--nh-panel:${theme.panel};--nh-text:${theme.text};--nh-muted:${theme.muted};--nh-display:"${theme.display}";`,
      calendarMode: CalendarStore.all().length > 0,
      monthLabel: CalendarStore.all().length ? CalendarStore.periodLabel(CalendarStore.period(CalendarStore.all()[0])) : LifestyleStore.monthLabel(),
      characters: [...new Set([...LifestyleStore.viewable(), ...(actor ? [actor] : [])])]
        .map((a) => ({ id: a.id, name: a.name, selected: a.id === this.actorId })),
      tab: { current: this.tab === "current", catalog: this.tab === "catalog", bills: this.tab === "bills", month: this.tab === "month" },
      busy: this.busy,
      actor: null
    };

    if (actor) Object.assign(context, this.#actorContext(actor));
    if (this.tab === "catalog") context.catalog = await this.#catalogContext(actor);
    if (isGM && this.tab === "month") context.overview = this.#overviewContext(state);
    return context;
  }

  #actorContext(actor) {
    const { items, bill, due, state, billing, wallet, status, reminders } = LifestyleOps.billFor(actor);
    const isOwner = actor.isOwner;
    const canManage = LifestyleStore.canManage(actor);
    const skillNames = this.#skillNames(actor);
    const tier = activeTier(items);
    const owing = due ? due.total : 0;

    const groups = GROUPS.map((g) => {
      const cards = items.filter((d) => d.group === g).sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
        .map((d) => this.#itemCard(d, actor, { isOwner, canManage, skillNames }));
      return { key: g, label: L(`NEONHUB.Lifestyle.Group.${g}`), total: bill.groups[g] ? eb(bill.groups[g]) : null, cards };
    }).filter((g) => g.cards.length);

    const hqs = LifestyleStore.hqSummary(actor).map((h) => ({
      ...h,
      rentText: h.rent ? eb(h.rent) : L("NEONHUB.HQ.RentFree"),
      shareText: h.rent ? eb(h.share) : null,
      discountText: h.discount ? eb(h.discount) : null,
      statusLabel: L(`NEONHUB.HQ.Status.${h.status}`)
    }));

    return {
      actor: { id: actor.id, uuid: actor.uuid, name: actor.name, img: actor.img, hasWallet: CPR.hasWealth(actor) },
      isOwner,
      canManage,
      wallet: eb(wallet),
      status,
      statusLabel: L(`NEONHUB.Lifestyle.Status.${status}`),
      paid: !billing.owed,
      canPay: isOwner && billing.owed > 0 && CPR.hasWealth(actor),
      monthLabel: billing.label,
      rentNext: billing.next ? (billing.next.today ? L("NEONHUB.Calendar.Rent.Today") : L("NEONHUB.Calendar.Rent.In", { n: billing.next.days })) : null,
      calendarName: billing.calendar?.name ?? null,
      owed: billing.owed > 1 ? { months: billing.owed, total: eb(owing), range: `${billing.firstLabel} – ${billing.label}` } : null,
      payAmount: eb(owing),
      stats: {
        total: eb(bill.total),
        housing: eb(bill.groups.housing),
        lifestyle: tier ? tier.name : L("NEONHUB.Lifestyle.NoPackage"),
        lifestyleCost: eb(bill.groups.lifestyle),
        memberships: eb(bill.groups.memberships),
        transport: eb(bill.groups.transport),
        loans: eb(bill.groups.loans),
        after: eb(wallet - owing),
        afterNegative: wallet - owing < 0,
        humanity: humanityBonus(items),
        discount: bill.discount ? eb(bill.discount) : null
      },
      groups,
      empty: !items.length,
      hqs,
      reminders: reminders.map((r) => (r.kind === "roughNight"
        ? L("NEONHUB.Lifestyle.Reminder.RoughNight", { name: r.name, dv: r.dv })
        : L("NEONHUB.Lifestyle.Reminder.Check", { name: r.name, skill: r.skill, dv: r.dv }))),
      history: [...state.history].reverse().map((h) => ({
        label: h.label,
        total: eb(h.total),
        after: eb(h.after),
        debt: h.after < 0,
        discount: h.discount ? eb(h.discount) : null,
        date: new Date(h.at).toLocaleString(game.i18n.lang, { dateStyle: "medium", timeStyle: "short" }),
        user: h.user,
        lines: (h.lines ?? []).map((l) => ({ name: l.name, cost: eb(l.cost) }))
      }))
    };
  }

  #itemCard(d, actor, { isOwner, canManage, skillNames }) {
    const item = actor.items.get(d.id);
    const badges = [];
    if (d.perk) badges.push({ icon: "fa-solid fa-building", text: L("NEONHUB.Lifestyle.Badge.Perk") });
    if (d.category === "housing") {
      if (d.owned) badges.push({ icon: "fa-solid fa-key", text: L("NEONHUB.Lifestyle.Badge.OwnedHome") });
      if (d.sleeps) badges.push({ icon: "fa-solid fa-bed", text: L("NEONHUB.Lifestyle.Badge.Sleeps", { n: d.sleeps }) });
      if (d.rooms) badges.push({ icon: "fa-solid fa-door-open", text: L("NEONHUB.Lifestyle.Badge.Rooms", { n: d.rooms }) });
      if (d.roughNight) badges.push({ icon: "fa-solid fa-moon", text: L("NEONHUB.Lifestyle.Badge.RoughNight", { dv: d.roughNight }), warn: true });
    }
    if (d.category === "lifestyle" && d.tier) badges.push({ icon: "fa-solid fa-layer-group", text: L("NEONHUB.Lifestyle.Badge.Tier", { n: d.tier }) + (d.plus ? "+" : "") });
    if (d.humanity) badges.push({ icon: "fa-solid fa-heart", text: L("NEONHUB.Lifestyle.Badge.Humanity", { n: d.humanity }) });
    if (d.check.skill && d.check.dv) badges.push({ icon: "fa-solid fa-dice-d20", text: L("NEONHUB.Lifestyle.Badge.Check", { skill: d.check.skill, dv: d.check.dv }) });
    if (d.response) badges.push({ icon: "fa-solid fa-stopwatch", text: L("NEONHUB.Lifestyle.Badge.Response", { formula: d.response }) });

    const loan = d.category === "loan";
    return {
      id: d.id,
      name: d.name,
      img: d.img || LifestyleStore.icon(d.category),
      category: L(`NEONHUB.Lifestyle.Category.${d.category}`),
      icon: CATEGORIES[d.category].icon,
      active: d.active,
      costText: this.#costText(d),
      badges,
      effects: this.#effectSummary(item?.effects, skillNames),
      description: excerpt(item?.system?.description?.value, 180),
      amount: d.amount,
      showAmount: d.category === "fuel" || d.amount > 1,
      canToggle: canManage,
      canRemove: canManage && (!loan || game.user.isGM),
      canAmount: canManage,
      payoff: loan && isOwner ? eb(payoffAmount(d)) : null,
      buyHome: d.category === "housing" && d.buyPrice && !d.owned && isOwner ? eb(d.buyPrice) : null,
      canCall: !!d.response && d.active && isOwner,
      canConfig: game.user.isGM,
      canOpen: !!item
    };
  }

  #costText(d) {
    if (d.perk) return L("NEONHUB.Lifestyle.Cost.Perk");
    if (d.category === "housing" && d.owned) return L("NEONHUB.Lifestyle.Cost.Owned");
    if (d.category === "furnishing") return d.monthly ? L("NEONHUB.Lifestyle.Cost.Monthly", { cost: eb(d.monthly) }) : L("NEONHUB.Lifestyle.Cost.Furnished");
    if (d.category === "loan") {
      if (d.loan.kind === "installment") return L("NEONHUB.Lifestyle.Cost.Installment", { cost: eb(d.monthly * d.amount), months: d.loan.monthsLeft });
      return L("NEONHUB.Lifestyle.Cost.Interest", { cost: eb(d.monthly * d.amount), principal: eb(d.loan.principal * d.amount) });
    }
    if (!d.monthly) return L("NEONHUB.Lifestyle.Cost.Free");
    if (d.amount > 1) return L("NEONHUB.Lifestyle.Cost.Times", { n: d.amount, cost: eb(d.monthly), total: eb(lineCost({ ...d, active: true })) });
    return L("NEONHUB.Lifestyle.Cost.Monthly", { cost: eb(d.monthly) });
  }

  /** Catalog price line for an item not yet on the character. */
  #catalogCost(ls, price) {
    if (ls.perk) return L("NEONHUB.Lifestyle.Cost.Perk");
    if (ls.category === "loan") {
      if (ls.loan.kind === "installment" && !ls.loan.principal) {
        return L("NEONHUB.Lifestyle.Cost.LoanTerms", { down: ls.loan.downPct, rate: ls.loan.ratePct, months: ls.loan.termMonths });
      }
      return L("NEONHUB.Lifestyle.Cost.LoanOffer", { principal: eb(ls.loan.principal), cost: eb(ls.monthly) });
    }
    if (CATEGORIES[ls.category].oneTime) return price ? L("NEONHUB.Lifestyle.Cost.OneTime", { cost: eb(price) }) : L("NEONHUB.Lifestyle.Cost.Free");
    const parts = [ls.monthly ? L("NEONHUB.Lifestyle.Cost.Monthly", { cost: eb(ls.monthly) }) : L("NEONHUB.Lifestyle.Cost.Free")];
    if (ls.category === "housing" && ls.buyPrice) parts.push(L("NEONHUB.Lifestyle.Cost.BuyFor", { cost: eb(ls.buyPrice) }));
    return parts.join(" · ");
  }

  #effectSummary(effects, skillNames) {
    const parts = [];
    for (const e of effects ?? []) {
      if (e.disabled) continue;
      for (const c of e.changes ?? []) {
        const v = Number(c.value);
        if (Number(c.mode) !== 2 || !Number.isFinite(v) || !v) continue;
        parts.push(`${changeKeyLabel(c.key, skillNames)} ${v > 0 ? "+" : "−"}${Math.abs(v)}`);
      }
    }
    return parts.join(", ");
  }

  #skillNames(actor) {
    const out = {};
    const source = actor ? actor.items : game.items;
    for (const i of source ?? []) if (i.type === "skill") out[cprSlug(i.name)] = i.name;
    return out;
  }

  /* ---------------------------------------- */
  /*  Catalog                                 */
  /* ---------------------------------------- */

  async #catalogEntries() {
    if (this._catalog) return this._catalog;
    const entries = [];
    const pack = game.packs.get(LS_PACK);
    // Whole documents rather than the index: the catalog shows each item's Active Effects,
    // which a LevelDB index doesn't reliably include. The pack is small.
    const packItems = pack ? await pack.getDocuments() : [];
    for (const item of [...packItems, ...game.items]) {
      const flag = item.getFlag(MODULE_ID, LS_FLAG);
      if (!flag || (!item.pack && !item.visible)) continue;
      entries.push({
        uuid: item.uuid,
        name: item.name,
        img: item.img,
        price: Number(item.system?.price?.market) || 0,
        description: item.system?.description?.value ?? "",
        effects: item.effects.contents,
        ls: normalizeLifestyle(flag),
        world: !item.pack
      });
    }
    this._catalog = entries;
    return entries;
  }

  async #catalogContext(actor) {
    const isGM = game.user.isGM;
    const entries = await this.#catalogEntries();
    const skillNames = this.#skillNames(actor);
    const ownedNames = new Set((actor?.items ?? []).filter((i) => i.getFlag(MODULE_ID, LS_FLAG)).map((i) => i.name));
    const canManage = actor ? LifestyleStore.canManage(actor) : false;
    const isOwner = !!actor?.isOwner;

    const visible = entries.filter((e) => isGM || !e.ls.template);
    const shown = visible.filter((e) => {
      if (this.filter === "templates") return e.ls.template;
      if (e.ls.template) return false;
      if (this.filter === "homebrew") return e.world;
      return this.filter === "all" || e.ls.category === this.filter;
    }).sort((a, b) => Object.keys(CATEGORIES).indexOf(a.ls.category) - Object.keys(CATEGORIES).indexOf(b.ls.category)
      || (a.ls.tier - b.ls.tier) || (a.ls.monthly - b.ls.monthly) || a.name.localeCompare(b.name));

    const filters = [
      { key: "all", label: L("NEONHUB.Lifestyle.Filter.all") },
      ...Object.keys(CATEGORIES).filter((c) => visible.some((e) => e.ls.category === c && !e.ls.template))
        .map((c) => ({ key: c, label: L(`NEONHUB.Lifestyle.Category.${c}`), icon: CATEGORIES[c].icon })),
      ...(visible.some((e) => e.world && !e.ls.template) ? [{ key: "homebrew", label: L("NEONHUB.Lifestyle.Filter.homebrew"), icon: "fa-solid fa-flask" }] : []),
      ...(isGM ? [{ key: "templates", label: L("NEONHUB.Lifestyle.Filter.templates"), icon: "fa-solid fa-clone" }] : [])
    ].map((f) => ({ ...f, active: f.key === this.filter }));

    return {
      filters,
      search: this.search,
      packMissing: !game.packs.get(LS_PACK),
      entries: shown.map((e) => {
        const ls = e.ls;
        const badges = [];
        if (ls.perk) badges.push({ icon: "fa-solid fa-building", text: L("NEONHUB.Lifestyle.Badge.Perk") });
        if (ls.category === "housing" && ls.sleeps) badges.push({ icon: "fa-solid fa-bed", text: L("NEONHUB.Lifestyle.Badge.Sleeps", { n: ls.sleeps }) });
        if (ls.category === "housing" && ls.roughNight) badges.push({ icon: "fa-solid fa-moon", text: L("NEONHUB.Lifestyle.Badge.RoughNight", { dv: ls.roughNight }), warn: true });
        if (ls.category === "lifestyle" && ls.tier) badges.push({ icon: "fa-solid fa-layer-group", text: L("NEONHUB.Lifestyle.Badge.Tier", { n: ls.tier }) + (ls.plus ? "+" : "") });
        if (ls.minTier) badges.push({ icon: "fa-solid fa-utensils", text: L("NEONHUB.Lifestyle.Badge.MinTier", { n: ls.minTier }) });
        if (ls.humanity) badges.push({ icon: "fa-solid fa-heart", text: L("NEONHUB.Lifestyle.Badge.Humanity", { n: ls.humanity }) });
        if (ls.check.skill && ls.check.dv) badges.push({ icon: "fa-solid fa-dice-d20", text: L("NEONHUB.Lifestyle.Badge.Check", { skill: ls.check.skill, dv: ls.check.dv }) });
        if (ls.response) badges.push({ icon: "fa-solid fa-stopwatch", text: L("NEONHUB.Lifestyle.Badge.Response", { formula: ls.response }) });
        const ask = !isGM && (ls.perk || !canManage);
        return {
          uuid: e.uuid,
          name: e.name,
          img: e.img || LifestyleStore.icon(ls.category),
          category: L(`NEONHUB.Lifestyle.Category.${ls.category}`),
          categoryKey: ls.category,
          icon: CATEGORIES[ls.category].icon,
          costText: this.#catalogCost(ls, e.price),
          badges,
          effects: this.#effectSummary(e.effects, skillNames),
          description: excerpt(e.description, 200),
          search: `${e.name} ${excerpt(e.description, 400)}`.toLowerCase(),
          world: e.world,
          template: ls.template,
          owned: ownedNames.has(e.name),
          canAdd: !!actor && (isGM || isOwner) && !ls.template,
          addLabel: ask ? L("NEONHUB.Lifestyle.Add.Ask") : L(`NEONHUB.Lifestyle.Add.${ls.category === "loan" ? "loan" : CATEGORIES[ls.category].oneTime && e.price ? "buy" : "add"}`)
        };
      })
    };
  }

  /* ---------------------------------------- */
  /*  GM month overview                       */
  /* ---------------------------------------- */

  #overviewContext(state) {
    const rows = LifestyleStore.characters().map((actor) => {
      const { bill, due, wallet, status, billing } = LifestyleOps.billFor(actor);
      const owners = game.users.filter((u) => !u.isGM && actor.testUserPermission(u, "OWNER")).map((u) => u.name).join(", ");
      return {
        id: actor.id,
        uuid: actor.uuid,
        name: actor.name,
        img: actor.img,
        owners,
        wallet: eb(wallet),
        negative: wallet < 0,
        total: eb(bill.total),
        owed: billing.owed > 1 ? L("NEONHUB.Lifestyle.OwedMonths", { n: billing.owed, total: eb(due.total) }) : null,
        status,
        statusLabel: L(`NEONHUB.Lifestyle.Status.${status}`),
        paid: !billing.owed,
        calendar: billing.calendar ? { name: billing.calendar.name, color: billing.calendar.color } : null,
        selected: actor.id === this.actorId
      };
    });
    const calendars = CalendarStore.all().map((c) => {
      const next = nextRentDay(c, c.rentDay);
      return {
        id: c.id,
        name: c.name,
        color: c.color,
        date: `${L(`NEONHUB.Calendar.Month.${c.month}`)} ${c.day}, ${c.year}`,
        label: CalendarStore.periodLabel(CalendarStore.period(c)),
        rent: next.today ? L("NEONHUB.Calendar.Rent.Today") : L("NEONHUB.Calendar.Rent.In", { n: next.days })
      };
    });
    return {
      rows,
      calendars,
      calendarMode: calendars.length > 0,
      autoBill: LifestyleStore.autoBill,
      due: rows.filter((r) => !r.paid).length,
      themes: Object.entries(THEMES).map(([key, t]) => ({ key, label: L(t.label), selected: key === state.theme })),
      manage: LifestyleStore.playersManage,
      debt: LifestyleStore.allowDebt
    };
  }

  /* ---------------------------------------- */
  /*  Rendering                               */
  /* ---------------------------------------- */

  _onRender(context, options) {
    super._onRender?.(context, options);
    const root = this.element;
    root.querySelector("select[name=actor]")?.addEventListener("change", (ev) => {
      this.actorId = ev.currentTarget.value || null;
      if (this.actorId && this.tab === "month") this.tab = "current";
      this.render();
    });
    root.querySelector("select[name=theme]")?.addEventListener("change", (ev) => LifestyleStore.setState({ theme: ev.currentTarget.value }));
    for (const input of root.querySelectorAll("input[data-amount]")) {
      input.addEventListener("change", (ev) => this.#perform("setAmount", { actor: this.actor.uuid, item: ev.currentTarget.dataset.amount, amount: ev.currentTarget.value }));
    }
    const search = root.querySelector("input[name=search]");
    if (search) {
      search.addEventListener("input", (ev) => {
        this.search = ev.currentTarget.value;
        this.#applySearch();
      });
      this.#applySearch();
    }
  }

  #applySearch() {
    const q = this.search.trim().toLowerCase();
    let shown = 0;
    for (const card of this.element.querySelectorAll("[data-search]")) {
      const hit = !q || card.dataset.search.includes(q);
      card.hidden = !hit;
      if (hit) shown++;
    }
    this.element.querySelector(".nh-ls-noresults")?.toggleAttribute("hidden", shown > 0);
  }

  async #perform(op, payload, { success } = {}) {
    if (this.busy) return null;
    this.busy = true;
    this.render();
    try {
      const result = await LifestyleOps.perform(op, payload);
      if (success) ui.notifications.info(typeof success === "function" ? success(result) : success);
      return result;
    } catch (err) {
      ui.notifications.warn(err.message);
      return null;
    } finally {
      this.busy = false;
      if (this.rendered) this.render();
    }
  }

  async #confirm(titleKey, bodyKey, data = {}) {
    return Compat.DialogV2.confirm({
      classes: ["neon-hub", "nh-cal-dialog"],
      window: { title: L(titleKey, data) },
      content: `<p>${esc(L(bodyKey, data))}</p>`,
      rejectClose: false
    });
  }

  #described(itemId) {
    return LifestyleStore.items(this.actor).find((d) => d.id === itemId);
  }

  /* ---------------------------------------- */
  /*  Actions                                 */
  /* ---------------------------------------- */

  static #onTab(event, target) {
    this.tab = target.dataset.tab;
    this.render();
  }

  static #onFilter(event, target) {
    this.filter = target.dataset.filter;
    this.render();
  }

  static async #onToggle(event, target) {
    const id = target.closest("[data-item]").dataset.item;
    await this.#perform("toggle", { actor: this.actor.uuid, item: id });
  }

  static async #onRemove(event, target) {
    const id = target.closest("[data-item]").dataset.item;
    const d = this.#described(id);
    if (!d || !(await this.#confirm("NEONHUB.Lifestyle.Confirm.RemoveTitle", "NEONHUB.Lifestyle.Confirm.Remove", { item: d.name }))) return;
    await this.#perform("remove", { actor: this.actor.uuid, item: id });
  }

  static async #onPayoff(event, target) {
    const id = target.closest("[data-item]").dataset.item;
    const d = this.#described(id);
    if (!d) return;
    const amount = eb(payoffAmount(d));
    if (!(await this.#confirm("NEONHUB.Lifestyle.Confirm.PayoffTitle", "NEONHUB.Lifestyle.Confirm.Payoff", { item: d.name, amount }))) return;
    await this.#perform("payoff", { actor: this.actor.uuid, item: id }, { success: L("NEONHUB.Lifestyle.Done.Payoff", { item: d.name }) });
  }

  static async #onBuyHome(event, target) {
    const id = target.closest("[data-item]").dataset.item;
    const d = this.#described(id);
    if (!d) return;
    if (!(await this.#confirm("NEONHUB.Lifestyle.Confirm.BuyHomeTitle", "NEONHUB.Lifestyle.Confirm.BuyHome", { item: d.name, amount: eb(d.buyPrice) }))) return;
    await this.#perform("buyHome", { actor: this.actor.uuid, item: id }, { success: L("NEONHUB.Lifestyle.Done.BuyHome", { item: d.name }) });
  }

  static async #onCall(event, target) {
    const id = target.closest("[data-item]").dataset.item;
    await this.#perform("call", { actor: this.actor.uuid, item: id });
  }

  static #onOpenItem(event, target) {
    const id = target.closest("[data-item]").dataset.item;
    this.actor?.items.get(id)?.sheet?.render(true);
  }

  static #onConfigItem(event, target) {
    const id = target.closest("[data-item]")?.dataset.item;
    const item = id ? this.actor?.items.get(id) : null;
    if (item) LifestyleItemConfig.open(item);
  }

  static async #onAdd(event, target) {
    const actor = this.actor;
    const uuid = target.closest("[data-uuid]").dataset.uuid;
    const entry = (await this.#catalogEntries()).find((e) => e.uuid === uuid);
    if (!actor || !entry) return;
    const ls = entry.ls;
    const payload = { actor: actor.uuid, source: uuid };
    const ask = await LifestyleOps.needsGM("add", payload);

    if (ls.category === "loan") {
      let principal = ls.loan.principal;
      if (!principal) {
        principal = await Compat.DialogV2.prompt({
          classes: ["neon-hub", "nh-cal-dialog"],
          window: { title: entry.name },
          content: `<p>${esc(L("NEONHUB.Lifestyle.Loan.AskPrincipal", { down: ls.loan.downPct, rate: ls.loan.ratePct, months: ls.loan.termMonths }))}</p><div class="form-group"><input type="number" name="principal" min="1" step="1" autofocus></div>`,
          ok: { label: L("NEONHUB.Lifestyle.Add.loan"), callback: (ev, button) => Number(button.form.elements.principal.value) || 0 },
          rejectClose: false
        });
        if (!principal) return;
        payload.principal = principal;
      } else if (!(await this.#confirm("NEONHUB.Lifestyle.Confirm.LoanTitle", "NEONHUB.Lifestyle.Confirm.Loan", { item: entry.name, principal: eb(principal), cost: eb(ls.monthly) }))) return;
    } else if (CATEGORIES[ls.category].oneTime && entry.price) {
      if (!(await this.#confirm("NEONHUB.Lifestyle.Confirm.BuyTitle", "NEONHUB.Lifestyle.Confirm.Buy", { item: entry.name, amount: eb(entry.price), name: actor.name }))) return;
    } else if (ask) {
      if (!(await this.#confirm("NEONHUB.Lifestyle.Confirm.AskTitle", "NEONHUB.Lifestyle.Confirm.Ask", { item: entry.name }))) return;
    }
    await this.#perform("add", payload, { success: L("NEONHUB.Lifestyle.Done.Added", { item: entry.name, name: actor.name }) });
  }

  /** GM: copy a template (or any catalog entry) into a new world item and open it for editing. */
  static async #onCopyTemplate(event, target) {
    const uuid = target.closest("[data-uuid]").dataset.uuid;
    const source = await fromUuid(uuid);
    if (!source) return;
    const folder = await LifestyleStore.homebrewFolder();
    const data = source.toObject();
    delete data._id;
    data.folder = folder.id;
    const ls = normalizeLifestyle(data.flags?.[MODULE_ID]?.[LS_FLAG]);
    ls.template = false;
    foundry.utils.setProperty(data, `flags.${MODULE_ID}.${LS_FLAG}`, ls);
    if (source.pack) data._stats = { ...(data._stats ?? {}), compendiumSource: source.uuid };
    const item = await Item.create(data);
    this._catalog = null;
    item.sheet.render(true);
    LifestyleItemConfig.open(item);
    this.render();
  }

  static async #onNewHomebrew() {
    const buttons = Object.entries(CATEGORIES).map(([key, def]) => ({ action: key, label: L(`NEONHUB.Lifestyle.Category.${key}`), icon: def.icon }));
    const category = await Compat.DialogV2.wait({
      window: { title: L("NEONHUB.Lifestyle.NewHomebrew"), icon: "fa-solid fa-flask" },
      content: `<p>${esc(L("NEONHUB.Lifestyle.NewHomebrewBody"))}</p>`,
      buttons,
      classes: ["neon-hub", "nh-cal-dialog", "neon-hub-choose"],
      rejectClose: false
    });
    if (!category) return;
    const folder = await LifestyleStore.homebrewFolder();
    const item = await Item.create(LifestyleStore.newItemData(category, { folder: folder.id }));
    this._catalog = null;
    item.sheet.render(true);
    LifestyleItemConfig.open(item);
    this.render();
  }

  static async #onPay() {
    const actor = this.actor;
    if (!actor) return;
    const { due, billing, wallet } = LifestyleOps.billFor(actor);
    if (!due) return;
    const key = wallet - due.total < 0 ? "NEONHUB.Lifestyle.Confirm.PayDebt" : "NEONHUB.Lifestyle.Confirm.Pay";
    const month = due.months > 1 ? `${billing.firstLabel} – ${billing.label}` : billing.label;
    if (!(await this.#confirm("NEONHUB.Lifestyle.Confirm.PayTitle", key, { amount: eb(due.total), month, name: actor.name, after: eb(wallet - due.total) }))) return;
    await this.#perform("pay", { actor: actor.uuid }, { success: L("NEONHUB.Lifestyle.Done.Paid", { name: actor.name }) });
  }

  static async #onPayFor(event, target) {
    const actor = game.actors.get(target.closest("[data-actor]").dataset.actor);
    if (!actor) return;
    await this.#perform("pay", { actor: actor.uuid }, { success: L("NEONHUB.Lifestyle.Done.Paid", { name: actor.name }) });
  }

  static async #onMarkPaid(event, target) {
    const row = target.closest("[data-actor]");
    const actor = game.actors.get(row.dataset.actor);
    if (!actor) return;
    await this.#perform("markPaid", { actor: actor.uuid, paid: target.dataset.paid === "true" });
  }

  static #onViewActor(event, target) {
    this.actorId = target.closest("[data-actor]").dataset.actor;
    this.tab = "current";
    this.render();
  }

  static async #onNewMonth() {
    const next = LifestyleStore.month + 1;
    const choice = await Compat.DialogV2.prompt({
      classes: ["neon-hub", "nh-cal-dialog"],
      window: { title: L("NEONHUB.Lifestyle.NewMonth"), icon: "fa-solid fa-calendar-plus" },
      content: `<p>${esc(L("NEONHUB.Lifestyle.NewMonthBody", { month: L("NEONHUB.Lifestyle.MonthN", { n: next }) }))}</p>
        <div class="form-group"><label class="checkbox"><input type="checkbox" name="bill" checked> ${esc(L("NEONHUB.Lifestyle.NewMonthBill"))}</label></div>
        <div class="form-group"><label class="checkbox"><input type="checkbox" name="hqs" ${HQStore.all().length ? "checked" : "disabled"}> ${esc(L("NEONHUB.Lifestyle.NewMonthHQ"))}</label></div>`,
      ok: { label: L("NEONHUB.Lifestyle.NewMonth"), callback: (ev, button) => ({ bill: button.form.elements.bill.checked, hqs: button.form.elements.hqs.checked }) },
      rejectClose: false
    });
    if (!choice) return;
    const result = await this.#perform("newMonth", choice);
    if (!result) return;
    const parts = [L("NEONHUB.Lifestyle.Done.NewMonth", { month: result.label })];
    if (result.billing) {
      parts.push(L("NEONHUB.Lifestyle.Done.Billed", { n: result.billing.paid.length }));
      if (result.billing.failed.length) ui.notifications.warn(L("NEONHUB.Lifestyle.Done.BillFailed", { names: result.billing.failed.map((f) => f.name).join(", ") }));
    }
    ui.notifications.info(parts.join(" "));
  }

  static async #onBillAll() {
    if (!(await this.#confirm("NEONHUB.Lifestyle.BillAll", "NEONHUB.Lifestyle.Confirm.BillAll"))) return;
    const result = await this.#perform("billAll", {});
    if (!result) return;
    ui.notifications.info(L("NEONHUB.Lifestyle.Done.Billed", { n: result.paid.length }));
    if (result.failed.length) {
      ui.notifications.warn(L("NEONHUB.Lifestyle.Done.BillFailed", { names: result.failed.map((f) => `${f.name} (${f.error})`).join("; ") }));
    }
  }

  static #onOpenHQ(event, target) {
    HQApp.open(target.dataset.id);
  }

  static #onOpenCalendar() {
    game.modules.get(MODULE_ID).api?.openCalendar();
  }

  /** GM: move a calendar to its next rent day, which starts the month. */
  static async #onToRentDay(event, target) {
    const id = target.closest("[data-calendar]").dataset.calendar;
    if (this.busy) return;
    this.busy = true;
    try {
      await game.modules.get(MODULE_ID).api?.toRentDay(id);
    } catch (err) {
      ui.notifications.warn(err.message);
    } finally {
      this.busy = false;
      if (this.rendered) this.render();
    }
  }

  static #onOpenSheet() {
    this.actor?.sheet?.render(true);
  }

  _onClose(options) {
    super._onClose?.(options);
    LifestyleApp.instance = null;
  }
}
