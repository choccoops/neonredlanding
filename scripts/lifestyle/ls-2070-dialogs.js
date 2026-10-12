import { Compat } from "../compat.js";
import { CPR } from "../cpr.js";
import { ENVIRONMENT, INCIDENTS, ART_TIERS, PERFORMED_BY, LIVING, THREE_WEEKS, automaticEffects, defaultLiving } from "./ls-2070.js";
import { fromDayNumber } from "../calendar/cal-dates.js";
import { LifestyleStore } from "./ls-store.js";
import { Lifestyle2070 } from "./ls-2070-ops.js";

const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));
const esc = (s) => Handlebars.escapeExpression(String(s ?? ""));
const eb = (n) => `${Math.round(Number(n) || 0).toLocaleString(game.i18n.lang)}eb`;
const DIALOG = ["neon-hub", "nh-cal-dialog", "nh-ls-dialog"];

/**
 * GM: the rent-day Humanity check. Lists what the character's lifestyle brings on its own, and
 * the judgement calls to tick. Resolves to the ticked effects ({ key: true | count }) or null.
 */
export async function humanityDialog(actor) {
  const items = LifestyleStore.items(actor);
  const auto = automaticEffects(items, { living: "none" });
  const full = automaticEffects(items, { living: "home" });
  const where = Lifestyle2070.homeSince(actor);
  const start = defaultLiving(where?.days ?? null);
  const since = where?.since !== null && where?.since !== undefined ? fromDayNumber(where.since) : null;
  const homeTax = full.taxes.find((t) => t.key === "home")?.n ?? 0;
  const livingInfo = !where ? L("NEONHUB.Lifestyle.Living.NoHome")
    : where.days === null ? L("NEONHUB.Lifestyle.Living.Undated", { home: where.home.name })
      : L("NEONHUB.Lifestyle.Living.Since", { home: where.home.name, date: `${since.day}.${since.month}.${since.year}`, days: where.days });
  const livingOptions = Object.entries(LIVING).map(([key, n]) => {
    const label = key === "home"
      ? L("NEONHUB.Lifestyle.Living.Home", { tax: homeTax, credit: full.credit })
      : L(`NEONHUB.Lifestyle.Living.${key}`, { n });
    return `<option value="${key}" ${key === start ? "selected" : ""}>${esc(label)}</option>`;
  }).join("");
  const tickable = Lifestyle2070.tickable();
  const mods = [];
  const autoRows = auto.effects.map((e) => `<li class="is-${ENVIRONMENT[e.key].kind}"><i class="fa-solid fa-lock"></i> ${esc(L(`NEONHUB.Lifestyle.Env.${e.key}`))} <b>${e.dice}</b></li>`);
  for (const t of auto.taxes) autoRows.push(`<li class="is-loss"><i class="fa-solid fa-lock"></i> ${esc(L(`NEONHUB.Lifestyle.Humanity.TaxFrom.${t.key}`))} <b>${t.n}</b></li>`);
  if (auto.tax && auto.lossMod) mods.unshift(L("NEONHUB.Lifestyle.Humanity.TaxMod", { n: auto.lossMod }));
  if (auto.credit) autoRows.push(`<li class="is-gain"><i class="fa-solid fa-lock"></i> ${esc(L("NEONHUB.Lifestyle.Humanity.Credit"))} <b>${auto.credit}${auto.gainMod ? ` +${auto.gainMod}` : ""}</b></li>`);
  if (auto.art) autoRows.push(`<li class="is-gain"><i class="fa-solid fa-lock"></i> ${esc(L("NEONHUB.Lifestyle.Humanity.Art"))} <b>${auto.art}</b></li>`);
  if (auto.lossMod) mods.push(L("NEONHUB.Lifestyle.Humanity.LossMod", { n: auto.lossMod }));
  if (auto.gainMod) mods.push(L("NEONHUB.Lifestyle.Humanity.GainMod", { n: auto.gainMod }));
  const tick = (t) => t.count
    ? `<label class="nh-ls-tick is-count"><input type="number" name="${t.key}" min="0" max="9" value="0"> ${esc(t.label)} <b>${t.dice}</b></label>`
    : `<label class="nh-ls-tick"><input type="checkbox" name="${t.key}"> ${esc(t.label)} <b>${t.dice}</b></label>`;

  const content = `
    <p class="hint">${esc(L("NEONHUB.Lifestyle.Humanity.Intro", { name: actor.name }))}</p>
    <div class="form-group stacked">
      <label>${esc(L("NEONHUB.Lifestyle.Humanity.Automatic"))}</label>
      ${autoRows.length ? `<ul class="nh-ls-autolist">${autoRows.join("")}</ul>` : `<p class="hint">${esc(L("NEONHUB.Lifestyle.Humanity.NoAutomatic"))}</p>`}
      ${mods.length ? `<p class="hint">${esc(mods.join(" · "))}</p>` : ""}
    </div>
    <div class="form-group">
      <label>${esc(L("NEONHUB.Lifestyle.Living.Label"))}</label>
      <select name="living">${livingOptions}</select>
      <p class="hint">${esc(livingInfo)} ${esc(L("NEONHUB.Lifestyle.Living.Hint", { n: THREE_WEEKS }))}</p>
    </div>
    <div class="nh-ls-ticks">
      <div class="form-group stacked"><label>${esc(L("NEONHUB.Lifestyle.Humanity.Losses"))}</label>${tickable.loss.map(tick).join("")}</div>
      <div class="form-group stacked"><label>${esc(L("NEONHUB.Lifestyle.Humanity.Gains"))}</label>${tickable.gain.map(tick).join("")}</div>
    </div>
    <p class="hint">${esc(L("NEONHUB.Lifestyle.Humanity.GoodLife"))}</p>`;

  return Compat.DialogV2.prompt({
    window: { title: L("NEONHUB.Lifestyle.Humanity.Title", { name: actor.name }), icon: "fa-solid fa-heart-pulse" },
    classes: DIALOG,
    position: { width: 620 },
    content,
    rejectClose: false,
    ok: {
      label: L("NEONHUB.Lifestyle.Humanity.Roll"),
      icon: "fa-solid fa-dice",
      callback: (event, button) => {
        const form = button.form;
        const ticked = { living: form.elements.living.value };
        for (const t of [...tickable.loss, ...tickable.gain]) {
          const input = form.elements[t.key];
          if (!input) continue;
          if (t.count) ticked[t.key] = Math.max(0, Math.floor(Number(input.value) || 0));
          else ticked[t.key] = input.checked;
        }
        return ticked;
      }
    }
  });
}

/**
 * GM: a one-time Humanity incident. Pick who it happened to and what, or roll custom dice.
 * Resolves to { actors: uuid[], incident: { kind, dice, label } } or null.
 */
export async function incidentDialog(selectedIds = []) {
  const characters = LifestyleStore.characters();
  const people = characters.map((a) => `
    <label class="nh-cal-player"><input type="checkbox" name="actors" value="${a.uuid}" ${selectedIds.includes(a.id) ? "checked" : ""}><i></i><span>${esc(a.name)}</span></label>`).join("");
  const options = [];
  for (const kind of ["loss", "gain"]) {
    for (const [dice, keys] of Object.entries(INCIDENTS[kind])) {
      options.push(`<optgroup label="${esc(L(`NEONHUB.Lifestyle.Incident.${kind}`))} ${dice}">${keys.map((k) => `<option value="${kind}|${dice}|${k}">${esc(L(`NEONHUB.Lifestyle.Incident.${k}`))}</option>`).join("")}</optgroup>`);
    }
  }
  const content = `
    <div class="form-group stacked">
      <label>${esc(L("NEONHUB.Lifestyle.Incident.Who"))}</label>
      ${characters.length ? `<div class="nh-cal-players">${people}</div>` : `<p class="hint">${esc(L("NEONHUB.Lifestyle.NoCharacters"))}</p>`}
    </div>
    <div class="form-group stacked">
      <label>${esc(L("NEONHUB.Lifestyle.Incident.What"))}</label>
      <select name="incident">${options.join("")}<option value="custom">${esc(L("NEONHUB.Lifestyle.Incident.Custom"))}</option></select>
    </div>
    <div class="form-group">
      <label>${esc(L("NEONHUB.Lifestyle.Incident.CustomRoll"))}</label>
      <select name="kind"><option value="loss">${esc(L("NEONHUB.Lifestyle.Incident.loss"))}</option><option value="gain">${esc(L("NEONHUB.Lifestyle.Incident.gain"))}</option></select>
      <select name="dice"><option>1d6</option><option>2d6</option><option>3d6</option><option>4d6</option></select>
      <input type="text" name="label" placeholder="${esc(L("NEONHUB.Lifestyle.Incident.LabelPlaceholder"))}">
      <p class="hint">${esc(L("NEONHUB.Lifestyle.Incident.Hint"))}</p>
    </div>`;
  return Compat.DialogV2.prompt({
    window: { title: L("NEONHUB.Lifestyle.Incident.Title"), icon: "fa-solid fa-heart-crack" },
    classes: DIALOG,
    position: { width: 520 },
    content,
    rejectClose: false,
    ok: {
      label: L("NEONHUB.Lifestyle.Incident.Roll"),
      icon: "fa-solid fa-dice",
      callback: (event, button) => {
        const form = button.form;
        const actors = [...form.querySelectorAll("input[name=actors]:checked")].map((i) => i.value);
        const pick = form.elements.incident.value;
        let incident;
        if (pick === "custom") {
          incident = { kind: form.elements.kind.value, dice: form.elements.dice.value, label: form.elements.label.value.trim() || L("NEONHUB.Lifestyle.Incident.Custom") };
        } else {
          const [kind, dice, key] = pick.split("|");
          incident = { kind, dice, label: L(`NEONHUB.Lifestyle.Incident.${key}`) };
        }
        return { actors, incident };
      }
    }
  });
}

/**
 * Make art: skill, tier, title, and for music or acting whether it's performed too.
 * Resolves to { skill, tier, extraMonths, title, perform } or null.
 */
export async function artDialog(actor) {
  const skills = Lifestyle2070.artSkills(actor);
  if (!skills.length) {
    ui.notifications.warn(L("NEONHUB.Lifestyle.Art.NoSkills", { name: actor.name }));
    return null;
  }
  const wallet = CPR.hasWealth(actor) ? eb(CPR.getWealth(actor)) : "—";
  const skillOptions = skills.map((s) => `<option value="${esc(s.name)}" data-family="${esc(s.family)}">${esc(s.name)} (+${s.base})</option>`).join("");
  const tierOptions = ART_TIERS.map((t, i) => `<option value="${i}">${esc(L(`NEONHUB.Lifestyle.Art.Tier.${t.scarcity}`))}: ${eb(t.cost)} · ${esc(L(`NEONHUB.Lifestyle.Art.Time.${t.time}`))} · DV${t.dv} · ${t.extra ? "4+" : t.hg} ${esc(L("NEONHUB.Lifestyle.Art.HumanityShort"))}</option>`).join("");
  const performable = Object.keys(PERFORMED_BY);
  const content = `
    <p class="hint">${esc(L("NEONHUB.Lifestyle.Art.Intro", { wallet }))}</p>
    <div class="form-group"><label>${esc(L("NEONHUB.Lifestyle.Art.Title"))}</label><input type="text" name="title" maxlength="80" placeholder="${esc(L("NEONHUB.Lifestyle.Art.Untitled"))}"></div>
    <div class="form-group"><label>${esc(L("NEONHUB.Lifestyle.Art.Skill"))}</label><select name="skill">${skillOptions}</select></div>
    <div class="form-group"><label>${esc(L("NEONHUB.Lifestyle.Art.TierLabel"))}</label><select name="tier">${tierOptions}</select></div>
    <div class="form-group"><label>${esc(L("NEONHUB.Lifestyle.Art.Extra"))}</label><input type="number" name="extra" min="0" max="12" value="0"><p class="hint">${esc(L("NEONHUB.Lifestyle.Art.ExtraHint"))}</p></div>
    <div class="form-group"><label class="nh-check"><input type="checkbox" name="perform"> ${esc(L("NEONHUB.Lifestyle.Art.Perform"))}</label><p class="hint">${esc(L("NEONHUB.Lifestyle.Art.PerformHint", { skills: performable.map((s) => `${s} → ${PERFORMED_BY[s]}`).join(", ") }))}</p></div>
    <p class="hint">${esc(L("NEONHUB.Lifestyle.Art.Rules"))}</p>`;
  return Compat.DialogV2.prompt({
    window: { title: L("NEONHUB.Lifestyle.Art.WindowTitle", { name: actor.name }), icon: "fa-solid fa-palette" },
    classes: DIALOG,
    position: { width: 540 },
    content,
    rejectClose: false,
    ok: {
      label: L("NEONHUB.Lifestyle.Art.Make"),
      icon: "fa-solid fa-paintbrush",
      callback: (event, button) => {
        const form = button.form;
        return {
          title: form.elements.title.value,
          skill: form.elements.skill.value,
          tier: Number(form.elements.tier.value) || 0,
          extraMonths: Number(form.elements.extra.value) || 0,
          perform: form.elements.perform.checked
        };
      }
    }
  });
}
