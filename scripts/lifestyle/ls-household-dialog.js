import { MODULE_ID } from "../constants.js";
import { Compat } from "../compat.js";
import { CPR } from "../cpr.js";
import { LS_FLAG, normalizeLifestyle } from "./ls-data.js";
import { RENT_MODES } from "./ls-household-data.js";
import { LifestyleStore } from "./ls-store.js";

const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));
const esc = (s) => Handlebars.escapeExpression(String(s ?? ""));
const eb = (n) => `${Math.round(Number(n) || 0).toLocaleString(game.i18n.lang)}eb`;
const DIALOG = ["neon-hub", "nh-cal-dialog", "nh-ls-dialog"];

/** Housing to build a household around: this era's catalog and the world's homebrew. */
async function homes() {
  const out = [];
  const pack = game.packs.get(LifestyleStore.pack);
  const docs = pack ? await pack.getDocuments() : [];
  for (const item of [...docs, ...game.items]) {
    const flag = item.getFlag?.(MODULE_ID, LS_FLAG);
    if (!flag) continue;
    const ls = normalizeLifestyle(flag);
    if (ls.category !== "housing" || ls.template) continue;
    if (!item.pack && ls.era && ls.era !== LifestyleStore.era) continue;
    out.push({ uuid: item.uuid, name: item.name, ls, world: !item.pack });
  }
  return out.sort((a, b) => a.ls.monthly - b.ls.monthly || a.name.localeCompare(b.name));
}

/**
 * GM: set up or change a household. Resolves to
 * { name, homeSource, rent, rentMode, payer, inhabitants } or null.
 * homeSource is a housing item's uuid, or "" to keep the household's current home.
 */
export async function householdDialog(hh = null) {
  const options = await homes();
  const characters = LifestyleStore.characters();
  const homeOptions = [
    ...(hh ? [`<option value="">${esc(L("NEONHUB.Household.Dialog.KeepHome", { name: hh.name }))}</option>`] : []),
    ...options.map((h) => `<option value="${h.uuid}">${esc(h.name)}${h.world ? ` (${esc(L("NEONHUB.Lifestyle.Homebrew"))})` : ""}: ${esc(h.ls.monthly ? L("NEONHUB.Lifestyle.Cost.Monthly", { cost: eb(h.ls.monthly) }) : h.ls.upfront ? L("NEONHUB.Lifestyle.Cost.Upfront", { cost: eb(h.ls.upfront) }) : L("NEONHUB.Lifestyle.Cost.Free"))} · ${esc(L("NEONHUB.Lifestyle.Badge.Sleeps", { n: h.ls.sleeps }))}</option>`)
  ].join("");
  const people = characters.map((a) => `
    <label class="nh-cal-player"><input type="checkbox" name="inhabitants" value="${a.uuid}" ${hh?.inhabitants.includes(a.uuid) ? "checked" : ""}><i></i><span>${esc(a.name)}</span></label>`).join("");
  const payers = characters.map((a) => `<option value="${a.uuid}" ${hh?.payer === a.uuid ? "selected" : ""}>${esc(a.name)}</option>`).join("");
  const modes = RENT_MODES.map((m) => `<option value="${m}" ${(hh?.rentMode ?? "split") === m ? "selected" : ""}>${esc(L(`NEONHUB.Household.Mode.${m}`))}</option>`).join("");

  const content = `
    <p class="hint">${esc(L("NEONHUB.Household.Dialog.Intro"))}</p>
    <div class="form-group"><label>${esc(L("NEONHUB.Household.Dialog.Name"))}</label><input type="text" name="name" value="${esc(hh?.name ?? "")}" maxlength="60" placeholder="${esc(L("NEONHUB.Household.Dialog.NamePlaceholder"))}"></div>
    <div class="form-group stacked"><label>${esc(L("NEONHUB.Household.Dialog.Home"))}</label><select name="home">${homeOptions}</select></div>
    <div class="form-group"><label>${esc(L("NEONHUB.Household.Dialog.Rent"))}</label><input type="number" name="rent" min="0" step="1" value="${hh && hh.rent !== hh.home.monthly ? hh.rent : ""}" placeholder="${esc(L("NEONHUB.Household.Dialog.RentPlaceholder"))}"><p class="hint">${esc(L("NEONHUB.Household.Dialog.RentHint"))}</p></div>
    <div class="form-group"><label>${esc(L("NEONHUB.Household.Dialog.Mode"))}</label><select name="rentMode">${modes}</select><p class="hint">${esc(L("NEONHUB.Household.Dialog.ModeHint"))}</p></div>
    <div class="form-group"><label>${esc(L("NEONHUB.Household.Dialog.Payer"))}</label><select name="payer">${payers}</select></div>
    <div class="form-group stacked"><label>${esc(L("NEONHUB.Household.Dialog.Inhabitants"))}</label>
      ${characters.length ? `<div class="nh-cal-players">${people}</div>` : `<p class="hint">${esc(L("NEONHUB.Lifestyle.NoCharacters"))}</p>`}
      <p class="hint">${esc(L("NEONHUB.Household.Dialog.InhabitantsHint"))}</p>
    </div>`;

  return Compat.DialogV2.prompt({
    window: { title: L(hh ? "NEONHUB.Household.Dialog.EditTitle" : "NEONHUB.Household.Dialog.NewTitle"), icon: "fa-solid fa-people-roof" },
    classes: DIALOG,
    position: { width: 540 },
    content,
    rejectClose: false,
    ok: {
      label: L(hh ? "NEONHUB.Household.Dialog.Save" : "NEONHUB.Household.Dialog.Create"),
      icon: "fa-solid fa-check",
      callback: (event, button) => {
        const form = button.form;
        const rent = form.elements.rent.value;
        return {
          name: form.elements.name.value.trim(),
          homeSource: form.elements.home.value,
          rent: rent === "" ? null : Math.max(0, Math.floor(Number(rent) || 0)),
          rentMode: form.elements.rentMode.value,
          payer: form.elements.payer.value,
          inhabitants: [...form.querySelectorAll("input[name=inhabitants]:checked")].map((i) => i.value)
        };
      }
    }
  });
}

/** Chip into the pool: resolves to the amount, or null. */
export async function chipInDialog(hh, actor, status) {
  const wallet = CPR.hasWealth(actor) ? CPR.getWealth(actor) : 0;
  const content = `
    <p>${esc(L("NEONHUB.Household.ChipIn.Body", { name: hh.name, total: eb(status.total), rent: eb(status.rent), left: eb(status.left) }))}</p>
    <div class="form-group"><label>${esc(L("NEONHUB.Household.ChipIn.Amount"))}</label><input type="number" name="amount" min="1" max="${status.left}" step="1" value="${Math.min(status.left, Math.max(0, wallet)) || status.left}" autofocus></div>
    <p class="hint">${esc(L("NEONHUB.Household.ChipIn.Wallet", { name: actor.name, wallet: eb(wallet) }))}</p>`;
  return Compat.DialogV2.prompt({
    window: { title: L("NEONHUB.Household.ChipIn.Title", { name: hh.name }), icon: "fa-solid fa-hand-holding-dollar" },
    classes: DIALOG,
    position: { width: 420 },
    content,
    rejectClose: false,
    ok: {
      label: L("NEONHUB.Household.ChipIn.Pay"),
      icon: "fa-solid fa-hand-holding-dollar",
      callback: (event, button) => Math.max(0, Math.floor(Number(button.form.elements.amount.value) || 0))
    }
  });
}
