import { Compat } from "../compat.js";
import { CONDITIONS, STANDARD, STRANGE_KEYS, RED_ERA } from "./weather-data.js";
import { WeatherStore } from "./weather-store.js";

const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));
const esc = (s) => Handlebars.escapeExpression(String(s ?? ""));

/**
 * GM: a calendar's weather. Plan days from the calendar's date, pick the forecast day,
 * keep it planned ahead, and choose which conditions can turn up at all.
 * Resolves to { action: "plan"|"save"|"clear", days, weather, off } or null.
 */
export async function weatherDialog(calendar) {
  const off = new Set(WeatherStore.off);
  const has = WeatherStore.has(calendar.id);
  const w = calendar.weather;
  const weekdays = [-1, 1, 2, 3, 4, 5, 6, 0].map((d) => `<option value="${d}" ${w.forecastDay === d ? "selected" : ""}>${esc(d < 0 ? L("NEONHUB.Weather.Dialog.NoForecast") : L(`NEONHUB.Calendar.Weekday.${d}`))}</option>`).join("");
  const box = (key) => `
    <label class="nh-wx-cond" style="--wx:${CONDITIONS[key].color}">
      <input type="checkbox" name="cond" value="${key}" ${off.has(key) ? "" : "checked"}>
      <i class="fa-solid ${CONDITIONS[key].icon}"></i><span>${esc(L(`NEONHUB.Weather.Cond.${key}`))}</span>
    </label>`;

  const content = `
    <p class="hint">${esc(L("NEONHUB.Weather.Dialog.Intro"))}</p>
    <div class="form-group">
      <label>${esc(L("NEONHUB.Weather.Dialog.Days"))}</label>
      <input type="number" name="days" value="42" min="1" max="366">
      <p class="hint">${esc(L(has ? "NEONHUB.Weather.Dialog.DaysHintReplan" : "NEONHUB.Weather.Dialog.DaysHint"))}</p>
    </div>
    <div class="form-group">
      <label class="nh-check"><input type="checkbox" name="auto" ${w.auto ? "checked" : ""}> ${esc(L("NEONHUB.Weather.Dialog.Auto"))}</label>
    </div>
    <div class="form-group">
      <label>${esc(L("NEONHUB.Weather.Dialog.ForecastDay"))}</label>
      <select name="forecastDay">${weekdays}</select>
      <p class="hint">${esc(L("NEONHUB.Weather.Dialog.ForecastHint"))}</p>
    </div>
    <div class="form-group">
      <label class="nh-check"><input type="checkbox" name="chat" ${w.chat ? "checked" : ""}> ${esc(L("NEONHUB.Weather.Dialog.Chat"))}</label>
    </div>
    <div class="form-group stacked">
      <label>${esc(L("NEONHUB.Weather.Dialog.Conditions"))}</label>
      <div class="nh-wx-presets">
        <button type="button" data-preset="all">${esc(L("NEONHUB.Weather.Dialog.PresetAll"))}</button>
        <button type="button" data-preset="2070">${esc(L("NEONHUB.Weather.Dialog.Preset2070"))}</button>
      </div>
      <div class="nh-wx-conds"><span class="nh-wx-group">${esc(L("NEONHUB.Weather.Dialog.Standard"))}</span>${STANDARD.map(box).join("")}</div>
      <div class="nh-wx-conds"><span class="nh-wx-group">${esc(L("NEONHUB.Weather.Dialog.Strange"))}</span>${STRANGE_KEYS.map(box).join("")}</div>
      <p class="hint">${esc(L("NEONHUB.Weather.Dialog.ConditionsHint"))}</p>
    </div>`;

  // The preset buttons tick and untick the boxes in place.
  const hook = Hooks.on("renderDialogV2", (app, html) => {
    const root = Compat.element(html) ?? app.element;
    if (!root?.querySelector?.(".nh-wx-presets")) return;
    Hooks.off("renderDialogV2", hook);
    for (const button of root.querySelectorAll("[data-preset]")) {
      button.addEventListener("click", () => {
        for (const input of root.querySelectorAll("input[name=cond]")) {
          input.checked = button.dataset.preset === "all" || !RED_ERA.includes(input.value);
        }
      });
    }
  });

  const read = (button) => {
    const form = button.form;
    const ticked = new Set([...form.querySelectorAll("input[name=cond]:checked")].map((i) => i.value));
    return {
      days: Math.min(366, Math.max(1, Math.round(Number(form.elements.days.value) || 42))),
      weather: { forecastDay: Number(form.elements.forecastDay.value), auto: form.elements.auto.checked, chat: form.elements.chat.checked },
      off: Object.keys(CONDITIONS).filter((k) => !ticked.has(k))
    };
  };
  const buttons = [
    { action: "plan", label: L(has ? "NEONHUB.Weather.Dialog.Replan" : "NEONHUB.Weather.Dialog.Plan"), icon: "fa-solid fa-cloud-sun-rain", default: true, callback: (ev, b) => ({ action: "plan", ...read(b) }) },
    { action: "save", label: L("NEONHUB.Weather.Dialog.Save"), icon: "fa-solid fa-floppy-disk", callback: (ev, b) => ({ action: "save", ...read(b) }) }
  ];
  if (has) buttons.push({ action: "clear", label: L("NEONHUB.Weather.Dialog.Clear"), icon: "fa-solid fa-trash", callback: (ev, b) => ({ action: "clear", ...read(b) }) });

  try {
    return await Compat.DialogV2.wait({
      window: { title: L("NEONHUB.Weather.Dialog.Title", { name: calendar.name }), icon: "fa-solid fa-cloud-sun-rain" },
      classes: ["neon-hub", "nh-cal-dialog", "nh-wx-dialog"],
      position: { width: 520 },
      content,
      buttons,
      rejectClose: false
    });
  } finally {
    Hooks.off("renderDialogV2", hook);
  }
}
