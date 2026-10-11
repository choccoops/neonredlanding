import { CONDITIONS, toC } from "./weather-data.js";
import { formatTime } from "./clock-time.js";
import { weekday } from "./cal-dates.js";

const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));
const esc = (s) => Handlebars.escapeExpression(String(s ?? ""));

/** Rain falls as sleet when it's cold. */
const SLEETY = new Set(["cold", "freezing"]);

/**
 * How planned weather and forecasts read: labels, icons, temperatures and the GM's
 * weather note with a short summary of each condition's rules (in Neon Hub's own words,
 * with the Cyberpunk RED core rulebook pages).
 */
export const WeatherView = {
  hour12() {
    try {
      return Number(game.settings.get("smalltime", "time-format")) === 12;
    } catch {
      return false;
    }
  },

  cond(key, band) {
    if (CONDITIONS[key]?.rain && SLEETY.has(band) && (key === "lightRain" || key === "heavyRain")) return L(`NEONHUB.Weather.Cond.${key}Sleet`);
    return L(`NEONHUB.Weather.Cond.${key}`);
  },

  band(band) {
    return L(`NEONHUB.Weather.Band.${band}`);
  },

  temp(f) {
    return `${f}°F · ${toC(f)}°C`;
  },

  shortDate(date) {
    return { weekday: L(`NEONHUB.Calendar.WeekdayShort.${weekday(date)}`), day: date.day };
  },

  /** The headline of a day: its multi-day event, else its short strange event, else its sky. */
  headline(day) {
    const key = day.event?.key ?? day.strange?.key ?? day.cond;
    return { key, icon: CONDITIONS[key].icon, color: CONDITIONS[key].color, label: this.cond(key, day.band) };
  },

  /** A planned day, as the GM (or a player, for today and past days) sees it. */
  actual(day) {
    const head = this.headline(day);
    const parts = [this.cond(day.cond, day.band)];
    if (day.strange) parts.push(this.strangeText(day.strange));
    if (day.event) parts.push(L("NEONHUB.Weather.EventDay", { name: this.cond(day.event.key), day: day.event.day, of: day.event.of }));
    return {
      ...head,
      sky: this.cond(day.cond, day.band),
      skyIcon: CONDITIONS[day.cond].icon,
      temp: this.temp(day.f),
      short: `${day.f}°`,
      band: this.band(day.band),
      tip: `${this.band(day.band)}, ${this.temp(day.f)} · ${parts.join(" · ")}`
    };
  },

  strangeText(strange) {
    const length = strange.minutes >= 60 ? L("NEONHUB.Weather.Hours", { n: strange.minutes / 60 }) : L("NEONHUB.Weather.Minutes", { n: strange.minutes });
    return L("NEONHUB.Weather.StrangeAt", { name: this.cond(strange.key), time: formatTime(strange.start, this.hour12()), length });
  },

  /** A forecast day, as players see it. */
  forecast(f) {
    const key = f.event?.key ?? f.cond;
    const risks = (f.risks ?? []).map((r) => ({ key: r.key, icon: CONDITIONS[r.key].icon, color: CONDITIONS[r.key].color, pct: r.pct, label: L("NEONHUB.Weather.Risk", { name: this.cond(r.key), pct: r.pct }) }));
    const temp = f.lo === f.hi ? `${f.lo}°F` : `${f.lo}–${f.hi}°F`;
    const label = f.event ? this.cond(f.event.key) : this.cond(f.cond, f.band);
    return {
      key,
      icon: CONDITIONS[key].icon,
      color: CONDITIONS[key].color,
      label,
      temp,
      short: `${f.lo}–${f.hi}°`,
      band: this.band(f.band),
      rain: f.rain,
      risks,
      tip: [`${label}`, `${this.band(f.band)} ${temp}`, L("NEONHUB.Weather.RainChance", { pct: f.rain }), ...risks.map((r) => r.label)].join(" · ")
    };
  },

  /** The GM's weather note for a day: what happens and how it plays. */
  note(day) {
    const rows = [];
    const rule = (key) => L(`NEONHUB.Weather.Rule.${key}`);
    const tempRule = { cold: "cold", freezing: "freezing", hot: "hot", scorching: "scorching" }[day.band];
    rows.push(`<p><b>${esc(this.band(day.band))}</b>, ${esc(this.temp(day.f))}${tempRule ? ` — ${esc(rule(tempRule))}` : ""}</p>`);
    const skyRule = CONDITIONS[day.cond].rain ? ` — ${esc(rule(day.cond))}` : "";
    rows.push(`<p><i class="fa-solid ${CONDITIONS[day.cond].icon}"></i> <b>${esc(this.cond(day.cond, day.band))}</b>${skyRule}</p>`);
    if (day.strange) {
      rows.push(`<p><i class="fa-solid ${CONDITIONS[day.strange.key].icon}" style="color:${CONDITIONS[day.strange.key].color}"></i> <b>${esc(this.strangeText(day.strange))}</b> — ${esc(rule(day.strange.key))}</p>`);
    }
    if (day.event) {
      const name = L("NEONHUB.Weather.EventDay", { name: this.cond(day.event.key), day: day.event.day, of: day.event.of });
      rows.push(`<p><i class="fa-solid ${CONDITIONS[day.event.key].icon}" style="color:${CONDITIONS[day.event.key].color}"></i> <b>${esc(name)}</b> — ${esc(rule(day.event.key))}</p>`);
    }
    return rows.join("");
  }
};
