import { MODULE_ID, TEMPLATE_PATH } from "../constants.js";
import { Compat } from "../compat.js";
import { CATEGORIES, LIFESTYLE_TIERS, LOAN_KINDS, FURNISHES, LS_FLAG, normalizeLifestyle, ITEM_ERAS, HOUSING_ENVS, PACKAGE_ENVS } from "./ls-data.js";
import { SCARCITY } from "./ls-2070.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { expandObject } = foundry.utils;
const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));

/**
 * GM form for an item's lifestyle settings: category, monthly cost and the fields that
 * category uses. Works on world items, compendium items (if unlocked) and owned items.
 * Saving also sets the item's usage to "equipped", so its Active Effects only apply
 * while it's active.
 */
export class LifestyleItemConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  static instances = new Map();

  constructor(item, options = {}) {
    super({ id: `${MODULE_ID}-lsconfig-${item.uuid.replace(/\W/g, "-")}`, ...options });
    this.item = item;
    const flag = item.getFlag(MODULE_ID, LS_FLAG);
    this.isNew = !flag;
    this.draft = normalizeLifestyle(flag ?? { category: "other", monthly: Number(item.system?.price?.market) || 0 });
  }

  static DEFAULT_OPTIONS = {
    classes: ["neon-hub", "nh-ls-config", "nh-cal-dialog"],
    tag: "form",
    window: { title: "NEONHUB.Lifestyle.Config.Title", icon: "fa-solid fa-sliders", resizable: true },
    position: { width: 500, height: "auto" },
    form: { handler: LifestyleItemConfig.#onSubmit, submitOnChange: false, closeOnSubmit: true },
    actions: { unflag: LifestyleItemConfig.#onUnflag }
  };

  static PARTS = {
    form: { template: `${TEMPLATE_PATH}/lifestyle/item-config.hbs` }
  };

  static open(item) {
    if (!game.user.isGM) return ui.notifications.warn(L("NEONHUB.Error.GMOnly"));
    if (item.pack && game.packs.get(item.pack)?.locked) return ui.notifications.warn(L("NEONHUB.Lifestyle.Config.Locked"));
    let app = this.instances.get(item.uuid);
    if (!app) {
      app = new this(item);
      this.instances.set(item.uuid, app);
    }
    app.render({ force: true });
    app.bringToFront?.();
    return app;
  }

  get title() {
    return `${L("NEONHUB.Lifestyle.Config.Title")}: ${this.item.name}`;
  }

  async _prepareContext() {
    const d = this.draft;
    const opt = (entries, value) => entries.map(([key, label]) => ({ key, label, selected: String(key) === String(value) }));
    const c = d.category;
    return {
      d,
      name: this.item.name,
      isNew: this.isNew,
      type: this.item.type,
      notGear: this.item.type !== "gear",
      categories: opt(Object.keys(CATEGORIES).map((k) => [k, L(`NEONHUB.Lifestyle.Category.${k}`)]), c),
      tiers: opt(Array.from({ length: LIFESTYLE_TIERS + 1 }, (_, i) => [i, i ? L(`NEONHUB.Lifestyle.Tier.${i}`) : L("NEONHUB.Lifestyle.Tier.0")]), d.tier),
      minTiers: opt(Array.from({ length: LIFESTYLE_TIERS + 1 }, (_, i) => [i, i ? L(`NEONHUB.Lifestyle.Tier.${i}`) : L("NEONHUB.Lifestyle.Config.AnyTier")]), d.minTier),
      loanKinds: opt(LOAN_KINDS.map((k) => [k, L(`NEONHUB.Lifestyle.Loan.Kind.${k}`)]), d.loan.kind),
      furnishes: opt(FURNISHES.map((k) => [k, L(`NEONHUB.Lifestyle.Furnishes.${k || "any"}`)]), d.furnishes),
      is: Object.fromEntries(Object.keys(CATEGORIES).map((k) => [k, k === c])),
      oneTime: !!CATEGORIES[c].oneTime,
      membershipLike: ["membership", "health", "subscription"].includes(c),
      responds: ["health", "transport"].includes(c),
      eras: opt(ITEM_ERAS.map((k) => [k, L(`NEONHUB.Lifestyle.Config.Era.${k || "any"}`)]), d.era),
      housingEnvs: opt(HOUSING_ENVS.map((k) => [k, L(`NEONHUB.Lifestyle.Config.Env.${k || "none"}`)]), d.env),
      packageEnvs: opt(PACKAGE_ENVS.map((k) => [k, L(`NEONHUB.Lifestyle.Config.Env.${k || "none"}`)]), d.env),
      scarcities: opt(SCARCITY.map((k, i) => [i, L(`NEONHUB.Lifestyle.Scarcity.${k}`)]), d.scarcity),
      installment: d.loan.kind === "installment"
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    // Re-draw when a choice changes which fields apply.
    for (const name of ["category", "loan.kind"]) {
      this.element.querySelector(`[name="${name}"]`)?.addEventListener("change", () => {
        this.draft = this.#read();
        this.render();
      });
    }
  }

  #read() {
    const data = expandObject(new Compat.FormDataExtended(this.element).object);
    return normalizeLifestyle({ ...this.draft, ...data, loan: { ...this.draft.loan, ...(data.loan ?? {}) }, check: { ...this.draft.check, ...(data.check ?? {}) } });
  }

  static async #onSubmit(event, form, formData) {
    const data = expandObject(formData.object);
    const ls = normalizeLifestyle({ ...this.draft, ...data, loan: { ...this.draft.loan, ...(data.loan ?? {}) }, check: { ...this.draft.check, ...(data.check ?? {}) } });
    const update = { [`flags.${MODULE_ID}.${LS_FLAG}`]: ls };
    // Effects follow the active switch; one-time purchases and recurring costs keep their shop price in step.
    if (this.item.type === "gear") update["system.usage"] = "equipped";
    if (!CATEGORIES[ls.category].oneTime && ls.category !== "loan" && this.item.type === "gear") update["system.price.market"] = ls.monthly;
    await this.item.update(update);
    ui.notifications.info(L("NEONHUB.Lifestyle.Config.Saved", { name: this.item.name }));
  }

  static async #onUnflag() {
    const ok = await Compat.DialogV2.confirm({
      classes: ["neon-hub", "nh-cal-dialog"],
      window: { title: L("NEONHUB.Lifestyle.Config.Unflag") },
      content: `<p>${Handlebars.escapeExpression(L("NEONHUB.Lifestyle.Config.UnflagBody", { name: this.item.name }))}</p>`,
      rejectClose: false
    });
    if (!ok) return;
    await this.item.unsetFlag(MODULE_ID, LS_FLAG);
    this.close();
  }

  _onClose(options) {
    super._onClose?.(options);
    LifestyleItemConfig.instances.delete(this.item.uuid);
  }
}
