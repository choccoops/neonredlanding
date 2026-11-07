import { MODULE_ID, TEMPLATE_PATH } from "./constants.js";
import { FBCOps } from "./fbc-ops.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));
const warn = (err) => ui.notifications.warn(err?.message ?? String(err));
const HL_MODES = ["roll", "static", "none"];

/**
 * Go Metal: pick one of the 2070 bodies for a character and install it, switch bodies, or leave one. GM only, since
 * a Full Body Conversion is surgery the table arranges in play.
 */
export class GoMetalApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static instances = new Map();

  static DEFAULT_OPTIONS = {
    classes: ["neon-hub", "nh-cal-app", "fbc-app"],
    tag: "div",
    window: { title: "FULLBORG.Title", icon: "fa-solid fa-robot", resizable: true },
    position: { width: 920, height: 700 },
    actions: {
      pick: GoMetalApp.#onPick,
      install: GoMetalApp.#onInstall,
      leave: GoMetalApp.#onLeave
    }
  };

  static PARTS = {
    main: { template: `${TEMPLATE_PATH}/go-metal.hbs`, scrollable: [".fbc-list", ".fbc-detail"] }
  };

  constructor(options = {}) {
    super(options);
    this.actorUuid = options.actorUuid;
    this.bodyId = options.bodyId ?? null;
    this.packageItemId = options.packageItemId ?? null;
    this.choice = { hl: "roll", biosystem: true, stripOld: true };
    this.busy = false;
  }

  /** Open Go Metal for an actor, optionally with a body picked (and a dropped package item to use up). */
  static open(actor, { bodyId = null, packageItemId = null } = {}) {
    if (!game.user.isGM) return ui.notifications.warn(L("FULLBORG.Error.GMOnly"));
    let app = this.instances.get(actor.uuid);
    if (!app) {
      app = new this({ id: `${MODULE_ID}-${actor.id}`, actorUuid: actor.uuid, bodyId, packageItemId });
      this.instances.set(actor.uuid, app);
    } else {
      if (bodyId) app.bodyId = bodyId;
      if (packageItemId) app.packageItemId = packageItemId;
    }
    app.render({ force: true });
    app.bringToFront?.();
    return app;
  }

  get actor() {
    return fromUuidSync(this.actorUuid);
  }

  get title() {
    return `${L("FULLBORG.Title")}: ${this.actor?.name ?? ""}`;
  }

  async _prepareContext() {
    const actor = this.actor;
    const state = FBCOps.state(actor);
    const bodies = await FBCOps.bodies();
    this.bodyId ??= bodies.find((b) => b.id !== state?.body?.id)?.id ?? null;
    const body = await FBCOps.body(this.bodyId);
    const makers = [];
    for (const b of bodies) {
      let m = makers.at(-1);
      if (m?.name !== b.maker) makers.push((m = { name: b.maker, bodies: [] }));
      m.bodies.push({ ...b, active: b.id === this.bodyId, current: b.id === state?.body?.id, worn: state?.worn?.includes(b.id) });
    }
    const info = body?.getFlag(MODULE_ID, "fbcBody") ?? {};
    return {
      actor,
      state,
      isFBC: !!state?.body,
      makers,
      none: !bodies.length,
      body,
      info,
      description: body?.system.information?.description ?? "",
      isCurrent: body && body.id === state?.body?.id,
      hasBiosystem: FBCOps.hasBiosystem(actor),
      hlModes: HL_MODES.map((m) => ({ id: m, label: L(`FULLBORG.HL.${m}`), hint: L(`FULLBORG.HL.${m}Hint`, { static: info.hl?.static ?? 0, roll: info.hl?.roll ?? "" }), checked: this.choice.hl === m })),
      choice: this.choice,
      busy: this.busy,
      installDisabled: this.busy || (body && body.id === state?.body?.id)
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    this.element.querySelectorAll("input[data-choice]").forEach((input) =>
      input.addEventListener("change", () => {
        const key = input.dataset.choice;
        this.choice[key] = input.type === "checkbox" ? input.checked : input.value;
      })
    );
  }

  _onClose(options) {
    super._onClose?.(options);
    GoMetalApp.instances.delete(this.actorUuid);
  }

  static #onPick(event, target) {
    this.bodyId = target.dataset.id;
    this.render();
  }

  static async #onInstall() {
    const actor = this.actor;
    const body = await FBCOps.body(this.bodyId);
    if (!actor || !body || this.busy) return;
    const switching = FBCOps.isFBC(actor);
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: L(switching ? "FULLBORG.Switch" : "FULLBORG.Install"), icon: "fa-solid fa-robot" },
      classes: ["neon-hub", "nh-cal-dialog"],
      content: `<p>${L(switching ? "FULLBORG.ConfirmSwitch" : "FULLBORG.Confirm", { name: Handlebars.escapeExpression(actor.name), body: Handlebars.escapeExpression(body.name) })}</p>`,
      rejectClose: false
    });
    if (!ok) return;
    this.busy = true;
    this.render();
    try {
      await FBCOps.goMetal(actor, body.id, this.choice);
      const pkg = this.packageItemId && actor.items.get(this.packageItemId);
      if (pkg) await pkg.delete();
      this.packageItemId = null;
      ui.notifications.info(L("FULLBORG.Done", { name: actor.name, body: body.name }));
    } catch (err) {
      console.error(err);
      warn(err);
    } finally {
      this.busy = false;
      this.render();
    }
  }

  static async #onLeave() {
    const actor = this.actor;
    const state = FBCOps.state(actor);
    if (!state?.body || this.busy) return;
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: L("FULLBORG.Leave"), icon: "fa-solid fa-person-walking-arrow-right" },
      classes: ["neon-hub", "nh-cal-dialog"],
      content: `<p>${L("FULLBORG.ConfirmLeave", { name: Handlebars.escapeExpression(actor.name), body: Handlebars.escapeExpression(state.body.name) })}</p>`,
      rejectClose: false
    });
    if (!ok) return;
    this.busy = true;
    this.render();
    try {
      await FBCOps.leaveBody(actor);
    } catch (err) {
      console.error(err);
      warn(err);
    } finally {
      this.busy = false;
      this.render();
    }
  }
}
