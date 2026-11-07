/**
 * Fashion Analysis: how a look reads in 2070s Night City. Pure data and scoring; fashion-ops.js
 * turns actors into the plain "kits" these functions read.
 *
 * Styles follow the Item Compendium's Fashion chapter (the six 2070 styles plus Gang Colors).
 * CPR only knows its ten classic styles, so a 2070 item keeps the nearest classic one in
 * system.style and its 2070 style in flags.cpr-neon-hub.fashion.style; older items are read as their
 * 2070 heir. Districts come from the Night City 2070 setting book; their dress codes, the faction
 * profiles and every number below are Neon Hub's house rules built on them.
 */

export const STYLES = ["entropism", "nomadLeathers", "kitsch", "neoMilitarism", "neoKitsch", "highFashion", "gangColors"];
/** The classic CPR style a 2070 item is saved as. */
export const CLASSIC = {
  entropism: "bagLadyChic", nomadLeathers: "nomadLeathers", kitsch: "genericChic", neoMilitarism: "businesswear",
  neoKitsch: "urbanFlash", highFashion: "highFashion", gangColors: "gangColors"
};
/** How the Time of the Red's styles read in 2070 (Item Compendium, "Older looks"). */
export const FOLD = {
  bagLadyChic: "entropism", bohemian: "entropism", genericChic: "kitsch", leisurewear: "kitsch", asiaPop: "kitsch",
  urbanFlash: "neoKitsch", businesswear: "neoMilitarism", highFashion: "highFashion", nomadLeathers: "nomadLeathers", gangColors: "gangColors"
};

export const TYPES = ["top", "bottoms", "jacket", "footwear", "jewelry", "mirrorshades", "glasses", "contactLenses", "hats"];
/** A full outfit of one style (Item Compendium): top, bottoms, footwear and jewelry. */
export const CORE = ["top", "bottoms", "footwear", "jewelry"];
export const ACCESSORIES = ["mirrorshades", "glasses", "contactLenses", "hats"];

/** Per-item prices (Item Compendium, Fashion Prices). */
const P = (b, t, j, f, jw, s, g, c, h) => ({ bottoms: b, top: t, jacket: j, footwear: f, jewelry: jw, mirrorshades: s, glasses: g, contactLenses: c, hats: h });
export const PRICES = {
  entropism: P(0, 0, 0, 0, 0, 0, 0, 0, 0),
  nomadLeathers: P(0, 0, 0, 0, 0, 0, 0, 0, 0),
  kitsch: P(50, 20, 50, 20, 50, 20, 20, 10, 10),
  neoMilitarism: P(500, 50, 500, 500, 5000, 500, 500, 100, 500),
  neoKitsch: P(500, 50, 500, 500, 5000, 500, 500, 100, 500),
  highFashion: P(1000, 500, 1000, 5000, 50000, 1000, 1000, 1000, 5000),
  gangColors: P(50, 20, 50, 20, 50, 20, 20, 10, 10)
};

/** A piece's 2070 style: its own flag, or its classic style's heir. */
export const styleOf = (system = {}, flag = {}) => (STYLES.includes(flag?.style) ? flag.style : FOLD[system.style] ?? "kitsch");

/* ------------------------------------------ */
/*  Districts                                 */
/* ------------------------------------------ */

/**
 * Zone rules: what each zone expects of chrome (show / hide / any), open weapons
 * (open: normal, discreet: frowned on, forbidden: security stops you) and how much the outfit
 * should cost (floor: below it you look out of place; mark: above it you look like money).
 */
export const ZONES = {
  executive: { chrome: "hide", arms: "forbidden", floor: 5000, mark: null },
  corporate: { chrome: "hide", arms: "forbidden", floor: 1000, mark: null },
  moderate: { chrome: "any", arms: "discreet", floor: 0, mark: 20000 },
  combat: { chrome: "show", arms: "open", floor: 0, mark: 2000 },
  extraterritorial: { chrome: "hide", arms: "forbidden", floor: 500, mark: null },
  occupied: { chrome: "any", arms: "forbidden", floor: 0, mark: 2000 },
  outskirts: { chrome: "any", arms: "open", floor: 0, mark: 5000 }
};

const D = (id, name, borough, zone, sc, uc, controllers, likes, extra = {}) => ({ id, name, borough, zone, sc, uc, controllers, likes, ...extra });
/** The eighteen districts (Night City 2070) and the Badlands. likes: style → −3..+3. */
export const DISTRICTS = [
  D("corporate-plaza", "Corporate Plaza", "City Center", "corporate", 9, 2, ["arasaka", "militech", "kang-tao", "biotechnica", "night-corp", "petrochem"],
    { highFashion: 3, neoMilitarism: 3, neoKitsch: 1, kitsch: -1, entropism: -3, nomadLeathers: -2, gangColors: -3 }),
  D("downtown", "Downtown", "City Center", "moderate", 7, 3, ["night-corp"],
    { neoKitsch: 2, highFashion: 2, neoMilitarism: 2, kitsch: 1, entropism: -1, nomadLeathers: -1, gangColors: -2 }),
  D("little-china", "Little China", "Watson", "moderate", 6, 4, ["maelstrom"],
    { kitsch: 2, entropism: 1, neoKitsch: 1, neoMilitarism: -1, highFashion: -2, gangColors: 0 }, { chrome: "any" }),
  D("kabuki", "Kabuki", "Watson", "moderate", 6, 4, ["tyger-claws", "mox"],
    { kitsch: 3, neoKitsch: 2, entropism: 1, gangColors: 0, neoMilitarism: -1, highFashion: -1 }),
  D("northside", "Northside Industrial", "Watson", "combat", 4, 6, ["maelstrom"],
    { entropism: 2, kitsch: 1, nomadLeathers: 1, gangColors: 0, neoMilitarism: -1, highFashion: -3, neoKitsch: -1 }),
  D("arasaka-waterfront", "Arasaka Waterfront", "Watson", "extraterritorial", 10, 1, ["arasaka"],
    { neoMilitarism: 3, highFashion: 1, kitsch: -2, entropism: -3, gangColors: -3, nomadLeathers: -2 }),
  D("japantown", "Japantown", "Westbrook", "moderate", 6, 3, ["tyger-claws"],
    { neoKitsch: 3, kitsch: 2, highFashion: 1, neoMilitarism: 0, entropism: -2, nomadLeathers: -2, gangColors: 0 }),
  D("charter-hill", "Charter Hill", "Westbrook", "corporate", 8, 2, [],
    { neoMilitarism: 3, neoKitsch: 2, highFashion: 2, kitsch: 0, entropism: -3, nomadLeathers: -2, gangColors: -3 }),
  D("north-oak", "North Oak", "Westbrook", "executive", 10, 1, ["lazarus"],
    { highFashion: 3, neoKitsch: 2, neoMilitarism: 2, kitsch: -2, entropism: -3, nomadLeathers: -3, gangColors: -3 }),
  D("wellsprings", "Wellsprings", "Heywood", "moderate", 6, 4, ["valentinos"],
    { kitsch: 2, neoKitsch: 1, entropism: 1, neoMilitarism: 0, highFashion: -1, gangColors: 0 }),
  D("the-glen", "The Glen", "Heywood", "corporate", 8, 3, [],
    { neoMilitarism: 3, highFashion: 2, neoKitsch: 1, kitsch: 0, entropism: -2, nomadLeathers: -2, gangColors: -3 }, { arms: "discreet" }),
  D("vista-del-rey", "Vista del Rey", "Heywood", "combat", 3, 7, ["valentinos"],
    { gangColors: 1, kitsch: 2, neoKitsch: 2, entropism: 1, nomadLeathers: 0, neoMilitarism: -2, highFashion: -1 }),
  D("arroyo", "Arroyo", "Santo Domingo", "moderate", 7, 3, ["sixth-street"],
    { entropism: 2, neoMilitarism: 1, kitsch: 1, nomadLeathers: 1, neoKitsch: -1, highFashion: -2, gangColors: 0 }),
  D("rancho-coronado", "Rancho Coronado", "Santo Domingo", "moderate", 5, 6, ["sixth-street"],
    { kitsch: 2, entropism: 1, neoMilitarism: 1, nomadLeathers: 0, neoKitsch: -1, highFashion: -2, gangColors: 0 }),
  D("coastview", "Coastview", "Pacifica", "combat", 2, 8, ["voodoo-boys"],
    { entropism: 3, kitsch: 1, nomadLeathers: 1, neoKitsch: -1, neoMilitarism: -2, highFashion: -3, gangColors: -1 }, { chrome: "any" }),
  D("west-wind", "West Wind Estate", "Pacifica", "combat", 2, 9, ["voodoo-boys", "scavengers"],
    { entropism: 3, nomadLeathers: 1, kitsch: 0, neoKitsch: -2, neoMilitarism: -2, highFashion: -3, gangColors: 0 }),
  D("occupied-zone", "Occupied Zone", "Pacifica", "occupied", 9, 9, ["barghest"],
    { neoMilitarism: 2, entropism: 1, kitsch: -1, neoKitsch: -2, highFashion: -3, nomadLeathers: -1, gangColors: -2 }),
  D("morro-rock", "Morro Rock Spaceport", "the Outskirts", "corporate", 8, 3, [],
    { neoMilitarism: 3, kitsch: 0, entropism: -1, highFashion: 0, nomadLeathers: -1, gangColors: -3 }, { arms: "discreet" }),
  D("badlands", "The Badlands", "the Outskirts", "outskirts", 2, 8, ["aldecaldos", "wraiths"],
    { nomadLeathers: 3, entropism: 2, kitsch: 0, neoMilitarism: 0, neoKitsch: -2, highFashion: -3, gangColors: 0 })
];
export const district = (id) => DISTRICTS.find((d) => d.id === id) ?? null;
export const rulesOf = (d) => ({ ...ZONES[d.zone], ...(d.chrome ? { chrome: d.chrome } : {}), ...(d.arms ? { arms: d.arms } : {}) });

/* ------------------------------------------ */
/*  Faction looks                             */
/* ------------------------------------------ */

/**
 * How each faction dresses, keyed by Street Cred faction id (plus the NCPD).
 * styles: style → share of the look. chrome: show / hide / any / heavy (frames and muscle count too).
 */
export const FACTION_LOOKS = {
  "tyger-claws": { styles: { neoKitsch: 0.4, kitsch: 0.3, gangColors: 0.3 }, chrome: "any" },
  valentinos: { styles: { neoKitsch: 0.45, gangColors: 0.35, kitsch: 0.2 }, chrome: "any", jewelry: true },
  "sixth-street": { styles: { neoMilitarism: 0.5, gangColors: 0.3, entropism: 0.2 }, chrome: "any" },
  maelstrom: { styles: { entropism: 0.4, gangColors: 0.3, kitsch: 0.3 }, chrome: "show" },
  animals: { styles: { entropism: 0.5, kitsch: 0.3, gangColors: 0.2 }, chrome: "heavy" },
  mox: { styles: { kitsch: 0.5, gangColors: 0.3, neoKitsch: 0.2 }, chrome: "any" },
  "voodoo-boys": { styles: { entropism: 0.6, kitsch: 0.4 }, chrome: "hide" },
  barghest: { styles: { neoMilitarism: 0.7, gangColors: 0.3 }, chrome: "any" },
  scavengers: { styles: { entropism: 0.8, kitsch: 0.2 }, chrome: "show" },
  aldecaldos: { styles: { nomadLeathers: 0.9, entropism: 0.1 }, chrome: "any" },
  wraiths: { styles: { nomadLeathers: 0.5, entropism: 0.3, gangColors: 0.2 }, chrome: "show" },
  afterlife: { styles: { neoKitsch: 0.4, kitsch: 0.3, neoMilitarism: 0.3 }, chrome: "any" },
  arasaka: { styles: { neoMilitarism: 0.7, highFashion: 0.3 }, chrome: "hide" },
  militech: { styles: { neoMilitarism: 0.9, highFashion: 0.1 }, chrome: "hide" },
  "kang-tao": { styles: { neoMilitarism: 0.6, highFashion: 0.4 }, chrome: "hide" },
  biotechnica: { styles: { neoMilitarism: 0.6, neoKitsch: 0.4 }, chrome: "hide" },
  "night-corp": { styles: { neoKitsch: 0.5, neoMilitarism: 0.5 }, chrome: "hide" },
  petrochem: { styles: { neoMilitarism: 0.8, highFashion: 0.2 }, chrome: "hide" },
  lazarus: { styles: { neoMilitarism: 1 }, chrome: "any" },
  maxtac: { styles: { neoMilitarism: 1 }, chrome: "heavy" },
  ncpd: { styles: { neoMilitarism: 0.8, kitsch: 0.2 }, chrome: "any" }
};
/** A look for a faction Fashion Analysis doesn't know (one the GM added): by its kind. */
const KIND_LOOKS = {
  gang: { styles: { gangColors: 0.5, kitsch: 0.3, entropism: 0.2 }, chrome: "any" },
  corp: { styles: { neoMilitarism: 0.7, highFashion: 0.3 }, chrome: "hide" },
  nomad: { styles: { nomadLeathers: 0.9, entropism: 0.1 }, chrome: "any" },
  other: { styles: { kitsch: 0.4, neoKitsch: 0.3, neoMilitarism: 0.3 }, chrome: "any" }
};
export const lookOf = (faction) => FACTION_LOOKS[faction?.id] ?? KIND_LOOKS[faction?.kind] ?? KIND_LOOKS.other;

/* ------------------------------------------ */
/*  A character's look                        */
/* ------------------------------------------ */

/**
 * The kit: what a character has on, as plain data.
 * @typedef {object} Kit
 * @property {{ name: string, type: string, style: string, faction?: string|null, price: number, uuid?: string }[]} clothing - worn pieces
 * @property {{ visible: number, hidden: number, fashionware: number, frames: number }} chrome
 * @property {{ visible: number, hidden: number }} weapons
 * @property {{ visible: number }} armor
 * @property {{ ws: number, pg: number, cool: number, hp?: number, int?: number }} skills - Wardrobe & Style, Personal Grooming, COOL, Human Perception, INT
 */
export function normalizeKit(raw = {}) {
  const n = (v) => Math.max(0, Math.round(Number(v) || 0));
  return {
    clothing: (raw.clothing ?? []).filter((c) => TYPES.includes(c.type)).map((c) => ({
      name: String(c.name ?? ""), type: c.type, style: STYLES.includes(c.style) ? c.style : "kitsch", faction: c.faction || null, price: n(c.price), uuid: c.uuid ?? null
    })),
    chrome: { visible: n(raw.chrome?.visible), hidden: n(raw.chrome?.hidden), fashionware: n(raw.chrome?.fashionware), frames: n(raw.chrome?.frames) },
    weapons: { visible: n(raw.weapons?.visible), hidden: n(raw.weapons?.hidden) },
    armor: { visible: n(raw.armor?.visible) },
    skills: { ws: n(raw.skills?.ws), pg: n(raw.skills?.pg), cool: n(raw.skills?.cool), hp: n(raw.skills?.hp), int: n(raw.skills?.int) }
  };
}

/** Grades, best first: [lowest score, key]. */
export const GRADES = [[90, "S"], [75, "A"], [60, "B"], [45, "C"], [30, "D"], [0, "F"]];
export const gradeOf = (score) => GRADES.find(([min]) => score >= min)[1];

/** Quality of one piece, 0–10, by what it cost. */
export function quality(price) {
  if (price <= 0) return 0;
  return Math.min(10, Math.round(Math.log10(price) * 2.5 * 10) / 10);
}

/**
 * Score a look out of 100: coverage (30), cohesion (25), quality (20), flair (10), skill (15).
 * The look is a style when the top, bottoms, footwear and jewelry are all that style.
 */
export function analyze(rawKit) {
  const kit = normalizeKit(rawKit);
  const pieces = kit.clothing;
  const slots = new Set(pieces.map((p) => p.type));
  const counts = {};
  for (const p of pieces) counts[p.style] = (counts[p.style] ?? 0) + 1;
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1] || STYLES.indexOf(a[0]) - STYLES.indexOf(b[0]))[0]?.[0] ?? null;
  const fullLook = CORE.every((t) => pieces.some((p) => p.type === t && p.style === dominant));
  const cohesion = pieces.length ? counts[dominant] / pieces.length : 0;
  const cost = pieces.reduce((s, p) => s + p.price, 0);

  const coverage = CORE.filter((t) => slots.has(t)).length * 5 + (slots.has("jacket") ? 5 : 0) + Math.min(5, ACCESSORIES.filter((t) => slots.has(t)).length * 2.5);
  const cohesionScore = pieces.length ? cohesion * 20 + (fullLook ? 5 : 0) : 0;
  // Free styles (Entropism, Nomad Leathers) are put together, not bought: they score as street-level pieces.
  const q = pieces.length ? pieces.reduce((s, p) => s + (p.price ? quality(p.price) : 3), 0) / pieces.length : 0;
  const qualityScore = q * 2;
  const flair = Math.min(10, kit.chrome.fashionware * 3 + (kit.skills.pg >= 6 ? 1 : 0));
  const skill = Math.min(15, (kit.skills.ws + kit.skills.pg) * 0.75 + kit.skills.cool * 0.5);
  const score = Math.round(Math.min(100, coverage + cohesionScore + qualityScore + flair + skill));
  return {
    score,
    grade: gradeOf(score),
    look: fullLook ? dominant : null,
    dominant,
    counts,
    cohesion: Math.round(cohesion * 100),
    cost,
    missing: CORE.filter((t) => !slots.has(t)),
    parts: { coverage: Math.round(coverage), cohesion: Math.round(cohesionScore), quality: Math.round(qualityScore), flair, skill: Math.round(skill) },
    kit
  };
}

/* ------------------------------------------ */
/*  Fitting into a district                   */
/* ------------------------------------------ */

/** District fit bands, best first: [lowest fit, key, social modifier]. */
export const FIT_BANDS = [[6, "belongs", 2], [3, "fitsIn", 1], [0, "passes", 0], [-3, "standsOut", -1], [-10, "marked", -2]];
export const fitBand = (fit) => FIT_BANDS.find(([min]) => fit >= min);

/**
 * How well a look fits a district, −10..+10, with the reasons and the warnings.
 * @param {object} analysis - from analyze()
 * @param {object} d - a district
 * @param {{ rivals?: (id: string) => string[], standing?: (id: string) => number, heat?: number }} context - Street Cred
 */
export function fitIn(analysis, d, { rivals = () => [], standing = null, heat = 0 } = {}) {
  const { kit } = analysis;
  const rules = rulesOf(d);
  const reasons = [];
  const warnings = [];
  const add = (n, key, data = {}) => {
    if (n) reasons.push({ n: Math.round(n * 10) / 10, key, data });
  };
  let fit = 0;
  const pieces = kit.clothing;
  // Style: the average of how the district takes each piece, doubled; a full look it likes adds 1.
  if (pieces.length) {
    const s = (pieces.reduce((sum, p) => sum + (d.likes[p.style] ?? 0), 0) / pieces.length) * 2;
    fit += s;
    add(s, "style", { style: analysis.dominant });
    if (analysis.look && (d.likes[analysis.look] ?? 0) >= 2) {
      fit += 1;
      add(1, "fullLook", { style: analysis.look });
    }
  } else {
    fit -= 3;
    add(-3, "nothing");
  }
  // Colors: your own on your turf, someone else's anywhere, a rival's on theirs.
  const colors = [...new Set(pieces.map((p) => p.faction).filter(Boolean))];
  for (const f of colors) {
    if (d.controllers.includes(f)) {
      fit += 2;
      add(2, "ownTurf", { faction: f });
    } else if (d.controllers.some((c) => rivals(c).includes(f))) {
      fit -= 5;
      add(-5, "rivalColors", { faction: f });
      warnings.push({ key: "rivalColors", data: { faction: f } });
    } else if (d.controllers.length && FACTION_LOOKS[f]?.styles?.gangColors) {
      fit -= 1;
      add(-1, "otherColors", { faction: f });
    }
  }
  // Chrome.
  if (rules.chrome === "show" && kit.chrome.visible) {
    const n = Math.min(2, kit.chrome.visible / 2);
    fit += n;
    add(n, "chromeShown");
  } else if (rules.chrome === "hide" && kit.chrome.visible) {
    const n = -Math.min(3, kit.chrome.visible);
    fit += n;
    add(n, "chromeHidden");
  }
  // Weapons and armor in plain sight.
  const arms = kit.weapons.visible + kit.armor.visible / 2;
  if (arms && rules.arms === "forbidden") {
    const n = -Math.min(4, arms * 2);
    fit += n;
    add(n, "armsForbidden");
    warnings.push({ key: "armsForbidden" });
  } else if (arms && rules.arms === "discreet") {
    const n = -Math.min(3, arms);
    fit += n;
    add(n, "armsDiscreet");
  } else if (rules.arms === "open" && !kit.weapons.visible && !kit.weapons.hidden) {
    fit -= 1;
    add(-1, "unarmed");
  }
  // Money.
  if (rules.floor && analysis.cost < rules.floor) {
    fit -= 2;
    add(-2, "cheap", { floor: rules.floor });
  }
  if (rules.mark && analysis.cost > rules.mark) {
    fit -= 2;
    add(-2, "money", { mark: rules.mark });
    warnings.push({ key: "money" });
  }
  if (["corporate", "executive"].includes(d.zone) && ["S", "A"].includes(analysis.grade)) {
    fit += 1;
    add(1, "polish");
  }
  // Street Cred: who runs the place, and how hot the badge runs here.
  if (standing) {
    for (const c of d.controllers) {
      const v = standing(c);
      if (v <= -5) warnings.push({ key: "marked", data: { faction: c, value: v } });
      else if (v >= 4) {
        fit += 1;
        add(1, "trusted", { faction: c });
      }
    }
  }
  if (heat >= 1 && d.sc >= 5 && !["extraterritorial", "occupied"].includes(d.zone)) warnings.push({ key: "heat", data: { heat, sc: d.sc } });
  fit = Math.max(-10, Math.min(10, Math.round(fit)));
  const [, band, modifier] = fitBand(fit);
  return { district: d.id, fit, band, modifier, reasons, warnings };
}

/* ------------------------------------------ */
/*  Reading as a faction, and disguise        */
/* ------------------------------------------ */

/**
 * How strongly a look reads as a faction, 0–100: its styles against the faction's (60), the
 * faction's own colors or uniform (up to 30) and its chrome habits (10). Someone else's colors cost 30.
 */
export function readAs(analysis, faction) {
  const look = lookOf(faction);
  const { kit } = analysis;
  const pieces = kit.clothing;
  if (!pieces.length) return 0;
  let overlap = 0;
  for (const [style, share] of Object.entries(look.styles)) overlap += Math.min(share, (analysis.counts[style] ?? 0) / pieces.length);
  let score = overlap * 60;
  const own = pieces.filter((p) => p.faction === faction.id).length;
  const others = pieces.filter((p) => p.faction && p.faction !== faction.id).length;
  score += Math.min(30, own * 15);
  score -= Math.min(30, others * 15);
  if (look.jewelry && pieces.some((p) => p.type === "jewelry" && p.price >= 50)) score += 5;
  const shown = kit.chrome.visible + kit.chrome.frames;
  if (look.chrome === "show" || look.chrome === "heavy") score += Math.min(10, shown * 3);
  else if (look.chrome === "hide") score += kit.chrome.visible ? -Math.min(10, kit.chrome.visible * 3) : 10;
  else score += 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Every faction a look reads as, strongest first. */
export function reads(analysis, factions) {
  return factions.map((f) => ({ id: f.id, name: f.name, kind: f.kind, score: readAs(analysis, f) }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

/** Disguise bands: [lowest read, key, modifier to the disguise check]. Below 20 it can't pass. */
export const DISGUISE_BANDS = [[80, "convincing", 2], [60, "solid", 0], [40, "thin", -2], [20, "shaky", -4], [0, "hopeless", null]];
export const disguiseOf = (read) => {
  const [, key, modifier] = DISGUISE_BANDS.find(([min]) => read >= min);
  return { key, modifier };
};

/**
 * The disguise check (house rule): COOL + Wardrobe & Style + 1d10 + the look's modifier, against the
 * watcher's INT + Human Perception + 1d10, who gets +2 if they're one of the faction. A tie goes to the watcher.
 */
export const disguiseBase = (kit) => kit.skills.cool + kit.skills.ws;
export const watcherBase = (kit, member = false) => kit.skills.int + kit.skills.hp + (member ? 2 : 0);

/* ------------------------------------------ */
/*  The crew                                  */
/* ------------------------------------------ */

/** How much a crew looks like one crew: the share of all their pieces in the commonest style. */
export function crewCohesion(analyses) {
  const counts = {};
  let total = 0;
  for (const a of analyses) {
    for (const [s, n] of Object.entries(a.counts)) {
      counts[s] = (counts[s] ?? 0) + n;
      total += n;
    }
  }
  const [style, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  return { style, percent: total ? Math.round((n / total) * 100) : 0 };
}

/* ------------------------------------------ */
/*  Shopping                                  */
/* ------------------------------------------ */

/** The style a district wants most, or the one a faction wears most. */
export function targetStyle({ district: d = null, faction = null } = {}) {
  if (faction) return Object.entries(lookOf(faction).styles).sort((a, b) => b[1] - a[1])[0][0];
  if (d) return Object.entries(d.likes).sort((a, b) => b[1] - a[1] || STYLES.indexOf(a[0]) - STYLES.indexOf(b[0]))[0][0];
  return "kitsch";
}

/** Slots in the order a shopping list fills them. */
const SHOP_ORDER = ["top", "bottoms", "footwear", "jewelry", "jacket", "mirrorshades", "hats", "glasses", "contactLenses"];

/**
 * A shopping list: for each slot that's empty or off-style, the faction's own piece (when shopping
 * for a faction) or else the cheapest unbranded piece of the target style that still fits the budget.
 * @param {object} analysis
 * @param {{ type, style, faction, price, name, uuid }[]} catalog - pieces for sale
 * @param {{ style: string, faction?: string|null, budget: number }} target
 * @returns {{ buy: object[], spent: number, left: number, kit: object }} kit: the outfit after buying
 */
export function shoppingList(analysis, catalog, { style, faction = null, budget = 0 }) {
  const kit = structuredClone(analysis.kit);
  const buy = [];
  let left = Math.max(0, Number(budget) || 0);
  for (const type of SHOP_ORDER) {
    const worn = kit.clothing.find((p) => p.type === type);
    const own = (c) => !!faction && c.faction === faction;
    if (worn && (own(worn) || (worn.style === style && !worn.faction))) continue;
    // The faction's own colors or uniform first, then unbranded pieces of the style, cheapest first.
    const options = catalog.filter((c) => c.type === type && (own(c) || (c.style === style && !c.faction)))
      .sort((a, b) => own(b) - own(a) || a.price - b.price);
    const pick = options.find((c) => c.price <= left);
    if (!pick) continue;
    left -= pick.price;
    buy.push({ ...pick, replaces: worn?.name ?? null });
    kit.clothing = [...kit.clothing.filter((p) => p.type !== type), { ...pick }];
  }
  return { buy, spent: Math.max(0, Number(budget) || 0) - left, left, kit };
}

/* ------------------------------------------ */
/*  The street feed                           */
/* ------------------------------------------ */

/** A small seeded generator, so a character's feed doesn't change every time the window redraws. */
export function seeded(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/**
 * Which kinds of comment the street makes about a look in a district (keys under
 * NEONHUB.Fashion.Feed). Each kind comes with how many lines it has; the caller picks from them.
 */
export function feedTopics(analysis, fit) {
  const topics = [];
  topics.push(analysis.score >= 75 ? "sharp" : analysis.score >= 45 ? "ok" : "rough");
  if (fit) topics.push(fit.fit >= 3 ? "fits" : fit.fit <= -3 ? "outOfPlace" : "meh");
  if (analysis.look) topics.push(`look.${analysis.look}`);
  if (fit?.warnings.some((w) => w.key === "rivalColors")) topics.push("rival");
  if (analysis.kit.chrome.visible >= 3) topics.push("chrome");
  if (analysis.kit.weapons.visible) topics.push("armed");
  if (analysis.cost >= 10000) topics.push("rich");
  return topics;
}
