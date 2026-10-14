/**
 * The Neon Journal's records: gigs, downtime records and story sessions. Each lives on an ordinary
 * text page of a Journal Entry, its data in the page's flags and a readable copy in the page's
 * text, so it still reads in Foundry's own journal without the module. Pure: no Foundry calls.
 */

/** The browser's sections. "journals" is every other journal. */
export const SECTIONS = ["journals", "gigs", "screamsheets", "world", "characters", "story", "downtime"];
/** Sections whose entries Neon Hub makes (flagged on the entry). */
export const OWN_SECTIONS = ["gigs", "screamsheets", "world", "characters", "story", "downtime"];
/** What a page can be, besides Foundry's own pages. */
export const KINDS = ["gig", "session", "downtime", "screamsheet", "lore", "profile", "diary"];

/** Worldbuilding entries, and the facts each kind starts with (translation keys). */
export const LORE_TYPES = ["corporation", "gang", "place", "organization", "person"];
export const LORE_FACTS = {
  corporation: ["Headquarters", "Industry", "Leadership", "InNightCity", "Edgerunners"],
  gang: ["Turf", "KnownFor", "Leadership", "Rivals", "Hangouts"],
  place: ["Region", "ControlledBy", "Feel", "NotableLocations", "Danger"],
  organization: ["Kind", "Base", "Leadership", "Purpose"],
  person: ["Role", "Affiliation", "Location", "Status", "KnownFor"]
};

/** A screamsheet's stories, in the order an issue lays them out. */
export const STORY_TYPES = ["breaking", "news", "developing", "advert", "classified"];

export const GIG_STATUSES = ["found", "active", "completed", "failed"];
export const OBJECTIVE_STATES = ["open", "done", "failed"];
export const REWARD_KINDS = ["eddies", "item", "housing", "ip", "hqip", "text"];
export const SPLITS = ["each", "split"];

const int = (v, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};
const str = (v, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const html = (v) => (typeof v === "string" ? v.slice(0, 100000) : "");
const pick = (v, list, fallback = list[0]) => (list.includes(v) ? v : fallback);
const uuids = (v) => (Array.isArray(v) ? [...new Set(v.filter((u) => typeof u === "string" && u))] : []);
const list = (v) => (Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : []);
const date = (d) => (d && typeof d === "object" && d.year ? { year: int(d.year), month: int(d.month, 1, 12), day: int(d.day, 1, 31) } : null);

let counter = 0;
/** A short id for rows (objectives, rewards). */
export function rowId() {
  counter = (counter + 1) % 1296;
  return Date.now().toString(36).slice(-6) + counter.toString(36).padStart(2, "0") + Math.random().toString(36).slice(2, 6);
}

/* ------------------------------------------ */
/*  Gigs                                      */
/* ------------------------------------------ */

export function normalizeObjective(raw = {}) {
  const r = raw && typeof raw === "object" ? raw : {};
  return { id: str(r.id, 32) || rowId(), text: str(r.text, 300), state: pick(r.state, OBJECTIVE_STATES) };
}

export function normalizeReward(raw = {}) {
  const r = raw && typeof raw === "object" ? raw : {};
  const kind = pick(r.kind, REWARD_KINDS, "text");
  return {
    id: str(r.id, 32) || rowId(),
    kind,
    amount: int(r.amount, 0, 100000000),
    // eddies: each crew member gets the amount, or the crew splits it
    split: pick(r.split, SPLITS),
    // item and housing: the item to hand over, and its name for display
    uuid: str(r.uuid, 200),
    name: str(r.name, 120),
    // hqip: which Headquarters
    hq: str(r.hq, 64),
    text: str(r.text, 300),
    paid: !!r.paid,
    paidTo: str(r.paidTo, 300)
  };
}

export function normalizeGig(raw = {}) {
  const r = raw && typeof raw === "object" ? raw : {};
  const stamps = r.dates && typeof r.dates === "object" ? r.dates : {};
  return {
    status: pick(r.status, GIG_STATUSES),
    client: str(r.client, 120),
    location: str(r.location, 120),
    deadline: str(r.deadline, 80),
    danger: str(r.danger, 60),
    image: str(r.image, 400),
    briefing: html(r.briefing),
    crew: uuids(r.crew),
    objectives: list(r.objectives).map(normalizeObjective).filter((o) => o.text),
    rewards: list(r.rewards).map(normalizeReward).filter((w) => rewardFilled(w)),
    // in-world dates as shown ("14 Mar 2045"), stamped as the gig moves along
    dates: { found: str(stamps.found, 40), active: str(stamps.active, 40), completed: str(stamps.completed, 40), failed: str(stamps.failed, 40) },
    payout: r.payout && typeof r.payout === "object" ? { at: int(r.payout.at), by: str(r.payout.by, 60), date: str(r.payout.date, 40) } : null
  };
}

/** A reward row with something in it. */
export function rewardFilled(w) {
  switch (w.kind) {
    case "eddies": case "ip": return w.amount > 0;
    case "hqip": return w.amount > 0 && !!w.hq;
    case "item": case "housing": return !!w.uuid;
    default: return !!w.text;
  }
}

/** Objectives by state, in their order. */
export function objectiveGroups(gig) {
  const out = { open: [], done: [], failed: [] };
  for (const o of gig.objectives) out[o.state].push(o);
  return out;
}

/** { done, total } for a progress bar: failed objectives count as settled. */
export function progress(gig) {
  const total = gig.objectives.length;
  const settled = gig.objectives.filter((o) => o.state !== "open").length;
  return { done: settled, total, pct: total ? Math.round((settled / total) * 100) : 0 };
}

/** Whether there's anything left to pay out. */
export function unpaid(gig) {
  return gig.rewards.filter((w) => !w.paid);
}

/**
 * How an amount of eddies goes to recipients: everyone the amount ("each"), or split evenly with
 * the odd eddies to the first ones ("split").
 * @returns {number[]} one amount per recipient, in order
 */
export function shares(amount, count, split = "each") {
  const n = int(count);
  if (!n) return [];
  const a = int(amount);
  if (split !== "split") return Array(n).fill(a);
  const base = Math.floor(a / n);
  const odd = a - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < odd ? 1 : 0));
}

/** Status a gig goes to from a GM action, or null if it can't. */
export function nextStatus(status, action) {
  switch (action) {
    case "take": return status === "found" ? "active" : null;
    case "complete": return status === "found" || status === "active" ? "completed" : null;
    case "fail": return status === "found" || status === "active" ? "failed" : null;
    case "reopen": return status === "completed" || status === "failed" ? "active" : null;
    default: return null;
  }
}

/* ------------------------------------------ */
/*  Downtime records                          */
/* ------------------------------------------ */

function normalizeRecordEntry(raw = {}) {
  const r = raw && typeof raw === "object" ? raw : {};
  return { label: str(r.label, 200), minutes: int(r.minutes), time: str(r.time, 40), when: str(r.when, 60), source: str(r.source, 60), user: str(r.user, 60) };
}

/** What happened in one downtime, kept for the record when it's completed. */
export function normalizeDowntimeRecord(raw = {}) {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    id: str(r.id, 32),
    label: str(r.label, 80),
    total: int(r.total),
    totalText: str(r.totalText, 40),
    start: date(r.start),
    from: str(r.from, 40),
    to: str(r.to, 40),
    completedAt: int(r.completedAt),
    people: list(r.people).map((p) => ({
      uuid: str(p?.uuid, 120),
      name: str(p?.name, 120),
      img: str(p?.img, 400),
      spent: str(p?.spent, 40),
      left: str(p?.left, 40),
      entries: list(p?.entries).map(normalizeRecordEntry)
    }))
  };
}

/* ------------------------------------------ */
/*  Story sessions                            */
/* ------------------------------------------ */

export function normalizeSession(raw = {}) {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    number: int(r.number, 0, 9999),
    // in-world date as shown, and the real date it was played (YYYY-MM-DD)
    date: str(r.date, 40),
    played: /^\d{4}-\d{2}-\d{2}$/.test(r.played ?? "") ? r.played : "",
    crew: uuids(r.crew),
    summary: html(r.summary),
    events: list(r.events).map((e) => ({ id: str(e?.id, 32) || rowId(), text: str(e?.text, 300), key: !!e?.key })).filter((e) => e.text)
  };
}

/* ------------------------------------------ */
/*  Screamsheets                              */
/* ------------------------------------------ */

export function normalizeStory(raw = {}) {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    id: str(r.id, 32) || rowId(),
    type: pick(r.type, STORY_TYPES, "news"),
    headline: str(r.headline, 200),
    body: typeof r.body === "string" ? r.body.trim().slice(0, 4000) : "",
    // who it's from: a byline, an advertiser, a classified's contact
    source: str(r.source, 120),
    image: str(r.image, 400),
    // developing stories marked to follow up are carried into the next issue
    followUp: !!r.followUp,
    continued: !!r.continued
  };
}

/** One issue of the screamsheet. */
export function normalizeScreamsheet(raw = {}) {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    masthead: str(r.masthead, 80),
    issue: int(r.issue, 0, 99999),
    date: str(r.date, 40),
    published: !!r.published,
    publishedAt: int(r.publishedAt),
    stories: list(r.stories).map(normalizeStory).filter((st) => st.headline || st.body)
  };
}

/** An issue's stories by type, in layout order. */
export function storyGroups(sheet) {
  return STORY_TYPES.map((type) => ({ type, stories: sheet.stories.filter((st) => st.type === type) })).filter((g) => g.stories.length);
}

/**
 * A roll table result as a story: "Headline | the rest" splits at the first bar; without one, the
 * first sentence is the headline when the text runs long. HTML is stripped.
 */
export function parseResult(text) {
  const plain = String(text ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>\s*<p[^>]*>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
  const bar = plain.indexOf("|");
  if (bar >= 0) return { headline: plain.slice(0, bar).trim(), body: plain.slice(bar + 1).trim() };
  if (plain.length > 90) {
    const end = plain.search(/[.!?](\s|$)/);
    if (end > 0 && end < 140) return { headline: plain.slice(0, end + 1).trim(), body: plain.slice(end + 1).trim() };
  }
  return { headline: plain, body: "" };
}

/** Developing stories from the last issue that carry on into the next. */
export function followUps(previous) {
  return (previous?.stories ?? []).filter((st) => st.type === "developing" && st.followUp)
    .map((st) => ({ ...st, id: rowId(), followUp: false, continued: true }));
}

/* ------------------------------------------ */
/*  Worldbuilding                             */
/* ------------------------------------------ */

const facts = (v) => list(v).map((f) => ({ id: str(f?.id, 32) || rowId(), label: str(f?.label, 60), value: str(f?.value, 400) })).filter((f) => f.label || f.value);

/** A worldbuilding entry: a corporation, gang, place, organization or person. */
export function normalizeLore(raw = {}) {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    type: pick(r.type, LORE_TYPES, "organization"),
    image: str(r.image, 400),
    tagline: str(r.tagline, 200),
    facts: facts(r.facts),
    body: html(r.body),
    // where it comes from, e.g. a book and page
    source: str(r.source, 120)
  };
}

/** Facts for a new entry of a type: the template's labels, empty. */
export function loreTemplate(type, label = (k) => k) {
  return (LORE_FACTS[type] ?? []).map((key) => ({ id: rowId(), label: label(key), value: "" }));
}

/* ------------------------------------------ */
/*  Characters' journals                      */
/* ------------------------------------------ */

/** The first page of a character's journal: who they are. */
export function normalizeProfile(raw = {}) {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    actor: str(r.actor, 120),
    handle: str(r.handle, 80),
    origin: str(r.origin, 200),
    goals: list(r.goals).map((g) => ({ id: str(g?.id, 32) || rowId(), text: str(g?.text, 300), done: !!g?.done })).filter((g) => g.text),
    contacts: list(r.contacts).map((c) => ({ id: str(c?.id, 32) || rowId(), name: str(c?.name, 120), note: str(c?.note, 300) })).filter((c) => c.name),
    notes: html(r.notes)
  };
}

/** A log entry in a character's journal. */
export function normalizeDiary(raw = {}) {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    date: str(r.date, 40),
    location: str(r.location, 120),
    body: html(r.body)
  };
}

const NORMALIZERS = { gig: normalizeGig, downtime: normalizeDowntimeRecord, session: normalizeSession, screamsheet: normalizeScreamsheet, lore: normalizeLore, profile: normalizeProfile, diary: normalizeDiary };

/** A page's data for its kind. */
export function normalizeKind(kind, data) {
  return NORMALIZERS[kind] ? NORMALIZERS[kind](data) : null;
}

/* ------------------------------------------ */
/*  Readable copies for the page text         */
/* ------------------------------------------ */

const escape = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/**
 * A plain HTML copy of a record for the page's text: what Foundry's own journal shows, and what
 * survives without the module.
 * @param {string} kind
 * @param {object} data - normalized
 * @param {(key: string, data?: object) => string} t - translations
 * @param {{ names?: Record<string,string>, rewards?: (w: object) => string }} extra
 */
export function snapshot(kind, data, t, { names = {}, rewards = (w) => w.text || w.name } = {}) {
  const li = (items) => (items.length ? `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>` : "");
  if (kind === "gig") {
    const rows = [
      [t("NEONHUB.Journal.Gig.Status"), t(`NEONHUB.Journal.Gig.State.${data.status}`)],
      [t("NEONHUB.Journal.Gig.Client"), data.client],
      [t("NEONHUB.Journal.Gig.Location"), data.location],
      [t("NEONHUB.Journal.Gig.Deadline"), data.deadline],
      [t("NEONHUB.Journal.Gig.Danger"), data.danger],
      [t("NEONHUB.Journal.Gig.Crew"), data.crew.map((u) => names[u]).filter(Boolean).join(", ")]
    ].filter(([, v]) => v);
    const marks = { open: "☐", done: "☑", failed: "☒" };
    return `<p>${rows.map(([k, v]) => `<strong>${escape(k)}:</strong> ${escape(v)}`).join("<br>")}</p>`
      + (data.briefing || "")
      + (data.objectives.length ? `<h3>${escape(t("NEONHUB.Journal.Gig.Objectives"))}</h3>${li(data.objectives.map((o) => `${marks[o.state]} ${escape(o.text)}`))}` : "")
      + (data.rewards.length ? `<h3>${escape(t("NEONHUB.Journal.Gig.Rewards"))}</h3>${li(data.rewards.map((w) => escape(rewards(w)) + (w.paid ? ` (${escape(t("NEONHUB.Journal.Gig.Paid"))})` : "")))}` : "");
  }
  if (kind === "downtime") {
    return `<p><strong>${escape(data.totalText)}</strong>${data.from ? ` · ${escape(data.from)}${data.to ? ` – ${escape(data.to)}` : ""}` : ""}</p>`
      + data.people.map((p) => `<h3>${escape(p.name)}</h3>`
        + li(p.entries.map((e) => `${e.when ? `${escape(e.when)}: ` : ""}${escape(e.label)} (${escape(e.time)})`))
        + (p.left && p.left !== "0m" ? `<p><em>${escape(t("NEONHUB.Downtime.Unused", { left: p.left }))}</em></p>` : "")).join("");
  }
  if (kind === "screamsheet") {
    const para = (body) => body.split(/\n+/).filter(Boolean).map((b) => `<p>${escape(b)}</p>`).join("");
    return `<p><strong>${escape(data.masthead)}</strong>${data.issue ? ` #${data.issue}` : ""}${data.date ? ` · ${escape(data.date)}` : ""}</p>`
      + storyGroups(data).map((g) => `<h3>${escape(t(`NEONHUB.Journal.Scream.Type.${g.type}`))}</h3>`
        + g.stories.map((st) => `<h4>${escape(st.headline)}</h4>${para(st.body)}${st.source ? `<p><em>${escape(st.source)}</em></p>` : ""}`).join("")).join("");
  }
  if (kind === "lore") {
    return (data.tagline ? `<p><em>${escape(data.tagline)}</em></p>` : "")
      + (data.facts.length ? `<p>${data.facts.map((f) => `<strong>${escape(f.label)}:</strong> ${escape(f.value)}`).join("<br>")}</p>` : "")
      + (data.body || "")
      + (data.source ? `<p><small>${escape(data.source)}</small></p>` : "");
  }
  if (kind === "profile") {
    return `<p>${[data.handle && `<strong>${escape(data.handle)}</strong>`, data.origin && escape(data.origin)].filter(Boolean).join(" · ")}</p>`
      + (data.goals.length ? `<h3>${escape(t("NEONHUB.Journal.Profile.Goals"))}</h3>${li(data.goals.map((g) => `${g.done ? "☑" : "☐"} ${escape(g.text)}`))}` : "")
      + (data.contacts.length ? `<h3>${escape(t("NEONHUB.Journal.Profile.Contacts"))}</h3>${li(data.contacts.map((c) => `<strong>${escape(c.name)}</strong>${c.note ? `: ${escape(c.note)}` : ""}`))}` : "")
      + (data.notes || "");
  }
  if (kind === "diary") {
    const head = [data.date, data.location].filter(Boolean).map(escape).join(" · ");
    return (head ? `<p><strong>${head}</strong></p>` : "") + (data.body || "");
  }
  if (kind === "session") {
    const head = [data.date, data.played].filter(Boolean).map(escape).join(" · ");
    const crew = data.crew.map((u) => names[u]).filter(Boolean).join(", ");
    return (head ? `<p><strong>${head}</strong>${crew ? `<br>${escape(crew)}` : ""}</p>` : "")
      + (data.summary || "")
      + (data.events.length ? `<h3>${escape(t("NEONHUB.Journal.Session.Events"))}</h3>${li(data.events.map((e) => (e.key ? `<strong>${escape(e.text)}</strong>` : escape(e.text))))}` : "");
  }
  return "";
}
