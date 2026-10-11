export const MODULE_ID = "cpr-neon-hub";
export const SYSTEM_ID = "cyberpunk-red-core";
export const MATT_ID = "monks-active-tiles";
export const MARKET_ID = "cpr-neon-market";
export const SOCKET_NAME = `module.${MODULE_ID}`;
export const TEMPLATE_PATH = `modules/${MODULE_ID}/templates`;

/** Scene flag that marks a scene as a hub and stores its layout. */
export const HUB_FLAG = "hub";
/** Tile flag that ties a generated tile back to its hub element. */
export const TILE_FLAG = "element";
/** Tile flag with the path of a button's lit (hovered) image. */
export const HOVER_FLAG = "hover";

/** World setting that stores every Headquarters. */
export const HQ_SETTING = "headquarters";

/**
 * Visual themes shared by hub pages and the Headquarters screen.
 * The same palette drives the canvas renderer (button images) and the CSS (windows),
 * and matches Neon Market's theme names so a hub and its shops look alike.
 */
export const THEMES = {
  /** The calendar's look: black chrome, notched corners, Tektur. The default. */
  chrome: {
    label: "NEONHUB.Theme.chrome", accent: "#ff2a6d", accent2: "#05d9e8",
    bg: "#07070b", bg2: "#0d0d15", panel: "rgba(13,13,21,0.92)", text: "#d8dbec", muted: "#6e7290",
    display: "Neon Hub Tektur", body: "Signika", cut: 16, glow: true, scanlines: true, chrome: true
  },
  neon: {
    label: "NEONHUB.Theme.neon", accent: "#ff2a6d", accent2: "#05d9e8",
    bg: "#0d0221", bg2: "#2a0a4a", panel: "rgba(18,6,38,0.88)", text: "#f4ecff", muted: "#a898c4",
    display: "Bruno Ace", body: "Signika", cut: 18, glow: true, scanlines: true
  },
  corpo: {
    label: "NEONHUB.Theme.corpo", accent: "#c8a24a", accent2: "#2b3a4f",
    bg: "#e9edf2", bg2: "#ffffff", panel: "rgba(255,255,255,0.94)", text: "#18212d", muted: "#5d6b7c",
    display: "Amiri", body: "Signika", cut: 0, glow: false, scanlines: false, light: true
  },
  street: {
    label: "NEONHUB.Theme.street", accent: "#ffd400", accent2: "#e4322b",
    bg: "#14120d", bg2: "#2b2414", panel: "rgba(28,25,18,0.92)", text: "#f6f0dd", muted: "#b6ab8d",
    display: "Modesto Condensed", body: "Signika", cut: 0, glow: false, scanlines: false, hazard: true, glowStrength: 0.35
  },
  nomad: {
    label: "NEONHUB.Theme.nomad", accent: "#e8813a", accent2: "#8fb3a3",
    bg: "#241c15", bg2: "#3b2a1d", panel: "rgba(46,36,27,0.92)", text: "#efe1c8", muted: "#b9a78a",
    display: "Modesto Condensed", body: "Signika", cut: 10, glow: false, scanlines: false
  },
  terminal: {
    label: "NEONHUB.Theme.terminal", accent: "#39ff88", accent2: "#b6ffcf",
    bg: "#010a04", bg2: "#03200d", panel: "rgba(3,20,9,0.92)", text: "#b6ffcf", muted: "#4fbf7a",
    display: "Courier New", body: "Courier New", cut: 0, glow: true, scanlines: true, mono: true
  },
  netmarket: {
    label: "NEONHUB.Theme.netmarket", accent: "#9d4dff", accent2: "#00e5ff",
    bg: "#07061a", bg2: "#1a1050", panel: "rgba(14,11,42,0.88)", text: "#e8e6ff", muted: "#8f8cc4",
    display: "Bruno Ace", body: "Signika", cut: 18, glow: true, scanlines: false, gridFloor: true
  },
  ripperdoc: {
    label: "NEONHUB.Theme.ripperdoc", accent: "#1fb5a8", accent2: "#d9304f",
    bg: "#eef3f3", bg2: "#ffffff", panel: "rgba(255,255,255,0.95)", text: "#11282b", muted: "#57777a",
    display: "Signika", body: "Signika", cut: 0, glow: false, scanlines: false, light: true, radius: 10
  },
  fixer: {
    label: "NEONHUB.Theme.fixer", accent: "#f0a830", accent2: "#d8d2c4",
    bg: "#14100a", bg2: "#2a2012", panel: "rgba(30,24,16,0.92)", text: "#efe6d4", muted: "#a8977a",
    display: "Amiri", body: "Signika", cut: 0, glow: false, scanlines: false, italic: true
  }
};

/** Scene sizes a hub can be built at. */
export const PAGE_SIZES = {
  "1920x1080": { width: 1920, height: 1080 },
  "2560x1440": { width: 2560, height: 1440 },
  "1600x1200": { width: 1600, height: 1200 }
};

/** Button footprints, in grid cells (columns x rows). */
export const BUTTON_SIZES = {
  normal: { w: 1, h: 1 },
  wide: { w: 2, h: 1 },
  tall: { w: 1, h: 2 },
  large: { w: 2, h: 2 }
};

/**
 * What a hub button can do. `matt` actions use Monk's Active Tile Triggers' own action types;
 * `custom` ones are registered by this module as MATT actions.
 */
export const BUTTON_ACTIONS = {
  scene: { icon: "fa-solid fa-map", label: "NEONHUB.Action.scene" },
  journal: { icon: "fa-solid fa-book-open", label: "NEONHUB.Action.journal" },
  actor: { icon: "fa-solid fa-id-card", label: "NEONHUB.Action.actor" },
  shop: { icon: "fa-solid fa-store", label: "NEONHUB.Action.shop" },
  hq: { icon: "fa-solid fa-house-signal", label: "NEONHUB.Action.hq" },
  lifestyle: { icon: "fa-solid fa-wallet", label: "NEONHUB.Action.lifestyle" },
  calendar: { icon: "fa-solid fa-calendar-days", label: "NEONHUB.Action.calendar" },
  messenger: { icon: "fa-solid fa-mobile-screen-button", label: "NEONHUB.Action.messenger" },
  sound: { icon: "fa-solid fa-volume-high", label: "NEONHUB.Action.sound" },
  playlist: { icon: "fa-solid fa-music", label: "NEONHUB.Action.playlist" },
  image: { icon: "fa-solid fa-image", label: "NEONHUB.Action.image" },
  macro: { icon: "fa-solid fa-terminal", label: "NEONHUB.Action.macro" },
  none: { icon: "fa-solid fa-circle-info", label: "NEONHUB.Action.none" }
};

/** The default theme for new hub pages, Headquarters and the Lifestyle window. */
export const DEFAULT_THEME = "chrome";

/** Night City Messenger windows a hub button can open (its module, when installed). */
export const MESSENGER_VIEWS = {
  inbox: { icon: "fa-solid fa-envelope", gm: false },
  compose: { icon: "fa-solid fa-pen-to-square", gm: false },
  contacts: { icon: "fa-solid fa-address-book", gm: false },
  networks: { icon: "fa-solid fa-network-wired", gm: true },
  admin: { icon: "fa-solid fa-terminal", gm: true }
};

/** Who an action is shown to. Keys match MATT's own "for" lists. */
export const AUDIENCES = {
  trigger: "NEONHUB.Audience.trigger",
  everyone: "NEONHUB.Audience.everyone",
  players: "NEONHUB.Audience.players",
  gm: "NEONHUB.Audience.gm"
};

/** Cyberpunk RED core roles, as named by the system's role items. */
export const ROLES = ["Exec", "Fixer", "Lawman", "Media", "Medtech", "Netrunner", "Nomad", "Rockerboy", "Solo", "Tech"];
