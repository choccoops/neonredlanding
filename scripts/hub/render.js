import { THEMES } from "../constants.js";
import { pageFrame } from "./hub-data.js";

/**
 * Draws hub pages with the 2D canvas: the page background (with the title) and one
 * image per button. Drawing happens in the GM's browser, where Foundry's web fonts
 * and Font Awesome are already loaded, so the images look exactly like the editor preview.
 */

const imageCache = new Map();

export function loadImage(src) {
  if (!src) return Promise.resolve(null);
  if (imageCache.has(src)) return imageCache.get(src);
  const p = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
  imageCache.set(src, p);
  return p;
}

export function clearImageCache(src) {
  if (src) imageCache.delete(src);
  else imageCache.clear();
}

/** Resolve a Font Awesome class to the glyph and font Foundry has loaded for it. */
export function iconGlyph(cls) {
  if (!cls || typeof document === "undefined") return null;
  const el = document.createElement("i");
  el.className = cls;
  el.style.cssText = "position:absolute;left:-9999px;top:-9999px;";
  document.body.appendChild(el);
  const cs = getComputedStyle(el, "::before");
  const raw = cs.content;
  const family = cs.fontFamily || getComputedStyle(el).fontFamily;
  const weight = cs.fontWeight || getComputedStyle(el).fontWeight || "900";
  el.remove();
  if (!raw || raw === "none" || raw === "normal") return null;
  // Font Awesome 6 sets `content: "\f279" / ""` (glyph plus empty alt text); keep only the glyph.
  const m = /^\s*(["'])(.*?)\1/.exec(raw);
  const char = m ? m[2] : raw;
  if (!char) return null;
  return { char, family, weight };
}

export async function ensureFonts(theme) {
  if (typeof document === "undefined" || !document.fonts) return;
  const fonts = new Set([theme.display, theme.body]);
  await Promise.all([...fonts].map((f) => document.fonts.load(`32px "${f}"`).catch(() => null)));
}

function fontStack(name, fallback = "sans-serif") {
  return `"${name}", "Signika", ${fallback}`;
}

function hexToRgba(hex, a) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? "");
  if (!m) return `rgba(255,255,255,${a})`;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`;
}

function cutPath(ctx, x, y, w, h, cut, radius = 0) {
  ctx.beginPath();
  if (radius) {
    ctx.roundRect(x, y, w, h, radius);
    return;
  }
  ctx.moveTo(x, y);
  ctx.lineTo(x + w - cut, y);
  ctx.lineTo(x + w, y + cut);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + cut, y + h);
  ctx.lineTo(x, y + h - cut);
  ctx.closePath();
}

function drawCover(ctx, img, x, y, w, h) {
  const r = Math.max(w / img.width, h / img.height);
  const iw = img.width * r;
  const ih = img.height * r;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}

/** Shrink text until it fits `maxW`; returns the font size used. */
function fitText(ctx, text, family, weight, size, maxW, minSize = 10, style = "") {
  let s = size;
  do {
    ctx.font = `${style} ${weight} ${s}px ${family}`.trim();
    if (ctx.measureText(text).width <= maxW) return s;
    s -= 1;
  } while (s > minSize);
  return s;
}

/** Wrap text into at most `maxLines` lines, ellipsising the last. */
function wrapLines(ctx, text, maxW, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxW || !line) line = test;
    else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

/** Letter spacing in px, where the canvas supports it (Chromium/Electron; ignored elsewhere). */
function track(ctx, px) {
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${Math.round(px * 10) / 10}px`;
}

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/* ------------------------------------------ */
/*  Page background                           */
/* ------------------------------------------ */

export async function renderBackground(hub, { load = loadImage } = {}) {
  const theme = THEMES[hub.theme];
  const frame = pageFrame(hub);
  const { width: W, height: H, scale: s } = frame;
  await ensureFonts(theme);
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Base gradient
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, theme.bg2);
  g.addColorStop(1, theme.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Accent glows
  for (const [cx, cy, col, a] of [[0.15, 1.05, theme.accent, 0.35], [0.9, -0.05, theme.accent2, 0.25]]) {
    const rg = ctx.createRadialGradient(W * cx, H * cy, 0, W * cx, H * cy, W * 0.6);
    rg.addColorStop(0, hexToRgba(col, a * (theme.glowStrength ?? (theme.light ? 0.5 : 1))));
    rg.addColorStop(1, hexToRgba(col, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }

  // Optional background art, dimmed toward the theme colour
  const img = await load(hub.background);
  if (img) {
    drawCover(ctx, img, 0, 0, W, H);
    ctx.fillStyle = hexToRgba(theme.bg, hub.dim);
    ctx.fillRect(0, 0, W, H);
    const fade = ctx.createLinearGradient(0, 0, 0, H);
    fade.addColorStop(0, hexToRgba(theme.bg, Math.min(0.85, hub.dim + 0.25)));
    fade.addColorStop(0.35, hexToRgba(theme.bg, 0));
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, W, H);
  }

  // Theme texture
  if (theme.gridFloor) {
    ctx.strokeStyle = hexToRgba(theme.accent2, 0.12);
    ctx.lineWidth = 1;
    const horizon = H * 0.62;
    for (let i = -20; i <= 20; i++) {
      ctx.beginPath();
      ctx.moveTo(W / 2 + i * 40 * s, horizon);
      ctx.lineTo(W / 2 + i * 260 * s, H);
      ctx.stroke();
    }
    for (let y = horizon, step = 8 * s; y < H; y += step, step *= 1.25) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  }
  if (theme.scanlines) {
    ctx.fillStyle = theme.mono ? "rgba(0,0,0,0.28)" : theme.chrome ? hexToRgba(theme.accent2, 0.035) : "rgba(255,255,255,0.025)";
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  }
  if (theme.hazard) {
    const band = 14 * s;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, band);
    ctx.rect(0, H - band, W, band);
    ctx.clip();
    for (let x = -H; x < W + H; x += 28 * s) {
      ctx.fillStyle = theme.accent;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 14 * s, 0);
      ctx.lineTo(x + 14 * s + H, H);
      ctx.lineTo(x + H, H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Corner brackets
  ctx.strokeStyle = hexToRgba(theme.accent, 0.8);
  ctx.lineWidth = 3 * s;
  const m = frame.margin * 0.45;
  const L = 60 * s;
  for (const [x, y, dx, dy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) {
    ctx.beginPath();
    ctx.moveTo(x, y + dy * L);
    ctx.lineTo(x, y);
    ctx.lineTo(x + dx * L, y);
    ctx.stroke();
  }

  // Title
  if (hub.showTitle && hub.title) {
    const titleSize = Math.round(84 * s);
    const family = fontStack(theme.display, theme.mono ? "monospace" : "sans-serif");
    const style = theme.italic ? "italic" : "";
    const caps = theme.mono || theme.hazard || theme.chrome;
    const text = caps ? hub.title.toUpperCase() : hub.title;
    if (theme.chrome) track(ctx, titleSize * 0.1);
    const size = fitText(ctx, text, family, "400", titleSize, W - frame.margin * 2, 24, style);
    if (theme.chrome) track(ctx, size * 0.1);
    const ty = frame.margin * 0.5 + size + (theme.chrome && hub.subtitle ? 26 * s : 0);
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    if (theme.glow && !theme.light) {
      ctx.shadowColor = theme.accent;
      ctx.shadowBlur = 28 * s;
    }
    if (hub.theme === "neon") {
      ctx.fillStyle = hexToRgba(theme.accent, 0.85);
      ctx.fillText(text, W / 2 - 3 * s, ty);
      ctx.fillStyle = hexToRgba(theme.accent2, 0.85);
      ctx.fillText(text, W / 2 + 3 * s, ty);
      ctx.shadowBlur = 0;
    }
    if (theme.chrome) {
      // A faint cyan split, the way a cheap screen renders it.
      ctx.shadowBlur = 0;
      ctx.fillStyle = hexToRgba(theme.accent2, 0.35);
      ctx.fillText(text, W / 2 - 3 * s, ty);
      ctx.shadowColor = theme.accent;
      ctx.shadowBlur = 24 * s;
      ctx.fillStyle = "#ffffff";
    } else {
      ctx.fillStyle = theme.text;
    }
    ctx.fillText(text, W / 2, ty);
    ctx.shadowBlur = 0;
    track(ctx, 0);

    if (hub.subtitle && theme.chrome) {
      // Subtitle as a kicker above the title: "// PICK WHERE TO GO NEXT"
      ctx.font = `400 ${Math.round(22 * s)}px ${fontStack(theme.display)}`;
      track(ctx, 22 * s * 0.3);
      ctx.fillStyle = theme.muted;
      ctx.fillText(`// ${hub.subtitle.toUpperCase()}`, W / 2, ty - size - 10 * s);
      track(ctx, 0);
    } else if (hub.subtitle) {
      ctx.font = `400 ${Math.round(28 * s)}px ${fontStack(theme.body)}`;
      ctx.fillStyle = theme.muted;
      ctx.fillText(hub.subtitle, W / 2, ty + 48 * s);
    }
    // Rule under the title
    const ruleY = frame.header - 36 * s;
    const rg = ctx.createLinearGradient(frame.margin, 0, W - frame.margin, 0);
    rg.addColorStop(0, hexToRgba(theme.accent, 0));
    rg.addColorStop(0.5, hexToRgba(theme.accent, 0.9));
    rg.addColorStop(1, hexToRgba(theme.accent, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(frame.margin, ruleY, W - frame.margin * 2, Math.max(1, 2 * s));
  }
  return canvas;
}

/* ------------------------------------------ */
/*  Buttons                                   */
/* ------------------------------------------ */

export async function renderButton(button, hub, w, h, { load = loadImage, glyph = iconGlyph } = {}) {
  const theme = THEMES[hub.theme];
  const s = Math.min(w / 400, h / 200, 1.6) || 1;
  await ensureFonts(theme);
  const pad = Math.round(Math.max(10, 14 * s));
  const glowPad = theme.glow && !theme.light ? Math.round(12 * s) : 4;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext("2d");
  const accent = button.color || theme.accent;
  const cut = Math.round((theme.cut ?? 0) * s);
  const radius = theme.radius ? Math.round(theme.radius * s) : 0;
  const x = glowPad;
  const y = glowPad;
  const bw = w - glowPad * 2;
  const bh = h - glowPad * 2;

  // Panel
  ctx.save();
  if (theme.glow && !theme.light) {
    ctx.shadowColor = hexToRgba(accent, 0.75);
    ctx.shadowBlur = 16 * s;
  } else if (theme.light) {
    ctx.shadowColor = "rgba(20,30,45,0.18)";
    ctx.shadowBlur = 18 * s;
    ctx.shadowOffsetY = 6 * s;
  }
  cutPath(ctx, x, y, bw, bh, cut, radius);
  ctx.fillStyle = theme.panel;
  ctx.fill();
  ctx.restore();

  // Picture, if any: fills the panel with a gradient so the label stays readable
  const img = await load(button.image);
  ctx.save();
  cutPath(ctx, x, y, bw, bh, cut, radius);
  ctx.clip();
  if (img) {
    drawCover(ctx, img, x, y, bw, bh);
    // Light themes shade pictures dark too, so the white label on top stays readable.
    const shadeColor = theme.light ? "#0e141c" : theme.bg;
    const shade = ctx.createLinearGradient(0, y, 0, y + bh);
    shade.addColorStop(0, hexToRgba(shadeColor, 0.05));
    shade.addColorStop(0.45, hexToRgba(shadeColor, 0.3));
    shade.addColorStop(1, hexToRgba(shadeColor, 0.9));
    ctx.fillStyle = shade;
    ctx.fillRect(x, y, bw, bh);
  } else {
    const sheen = ctx.createLinearGradient(x, y, x + bw, y + bh);
    sheen.addColorStop(0, hexToRgba(accent, theme.light ? 0.08 : 0.16));
    sheen.addColorStop(1, hexToRgba(accent, 0));
    ctx.fillStyle = sheen;
    ctx.fillRect(x, y, bw, bh);
  }
  // Accent bar
  ctx.fillStyle = accent;
  ctx.fillRect(x, y, Math.max(3, 5 * s), bh);
  if (theme.hazard) {
    for (let i = 0; i < bw + bh; i += 18 * s) {
      ctx.fillStyle = i / (18 * s) % 2 ? "#111" : accent;
      ctx.fillRect(x + i, y + bh - 6 * s, 9 * s, 6 * s);
    }
  }
  ctx.restore();

  // Border
  cutPath(ctx, x + 0.5, y + 0.5, bw - 1, bh - 1, cut, radius);
  ctx.strokeStyle = hexToRgba(accent, theme.light ? 0.55 : 0.85);
  ctx.lineWidth = Math.max(1, 1.5 * s);
  ctx.stroke();

  // Chrome: a stripe of accent along the notched corner, like the calendar's date panel.
  if (theme.chrome && cut) {
    const band = Math.max(3, 6 * s);
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(x + bw - cut - band, y);
    ctx.lineTo(x + bw - cut, y);
    ctx.lineTo(x + bw, y + cut);
    ctx.lineTo(x + bw, y + cut + band);
    ctx.closePath();
    ctx.fill();
  }

  // Icon + text. Wide buttons put the icon on the left; tall/square ones stack it on top.
  const g = button.icon ? glyph(button.icon) : null;
  const stacked = bh > bw * 0.75;
  const textMono = theme.mono;
  const displayFamily = fontStack(theme.display, textMono ? "monospace" : "sans-serif");
  const bodyFamily = fontStack(theme.body, textMono ? "monospace" : "sans-serif");
  const labelText = theme.mono || theme.hazard || theme.chrome ? button.label.toUpperCase() : button.label;
  const iconSize = Math.round(Math.min(bh * (stacked ? 0.28 : 0.4), 64 * s));
  let tx = x + pad + 6 * s;
  let ty;
  let maxW = bw - pad * 2 - 6 * s;

  ctx.textBaseline = "alphabetic";
  if (g && !img) {
    ctx.font = `${g.weight} ${iconSize}px ${g.family}`;
    ctx.fillStyle = accent;
    if (theme.glow && !theme.light) {
      ctx.shadowColor = accent;
      ctx.shadowBlur = 12 * s;
    }
    if (stacked) {
      ctx.textAlign = "center";
      ctx.fillText(g.char, x + bw / 2, y + pad + iconSize);
    } else {
      ctx.textAlign = "left";
      ctx.fillText(g.char, tx, y + bh / 2 + iconSize * 0.36);
      tx += iconSize + pad;
      maxW -= iconSize + pad;
    }
    ctx.shadowBlur = 0;
  } else if (g && img) {
    // Small badge icon on pictures
    const bs = Math.round(26 * s);
    ctx.font = `${g.weight} ${Math.round(bs * 0.62)}px ${g.family}`;
    ctx.fillStyle = hexToRgba(theme.bg, 0.8);
    ctx.fillRect(x + bw - pad - bs, y + pad, bs, bs);
    ctx.fillStyle = accent;
    ctx.textAlign = "center";
    ctx.fillText(g.char, x + bw - pad - bs / 2, y + pad + bs * 0.74);
  }

  const labelSize = Math.round(Math.min((stacked ? 40 : 44) * Math.max(0.7, s), bh * 0.27));
  const subSize = Math.max(12, Math.round(labelSize * 0.58));
  const hasSub = !!button.subtitle;

  ctx.textAlign = stacked ? "center" : "left";
  const cx = stacked ? x + bw / 2 : tx;
  const fontStyle = theme.italic ? "italic" : "";
  if (theme.chrome) track(ctx, labelSize * 0.06);
  const size = fitText(ctx, labelText, displayFamily, "400", labelSize, maxW, 12, fontStyle);
  if (theme.chrome) track(ctx, size * 0.06);
  let subLines = [];
  if (hasSub) {
    ctx.font = `400 ${subSize}px ${bodyFamily}`;
    subLines = wrapLines(ctx, button.subtitle, maxW, stacked ? 3 : 2);
  }
  const blockH = size + (subLines.length ? 8 * s + subLines.length * subSize * 1.25 : 0);
  if (img) ty = y + bh - pad - blockH + size;
  else if (stacked) ty = y + pad + (g ? iconSize + 14 * s : 0) + Math.max(0, (bh - pad * 2 - (g ? iconSize + 14 * s : 0) - blockH) / 2) + size;
  else ty = y + (bh - blockH) / 2 + size;

  ctx.font = `${fontStyle} 400 ${size}px ${displayFamily}`.trim();
  ctx.fillStyle = img && theme.light ? "#ffffff" : theme.text;
  if (img) {
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 6 * s;
  }
  ctx.fillText(labelText, cx, ty);
  ctx.shadowBlur = 0;
  track(ctx, 0);
  if (subLines.length) {
    ctx.font = `400 ${subSize}px ${bodyFamily}`;
    ctx.fillStyle = img ? hexToRgba(theme.light ? "#ffffff" : theme.text, 0.85) : theme.muted;
    subLines.forEach((line, i) => ctx.fillText(line, cx, ty + 8 * s + (i + 1) * subSize * 1.25));
  }

  if (button.gmOnly) {
    ctx.font = `700 ${Math.round(12 * Math.max(1, s))}px ${bodyFamily}`;
    ctx.textAlign = "right";
    ctx.fillStyle = hexToRgba(accent, 0.9);
    ctx.fillText("GM", x + bw - pad, y + bh - pad * 0.6);
  }
  return canvas;
}

/** Encode a canvas for upload: WebP when the browser can, PNG otherwise. */
export function canvasToFile(canvas, baseName) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob && blob.type === "image/webp") return resolve(new File([blob], `${baseName}.webp`, { type: "image/webp" }));
      canvas.toBlob((png) => resolve(new File([png], `${baseName}.png`, { type: "image/png" })), "image/png");
    }, "image/webp", 0.92);
  });
}
