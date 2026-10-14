import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeGig, normalizeReward, rewardFilled, objectiveGroups, progress, unpaid, shares, nextStatus,
  normalizeDowntimeRecord, normalizeSession, normalizeKind, snapshot
} from "../scripts/journal/journal-data.js";

const t = (k, d) => (d ? `${k}:${JSON.stringify(d)}` : k.split(".").pop());

test("gigs normalize with defaults and drop empty rows", () => {
  const g = normalizeGig({
    status: "bogus",
    client: "  Padre ",
    crew: ["Actor.a", "Actor.a", "", 5],
    objectives: [{ text: "Get in" }, { text: "", state: "done" }, { text: "Get out", state: "failed" }],
    rewards: [{ kind: "eddies", amount: 500 }, { kind: "eddies", amount: 0 }, { kind: "item" }, { kind: "item", uuid: "Item.x", name: "Kiroshis" }, { kind: "nope", text: "A favour" }]
  });
  assert.equal(g.status, "found");
  assert.equal(g.client, "Padre");
  assert.deepEqual(g.crew, ["Actor.a"]);
  assert.deepEqual(g.objectives.map((o) => [o.text, o.state]), [["Get in", "open"], ["Get out", "failed"]]);
  assert.deepEqual(g.rewards.map((w) => w.kind), ["eddies", "item", "text"]);
  assert.ok(g.objectives.every((o) => o.id));
  assert.equal(g.payout, null);
});

test("objectives and rows from a form come in as objects keyed by index", () => {
  const g = normalizeGig({ objectives: { 0: { text: "A" }, 1: { text: "B", state: "done" } } });
  assert.deepEqual(g.objectives.map((o) => o.text), ["A", "B"]);
});

test("rewards are filled when they have what they need", () => {
  assert.equal(rewardFilled(normalizeReward({ kind: "hqip", amount: 10 })), false);
  assert.equal(rewardFilled(normalizeReward({ kind: "hqip", amount: 10, hq: "abc" })), true);
  assert.equal(rewardFilled(normalizeReward({ kind: "ip", amount: 5 })), true);
  assert.equal(rewardFilled(normalizeReward({ kind: "housing", uuid: "Compendium.x.Item.y" })), true);
});

test("objective groups and progress", () => {
  const g = normalizeGig({ objectives: [{ text: "A" }, { text: "B", state: "done" }, { text: "C", state: "failed" }, { text: "D" }] });
  const groups = objectiveGroups(g);
  assert.deepEqual([groups.open.length, groups.done.length, groups.failed.length], [2, 1, 1]);
  assert.deepEqual(progress(g), { done: 2, total: 4, pct: 50 });
  assert.deepEqual(progress(normalizeGig({})), { done: 0, total: 0, pct: 0 });
});

test("eddies go to each, or split with the odd eddies to the first", () => {
  assert.deepEqual(shares(500, 3, "each"), [500, 500, 500]);
  assert.deepEqual(shares(1000, 3, "split"), [334, 333, 333]);
  assert.deepEqual(shares(2, 3, "split"), [1, 1, 0]);
  assert.deepEqual(shares(100, 0, "split"), []);
});

test("unpaid rewards", () => {
  const g = normalizeGig({ rewards: [{ kind: "ip", amount: 5, paid: true }, { kind: "text", text: "Favour" }] });
  assert.deepEqual(unpaid(g).map((w) => w.kind), ["text"]);
});

test("status moves", () => {
  assert.equal(nextStatus("found", "take"), "active");
  assert.equal(nextStatus("active", "take"), null);
  assert.equal(nextStatus("active", "complete"), "completed");
  assert.equal(nextStatus("found", "fail"), "failed");
  assert.equal(nextStatus("failed", "reopen"), "active");
  assert.equal(nextStatus("completed", "fail"), null);
});

test("downtime records and sessions normalize", () => {
  const r = normalizeDowntimeRecord({ label: "Recovery", total: 4320, people: [{ name: "Rook", entries: [{ label: "Healing", minutes: 1440, when: "14 Mar" }] }] });
  assert.equal(r.people[0].entries[0].label, "Healing");
  assert.equal(r.start, null);
  const s = normalizeSession({ number: "3", played: "2026-10-13", events: [{ text: "Met Rogue", key: 1 }, { text: "" }], crew: ["Actor.a"] });
  assert.equal(s.number, 3);
  assert.equal(s.played, "2026-10-13");
  assert.deepEqual(s.events.map((e) => [e.text, e.key]), [["Met Rogue", true]]);
  assert.equal(normalizeSession({ played: "13/10/2026" }).played, "");
  assert.equal(normalizeKind("text", {}), null);
});

test("snapshots read without the module and escape what they show", () => {
  const g = normalizeGig({ client: "<b>Padre</b>", crew: ["Actor.a"], briefing: "<p>Brief</p>", objectives: [{ text: "Get in", state: "done" }], rewards: [{ kind: "eddies", amount: 500, paid: true }] });
  const out = snapshot("gig", g, t, { names: { "Actor.a": "Rook" }, rewards: (w) => `${w.amount}eb` });
  assert.match(out, /&lt;b&gt;Padre/);
  assert.match(out, /Rook/);
  assert.match(out, /<p>Brief<\/p>/);
  assert.match(out, /☑ Get in/);
  assert.match(out, /500eb \(Paid\)/);
  const d = snapshot("downtime", normalizeDowntimeRecord({ totalText: "3d", people: [{ name: "Rook", left: "1d", entries: [{ label: "Gig", time: "2d", when: "14 Mar" }] }] }), t);
  assert.match(d, /14 Mar: Gig \(2d\)/);
  assert.match(d, /Unused/);
});

import { normalizeScreamsheet, storyGroups, parseResult, followUps } from "../scripts/journal/journal-data.js";

test("screamsheets keep stories in layout order and drop empty ones", () => {
  const s = normalizeScreamsheet({ issue: "7", stories: [{ type: "advert", headline: "Buy Nicola" }, { type: "breaking", headline: "Fire in Watson" }, { type: "bogus", headline: "x" }, { type: "news" }] });
  assert.equal(s.issue, 7);
  assert.equal(s.published, false);
  assert.deepEqual(s.stories.map((st) => st.type), ["advert", "breaking", "news"]);
  assert.deepEqual(storyGroups(s).map((g) => g.type), ["breaking", "news", "advert"]);
});

test("table results become headlines and bodies", () => {
  assert.deepEqual(parseResult("<p>Fire in Watson | Three blocks burn.</p>"), { headline: "Fire in Watson", body: "Three blocks burn." });
  assert.deepEqual(parseResult("Short headline"), { headline: "Short headline", body: "" });
  const long = parseResult("Maelstrom hits a convoy on the Badlands road. Six trucks lost, the drivers missing, and nobody at the scene is talking to the press.");
  assert.equal(long.headline, "Maelstrom hits a convoy on the Badlands road.");
  assert.match(long.body, /^Six trucks/);
  assert.deepEqual(parseResult("Tom &amp; Jerry's<br>Open late"), { headline: "Tom & Jerry's\nOpen late", body: "" });
});

test("developing stories marked to follow up carry on", () => {
  const prev = normalizeScreamsheet({ stories: [{ type: "developing", headline: "Strike at the docks", followUp: true }, { type: "developing", headline: "Old news" }, { type: "news", headline: "Not developing", followUp: true }] });
  const next = followUps(prev);
  assert.deepEqual(next.map((st) => [st.headline, st.continued, st.followUp]), [["Strike at the docks", true, false]]);
  assert.notEqual(next[0].id, prev.stories[0].id);
  assert.deepEqual(followUps(null), []);
});

import { normalizeLore, loreTemplate, normalizeProfile, normalizeDiary, LORE_FACTS } from "../scripts/journal/journal-data.js";

test("worldbuilding entries keep their facts and type", () => {
  const l = normalizeLore({ type: "gang", tagline: "Metal over meat", facts: [{ label: "Turf", value: "Northside" }, { label: "", value: "" }], body: "<p>x</p>", source: "Handbook p.25" });
  assert.equal(l.type, "gang");
  assert.deepEqual(l.facts.map((f) => [f.label, f.value]), [["Turf", "Northside"]]);
  assert.equal(normalizeLore({ type: "dragon" }).type, "organization");
  const tpl = loreTemplate("corporation", (k) => `L:${k}`);
  assert.equal(tpl.length, LORE_FACTS.corporation.length);
  assert.ok(tpl.every((f) => f.label.startsWith("L:") && f.value === "" && f.id));
  assert.deepEqual(loreTemplate("nope"), []);
});

test("character journals: profile and log entries", () => {
  const p = normalizeProfile({ actor: "Actor.a", handle: "Rook", goals: [{ text: "Get out of Watson", done: 1 }, { text: "" }], contacts: [{ name: "Padre", note: "Owes me" }, { note: "no name" }] });
  assert.deepEqual(p.goals.map((g) => [g.text, g.done]), [["Get out of Watson", true]]);
  assert.deepEqual(p.contacts.map((c) => c.name), ["Padre"]);
  assert.deepEqual(normalizeDiary({ date: "14 Mar 2045", body: "<p>Long day.</p>", extra: 1 }), { date: "14 Mar 2045", location: "", body: "<p>Long day.</p>" });
});
