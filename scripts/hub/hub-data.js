import { THEMES, PAGE_SIZES, BUTTON_SIZES, BUTTON_ACTIONS, AUDIENCES, DEFAULT_THEME, MESSENGER_VIEWS } from "../constants.js";

/**
 * Hub pages: the layout model and the layout engine.
 * Pure functions (no Foundry calls) so the same code can drive the canvas
 * preview, the tile builder and the tests.
 */

export const HUB_VERSION = 1;

const rid = () => (globalThis.foundry?.utils?.randomID?.(12) ?? Math.random().toString(36).slice(2, 14));
const clone = (o) => structuredClone(o);

export function defaultButton(overrides = {}) {
  return normalizeButton({
    id: rid(),
    label: "New button",
    subtitle: "",
    icon: BUTTON_ACTIONS.scene.icon,
    image: "",
    color: "",
    size: "normal",
    gmOnly: false,
    clickSound: "",
    action: { type: "scene" },
    ...overrides
  });
}

export function defaultHub(overrides = {}) {
  return normalizeHub({
    version: HUB_VERSION,
    title: "Night City",
    subtitle: "Choose your destination",
    theme: DEFAULT_THEME,
    size: "1920x1080",
    background: "",
    dim: 0.45,
    columns: 4,
    layout: "grid",
    showTitle: true,
    hover: true,
    clickSound: "",
    buttons: [],
    ...overrides
  });
}

export function normalizeButton(raw = {}) {
  const b = { ...clone(raw) };
  b.id ||= rid();
  b.label = String(b.label ?? "");
  b.subtitle = String(b.subtitle ?? "");
  b.icon = String(b.icon ?? "");
  b.image = String(b.image ?? "");
  b.color = /^#[0-9a-f]{6}$/i.test(b.color ?? "") ? b.color : "";
  if (!BUTTON_SIZES[b.size]) b.size = "normal";
  b.gmOnly = !!b.gmOnly;
  b.clickSound = String(b.clickSound ?? "");
  const a = { ...(b.action ?? {}) };
  if (!BUTTON_ACTIONS[a.type]) a.type = "none";
  a.target = typeof a.target === "string" ? a.target : "";
  a.file = typeof a.file === "string" ? a.file : "";
  if (!AUDIENCES[a.audience]) a.audience = "trigger";
  if (!["trigger", "everyone", "activate"].includes(a.sceneMode)) a.sceneMode = "trigger";
  if (!["play", "stop", "pause", "next", "prev"].includes(a.playMode)) a.playMode = "play";
  a.ownCharacter = !!a.ownCharacter;
  a.ignorePermission = a.ignorePermission !== false;
  a.volume = Math.min(1, Math.max(0, Number(a.volume ?? 1)));
  a.loop = !!a.loop;
  a.caption = String(a.caption ?? "");
  a.runAs = a.runAs === "gm" ? "gm" : "player";
  a.view = MESSENGER_VIEWS[a.view] ? a.view : "inbox";
  b.action = a;
  return b;
}

export function normalizeHub(raw = {}) {
  const h = { ...clone(raw) };
  h.version = HUB_VERSION;
  h.title = String(h.title ?? "");
  h.subtitle = String(h.subtitle ?? "");
  if (!THEMES[h.theme]) h.theme = DEFAULT_THEME;
  if (!PAGE_SIZES[h.size]) h.size = "1920x1080";
  h.background = String(h.background ?? "");
  h.dim = Math.min(0.9, Math.max(0, Number(h.dim ?? 0.45)));
  h.columns = Math.min(8, Math.max(1, Math.floor(Number(h.columns) || 4)));
  h.layout = h.layout === "manual" ? "manual" : "grid";
  h.showTitle = h.showTitle !== false;
  h.hover = h.hover !== false;
  h.clickSound = String(h.clickSound ?? "");
  h.buttons = Array.isArray(h.buttons) ? h.buttons.map(normalizeButton) : [];
  return h;
}

/** Page geometry: where the title sits and the rectangle buttons are laid out in. */
export function pageFrame(hub) {
  const { width, height } = PAGE_SIZES[hub.size];
  const s = width / 1920;
  const margin = Math.round(96 * s);
  const header = hub.showTitle ? Math.round((hub.subtitle ? 250 : 200) * s) : margin;
  return {
    width,
    height,
    scale: s,
    margin,
    gap: Math.round(28 * s),
    header,
    area: { x: margin, y: header, w: width - margin * 2, h: height - header - margin }
  };
}

/**
 * Grid layout. Buttons are placed in reading order into a grid of `columns` columns,
 * first fit, honouring each button's footprint (wide, tall, large). Rows shrink to fit
 * the page height, then the whole block is centred.
 * @returns {{frame: object, rects: Object<string, {x,y,w,h}>, overflow: boolean}}
 */
export function computeLayout(hub, manual = {}) {
  const frame = pageFrame(hub);
  const cols = hub.columns;
  const { area, gap } = frame;
  const grid = [];
  const placed = [];
  const isFree = (r, c, w, h) => {
    if (c + w > cols) return false;
    for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) if (grid[y]?.[x]) return false;
    return true;
  };
  const occupy = (r, c, w, h) => {
    for (let y = r; y < r + h; y++) {
      grid[y] ??= [];
      for (let x = c; x < c + w; x++) grid[y][x] = true;
    }
  };

  for (const b of hub.buttons) {
    if (hub.layout === "manual" && manual[b.id]) continue;
    const fp = BUTTON_SIZES[b.size];
    const w = Math.min(fp.w, cols);
    const h = fp.h;
    let done = false;
    for (let r = 0; !done && r < 200; r++) {
      for (let c = 0; c <= cols - w; c++) {
        if (isFree(r, c, w, h)) {
          occupy(r, c, w, h);
          placed.push({ id: b.id, r, c, w, h });
          done = true;
          break;
        }
      }
    }
  }

  const rows = placed.reduce((n, p) => Math.max(n, p.r + p.h), 0);
  const cellW = (area.w - gap * (cols - 1)) / cols;
  const idealH = cellW * 0.5;
  const fitH = rows ? (area.h - gap * (rows - 1)) / rows : idealH;
  const cellH = Math.max(40 * frame.scale, Math.min(idealH, fitH));
  const blockH = rows ? rows * cellH + gap * (rows - 1) : 0;
  const usedCols = placed.reduce((n, p) => Math.max(n, p.c + p.w), 0);
  const blockW = usedCols ? usedCols * cellW + gap * (usedCols - 1) : 0;
  const offX = area.x + (area.w - blockW) / 2;
  const offY = area.y + Math.max(0, (area.h - blockH) / 2);

  const rects = {};
  for (const p of placed) {
    rects[p.id] = {
      x: Math.round(offX + p.c * (cellW + gap)),
      y: Math.round(offY + p.r * (cellH + gap)),
      w: Math.round(p.w * cellW + (p.w - 1) * gap),
      h: Math.round(p.h * cellH + (p.h - 1) * gap)
    };
  }
  if (hub.layout === "manual") {
    for (const [id, r] of Object.entries(manual)) if (hub.buttons.some((b) => b.id === id)) rects[id] = { ...r };
  }
  return { frame, rects, overflow: fitH < 40 * frame.scale };
}

/** Problems that would make a button do nothing, keyed by button id. */
export function validateHub(hub, { hqExists = () => true } = {}) {
  const issues = {};
  for (const b of hub.buttons) {
    const a = b.action;
    let problem = null;
    if (["scene", "journal", "playlist", "macro", "shop"].includes(a.type) && !a.target) problem = "NEONHUB.Editor.Issue.NoTarget";
    if (a.type === "actor" && !a.target && !a.ownCharacter) problem = "NEONHUB.Editor.Issue.NoTarget";
    if (a.type === "hq" && (!a.target || !hqExists(a.target))) problem = "NEONHUB.Editor.Issue.NoHQ";
    if (["sound", "image"].includes(a.type) && !a.file) problem = "NEONHUB.Editor.Issue.NoFile";
    if (!b.label.trim() && !b.icon && !b.image) problem ??= "NEONHUB.Editor.Issue.Empty";
    if (problem) issues[b.id] = problem;
  }
  return issues;
}

/** Small stable hash, used to give re-rendered images new file names so clients never show a cached copy. */
export function hashOf(value) {
  const str = typeof value === "string" ? value : JSON.stringify(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function slugify(str) {
  return String(str).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "hub";
}
