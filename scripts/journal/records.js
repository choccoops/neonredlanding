import { addDays } from "../calendar/cal-dates.js";
import { MINUTES, formatDuration, balance, timeline } from "../calendar/downtime-data.js";
import { LifestyleStore } from "../lifestyle/ls-store.js";
import { JournalStore, actorOf, formatDate } from "./journal-store.js";

const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));

/** "14 Mar" a number of minutes into a downtime that started on a date. */
function dayInto(start, minutes) {
  if (!start) return "";
  const d = addDays(start, Math.floor(minutes / MINUTES.day));
  return `${d.day} ${L(`NEONHUB.Calendar.MonthShort.${d.month}`)}`;
}

/**
 * Records the Neon Journal keeps: a page for each completed downtime, and the GM's story chapters
 * with a page per session.
 */
export const Records = {
  /**
   * GM: file a completed downtime under Downtime, with everyone's log as it stood.
   * @param {object} call - the downtime (normalized), before it was closed
   * @param {(call: object, uuid: string) => object|null} startOf - each character's start date
   */
  async recordDowntime(call, startOf) {
    if (!game.user.isGM || !call) return null;
    const people = call.participants.map(actorOf).filter(Boolean).map((a) => {
      const b = balance(call, a.uuid);
      const start = startOf(call, a.uuid);
      return {
        uuid: a.uuid,
        name: a.name,
        img: a.img,
        spent: formatDuration(b.spent),
        left: formatDuration(b.left),
        entries: timeline(call, a.uuid).map((e) => {
          const from = dayInto(start, e.from);
          const to = dayInto(start, Math.max(e.from, e.to - 1));
          return { label: e.label, minutes: e.minutes, time: formatDuration(e.minutes), when: from && to !== from ? `${from} – ${to}` : from, source: e.source === "manual" ? L("NEONHUB.Downtime.ByHand") : e.source, user: e.user };
        })
      };
    });
    const end = call.start ? addDays(call.start, Math.floor(call.total / MINUTES.day)) : null;
    const record = {
      id: call.id,
      label: call.label,
      total: call.total,
      totalText: formatDuration(call.total),
      start: call.start,
      from: formatDate(call.start),
      to: formatDate(end),
      completedAt: Date.now(),
      people
    };
    const name = `${call.label || L("NEONHUB.Downtime.Title")}${record.from ? ` · ${record.from}` : ""}`;
    return JournalStore.createEntry("downtime", { name, kind: "downtime", data: record });
  },

  /** GM: a new story chapter (an entry under Story & Events) with an opening page. */
  async newChapter(name = L("NEONHUB.Journal.Story.NewChapter")) {
    if (!game.user.isGM) throw new Error(L("NEONHUB.Error.GMOnly"));
    return JournalStore.createEntry("story", {
      name,
      pages: [{ name: L("NEONHUB.Journal.Story.Overview"), type: "text", text: { content: "", format: 1 } }]
    });
  },

  /** GM: a session page in a chapter, numbered after the last session anywhere in the story. */
  async addSession(entry) {
    if (!game.user.isGM) throw new Error(L("NEONHUB.Error.GMOnly"));
    let last = 0;
    for (const e of JournalStore.entries("story")) {
      for (const p of e.pages) if (JournalStore.kind(p) === "session") last = Math.max(last, JournalStore.data(p).number);
    }
    const crew = LifestyleStore.characters().map((a) => a.uuid);
    const number = last + 1;
    const today = new Date();
    const played = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    return JournalStore.addPage(entry, "session", L("NEONHUB.Journal.Session.Name", { n: number }), {
      number, played, crew, date: formatDate(JournalStore.today(crew))
    });
  }
};
