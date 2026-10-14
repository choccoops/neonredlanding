import { MODULE_ID } from "../constants.js";
import { HubSocket } from "../socket.js";
import { Messenger } from "../messenger.js";
import { LifestyleStore } from "../lifestyle/ls-store.js";
import { STORY_TYPES, normalizeScreamsheet, parseResult, followUps, storyGroups, rowId } from "./journal-data.js";
import { JournalStore, formatDate } from "./journal-store.js";

const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));
const esc = (s) => Handlebars.escapeExpression(String(s ?? ""));

export const SCREAM_PACK = `${MODULE_ID}.screamsheet-tables`;
/** The starter tables in the Screamsheet Tables compendium, by story type. */
export const STARTER_TABLES = {
  breaking: "nhScreamBreaking",
  news: "nhScreamNews0000",
  developing: "nhScreamDevelop0",
  advert: "nhScreamAdverts0",
  classified: "nhScreamClassify"
};
const DEFAULT_COUNTS = { breaking: 1, news: 3, developing: 2, advert: 2, classified: 4 };
const MAX_COUNT = 12;

const starterUuid = (type) => `Compendium.${SCREAM_PACK}.RollTable.${STARTER_TABLES[type]}`;

/**
 * Screamsheets: weekly issues in the Neon Journal. The GM writes stories, or rolls them from roll
 * tables (the starter tables, or their own), and publishes: players can then read the issue, a card
 * goes to chat, a breaking-news alert crosses everyone's screen, and with Night City Messenger each
 * character gets it in their inbox.
 */
export const ScreamOps = {
  register() {
    game.settings.register(MODULE_ID, "screamTables", { scope: "world", config: false, type: Object, default: {} });
    game.settings.register(MODULE_ID, "screamCounts", { scope: "world", config: false, type: Object, default: {} });
    game.settings.register(MODULE_ID, "screamMessenger", {
      name: "NEONHUB.Journal.Scream.Setting.Messenger",
      hint: "NEONHUB.Journal.Scream.Setting.MessengerHint",
      scope: "world",
      config: true,
      type: Boolean,
      default: true
    });
  },

  init() {
    HubSocket.on("screamAlert", (payload, sender) => {
      if (sender?.isGM) screamAlert(payload);
    });
  },

  /** { type: { uuid, count } } for the generator: the GM's choices, else the starter tables. */
  generator() {
    const tables = game.settings.get(MODULE_ID, "screamTables") ?? {};
    const counts = game.settings.get(MODULE_ID, "screamCounts") ?? {};
    return Object.fromEntries(STORY_TYPES.map((type) => {
      const uuid = typeof tables[type] === "string" ? tables[type] : starterUuid(type);
      const count = Number.isFinite(Number(counts[type])) ? Math.max(0, Math.min(MAX_COUNT, Math.floor(Number(counts[type])))) : DEFAULT_COUNTS[type];
      return [type, { uuid, count }];
    }));
  },

  async saveGenerator(choice) {
    const tables = {};
    const counts = {};
    for (const type of STORY_TYPES) {
      tables[type] = choice[type]?.uuid ?? "";
      counts[type] = Math.max(0, Math.min(MAX_COUNT, Math.floor(Number(choice[type]?.count) || 0)));
    }
    await game.settings.set(MODULE_ID, "screamTables", tables);
    await game.settings.set(MODULE_ID, "screamCounts", counts);
  },

  /** Roll tables the GM can pick for the generator: the starter tables and the world's. */
  async tableChoices() {
    const out = [];
    const pack = game.packs.get(SCREAM_PACK);
    if (pack) {
      const index = await pack.getIndex();
      for (const e of index) out.push({ uuid: `Compendium.${SCREAM_PACK}.RollTable.${e._id}`, name: `${L("NEONHUB.Journal.Scream.Starter")}: ${e.name}` });
    }
    for (const t of game.tables) out.push({ uuid: t.uuid, name: t.name });
    return out;
  },

  /** The latest issue (by number), or null. */
  latest() {
    let best = null;
    for (const entry of JournalStore.entries("screamsheets")) {
      const page = JournalStore.recordPage(entry, "screamsheet");
      const sheet = page ? JournalStore.data(page) : null;
      if (sheet && (!best || sheet.issue > best.sheet.issue)) best = { entry, page, sheet };
    }
    return best;
  },

  /** GM: a new draft issue: numbered after the last, dated today, with its follow-ups carried on. */
  async create() {
    if (!game.user.isGM) throw new Error(L("NEONHUB.Error.GMOnly"));
    const last = this.latest();
    const masthead = last?.sheet.masthead || L("NEONHUB.Journal.Scream.DefaultMasthead");
    const issue = (last?.sheet.issue ?? 0) + 1;
    const date = formatDate(JournalStore.today());
    return JournalStore.createEntry("screamsheets", {
      name: L("NEONHUB.Journal.Scream.IssueName", { masthead, issue, date: date || "" }).replace(/\s·\s*$/, ""),
      kind: "screamsheet",
      data: { masthead, issue, date, stories: followUps(last?.sheet) }
    });
  },

  /**
   * GM: roll stories for an issue from the generator's tables and add them.
   * @returns {Promise<number>} how many stories were added
   */
  async generate(entry) {
    if (!game.user.isGM) throw new Error(L("NEONHUB.Error.GMOnly"));
    const page = JournalStore.recordPage(entry, "screamsheet");
    if (!page) return 0;
    const sheet = JournalStore.data(page);
    const seen = new Set(sheet.stories.map((st) => st.headline.toLowerCase()));
    const added = [];
    const problems = [];
    for (const [type, { uuid, count }] of Object.entries(this.generator())) {
      if (!uuid || !count) continue;
      const table = await fromUuid(uuid).catch(() => null);
      if (!(table instanceof RollTable)) {
        problems.push(L(`NEONHUB.Journal.Scream.Type.${type}`));
        continue;
      }
      let tries = 0;
      let got = 0;
      while (got < count && tries < count * 6) {
        tries++;
        const { results } = await table.roll();
        const text = results.map((r) => r.text ?? r.description ?? r.name ?? "").join(" | ");
        const story = parseResult(text);
        if (!story.headline || seen.has(story.headline.toLowerCase())) continue;
        seen.add(story.headline.toLowerCase());
        added.push({ id: rowId(), type, ...story });
        got++;
      }
    }
    if (problems.length) ui.notifications.warn(L("NEONHUB.Journal.Scream.NoTable", { types: problems.join(", ") }));
    if (added.length) await JournalStore.save(page, { ...sheet, stories: [...sheet.stories, ...added] });
    return added.length;
  },

  /** GM: publish an issue: players can read it, a card goes to chat, an alert crosses every screen, and inboxes get it. */
  async publish(entry, { resend = false } = {}) {
    if (!game.user.isGM) throw new Error(L("NEONHUB.Error.GMOnly"));
    const page = JournalStore.recordPage(entry, "screamsheet");
    if (!page) return null;
    let sheet = JournalStore.data(page);
    if (!sheet.stories.length) throw new Error(L("NEONHUB.Journal.Scream.Error.Empty"));
    if (!sheet.published) sheet = await JournalStore.save(page, { ...sheet, published: true, publishedAt: Date.now() });
    if (!JournalStore.playersSee(entry)) await JournalStore.setPlayersSee(entry, true);

    const groups = storyGroups(sheet);
    const lead = groups[0]?.stories[0];
    const headlines = sheet.stories.filter((st) => ["breaking", "news", "developing"].includes(st.type)).slice(0, 5);
    const title = `${sheet.masthead}${sheet.issue ? ` #${sheet.issue}` : ""}`;

    // The chat card, for everyone.
    const content = `<div class="nh-cal-card nh-scream-card">`
      + `<div class="nh-cal-card-kicker">// ${esc(L(resend ? "NEONHUB.Journal.Scream.Reminder" : "NEONHUB.Journal.Scream.OutNow"))}</div>`
      + `<div class="nh-cal-card-name">${esc(title)}</div>${sheet.date ? `<p class="nh-scream-card-date">${esc(sheet.date)}</p>` : ""}`
      + (lead ? `<p class="nh-scream-card-lead is-${lead.type}">${esc(lead.headline)}</p>` : "")
      + `<ul class="nh-jr-card-list">${headlines.filter((st) => st !== lead).map((st) => `<li>${esc(st.headline)}</li>`).join("")}</ul>`
      + `<p class="nh-jr-card-open">@UUID[${entry.uuid}]{${esc(L("NEONHUB.Journal.Scream.Read"))}}</p></div>`;
    await ChatMessage.create({ content, speaker: { alias: sheet.masthead } });

    // The alert on every screen.
    HubSocket.emit("screamAlert", {
      uuid: entry.uuid,
      masthead: sheet.masthead,
      issue: sheet.issue,
      headlines: headlines.map((st) => ({ type: st.type, headline: st.headline }))
    }, game.users.filter((u) => u.active).map((u) => u.id));

    // Night City Messenger: each character's inbox.
    let sent = 0;
    if (!resend && game.settings.get(MODULE_ID, "screamMessenger")) sent = await this._messenger(sheet, title, headlines);
    return { sheet, sent };
  },

  async _messenger(sheet, title, headlines) {
    const api = globalThis.game?.nightcity?.messenger;
    if (!Messenger.ready || typeof api?.sendMessage !== "function") return 0;
    const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "") || "news";
    const body = `<p><strong>${esc(title)}</strong>${sheet.date ? ` · ${esc(sheet.date)}` : ""}</p>`
      + `<ul>${headlines.map((st) => `<li>${esc(st.headline)}</li>`).join("")}</ul>`
      + `<p><em>${esc(L("NEONHUB.Journal.Scream.MessengerFooter"))}</em></p>`;
    let sent = 0;
    for (const actor of LifestyleStore.characters()) {
      try {
        const result = await api.sendMessage({
          toActorId: actor.id,
          to: `${slug(actor.name)}@nightcity.net`,
          from: `${slug(sheet.masthead)}@screamsheet.net`,
          fromName: sheet.masthead,
          subject: headlines[0] ? `${title}: ${headlines[0].headline}` : title,
          body,
          priority: headlines.some((st) => st.type === "breaking") ? "urgent" : "normal"
        });
        if (result?.success !== false) sent++;
      } catch (err) {
        console.warn(`${MODULE_ID} | screamsheet to ${actor.name}'s inbox failed`, err);
      }
    }
    return sent;
  }
};

/**
 * The breaking-news alert: a banner across the top of the screen with the issue's headlines
 * running through it. Clicking opens the issue; it leaves by itself.
 */
export function screamAlert({ uuid, masthead, issue, headlines = [] }) {
  document.querySelector(".nh-scream-alert")?.remove();
  const el = document.createElement("div");
  el.className = "nh-scream-alert";
  const breaking = headlines.some((h) => h.type === "breaking");
  const items = headlines.map((h) => `<span class="is-${esc(h.type)}">${h.type === "breaking" ? `<b>${esc(L("NEONHUB.Journal.Scream.Type.breaking"))}</b> ` : ""}${esc(h.headline)}</span>`).join("<i>///</i>");
  el.innerHTML = `<div class="nh-scream-alert-tag ${breaking ? "is-breaking" : ""}">${esc(L(breaking ? "NEONHUB.Journal.Scream.Type.breaking" : "NEONHUB.Journal.Scream.NewIssue"))}</div>
    <div class="nh-scream-alert-name">${esc(masthead)}${issue ? ` <small>#${issue}</small>` : ""}</div>
    <div class="nh-scream-alert-ticker"><div class="nh-scream-alert-run">${items}<i>///</i>${items}</div></div>
    <button type="button" class="nh-scream-alert-read"><i class="fa-solid fa-newspaper"></i> ${esc(L("NEONHUB.Journal.Scream.Read"))}</button>`;
  const close = () => {
    el.classList.add("is-leaving");
    setTimeout(() => el.remove(), 400);
  };
  el.addEventListener("click", (ev) => {
    if (ev.target.closest(".nh-scream-alert-read")) game.modules.get(MODULE_ID)?.api?.journal?.open(uuid);
    close();
  });
  document.body.append(el);
  setTimeout(close, 14000);
  try {
    const audio = foundry.audio?.AudioHelper ?? globalThis.AudioHelper;
    audio?.play({ src: "sounds/notify.wav", volume: 0.6, autoplay: true, loop: false }, false);
  } catch { /* no sound, no matter */ }
}
