import { Compat } from "../compat.js";
import { ACCENTS, CalendarStore } from "./cal-store.js";
import { clampDate } from "./cal-dates.js";

const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));
const esc = (s) => Handlebars.escapeExpression(String(s ?? ""));

/**
 * GM form to create or edit a calendar: name, start date (new only), rent day,
 * accent and which players see it. Resolves to the values, or null if dismissed.
 */
export async function calendarDialog(calendar = null) {
  const isNew = !calendar;
  const list = CalendarStore.all();
  const data = calendar ?? {
    ...CalendarStore.defaultDate(),
    name: L("NEONHUB.Calendar.DefaultName", { n: list.length + 1 }),
    color: ACCENTS[list.length % ACCENTS.length],
    players: [],
    rentDay: 1,
    clock: true
  };
  // Only offered with SmallTime, but kept either way.
  const clockField = game.modules.get("smalltime")?.active ? `
    <div class="form-group">
      <label class="nh-check"><input type="checkbox" name="clock" ${data.clock !== false ? "checked" : ""}> ${esc(L("NEONHUB.Clock.Follow"))}</label>
      <p class="hint">${esc(L("NEONHUB.Clock.FollowHint"))}</p>
    </div>` : "";

  const accents = ACCENTS.includes(data.color) ? ACCENTS : [...ACCENTS, data.color];
  const swatches = accents.map((c) => `
    <label class="nh-cal-swatch" style="--swatch:${c}" data-tooltip="${c}">
      <input type="radio" name="color" value="${c}" ${c === data.color ? "checked" : ""}><span></span>
    </label>`).join("");

  const players = game.users.filter((u) => !u.isGM);
  const playerBoxes = players.length
    ? `<div class="nh-cal-players">${players.map((u) => `
        <label class="nh-cal-player" style="--player:${esc(u.color?.css ?? u.color)}">
          <input type="checkbox" name="players" value="${u.id}" ${data.players.includes(u.id) ? "checked" : ""}>
          <i></i><span>${esc(u.name)}</span>
        </label>`).join("")}</div>`
    : `<p class="hint">${esc(L("NEONHUB.Calendar.Dialog.NoPlayers"))}</p>`;

  const dateFields = isNew ? `
    <div class="form-group">
      <label>${esc(L("NEONHUB.Calendar.Dialog.Start"))}</label>
      <div class="nh-cal-date-inputs">
        <input type="number" name="day" value="${data.day}" min="1" max="31" aria-label="${esc(L("NEONHUB.Calendar.Field.Day"))}">
        <span>.</span>
        <input type="number" name="month" value="${data.month}" min="1" max="12" aria-label="${esc(L("NEONHUB.Calendar.Field.Month"))}">
        <span>.</span>
        <input type="number" name="year" value="${data.year}" min="1" max="9999" class="is-year" aria-label="${esc(L("NEONHUB.Calendar.Field.Year"))}">
      </div>
    </div>` : "";

  const content = `
    <div class="form-group">
      <label>${esc(L("NEONHUB.Calendar.Dialog.Name"))}</label>
      <input type="text" name="name" value="${esc(data.name)}" maxlength="60" required autofocus>
    </div>
    ${dateFields}
    <div class="form-group">
      <label>${esc(L("NEONHUB.Calendar.Dialog.RentDay"))}</label>
      <input type="number" name="rentDay" value="${data.rentDay}" min="1" max="31">
      <p class="hint">${esc(L("NEONHUB.Calendar.Dialog.RentDayHint"))}</p>
    </div>
    ${clockField}
    <div class="form-group stacked">
      <label>${esc(L("NEONHUB.Calendar.Dialog.Accent"))}</label>
      <div class="nh-cal-swatches">${swatches}</div>
    </div>
    <div class="form-group stacked">
      <label>${esc(L("NEONHUB.Calendar.Dialog.Players"))}</label>
      ${playerBoxes}
      <p class="hint">${esc(L("NEONHUB.Calendar.Dialog.PlayersHint"))}</p>
    </div>`;

  return Compat.DialogV2.prompt({
    window: { title: L(isNew ? "NEONHUB.Calendar.New" : "NEONHUB.Calendar.Edit"), icon: "fa-solid fa-calendar-plus" },
    classes: ["neon-hub", "nh-cal-dialog"],
    position: { width: 440 },
    content,
    rejectClose: false,
    ok: {
      label: L(isNew ? "NEONHUB.Calendar.Dialog.Create" : "NEONHUB.Calendar.Dialog.Save"),
      icon: "fa-solid fa-check",
      callback: (event, button) => {
        const form = button.form;
        const result = {
          name: form.elements.name.value.trim(),
          rentDay: Number(form.elements.rentDay.value) || 1,
          color: form.querySelector("input[name=color]:checked")?.value ?? data.color,
          players: [...form.querySelectorAll("input[name=players]:checked")].map((i) => i.value)
        };
        if (form.elements.clock) result.clock = form.elements.clock.checked;
        if (isNew) Object.assign(result, clampDate({ day: form.elements.day.value, month: form.elements.month.value, year: form.elements.year.value }));
        return result;
      }
    }
  });
}
