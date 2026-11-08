"""Builds Neon Hub's 2070 item packs from the 2070 Item Compendium (the book's own markup and data modules).

Run: python3 -I items2070.py <module root> <book source dir>
Writes packs/_source/items-2070 (Items), packs/_source/rides-2070 (vehicles, ACPAs and cyberpets as Actors for
MMuton's vehicle sheet) and packs/_source/dv-tables-2070 (the 2070 Core Rules' range tables as CPR DV tables).
Ids are derived from names, so re-running keeps every document's id. Items carry Active Effects read from the
book's own "+2 Stealth"-style lines. Icons point at the CPR system's own; nothing else comes from its packs.
"""
import glob, hashlib, html, json, os, re, shutil, string, sys

ROOT, BOOK = sys.argv[1], sys.argv[2]
sys.path[:0] = [os.path.join(BOOK, "data"), os.path.join(BOOK, "notes")]
import range_tables as RT
import src_house as HOUSE, src_exotics as EXO, src_pets as PETS, src_sof as SOF
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import icons2070 as ICONS

MOD = "cpr-neon-hub"
SYS = "systems/cyberpunk-red-core/icons/compendium"
MIGRATION = {"cyberpunk-red-core": {"_migration": {"current": 33}}}
SOURCE = "Item Compendium (2070)"
B62 = string.ascii_letters + string.digits


def rid(*parts):
    h = int(hashlib.sha1("|".join(map(str, parts)).encode()).hexdigest(), 16)
    out = ""
    for _ in range(16):
        h, r = divmod(h, 62)
        out += B62[r]
    return out


# ------------------------------------------------------------------ text
def strip(s):
    return re.sub(r"\s+", " ", str(s or "").replace("\u200b", "")).strip()


def inline(s):
    s = html.escape(strip(s), quote=False)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<em>\1</em>", s)
    return s


def plain(s):
    return re.sub(r"\*+", "", strip(s)).strip(" ◆").strip()


def para(*parts):
    return "".join(f"<p>{p}</p>" for p in parts if p)


CATEGORY = {"free": 0, "dirt cheap": 5, "cheap": 10, "everyday": 20, "costly": 50, "premium": 100, "expensive": 500,
            "very expensive": 1000, "v. expensive": 1000, "v.exp": 1000, "luxury": 5000, "super luxury": 10000, "s. luxury": 10000}


def price(s):
    s = strip(s)
    m = re.search(r"([\d,]+)\s*eb", s)
    if m:
        return int(m.group(1).replace(",", ""))
    low = s.lower()
    for k in sorted(CATEGORY, key=len, reverse=True):
        if k in low:
            return CATEGORY[k]
    return 0


def num(s, default=0):
    m = re.search(r"-?\d+", str(s or ""))
    return int(m.group()) if m else default


# ------------------------------------------------------------------ the book's markup
def read_markup():
    """Tables, weapon cards and paragraphs, each with where it sits in the book."""
    lines = open(os.path.join(BOOK, "out", "compendium_markup.txt"), encoding="utf-8").read().split("\n")
    where = {"chapter": "", "h1": "", "h2": "", "h3": "", "tag": ""}
    out = []
    i = 0
    while i < len(lines):
        l = lines[i]
        if l.startswith("@chapter"):
            where = {"chapter": l.split("|")[1].strip(), "h1": "", "h2": "", "h3": "", "tag": ""}
        elif l.startswith("# "):
            where.update(h1=l[2:].strip(), h2="", h3="", tag="")
        elif l.startswith("## "):
            where.update(h2=l[3:].strip(), h3="")
        elif l.startswith("### "):
            where.update(h3=l[4:].strip())
        elif l.startswith("@tag "):
            where["tag"] = l[5:].strip()
        elif l.startswith("@card "):
            out.append(dict(where, kind="card", card=json.loads(l[6:])))
        elif l.startswith("@table"):
            title = re.search(r"title=(.+?)(?: size=| align=| widths=|$)", l)
            j = i + 1
            while j < len(lines) and not lines[j].startswith("|"):
                j += 1
            rows = []
            while j < len(lines) and lines[j].startswith("|"):
                rows.append([c.strip() for c in lines[j].strip().strip("|").split("|")])
                j += 1
            out.append(dict(where, kind="table", title=title.group(1).strip() if title else "", header=rows[0], rows=rows[1:]))
            i = j
            continue
        i += 1
    return additions(out, "\n".join(lines))


PISTOL_DVS = ["13", "15", "20", "25", "30", "35", "—", "—"]
RIFLE_DVS = ["17", "16", "15", "13", "15", "20", "25", "30"]
ADDITIONS = [
    ("Weapons", "Pistols", "card", {
        "name": "Microwaver", "cost": "500eb (Expensive)", "tier": "grn", "skill": "Handgun", "range": "Pistol", "damage": "None", "rof": "1",
        "hands": "1", "capacity": "8 (battery)", "modes": "None", "conceal": "Yes", "slots": "0", "attachments": "None", "mods": "None", "fab": "",
        "special": "No damage. On a hit, the target rolls DV15 Cybertech or the GM switches off 2 pieces of their cyberware or electronics for "
                   "1 minute; a disabled cyberlimb hangs limp. Hardened chrome shrugs it off. Its 8-shot battery recharges in an hour; spare packs 50eb.",
        "flavor": "A pistol-sized pulse emitter that cooks circuits and leaves the meat alone.", "dvs": PISTOL_DVS,
        "class": "Exotic Very Heavy Pistol"}),
    ("Weapons", "Pistols", "card", {
        "name": "Shrieker", "cost": "500eb (Expensive)", "tier": "grn", "skill": "Handgun", "range": "Pistol", "damage": "None", "rof": "1",
        "hands": "1", "capacity": "8 (battery)", "modes": "None", "conceal": "No", "slots": "0", "attachments": "None", "mods": "None", "fab": "",
        "special": "No damage. On a hit, the target rolls DV15 Resist Torture/Drugs or suffers Damaged Ear (no Bonus Damage). Without ear "
                   "protection, so do you. Its 8-shot battery recharges in an hour; spare packs 50eb.",
        "flavor": "A sonic projector for crowds and doorways. Buy the earplugs first.", "dvs": PISTOL_DVS,
        "class": "Exotic Very Heavy Pistol"}),
    ("Weapons", "Machine Guns", "card", {
        "name": "Techtronika BMG-570", "cost": "1,000eb (V. Expensive)", "tier": "yel", "skill": "Heavy Weapons", "range": "Assault Rifle",
        "damage": "5d6", "rof": "1", "hands": "2", "capacity": "500", "modes": "Autofire (Assault Rifle 4), Suppressive Fire", "conceal": "No",
        "slots": "0", "attachments": "Bipod", "mods": "None", "fab": "",
        "special": "Belt-fed from a 500-round box: single shots use Heavy Weapons, Autofire and Suppressive Fire use Autofire. BODY 11+ unless "
                   "mounted. Deploying the bipod is an Action, and it stays mounted until you move. Fits a Vehicle Heavy Weapon Mount. "
                   "The Silver finish changes nothing but the price of a repaint.",
        "flavor": "Standard on Kaukaz armored pickups. Water-cooled barrel, 500-round box.", "dvs": RIFLE_DVS,
        "class": "Exotic Assault Rifle (belt-fed)  •  POWER"}),
    ("Cyberware", "Internal Body Cyberware", "table", (
        ["Cyberware", "Install", "Cost", "HL", "Slots", "Effect", "Source"],
        ["Bodyweight Autoinjector", "Clinic", "500eb", "3 (1d6)", "1",
         "Holds one dose of a drug or Pharmaceutical under the skin. Release it without an Action once a Turn, or set it at install to fire on "
         "its own the moment you're Seriously Wounded. Refilling it takes an Action with an Airhypo.", ""])),
    ("Cyberware", "Cyberlimbs & Options", "table", (
        ["Cyberware", "Install", "Cost", "HL", "Slots", "Effect", "Source"],
        ["Rocklin Augmentics Skydrivers", "Hospital", "2,500eb (V. Expensive)", "14 (4d6)", "0, gives 3",
         "Paired cyberlegs, priced and HL'd as one item, each with 3 option slots and a fixed Jump Booster (no HL, no slot). Falls deal damage "
         "as if they were 4m/yds shorter. Out of production since Rocklin folded; Militech bought the last stock for its Phoenix units.", ""])),
    ("Cyberware", "Borgware", "table", (
        ["Cyberware", "Install", "Cost", "HL", "Slots", "Effect", "Source"],
        ["Integrated Zetatech CyberConductor", "Hospital", "5,000eb", "14 (4d6)", "0",
         "Borgware; needs an Integrated Netstation and two or more integrated decks. Your integrated decks run as one: Programs and Hardware in "
         "any of them count as installed in the deck you Jack In with. Once per Turn, derez one of your Programs and rez another in the same NET "
         "Action. Overheat or Short Circuit on one deck hits them all.", ""])),
]


def additions(events, raw):
    """The ADDITIONS the book hasn't printed yet, as events the router reads like the book's own."""
    have = {plain(n).lower() for n in re.findall(r'"name": "([^"]+)"', raw)} | {plain(l.split("|")[1]).lower() for l in raw.split("\n") if l.startswith("| ")}
    for chapter, h1, kind, data in ADDITIONS:
        where = {"chapter": chapter, "h1": h1, "h2": "", "h3": "", "tag": ""}
        name = data["name"] if kind == "card" else data[1][0]
        if name.lower() in have:
            continue
        NOTES.append(f"not printed in the book yet, using Neon Hub's entry: {name}")
        events.append(dict(where, kind="card", card=data) if kind == "card" else dict(where, kind="table", title="", header=data[0], rows=[data[1]]))
    return events


# ------------------------------------------------------------------ documents
ITEMS, ACTORS, FOLDERS = {}, {}, {}
DUPES = []
NOTES = []


def folder(pack, path, color=None):
    """A folder (and its parents) in a pack; path is a tuple of names."""
    parent = None
    for depth in range(1, len(path) + 1):
        key = (pack,) + tuple(path[:depth])
        if key not in FOLDERS:
            fid = rid("folder", *key)
            FOLDERS[key] = {"_id": fid, "_key": f"!folders!{fid}", "name": path[depth - 1],
                            "type": "Actor" if pack == "rides-2070" else "Item", "folder": parent, "sorting": "a",
                            "sort": len(FOLDERS) * 100, "color": color if depth == 1 else None, "description": "", "flags": {}}
        parent = FOLDERS[key]["_id"]
    return parent


def source_html(where=""):
    return f"<p><small>{html.escape(SOURCE)}{' • ' + html.escape(where) if where else ''}</small></p>"


# The book's few mentions of where an entry was first printed: Neon Hub keeps the 2070 wording only.
TEXT_FIX = [(" (The DLC's summary table says 2 slots; its full entry says 3.)", ""),
            ("(Corgo's Projectile Launch System)", "(Projectile Launch System)"),
            ("the CEMK Neuroport Cyberdeck Port", "the Neuroport Cyberdeck Port")]


def fix_text(s):
    for old, new in TEXT_FIX:
        s = s.replace(old, new)
    return s


# Items Neon Hub already ships (Street Goods, Lifestyle 2070s, Fashion 2070s) aren't repeated here.
ELSEWHERE = set()
SKIPPED = []


def load_elsewhere():
    for pack in ("street-goods", "lifestyle-2070", "fashion-2070"):
        for f in glob.glob(os.path.join(ROOT, "packs/_source", pack, "*.json")):
            d = json.load(open(f, encoding="utf-8"))
            if "system" in d:
                ELSEWHERE.add(d["name"].lower())


def item(type_, name, system, desc, path, src="", tag="", img=None, flags=None, effects=None):
    name = plain(name)
    if not name:
        return None
    if name.lower() in ELSEWHERE and type_ != "vehicle":
        SKIPPED.append(name)
        return None
    key = (type_, name.lower())
    if key in ITEMS:
        DUPES.append(f"{type_}: {name} ({' / '.join(path)})")
        return ITEMS[key]
    iid = rid("item", type_, name.lower())
    system = dict(system)
    desc = fix_text(desc)
    system.setdefault("description", {"value": desc + source_html(path[0])})
    system.setdefault("source", {"book": SOURCE, "page": 0})
    system.setdefault("revealed", True)
    system.setdefault("favorite", False)
    if type_ == "itemUpgrade" and not img:
        kind, rel = ICONS.upgrade_icon(name, path, SYSDIR)
        img = f"{SYS}/{rel}" if rel else f"{ASSETS}/upgrades/{kind}.svg"
    doc = {"_id": iid, "_key": f"!items!{iid}", "name": name, "type": type_, "img": img or IMG.get(type_, f"{SYS}/default/Default_Gear.svg"),
           "folder": folder("items-2070", path, COLORS.get(path[0])), "sort": len(ITEMS) * 10,
           "system": system, "effects": effects or [], "flags": {**MIGRATION, MOD: {"source2070": {"book": SOURCE, "chapter": path[0]}, **(flags or {})}},
           "ownership": {"default": 0}}
    if not effects:
        usage, doc["effects"] = effects_for(doc, desc, path)
        if usage:
            system["usage"] = usage
    ITEMS[key] = doc
    return doc


# ------------------------------------------------------------------ Active Effects
# Read from the book's own bonus lines ("+2 Stealth", "COOL and TECH −2"), in CPR 0.92.4's effect format.
STAT_KEYS = {"REF": "ref", "DEX": "dex", "MOVE": "move", "BODY": "body", "COOL": "cool", "TECH": "tech", "INT": "int", "WILL": "will"}
SKILLS = ["Accounting", "Acting", "Air Vehicle Tech", "Animal Handling", "Archery", "Athletics", "Autofire", "Basic Tech", "Brawling", "Bribery",
          "Bureaucracy", "Business", "Composition", "Conceal/Reveal Object", "Concentration", "Contortionist", "Conversation", "Criminology",
          "Cryptography", "Cybertech", "Dance", "Deduction", "Demolitions", "Drive Land Vehicle", "Education", "Electronics/Security Tech",
          "Endurance", "Evasion", "First Aid", "Forgery", "Gamble", "Handgun", "Heavy Weapons", "Human Perception", "Interrogation",
          "Land Vehicle Tech", "Library Search", "Lip Reading", "Local Expert", "Martial Arts", "Melee Weapon", "Paint/Draw/Sculpt", "Paramedic",
          "Perception", "Personal Grooming", "Persuasion", "Photography/Film", "Pick Lock", "Pick Pocket", "Pilot Air Vehicle", "Pilot Sea Vehicle",
          "Play Instrument", "Resist Torture/Drugs", "Riding", "Sea Vehicle Tech", "Shoulder Arms", "Stealth", "Streetwise", "Tactics", "Tracking",
          "Trading", "Wardrobe & Style", "Weaponstech", "Wilderness Survival"]
COMBAT = {"Initiative": ("bonuses.initiative", "combat"), "Aimed Shots": ("bonuses.aimedShot", "combat"), "Aimed Shot": ("bonuses.aimedShot", "combat"),
          "Melee": ("bonuses.melee", "combat"), "Ranged": ("bonuses.ranged", "combat"), "Ranged Attacks": ("bonuses.ranged", "combat"),
          "Single Shot": ("bonuses.singleShot", "combat"), "Speed": ("bonuses.speed", "netrun"),
          "everything": ("bonuses.allActions", "misc"), "all Actions": ("bonuses.allActions", "misc")}


def slugify(name):
    """CPR's own skill-key rule (SystemUtils.slugify), so a skill effect lands where the roll looks."""
    if name in ("Conceal/Reveal Object", "Paint/Draw/Sculpt", "Resist Torture/Drugs"):
        s = name.replace(" ", "").replace("/", "Or")
    else:
        s = name.replace(" ", "").replace("/", "And").replace("&", "And")
    return s[0].lower() + s[1:]


TARGETS = {**{k: (f"system.stats.{v}.value", "stat") for k, v in STAT_KEYS.items()}, "EMP": ("system.stats.emp.max", "stat"),
           **{k: (f"bonuses.{slugify(k)}", "skill") for k in SKILLS}, "Wardrobe": ("bonuses.wardrobeAndStyle", "skill"), **COMBAT}
_T = "|".join(re.escape(t) for t in sorted(TARGETS, key=len, reverse=True))
_TLIST = rf"(?:{_T})(?![\w-])(?:\s*(?:,|/|\band\b|\bor\b|, and)\s*(?:{_T})(?![\w-]))*"
TFIND = re.compile(rf"(?:{_T})(?![\w-])")
BONUS_BEFORE = re.compile(rf"([+−-])(\d+)(?![\dd])\s+(?:to\s+)?(?:(?:all|your)\s+)?({_TLIST})(?:\s+Checks?)?")
BONUS_AFTER = re.compile(rf"(?<![\w+−-])((?:{'|'.join(STAT_KEYS)})(?:\s*(?:,|/|and)\s*(?:{'|'.join(STAT_KEYS)}))*)\s+([+−-])(\d+)(?![\dd])(?!\s*(?:to|on)\b)")
# Wording that makes a bonus depend on the moment: those become toggles (skills) or are left to the table.
CONDITION = re.compile(r"\b(when|whenever|while|if|unless|against|without|with|once|until|instead|per|each|after|before|during|first|"
                       r"or more|installs?|by (?:sight|smell|hearing)|for (?:hearing|sight|smell)|for \w+ing|to (?!a max)\w+|in (?:any|a|the)\b|"
                       r"on (?:a|an|the|Move)|vs\.?|only|next|about|through|inside|jacked|except|two-handed)\b", re.I)
TIMED = re.compile(r"\b(activate[sd]?|as an Action|lasts|for (?:the first )?(?:\d+|one|two|three|1) (?:Rounds?|minutes?|hours?|Turns?)|for \d+ Rounds)\b", re.I)
NOT_A_CONDITION = re.compile(r"\b(?:while (?:rezzed|worn|installed|running|it runs)|worn,?|installed,?)\b", re.I)
WEAPON_SKILLS = {f"bonuses.{slugify(k)}" for k in ("Archery", "Autofire", "Brawling", "Handgun", "Heavy Weapons", "Martial Arts", "Melee Weapon", "Shoulder Arms")}
USAGE = {"cyberware": "installed", "gear": "equipped", "weapon": "equipped", "armor": "equipped", "clothing": "equipped",
         "drug": "snorted", "program": "rezzed", "itemUpgrade": "toggled"}
EFFECT_NOTES = []


def _clauses(text):
    """The book text as plain clauses; for drugs only the Primary effect (not the come-down or withdrawal)."""
    t = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", text)))
    t = t.replace("Land/Sea/Air Vehicle Tech", "Land Vehicle Tech, Sea Vehicle Tech, Air Vehicle Tech")
    return [c.strip() for c in re.split(r"(?<=[.;])\s+|;\s*", t) if c.strip()]


def _drug_primary(text):
    t = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", text)))
    m = re.search(r"Primary \([^)]*\):(.*?)(?:Secondary|$)", t) or re.search(r"\b\d+\s*(?:h|hours?|minutes?|minute)\s*:(.*?)(?:\bDV\d+:|$)", t)
    return m.group(1) if m else ""


def effects_for(doc, desc, path):
    """(usage, [ActiveEffect]) for an item, from its own text. Mechanics the sheet can't hold stay in the text."""
    type_, name, sysd = doc["type"], doc["name"], doc["system"]
    if type_ not in USAGE or name.startswith("ACPA "):
        return None, []
    if type_ == "itemUpgrade" and sysd.get("type") not in ("cyberware", "armor", "clothing", "gear"):
        return None, []  # weapon, vehicle and deck upgrades improve the item, not the person
    if type_ == "program" and (sysd.get("class") not in ("booster", "defender") or "Cooldown:" in desc):
        return None, []  # attackers and Black ICE work on their target, not the runner
    text = _drug_primary(desc) if type_ == "drug" else desc
    if "at the table" in text:
        return None, []
    always, timed, situational = {}, {}, {}
    for clause in _clauses(text):
        # "REF, DEX and MOVE become 6 unless higher" and an implanted frame's "BODY becomes 14": a floor under the stat,
        # set before other chrome's penalties (priority 10, ahead of their ADDs at 20).
        if type_ == "cyberware" and not re.search(r"plugged in", clause):
            for m in re.finditer(rf"((?:{'|'.join(STAT_KEYS)})(?:\s*(?:,|and)\s*(?:{'|'.join(STAT_KEYS)}))*) becomes? (\d+)\b", clause):
                for st in re.findall("|".join(STAT_KEYS), m.group(1)):
                    always[f"system.stats.{STAT_KEYS[st]}.value"] = ("stat", int(m.group(2)), 4, 10)
        if re.search(r"against (?:you|them)|no HP|without a dose|addicted|\banyone\b|to hear|\bdodging\b|\bbecomes?\b|\btargets?\b", clause, re.I):
            continue
        found = [(m, [(n, m.group(1), m.group(2)) for n in TFIND.findall(m.group(3))])
                 for m in BONUS_BEFORE.finditer(clause)]
        found += [(m, [(n, m.group(2), m.group(3)) for n in TFIND.findall(m.group(1))])
                  for m in BONUS_AFTER.finditer(clause)]
        if type_ == "cyberware" and path[-1] == "Linear Frames":
            found += [(m, [("BODY=", "", m.group(1))]) for m in re.finditer(r"\bBODY (\d+)\b(?! *[+−-])", clause)]
        for m, targets in found:
            rest = clause[:m.start()] + " " + clause[m.end():]
            rest = re.sub(r"\((?:max|min|[^)]*at most|[^)]*a max)[^)]*\)|to a max of \d+|\(once\)", " ", rest)
            rest = NOT_A_CONDITION.sub(" ", rest)
            timed_hit = TIMED.search(rest)
            cond = CONDITION.search(rest)
            for tname, sign, n in targets:
                if tname == "BODY=":
                    always["system.stats.body.value"] = ("stat", int(n), 4)
                    continue
                key, cat = TARGETS[tname]
                if cat == "stat" and (type_ == "armor" or sysd.get("type") == "armor"):
                    continue  # CPR applies armor penalties itself
                if type_ == "weapon" and (cat != "skill" or key in WEAPON_SKILLS):
                    continue  # a weapon's own attack bonuses live on the weapon
                if key == "bonuses.speed" and type_ != "program":
                    continue
                val = int(n) * (-1 if sign in "−-" else 1)
                if timed_hit:
                    bucket = timed
                elif cond:
                    if cat != "skill":
                        continue
                    bucket = situational
                else:
                    bucket = always
                old = bucket.get(key)
                bucket[key] = (cat, (old[1] if old else 0) + val, 2)
    effects = []
    for label, bucket, disabled, sit in ((name, always, type_ in ("drug", "itemUpgrade"), False),
                                         (f"{name} (active)", timed, True, False),
                                         (f"{name} (situational)", situational, type_ in ("drug", "itemUpgrade"), True)):
        if not bucket:
            continue
        eid = rid("effect", doc["_id"], label)
        changes, cats, sits = [], {}, {}
        for i, (key, (cat, val, mode, *prio)) in enumerate(sorted(bucket.items())):
            changes.append({"key": key, "mode": mode, "value": str(val), "priority": prio[0] if prio else None})
            cats[str(i)] = cat
            sits[str(i)] = {"isSituational": sit and cat == "skill", "onByDefault": False}
        effects.append({"_id": eid, "_key": f"!items.effects!{doc['_id']}.{eid}", "name": label, "img": "icons/svg/aura.svg",
                        "type": "base", "system": {}, "changes": changes, "disabled": disabled, "transfer": True, "origin": None,
                        "duration": {}, "description": "", "statuses": [], "tint": "#ffffff", "sort": 0,
                        "flags": {"cyberpunk-red-core": {"changes": {"cats": cats, "situational": sits}}}})
        EFFECT_NOTES.append(f"{type_:11} {label}: " + ", ".join(f"{c['key'].split('.')[-2 if c['key'].startswith('system') else -1]} {c['value']}" for c in changes))
    return (USAGE[type_] if effects else None), effects


IMG = {"weapon": f"{SYS}/default/Default_Weapon.svg", "ammo": f"{SYS}/default/Default_Ammo.svg", "armor": f"{SYS}/default/Default_Armor.svg",
       "cyberware": f"{SYS}/default/Default_Cyberware.svg", "cyberdeck": f"{SYS}/default/Default_Cyberdeck.svg",
       "program": f"{SYS}/default/Default_Program.svg", "drug": f"{SYS}/drugs/stim.svg", "gear": f"{SYS}/default/Default_Gear.svg",
       "itemUpgrade": f"modules/{MOD}/assets/items/upgrades/upgrade.svg", "vehicle": f"{SYS}/vehicles/super_car.svg"}
COLORS = {"Weapons": "#ff2a6d", "Ammo & Explosives": "#ff8a1f", "Attachments & Mods": "#f3e600", "Armor & Shields": "#8fb0cc",
          "Power Armor": "#7f9cb5", "Cyberware": "#05d9e8", "Netrunning": "#39ff88", "Gear & Goods": "#d8dbec",
          "Drugs": "#ff4fd8", "Vehicles & Upgrades": "#e8813a", "Invented Tech": "#c792ff", "Iconics": "#ffd400"}


def fixup_defaults():
    # Use whichever default icons exist in the system (names checked against CPR 0.92.4).
    have = set(os.listdir(os.path.join(SYSDIR, "icons/compendium/default")))
    for t, path in list(IMG.items()):
        base = os.path.basename(path)
        if path.startswith(f"{SYS}/default/") and base not in have:
            alt = next((h for h in have if h.lower().startswith(base.lower().split(".")[0][:14])), "Default_Gear.svg" if "Default_Gear.svg" in have else sorted(have)[0])
            IMG[t] = f"{SYS}/default/{alt}"


SYSDIR = os.environ.get("CPR_SYSTEM", "")
ASSETS = f"modules/{MOD}/assets/items"
# weapon icons drawn from the system's, with badges (written to assets/items/weapons at the end)
DERIVED = {}

# ------------------------------------------------------------------ weapons
WTYPE = [("very heavy melee", "vHeavyMelee"), ("heavy melee", "heavyMelee"), ("medium melee", "medMelee"), ("light melee", "lightMelee"),
         ("martial", "martialArts"), ("very heavy pistol", "vHeavyPistol"), ("heavy pistol", "heavyPistol"), ("medium pistol", "medPistol"),
         ("heavy smg", "heavySmg"), ("smg", "smg"), ("shotgun", "shotgun"), ("assault rifle", "assaultRifle"), ("machine gun", "assaultRifle"),
         ("sniper", "sniperRifle"), ("rifle", "assaultRifle"), ("crossbow", "bow"), ("bow", "bow"), ("grenade launcher", "grenadeLauncher"),
         ("rocket", "rocketLauncher"), ("missile", "rocketLauncher"), ("flamethrower", "shotgun"), ("thrown", "thrownWeapon"),
         ("pistol", "medPistol"), ("melee", "medMelee")]
AMMO_FOR = {"medPistol": ["medPistol"], "heavyPistol": ["heavyPistol"], "vHeavyPistol": ["vHeavyPistol"], "smg": ["medPistol"],
            "heavySmg": ["heavyPistol"], "shotgun": ["shotgunShell", "shotgunSlug"], "assaultRifle": ["rifle"], "sniperRifle": ["rifle"],
            "bow": ["arrow"], "grenadeLauncher": ["grenade"], "rocketLauncher": ["rocket"]}
WIMG = {"medPistol": "mediumPistol", "heavyPistol": "heavyPistol", "vHeavyPistol": "veryHeavyPistol", "smg": "SMG", "heavySmg": "heavySMG",
        "shotgun": "Shotgun", "assaultRifle": "AssaultRifle", "sniperRifle": "SniperRifle", "bow": "Bow", "grenadeLauncher": "GrenadeLauncher",
        "rocketLauncher": "RocketLauncher", "lightMelee": "CombatKnife", "medMelee": "BaseballBat", "heavyMelee": "Sword",
        "vHeavyMelee": "Chainsaw", "thrownWeapon": "thrown_weapon", "martialArts": "unarmed"}
MELEE_SKILLS = ("Melee Weapon", "Brawling", "Martial Arts")
RANGE_ALIAS = {"Long-Barrel Pistol": "Long Barrel Pistol", "Anti-Materiel Rifle": "Anti-materiel Rifle", "Bows & Crossbows": "Bow",
               "Crossbow": "Bow", "Machine Gun": "Assault Rifle", "Shortbow": "Shortbow", "Longbow": "Longbow"}


def wimg(wtype, quality="standard", rebuild=None, iconic=False):
    """The system's icon for the weapon type and quality; with a 2070s type or as an Iconic, Neon Hub's copy with its badges."""
    base = WIMG.get(wtype)
    if not base:
        return IMG["weapon"]
    if (rebuild or iconic) and SYSDIR:
        fname = f"{base}_{quality}" + (f"_{rebuild}" if rebuild else "") + ("_iconic" if iconic else "") + ".svg"
        if fname not in DERIVED:
            svg = ICONS.derive_weapon(SYSDIR, base, quality, rebuild, iconic)
            if svg:
                DERIVED[fname] = svg
        if fname in DERIVED:
            return f"{ASSETS}/weapons/{fname}"
    if SYSDIR:
        name, _ = ICONS.system_weapon_file(SYSDIR, base, quality)
        if not name:
            name, _ = ICONS.system_weapon_file(SYSDIR, base, "standard")
        return f"{SYS}/weapons/{name}.svg" if name else IMG["weapon"]
    return f"{SYS}/weapons/{base}{'' if quality == 'standard' else '_' + quality}.svg"


TYPES_2070 = ("power", "smart", "tech")


def rebuild_of(*texts):
    """A gun's 2070s type, from its card ("Tech Rebuild" built in, or a "• TECH" class): power, smart, tech or None."""
    for t in texts:
        t = strip(t or "")
        m = re.search(r"\b(Power|Smart|Tech) Rebuild\b", t) or re.search(r"•\s*(POWER|SMART|TECH)\b", t)
        if m:
            return m.group(1).lower()
    return None


def weapon_type(cls, skill, rng):
    text = f"{cls} {rng}".lower()
    if skill in MELEE_SKILLS and "melee" not in text and skill != "Melee Weapon":
        return "martialArts" if skill == "Martial Arts" else "lightMelee"
    for k, v in WTYPE:
        if k in text:
            return v
    return "medMelee" if skill == "Melee Weapon" else "assaultRifle"


CLASS_RANGE = [("machine gun", "Machine Gun"), ("missile", "Missile Launcher"), ("rocket", "Rocket Launcher"), ("grenade launcher", "Grenade Launcher"),
               ("shotgun", "Shotgun"), ("sniper", "Sniper Rifle"), ("assault rifle", "Assault Rifle"), ("heavy smg", "SMG"), ("smg", "SMG"),
               ("crossbow", "Bow"), ("bow", "Bow"), ("pistol", "Pistol")]


def dv_table(rng, ranged, cls=""):
    if not ranged:
        return ""
    rng = strip(rng).split(" / ")[0]
    rng = RANGE_ALIAS.get(rng, rng)
    if rng in RT.SINGLE:
        return f"DV {rng}"
    low = cls.lower()
    found = next((r for k, r in CLASS_RANGE if k in low), None)
    return f"DV {found}" if found in RT.SINGLE or found == "Machine Gun" else ""


def quality_of(text):
    t = text.lower()
    return "excellent" if "excellent" in t else "poor" if "poor quality" in t or re.search(r"\bpq\b", t) else "standard"


def weapon_system(w, cls, cost, rebuild=None):
    skill = strip(w.get("skill")) or "Melee Weapon"
    ranged = skill not in MELEE_SKILLS
    wtype = weapon_type(cls, skill, w.get("range", ""))
    q = quality_of(cls)
    modes = strip(w.get("modes"))
    af = re.search(r"Autofire \([^)]*?(\d+)\)", modes)
    dmg = re.search(r"\d+d\d+", strip(w.get("damage")))
    return wtype, q, {
        "weaponSkill": skill, "weaponType": wtype, "isRanged": ranged, "quality": q,
        # Excellent Quality +1; a Smart weapon +1 to ranged Attacks with it
        "attackmod": (1 if q == "excellent" else 0) + (1 if rebuild == "smart" and ranged else 0),
        "damage": dmg.group() if dmg else "0", "rof": max(1, num(w.get("rof"), 1)), "handsReq": max(1, num(w.get("hands"), 1)),
        "magazine": {"value": 0, "max": num(w.get("capacity")) if ranged else 0, "ammoData": None},
        "ammoVariety": AMMO_FOR.get(wtype, []) if ranged else [], "usesType": "magazine",
        "fireModes": {"autoFire": int(af.group(1)) if af else 0, "suppressiveFire": "Suppressive" in modes},
        "concealable": {"concealable": strip(w.get("conceal")).lower().startswith("yes"), "isConcealed": False},
        "dvTable": dv_table(w.get("range", ""), ranged, cls), "critFailEffect": "jammed", "equipped": "owned", "usage": "equipped",
        "price": {"market": price(cost)}, "brand": "",
        "installedItems": {"allowed": True, "allowedTypes": ["itemUpgrade", "ammo"], "list": [], "slots": num(w.get("slots")), "usedSlots": 0},
        "unarmedAutomaticCalculation": True
    }


def weapon_desc(w, cls):
    rows = [("Class", cls), ("Range table", w.get("range")), ("Damage", w.get("damage")), ("Alt. fire", w.get("modes")),
            ("Built-in", w.get("attachments")), ("Mods", w.get("mods")), ("Fabrication", w.get("fab"))]
    stats = "<br>".join(f"<strong>{k}:</strong> {inline(v)}" for k, v in rows if strip(v) and strip(v) not in ("None", "—", "N/A"))
    return para(inline(w.get("special")) if strip(w.get("special")) not in ("", "None") else "", f"<em>{inline(w.get('flavor'))}</em>" if strip(w.get("flavor")) else "", stats)


CARDS = {}
# Made last, so adding them doesn't move every other item's sort
LATER = []
# What each 2070s type does, in the book's words (its Power, Smart & Tech Weapons table)
TYPE_RULES = {}


def add_card(ev, path):
    w = ev["card"]
    cls = strip(w.get("class", "")).split("//")[0].strip()
    src = strip(w.get("class", "")).split("//")[1].strip() if "//" in w.get("class", "") else ev["tag"]
    rb = rebuild_of(w.get("attachments"), w.get("class"))
    wtype, q, system = weapon_system(w, cls, w.get("cost"), rb)
    rb = rb if system["isRanged"] else None
    doc = item("weapon", w["name"], system, weapon_desc(w, cls), path, src, img=wimg(wtype, q, rb, path[0] == "Iconics"),
               flags={"weaponType2070": rb} if rb else None)
    if doc:
        CARDS[plain(w["name"]).lower()] = (w, cls)
    return doc


def add_variant(row, header, path, tag):
    name, base, cost, listing = plain(row[0]), plain(row[1]), row[2], row[3]
    key = re.sub(r"\b(generic|two-handed|one-handed)\s+", "", base.lower()).strip()
    found = CARDS.get(base.lower()) or CARDS.get(key) or next((v for k, v in CARDS.items() if base.lower() in k), None)
    if not found:
        NOTES.append(f"variant without a base card: {name} (based on {base})")
        return item("gear", name, gear_sys(cost), para(inline(listing), f"<strong>Based on:</strong> {inline(base)}"), path, tag=tag)
    w, cls = found
    q = quality_of(listing)
    cls2 = re.sub(r"(Excellent|Poor) Quality ", "", cls)
    cls2 = (f"{q.title()} Quality " if q != "standard" else "") + cls2
    rb = rebuild_of(listing, w.get("attachments"), w.get("class"))
    wtype, q, system = weapon_system(w, cls2, cost, rb)
    rb = rb if system["isRanged"] else None
    desc = para(inline(listing), f"<strong>Based on:</strong> {inline(base)}", f"<strong>{inline(header[2])}:</strong> {inline(cost)}")
    return item("weapon", name, system, desc, path, tag=tag, img=wimg(wtype, q, rb, path[0] == "Iconics"), flags={"weaponType2070": rb} if rb else None)


def add_generic(ev, path):
    h = ev["header"]
    melee = h[1] == "Examples"
    for r in ev["rows"]:
        name = plain(r[0])
        for q, col in (("poor", "Poor"), ("standard", "Standard"), ("excellent", "Excellent")):
            c = r[h.index(col)]
            if melee:
                w = {"skill": "Melee Weapon", "damage": r[2], "rof": r[3], "hands": "1" if "Light" in name or "Medium" in name else "2",
                     "conceal": r[4], "range": "", "capacity": "0", "slots": "3"}
            else:
                w = {"skill": r[1], "damage": r[2], "capacity": r[3], "rof": r[4], "hands": r[5], "conceal": r[6], "range": r[10], "slots": "3",
                     "modes": "Autofire, Suppressive Fire" if "SMG" in name or "Assault" in name else ""}
            cls = ("" if q == "standard" else f"{q.title()} Quality ") + name
            wtype, qq, system = weapon_system(w, cls, c)
            nm = name if q == "standard" else f"{name} ({q.title()})"
            ex = f"<strong>Examples:</strong> {inline(r[1])}" if melee else ""
            item("weapon", nm, system, para(ex, f"<strong>Generic weapon</strong> ({q} quality)."), path, tag=ev["tag"], img=wimg(wtype, qq))
            if q == "standard":
                CARDS.setdefault(name.lower(), (w, cls))
            if melee:
                continue
            # A generic gun is Power, Smart or Tech, picked when it's bought, free (Tech doesn't fit Grenade and Rocket Launchers).
            for t in TYPES_2070:
                if t == "tech" and wtype in ("grenadeLauncher", "rocketLauncher"):
                    continue
                wtype, qq, system = weapon_system(w, f"{cls} • {t.upper()}", c, t)
                tn = t.title()
                rule = TYPE_RULES.get(t, "")
                LATER.append(lambda name=name, q=q, tn=tn, rule=rule, ex=ex, system=system, wtype=wtype, qq=qq, t=t: item("weapon", f"{name} ({tn})" if q == "standard" else f"{name} ({q.title()}, {tn})", system,
                     para(ex, f"<strong>Generic {tn} weapon</strong> ({q} quality): the type is built in, at no extra cost, and takes no slots.",
                          f"<strong>{tn}:</strong> {rule}" if rule else ""),
                     path + (f"{tn} Weapons",), tag=ev["tag"], img=wimg(wtype, qq, t), flags={"weaponType2070": t}))


# ------------------------------------------------------------------ ammo
VARIETY_WORDS = [("arrow", ["arrow"]), ("bullet", ["medPistol", "heavyPistol", "vHeavyPistol", "rifle"]), ("slug", ["shotgunSlug"]),
                 ("shell", ["shotgunShell"]), ("grenade", ["grenade"]), ("rocket", ["rocket"]), ("modball", ["paintball"])]
ALL_VARIETIES = ["arrow", "medPistol", "heavyPistol", "vHeavyPistol", "rifle", "shotgunSlug", "shotgunShell", "grenade", "rocket"]
VLABEL = {"arrow": "Arrow", "medPistol": "Medium Pistol", "heavyPistol": "Heavy Pistol", "vHeavyPistol": "Very Heavy Pistol", "rifle": "Rifle",
          "shotgunSlug": "Shotgun Slug", "shotgunShell": "Shotgun Shell", "grenade": "Grenade", "rocket": "Rocket", "paintball": "ModBall"}
ATYPE = [("armor-piercing", "armorPiercing"), ("biotoxin", "biotoxin"), ("emp", "emp"), ("hyper expansive", "expansive"), ("expansive", "expansive"),
         ("flashbang", "flashbang"), ("incendiary", "incendiary"), ("poison", "poison"), ("rubber", "rubber"), ("sleep", "sleep"),
         ("smart", "smart"), ("smoke", "smoke"), ("teargas", "teargas"), ("acid", "acid")]


def ammo_varieties(name, effect):
    first = effect.split(".")[0].lower()
    if "modball" in name.lower() or "modball gun" in first:
        return ["paintball"]
    if first.startswith("all types"):
        v = list(ALL_VARIETIES)
        if "except" in first:
            for word, vs in VARIETY_WORDS:
                if word in first.split("except", 1)[1]:
                    v = [x for x in v if x not in vs]
        return v
    out = []
    for word, vs in VARIETY_WORDS:
        if re.search(rf"\b{word}s?\b", first):
            out += [x for x in vs if x not in out]
    return out


def add_ammo(row, path, tag):
    name, cost, effect = plain(row[0]), row[1], row[2]
    src = row[3] if len(row) > 3 else ""
    vs = ammo_varieties(name, effect)
    if not vs:
        return item("gear", name, gear_sys(cost), para(inline(effect), f"<strong>Cost:</strong> {inline(cost)}"), path, src, tag)
    atype = next((v for k, v in ATYPE if k in name.lower()), "basic")
    per_ten = "/10" in cost or "for 10" in cost
    grenade_price = re.search(r"([\d,]+)eb per grenade", cost)
    for v in vs:
        p = price(cost)
        amount = 10 if per_ten and v not in ("grenade", "rocket") else 1
        if v in ("grenade", "rocket") and grenade_price:
            p = int(grenade_price.group(1).replace(",", ""))
        nm = name if len(vs) == 1 else f"{name} ({VLABEL[v]})"
        system = {"variety": v, "type": atype, "amount": amount, "price": {"market": p}, "ablationValue": 2 if atype == "armorPiercing" else 1,
                  "concealable": {"concealable": True, "isConcealed": False},
                  "overrides": {"autofire": {"minimum": 0, "mode": "none", "value": 0}, "damage": {"minimum": "", "mode": "none", "value": ""}}}
        item("ammo", nm, system, para(inline(effect), f"<strong>Cost:</strong> {inline(cost)}" + (" (price per 10)" if amount == 10 else "")), path, src, tag)


# ------------------------------------------------------------------ upgrades, gear, armor
def gear_sys(cost, **kw):
    return {"price": {"market": price(cost)}, "amount": 1, "equipped": "owned", "usage": "carried", "brand": "",
            "concealable": {"concealable": False, "isConcealed": False}, "isElectronic": False, **kw}


def upgrade(name, utype, cost, slots, desc, path, src="", tag=""):
    system = {"type": utype, "size": max(0, num(slots)) if re.search(r"\d", str(slots or "")) else 0, "price": {"market": price(cost)},
              "installLocation": "mall", "brand": "", "concealable": {"concealable": False, "isConcealed": False}, "isElectronic": False}
    return item("itemUpgrade", name, system, desc, path, src, tag)


def rowdict(header, row):
    return {h: row[i] if i < len(row) else "" for i, h in enumerate(header)}


def fields_html(d, skip=()):
    return "<br>".join(f"<strong>{inline(k)}:</strong> {inline(v)}" for k, v in d.items() if k not in skip and strip(v) not in ("", "—", "N/A"))


KIND_SP = [("heavy metalgear", 19, 4), ("light metalgear", 16, 3), ("metalgear", 18, 4), ("flak", 15, 4), ("heavy armorjack", 13, 2),
           ("medium armorjack", 12, 2), ("light armorjack", 11, 0), ("bodyweight", 11, 0), ("kevlar", 7, 0), ("leathers", 4, 0)]
HEAD_WORDS = re.compile(r"helmet|mask|kabuto|optics platform|\bhat\b|helm\b|head armor", re.I)


def add_armor(row, header, path, tag):
    d = rowdict(header, row)
    name = plain(d[header[0]])
    notes = d.get("Notes") or d.get("Effect") or ""
    cost = d.get("Cost") or d.get("Category") or ""
    if re.search(r"\bshield\b", name, re.I) and re.search(r"(\d+)\s*HP", notes):
        return add_shield([name, cost, re.search(r"(\d+)\s*HP", notes).group(1), notes], ["Gun Shield", "Cost", "HP", "Effect"], path, tag)
    name = re.sub(r"\s*\(Body / Head\)", "", name)
    body = re.search(r"(?:Body\s*)?SP\s?(\d+)", notes)
    head = re.search(r"Head SP\s?(\d+)", notes)
    pen = re.search(r"[−-](\d)\s+(?:armor )?penalty|penalty\s+[−-](\d)|[−-](\d) REF", notes, re.I)
    penalty = next((int(g) for g in (pen.groups() if pen else []) if g), 0)
    sp_b = int(body.group(1)) if body else 0
    if not sp_b:
        kind = next((k for k in KIND_SP if k[0] in notes.lower()), None)
        if kind:
            sp_b, penalty = kind[1], penalty or kind[2]
    if not sp_b and not head:
        return item("gear", name, gear_sys(cost), para(inline(notes), f"<strong>Cost:</strong> {inline(cost)}"), ("Armor & Shields", "Armor Gear"), d.get("Source", ""), tag)
    sp_h = int(head.group(1)) if head else sp_b
    if HEAD_WORDS.search(f"{name} {notes.split('.')[0]}") and not head:
        head, sp_h = True, sp_b
    only_head = bool(head) and not re.search(r"\bBody\b", notes)
    desc = para(inline(notes), f"<strong>Cost:</strong> {inline(cost)}") 
    base = {"price": {"market": price(cost)}, "penalty": penalty, "equipped": "owned", "usage": "equipped", "brand": "", "isShield": False,
            "shieldHitPoints": {"value": 0, "max": 0}, "concealable": {"concealable": False, "isConcealed": False}, "isElectronic": False,
            "installedItems": {"allowed": True, "allowedTypes": ["itemUpgrade"], "list": [], "slots": 3, "usedSlots": 0}}
    out = []
    if not only_head:
        out.append(item("armor", f"{name} (Body)" if not head else name, {**base, "isBodyLocation": True, "isHeadLocation": bool(head) and "head and body" in notes.lower(),
                                                                          "bodyLocation": {"sp": sp_b, "ablation": 0}, "headLocation": {"sp": sp_h if head else 0, "ablation": 0}},
                        desc, path, d.get("Source", ""), tag))
    if not head and sp_b and "body only" not in notes.lower():
        out.append(item("armor", f"{name} (Head)", {**base, "isBodyLocation": False, "isHeadLocation": True, "bodyLocation": {"sp": 0, "ablation": 0},
                                                     "headLocation": {"sp": sp_b, "ablation": 0}}, desc, path, d.get("Source", ""), tag))
    elif only_head:
        out.append(item("armor", name, {**base, "isBodyLocation": False, "isHeadLocation": True, "bodyLocation": {"sp": 0, "ablation": 0},
                                         "headLocation": {"sp": sp_h, "ablation": 0}}, desc, path, d.get("Source", ""), tag))
    return out


def add_shield(row, header, path, tag):
    d = rowdict(header, row)
    hp = num(d.get("HP"))
    system = {"price": {"market": price(d.get("Cost"))}, "isShield": True, "isBodyLocation": False, "isHeadLocation": False, "penalty": 0,
              "shieldHitPoints": {"value": hp, "max": hp}, "bodyLocation": {"sp": 0, "ablation": 0}, "headLocation": {"sp": 0, "ablation": 0},
              "equipped": "owned", "usage": "equipped", "brand": "", "concealable": {"concealable": False, "isConcealed": False}}
    return item("armor", d[header[0]], system, para(inline(d.get("Effect"))), path, tag=tag, img=f"{SYS}/armor/bullet_proof_shield.svg")


# ------------------------------------------------------------------ cyberware
CYBER_TYPE = {"Fashionware": "fashionware", "Neuralware & Chipware": "neuralWare", "Cyberoptics": "cyberEye", "Cyberaudio": "cyberAudioSuite",
              "Internal Body Cyberware": "cyberwareInternal", "External Body Cyberware": "cyberwareExternal", "Cyberlimbs & Options": "cyberArm",
              "Dynalar Cyberfingers": "cyberArm", "Borgware": "borgware"}


def hl(s):
    s = strip(s)
    m = re.match(r"(\d+)\s*\(([^)]+)\)", s)
    if m:
        return {"static": int(m.group(1)), "roll": m.group(2).replace(" ", "")}
    n = num(s, 0)
    return {"static": n, "roll": "0" if n == 0 else ""}


def install_of(s):
    s = strip(s).lower()
    return "hospital" if "hospital" in s else "clinic" if "clinic" in s else "mall" if "mall" in s else "notApplicable"


def guess_cyber_type(name, effect, default):
    t = f"{name} {effect}".lower()
    if default == "cyberArm" and re.search(r"cyberleg|\bfoot\b|\bleg option|\bankle", t) and "cyberarm" not in t.split(".")[0]:
        return "cyberLeg"
    if default != "cyberwareInternal":
        return default
    for k, v in (("cyberarm", "cyberArm"), ("cyberleg", "cyberLeg"), ("cybereye", "cyberEye"), ("cyberaudio", "cyberAudioSuite"),
                 ("neuralware", "neuralWare"), ("borgware", "borgware"), ("fashionware", "fashionware"), ("external", "cyberwareExternal")):
        if k in t.split(".")[0]:
            return v
    return default


def cyber(name, ctype, install, cost, hlv, slots, effect, path, src="", tag="", extra=None):
    slots = strip(slots)
    gives = re.search(r"gives\s+(\d+)", slots)
    foundational = bool(gives) or effect.lower().startswith("foundation")
    system = {"type": ctype, "installLocation": install, "humanityLoss": hlv, "isFoundational": foundational,
              "size": 0 if foundational else max(0, num(slots, 1) if re.search(r"\d", slots) else 1),
              "price": {"market": price(cost)}, "usage": "installed", "brand": "", "core": False, "isWeapon": False, "isElectronic": True,
              "concealable": {"concealable": False, "isConcealed": False}, "providesHardening": False,
              "installedItems": {"allowed": foundational, "allowedTypes": ["cyberware"] if foundational else ["itemUpgrade"], "list": [],
                                 "slots": int(gives.group(1)) if gives else 0, "usedSlots": 0}}
    if extra:
        system.update(extra)
    return item("cyberware", name, system, para(inline(effect), f"<strong>Install:</strong> {inline(install.title())} • <strong>HL:</strong> {hlv['static']}{' (' + hlv['roll'] + ')' if hlv['roll'] not in ('', '0') else ''}"), path, src, tag)


# ------------------------------------------------------------------ netrunning
def program(name, pclass, cost, desc, path, tag, size=1, stats=None, ice=None):
    system = {"class": pclass, "size": size, "price": {"market": price(cost)}, "installLocation": "mall", "isRezzed": False, "usage": "toggled",
              "atk": 0, "def": 0, "rez": 0, "per": 0, "spd": 0, "interface": 0, "damage": {"standard": "1d6", "blackIce": "1d6"}}
    if stats:
        system.update(stats)
    if ice:
        system["blackIceType"] = ice
    return item("program", name, system, desc, path, tag=tag, img=f"{SYS}/default/Default_Program.svg")


def deck(name, slots, cost, desc, path, tag, quality="standard"):
    system = {"price": {"market": price(cost)}, "quality": quality, "size": 1, "installLocation": "mall", "equipped": "owned", "isElectronic": True,
              "installedItems": {"allowed": True, "allowedTypes": ["itemUpgrade", "program"], "list": [], "slots": slots, "usedSlots": 0},
              "concealable": {"concealable": False, "isConcealed": False}, "brand": ""}
    return item("cyberdeck", name, system, desc, path, tag=tag, img=f"{SYS}/default/Default_Cyberdeck.svg")


def split_versions(name, *cols):
    """'Cyberdeck (Poor / Standard / Excellent)' with '100eb / 500eb / 1,000eb' -> one tuple per version."""
    m = re.match(r"(.+?)\s*\(([^)]*/[^)]*)\)\s*$", plain(name))
    if not m:
        return [(plain(name), None) + tuple(cols)]
    base, versions = m.group(1), [v.strip() for v in m.group(2).split("/")]
    out = []
    for i, v in enumerate(versions):
        vals = []
        for c in cols:
            parts = [p.strip() for p in str(c).split("/")]
            vals.append(parts[i] if len(parts) == len(versions) else c)
        out.append((f"{base} ({v})" if v.lower() != "standard" else base, v.lower()) + tuple(vals))
    return out


# ------------------------------------------------------------------ vehicles and actors
def vehicle_kind(group, notes):
    t = notes.lower()
    if group == "Air Vehicles" or re.search(r"aerodyne|aerozep|gyrocopter|helicopter|\bav-\d", t):
        return "air"
    if group == "Sea Vehicles" or re.search(r"boat|yacht|jetski|ship|hydrofoil|submarine", t):
        return "sea"
    return "land"


def vehicle_img(kind, notes):
    t = notes.lower()
    if kind == "air":
        return f"{SYS}/vehicles/{'blimp' if 'zep' in t else 'helicopter' if 'gyro' in t or 'heli' in t else 'airplane'}.svg"
    if kind == "sea":
        return f"{SYS}/vehicles/{'speed_boat' if re.search(r'speedboat|jetski|boat', t) else 'ship'}.svg"
    if re.search(r"\bbike\b|roadbike|superbike|motorcycle|trike|scooter", t):
        return f"{SYS}/vehicles/motorbike.svg"
    return f"{SYS}/vehicles/super_car.svg"


def seat(pid, name, n, skills, weapons=False, control=False, glass=0):
    return {"id": pid, "name": name, "builtIn": False, "maxOccupants": max(1, n), "canControlWeapons": weapons, "bulletproofGlass": bool(glass),
            "glassHpMax": glass, "glassHp": glass, "skills": skills, "statMods": "", "matchVehicleMove": False, "matchOccupantMove": False,
            "grantsTokenControl": control, "occupants": []}


def seats_for(vid, kind, seats, notes, bike):
    glass = 30 if re.search(r"bulletproof glass\s*(?:\[x2\]|×2|x2)", notes, re.I) else 15 if "bulletproof glass" in notes.lower() else 0
    if bike:
        glass = 0
    drive = {"air": ("Cockpit", "Pilot Air Vehicle, Air Vehicle Tech, Evasion"), "sea": ("Helm", "Pilot Sea Vehicle, Sea Vehicle Tech, Evasion"),
             "land": ("Driver's Seat", "Drive Land Vehicle, Land Vehicle Tech, Evasion")}[kind]
    out = [seat(rid("pos", vid, "drive"), drive[0], 1, drive[1], weapons=True, control=True, glass=glass)]
    left = max(0, seats - 1)
    if re.search(r"onboard|turret|rocket pod|machine gun|harpoon|weapon mount with", notes, re.I) and left:
        out.append(seat(rid("pos", vid, "gunner"), "Gunner", 1, "Heavy Weapons, Autofire, Evasion", weapons=True, glass=glass))
        left -= 1
    if left:
        out.append(seat(rid("pos", vid, "front"), "Co-Pilot" if kind == "air" else "Passenger Seat", 1,
                        drive[1] if kind == "air" else "Evasion", weapons=kind == "air", glass=glass))
        left -= 1
    if left:
        out.append(seat(rid("pos", vid, "back"), "Cabin" if kind != "land" else "Back Seat", left, "Evasion", glass=glass))
    return out


def actor(name, img, system, items, path, flags, token=None):
    aid = rid("actor", name.lower())
    embedded = []
    for it in items:
        e = json.loads(json.dumps(it))
        e["_id"] = e.pop("_embedId", None) or rid("embed", aid, it["_id"], len(embedded))
        e["_key"] = f"!actors.items!{aid}.{e['_id']}"
        for fx in e.get("effects", []):
            fx["_key"] = f"!actors.items.effects!{aid}.{e['_id']}.{fx['_id']}"
        e.pop("folder", None)
        e.pop("sort", None)
        embedded.append(e)
    doc = {"_id": aid, "_key": f"!actors!{aid}", "name": name, "type": "mook", "img": img, "folder": folder("rides-2070", path),
           "system": system, "items": embedded, "effects": [],
           "prototypeToken": {"name": name, "actorLink": True, "texture": {"src": img}, "width": 1, "height": 1, "disposition": 0,
                              "displayName": 20, "displayBars": 20, "bar1": {"attribute": "derivedStats.hp"}, **(token or {})},
           "flags": {**MIGRATION, **flags}, "ownership": {"default": 0}}
    ACTORS[aid] = doc
    return doc


VAS = "mmutons-cyberpunk-red-vas"


def armor_plate(name, sp):
    return {"_id": rid("plate", name, sp), "name": f"{name} Armor (SP{sp})", "type": "armor", "img": f"{SYS}/armor/flak_body.svg",
            "system": {"bodyLocation": {"sp": sp, "ablation": 0}, "headLocation": {"sp": sp, "ablation": 0}, "isBodyLocation": True,
                       "isHeadLocation": True, "penalty": 0, "equipped": "equipped", "usage": "equipped", "price": {"market": 0},
                       "description": {"value": "<p>The vehicle's or suit's own armor. Ablates like any armor.</p>"}},
            "effects": [], "flags": MIGRATION}


def add_vehicle(row, header, group, path, tag):
    d = rowdict(header, row)
    name = plain(d[header[0]])
    notes = d.get("Type, upgrades & notes", d.get("Notes", ""))
    sdp, sp, seats, move = num(d.get("SDP")), num(d.get("SP")), max(1, num(d.get("Seats"), 1)), num(d.get("MOVE"))
    kind = vehicle_kind(group, notes)
    bike = bool(re.search(r"\bbike|motorcycle|trike|scooter|bicycle", f"{name} {notes}", re.I)) and kind == "land"
    img = f"{SYS}/spinning_your_wheels/bicycle.svg" if "Bicycle" in name else vehicle_img(kind, notes)
    desc = para(inline(notes), fields_html({"Cost": d.get("Cost"), "Nomad": d.get("Nomad"), "SDP": d.get("SDP"), "SP": d.get("SP"), "Seats": d.get("Seats"),
                                            "MOVE": d.get("MOVE"), "Speed": d.get("Speed")}))
    vi = item("vehicle", name, {"sdp": sdp, "seats": seats, "speedCombat": move, "speedNarrative": strip(d.get("Speed")), "price": {"market": price(d.get("Cost"))},
                                "brand": "", "concealable": {"concealable": False, "isConcealed": False},
                                "installedItems": {"allowed": True, "allowedTypes": ["itemUpgrade"], "list": [], "slots": 3, "usedSlots": 0}},
              desc, ("Vehicles & Upgrades", "Vehicles (for character sheets)", group or path[-1]), tag=tag, img=img)
    aid = rid("actor", name.lower())
    items = [armor_plate(name, sp)] if sp else []
    positions = seats_for(aid, kind, seats, notes, bike)
    # A gun the book names on the vehicle's mount comes mounted, on the gunner's seat if it has one.
    mount = re.search(r"Weapon Mount with an? (.+?)(?: and [\d,]+ [\w ]*rounds)?(?=[.,;]|$)", plain(notes))
    gun = find_item(mount.group(1), ("weapon",)) if mount else None
    if mount and not gun:
        NOTES.append(f"Vehicle {name}: mounted gun not in the catalog: {mount.group(1)}")
    if gun:
        e = json.loads(json.dumps(gun))
        e["flags"].setdefault(VAS, {})["mountedPosition"] = next((p["id"] for p in positions if p["name"] == "Gunner"), positions[0]["id"])
        e["system"]["equipped"] = "equipped"
        items.append(e)
    actor(name, img, {"stats": {"move": {"value": move}}, "derivedStats": {"hp": {"value": sdp, "max": sdp}},
                      "information": {"description": desc + source_html("Vehicles"), "alias": "", "history": "", "notes": ""}},
          items, path, {"core": {"sheetClass": f"{VAS}.VehicleSheet"}, VAS: {"positions": positions},
                        MOD: {"vehicle2070": {"kind": kind, "seats": seats, "nomad": strip(d.get("Nomad")), "cost": strip(d.get("Cost"))}}},
          token={"width": 1 if bike or kind == "land" and sdp < 60 else 2, "height": 1 if bike or kind == "land" and sdp < 60 else 2})
    return vi


def norm(s):
    return re.sub(r"\s*/\s*", "/", s.lower()).strip()


ALIASES = {"integrated techscanner": "techscanner (arm)", "techtronika russia bmg-570": "techtronika bmg-570"}
# The book's Range Table Modification: which table each barrel, tube, choke or limb puts a weapon on.
RTM = {"pistol": {"snub barrel": "Snubnose Pistol", "long barrel": "Long Barrel Pistol"}, "smg": {"short barrel": "Subcompact SMG"},
       "shotgun": {"short barrel": "Short Barrel Shotgun", "choke": "Long Barrel Shotgun"},
       "rifle": {"carbine barrel": "Carbine", "battle barrel": "Battle Rifle", "marksman barrel": "Marksman Rifle"},
       "sniper": {"scout barrel": "Scout Rifle", "long barrel": "Anti-materiel Rifle"}, "bow": {"short limbs": "Shortbow", "long limbs": "Longbow"},
       "launcher": {"short tube": "Grenade Launcher", "standard tube": "Rocket Launcher", "long tube": "Missile Launcher"}}
FAMILY = {"medPistol": "pistol", "heavyPistol": "pistol", "vHeavyPistol": "pistol", "smg": "smg", "heavySmg": "smg", "shotgun": "shotgun",
          "assaultRifle": "rifle", "sniperRifle": "sniper", "bow": "bow", "grenadeLauncher": "launcher", "rocketLauncher": "launcher"}


def range_mod(name, weapon):
    """The table a barrel/tube/limbs attachment puts this weapon on, or None if it isn't one."""
    n = re.sub(r"^(?:SMG|Sniper Rifle|Sniper|Shotgun|Pistol|Rocket|Grenade|Assault Rifle|Bow)\s+", "", plain(name)).lower()
    return RTM.get(FAMILY.get(weapon["system"]["weaponType"], ""), {}).get(n)


def find_item(name, types=("weapon", "cyberware")):
    n = plain(re.sub(r"^TUp \([^)]*\)\s*", "", name))
    n = re.sub(r"\s*\((?:Machine Pistol|SMG|Assault Rifle) \d\)$", "", n)
    n = ALIASES.get(n.lower(), ALIASES.get(re.sub(r"\s*\((?:Silver|Gold)\)$", "", n).lower(), n))
    n = re.sub(r"\s+w/.*$", "", n)
    n = re.sub(r"\s*\((?:Silver|Gold|x\d|×\d|[^)]*Welder)\)$", "", n).strip()
    n = re.sub(r"\s*×\d+$", "", n).strip()
    n = re.sub(r"^EQ ", "", n)
    for t in types:
        for (tt, k), v in ITEMS.items():
            if tt == t and norm(k) == norm(n):
                return v
    for t in types:
        if (t, n.lower()) in ITEMS:
            return ITEMS[(t, n.lower())]
    for t in types:
        for (tt, k), v in ITEMS.items():
            if tt == t and (norm(k).startswith(norm(n)) or norm(n) in norm(k)) and len(n) > 5:
                return v
    return None


def add_acpa(m, flavor, path):
    name, cost, stats, frame, weapons, cyberware = m[:6]
    hp, sp = num(re.search(r"(\d+)\s*HP", stats).group(1)), num(re.search(r"(\d+)\s*SP", stats).group(1))
    body = re.search(r"BODY\s*(\d+)", stats)
    aid = rid("actor", name.lower())
    pilot = seat(rid("pos", aid, "pilot"), "Pilot", 1, "Evasion, Athletics, Brawling, Melee Weapon, Heavy Weapons", weapons=True, control=True)
    items = [armor_plate(name, sp)]
    missing = []

    def embed(it):
        e = json.loads(json.dumps(it))
        e["_embedId"] = rid("embed", aid, it["_id"], len(items))
        items.append(e)
        return e

    def fit(gun, part):
        """Fit an attachment into a gun: CPR's installed list and slots, and a barrel's new range table."""
        table = range_mod(part, gun)
        up = ITEMS.get(("itemUpgrade", "range table modification")) if table else find_item(part, ("itemUpgrade",))
        if not up:
            return False
        e = embed(up)
        e["system"]["equipped"] = "owned"
        gun["system"]["installedItems"]["list"].append(e["_embedId"])
        gun["system"]["installedItems"]["usedSlots"] += e["system"].get("size", 0)
        # Onboard fits are the suit maker's: the gun takes them whatever its catalog slots say.
        gun["system"]["installedItems"]["slots"] = max(gun["system"]["installedItems"]["slots"], gun["system"]["installedItems"]["usedSlots"])
        if table:
            gun["system"]["dvTable"] = f"DV {table}"
            e["name"] = f"{e['name']} ({plain(part)})"
        return True

    gun = None
    for w in [x.strip() for x in re.split(r",\s*(?![^()]*\))", weapons) if x.strip()]:
        count = re.search(r"\s*×(\d+)$", w)
        w = w[:count.start()] if count else w
        base, _, parts = w.partition(" w/ ")
        it = find_item(base, ("weapon",))
        if it:
            for _ in range(int(count.group(1)) if count else 1):
                gun = embed(it)
                gun["flags"].setdefault(VAS, {})["mountedPosition"] = pilot["id"]
                gun["system"]["equipped"] = "equipped"
                for part in [x for x in re.split(r"\s*&\s*", parts) if x]:
                    if not fit(gun, part):
                        missing.append(part)
        elif gun and all(range_mod(x, gun) or find_item(x, ("itemUpgrade",)) for x in re.split(r"\s*&\s*", w)):
            for part in re.split(r"\s*&\s*", w):  # more of the last gun's attachments, after a comma
                fit(gun, part)
        else:
            missing.append(w)
    chrome = []
    for c in [x.strip() for x in re.split(r",\s*(?![^()]*\))", cyberware) if x.strip()]:
        it = find_item(c, ("cyberware",))
        if it:
            e = embed(it)
            e["flags"].setdefault(VAS, {})["installed"] = True
            chrome.append(e["_embedId"])
        else:
            missing.append(c)
    if missing:
        NOTES.append(f"ACPA {name}: not in the catalog, listed in the description only: {', '.join(missing)}")
    desc = para(f"<em>{inline(flavor)}</em>", fields_html({"Cost": cost, "Frame / Shell": frame, "Stats": stats, "Onboard weapons": weapons,
                                                          "Onboard cyberware": cyberware}),
                "One pilot. The suit's stats modify the pilot's; see the Item Compendium, Power Armor.")
    actor(name, f"{SYS}/default/Default_Armor.svg",
          {"stats": {"body": {"value": int(body.group(1)) if body else 0}}, "derivedStats": {"hp": {"value": hp, "max": hp}},
           "installedItems": {"allowed": True, "allowedTypes": ["cyberware"], "list": chrome},
           "information": {"description": desc + source_html("Power Armor"), "alias": "", "history": "", "notes": ""}},
          items, path, {"core": {"sheetClass": f"{VAS}.VehicleSheet"}, VAS: {"positions": [pilot]}, MOD: {"acpa2070": {"cost": cost, "frame": frame}}})


STATS = ["int", "ref", "dex", "tech", "cool", "will", "move", "body", "emp"]


def add_pet(p, path):
    stats = {k.lower(): int(v) for k, v in re.findall(r"\b(INT|REF|DEX|TECH|COOL|WILL|MOVE|BODY|EMP)\s+(\d+)", p["stats"])}
    system = {"stats": {k: {"value": stats.get(k, 0)} for k in STATS}, "derivedStats": {"hp": {"value": p["hp"], "max": p["hp"]}},
              "information": {"description": para(f"<em>{inline(p.get('line', ''))}</em>",
                                                  fields_html({"Cost": p["cost"], "Lifestyle": p.get("life"), "Cyberware slots": p.get("slots"), "Threat": p.get("level"),
                                                               "Death Save": p.get("ds"), "Seriously Wounded": p.get("sw"), "Attacks": p.get("weapons"),
                                                               "Armor": p.get("armor"), "Skills": p.get("skills"), "Cyberware": p.get("cyber"), "Notes": p.get("notes")}))
                              + source_html("Cyberpets"), "alias": "", "history": "", "notes": ""}}
    actor(p["name"], f"{SYS}/default/Default_CPR_Mystery_Man.svg", system, [], path, {MOD: {"pet2070": {"cost": p["cost"]}}})


# ------------------------------------------------------------------ DV tables
TABLES = []


def dv_tables():
    bands = [tuple(int(x) for x in b.split("-")) for b in RT.BANDS]
    abands = [tuple(int(x) for x in b.split("-")) for b in RT.AUTO_BANDS]
    defs = [(f"DV {k}", bands, v, "Single shot") for k, v in RT.SINGLE.items()]
    auto_names = {"Machine Pistol": "DV Pistol (Autofire, Machine Pistol)", "SMGs": "DV SMG (Autofire)", "Assault Rifle": "DV Assault Rifle (Autofire)",
                  "Machine Gun": "DV Machine Gun (Autofire)"}
    defs += [(auto_names[k], abands, v, "Autofire") for k, v in RT.AUTOFIRE.items()]
    defs += [("DV Machine Gun", bands, RT.SINGLE["Assault Rifle"], "Single shot (fires on the Assault Rifle table)")]
    # CPR's own table names, so the system's weapons still find a table: the 2070 rules' values for each.
    defs += [("DV Bows & Crossbows", bands, RT.SINGLE["Bow"], "Single shot (the Bow table)"),
             ("DV Long-Barrel Pistol", bands, RT.SINGLE["Long Barrel Pistol"], "Single shot (the Long Barrel Pistol table)"),
             ("DV Shotgun (Slug)", bands, RT.SINGLE["Shotgun"], "Single shot (the Shotgun table)"),
             ("DV Thrown Weapon", bands, [16, 15, 15, None, None, None, None, None], "Thrown (Core Rules, Chapter 07: DV16 to 6m, DV15 to 25m)"),
             ("DV Generic", bands, [""] * len(bands), "Blank: set the DVs at the table")]
    for name, bs, dvs, kind in defs:
        tid = rid("table", name)
        results = []
        for (lo, hi), dv in zip(bs, dvs):
            if dv is None:
                continue
            res_id = rid("result", name, lo)
            results.append({"_id": res_id, "_key": f"!tables.results!{tid}.{res_id}", "type": "text", "text": str(dv), "range": [lo, hi],
                            "weight": 1, "drawn": False, "img": "icons/svg/d20-black.svg", "documentCollection": "", "documentId": None, "flags": {}})
        TABLES.append({"_id": tid, "_key": f"!tables!{tid}", "name": name, "img": f"{SYS}/default/Default_DV_Table.svg" if SYSDIR and os.path.exists(os.path.join(SYSDIR, "icons/compendium/default/Default_DV_Table.svg")) else "icons/svg/d20-grey.svg",
                       "description": f"<p>{kind}, by distance in m/yds. The 2070 Standard range tables (Core Rules (2070), Chapter 07).</p>",
                       "formula": "", "replacement": True, "displayRoll": False, "results": results, "folder": None, "sort": len(TABLES) * 100,
                       "ownership": {"default": 0}, "flags": {}})


# ------------------------------------------------------------------ routing
SKIP_SECTIONS = {"Fashion", "Full Body Conversions", "Services", "Vehicle Classes", "Building an Architecture", "Paydata"}
SKIP_HEADERS = {"Category", "Band", "Autofire", "Type", "d100", "Weapon type", "Style", "Tuning", "Below STAB", "Heat", "Class", "Floors",
                "Password / File / Node", "Demon", "1d6"}
CH = {"Weapons": "Weapons", "Ammo, Attachments, Mods & Explosives": None, "Armor & Fashion": "Armor & Shields", "Power Armor": "Power Armor",
      "Cyberware": "Cyberware", "Netrunning Gear": "Netrunning", "Gear & Goods": "Gear & Goods", "Vehicles": "Vehicles & Upgrades",
      "Invented Tech Upgrades": "Invented Tech", "Iconics": "Iconics"}


def route(ev):
    chapter, h1 = ev["chapter"], ev["h1"]
    if chapter.startswith("Living") or chapter.startswith("Using") or h1 in SKIP_SECTIONS:
        return
    tag = ev["tag"]
    if ev["kind"] == "card":
        if chapter == "Cyberware":
            w = ev["card"]
            cls = strip(w.get("class", "")).split("//")[0].strip()
            wtype, q, ws = weapon_system(w, cls, w.get("cost"))
            ws.pop("equipped", None)
            ws.pop("usage", None)
            ws.pop("installedItems", None)
            cyber(w["name"], "cyberArm", "hospital", w.get("cost"), {"static": 7, "roll": "2d6"}, "0, gives 4",
                  f"Foundation. {strip(w.get('special'))}", ("Cyberware", h1), tag=tag, extra={**ws, "isWeapon": True})
            return
        top = "Iconics" if chapter == "Iconics" else "Vehicles & Upgrades" if chapter == "Vehicles" else "Gear & Goods" if chapter == "Gear & Goods" else "Weapons"
        add_card(ev, (top, h1 or "Other"))
        return
    header, rows = ev["header"], ev["rows"]
    h0 = header[0]
    if h0 in SKIP_HEADERS or (h0 == "Item" and header[1:3] == ["Cost", "Details"]):
        return
    if h0 == "Rebuild" and "Fits" in header:
        for r in rows:
            d = rowdict(header, r)
            upgrade(d["Rebuild"], "weapon", d["Cost"], 0, para(inline(d["Effect"]), fields_html(d, ("Rebuild", "Effect"))), ("Attachments & Mods", "Melee Rebuilds"), tag=tag)
        return
    if h0 == "Weapon" and "Skill" in header or h0 == "Weapon" and "Examples" in header:
        add_generic(ev, ("Weapons", "Generic Weapons"))
        return
    if h0 == "Variant":
        top = "Iconics" if chapter == "Iconics" else "Weapons"
        for r in rows:
            add_variant(r, header, (top, ev["h3"] or h1, ) if chapter != "Iconics" else (top, h1), tag)
        return
    if h0 == "Ammo":
        for r in rows:
            add_ammo(r, ("Ammo & Explosives", "Ammunition"), tag)
        return
    if h0 in ("Attachment", "Attachment Mod", "Weapon Mod", "Upgrade") and chapter.startswith("Ammo"):
        sub = "Weapon Mods" if h1 == "Weapon Mods" else "Attachments"
        for r in rows:
            d = rowdict(header, r)
            cost = d.get("Cost") or d.get("Materials", "")
            upgrade(d[h0], "weapon", cost, d.get("Slots", 0), para(inline(d.get("Effect")), fields_html(d, (h0, "Effect", "Slots", "Source"))),
                    ("Attachments & Mods", sub), d.get("Source", ""), tag)
        return
    if h0 == "Item" and h1 == "Explosives & Special Grenades":
        for r in rows:
            d = rowdict(header, r)
            if "grenade" in d["Item"].lower():
                p = price(d["Cost"])
                item("ammo", d["Item"], {"variety": "grenade", "type": next((v for k, v in ATYPE if k in d["Item"].lower()), "basic"), "amount": 1,
                                         "price": {"market": p}, "ablationValue": 1, "concealable": {"concealable": True, "isConcealed": False}},
                     para(inline(d["Effect"])), ("Ammo & Explosives", "Explosives & Grenades"), d.get("Source", ""), tag)
            else:
                item("gear", d["Item"], gear_sys(d["Cost"]), para(inline(d["Effect"])), ("Ammo & Explosives", "Explosives & Grenades"), d.get("Source", ""), tag)
        return
    if h0 == "Armor":
        for r in rows:
            add_armor(r, header, ("Iconics", "Iconic Armor") if chapter == "Iconics" else ("Armor & Shields", "Body & Head Armor"), tag)
        return
    if h0 == "Upgrade" and "Where" in header:
        for r in rows:
            d = rowdict(header, r)
            upgrade(d["Upgrade"], "armor", d["Cost"], 1, para(inline(d["Effect"]), fields_html(d, ("Upgrade", "Effect", "Cost"))), ("Armor & Shields", "Armor Upgrades"), tag=tag)
        return
    if h0 in ("Enhancement", "Shield Attachment") and "Slots" in header:
        for r in rows:
            d = rowdict(header, r)
            upgrade(d[h0], "armor", d["Cost"], d["Slots"], para(inline(d["Effect"])), ("Armor & Shields", "Armor Enhancements" if h0 == "Enhancement" else "Shields"), tag=tag)
        return
    if h0 == "Gun Shield":
        for r in rows:
            add_shield(r, header, ("Armor & Shields", "Shields"), tag)
        return
    if h0 in ("Frame", "Shell") and chapter == "Power Armor":
        for r in rows:
            d = rowdict(header, r)
            item("gear", f"ACPA {h0}: {plain(d[h0])}", gear_sys(d["Cost"]), para(fields_html(d, (h0,)), "A part for building an ACPA (Item Compendium, Power Armor)."),
                 ("Power Armor", "Frames & Shells"), tag=tag)
        return
    if h0 == "Cyberware":
        ctype = CYBER_TYPE.get(h1)
        for r in rows:
            d = rowdict(header, r)
            name = d["Cyberware"]
            effect = d.get("Effect", "")
            if chapter == "Iconics":
                hlcol = d.get("HL", "")
                hlv = hl(hlcol.split("•")[0])
                inst = install_of(hlcol)
                cyber(name, guess_cyber_type(name, effect, "cyberwareInternal"), inst, d.get("Category • Fabrication", ""), hlv, "1",
                      f"{effect} **Category • Fabrication:** {d.get('Category • Fabrication', '')}", ("Iconics", "Iconic Cyberware"), tag=tag)
            else:
                cyber(name, guess_cyber_type(name, effect, ctype), install_of(d.get("Install")), d.get("Cost"), hl(d.get("HL")), d.get("Slots", "1"),
                      effect, ("Cyberware", h1), d.get("Source", ""), tag)
        return
    if h0 in ("Enhancement", "Operating System") and chapter == "Cyberware":
        for r in rows:
            d = rowdict(header, r)
            upgrade(d[h0], "cyberware", d["Cost"], 0, para(inline(d["Effect"]), fields_html(d, (h0, "Effect", "Cost"))),
                    ("Cyberware", "Enhancements" if h0 == "Enhancement" else "Operating Systems"), tag=tag)
        return
    if h0 == "Frame" and "Maker" in header:
        for r in rows:
            d = rowdict(header, r)
            cyber(d["Frame"], "borgware", "hospital", "", {"static": 14, "roll": "4d6"}, "0", f"{d['Effect']} **Maker:** {d['Maker']}. **Type:** {d['Type']}. Price on request.",
                  ("Cyberware", "Linear Frames"), tag=tag)
        return
    if h0 == "Frame" and chapter == "Gear & Goods":
        for r in rows:
            d = rowdict(header, r)
            item("gear", d["Frame"], gear_sys(d["Cost"]), para(inline(d["Effect"]), f"<strong>Cost:</strong> {inline(d['Cost'])}"), ("Gear & Goods", h1), tag=tag)
        return
    if h0 == "Rig":
        for r in rows:
            d = rowdict(header, r)
            item("gear", d["Rig"], gear_sys(d["Cost"], isElectronic=True), para(inline(d["Notes"]), fields_html(d, ("Rig", "Notes"))), ("Netrunning", h1), tag=tag)
        return
    if h0 == "Deck":
        for r in rows:
            d = rowdict(header, r)
            rules = REWORDED.get(plain(d["Deck"]), d.get("Rules") or d.get("Effect", ""))
            cost = d.get("Cost") or d.get("Category • Fabrication", "")
            slots = d.get("Slots", "")
            for name, q, s, c in split_versions(d["Deck"], slots, cost):
                n_slots = num(s) or num(re.search(r"(\d+) slots", rules).group(1)) if (num(s) or re.search(r"(\d+) slots", rules)) else 7
                deck(name, n_slots, c, para(inline(rules), fields_html({"Slots": s, "Cost": c})), ("Iconics", "Iconic Cyberdecks") if chapter == "Iconics" else ("Netrunning", h1), tag,
                     q if q in ("poor", "standard", "excellent") else "standard")
        return
    if h0 == "Cybersuite":
        for r in rows:
            d = rowdict(header, r)
            cyber(d["Cybersuite"], "neuralWare", "hospital", d["Cost"], {"static": 7, "roll": "2d6"}, "1",
                  f"{d['Perk']} **Built-in quickhacks:** {d['Built-in quickhacks']}. Takes 1 Neural Link slot; needs a Neuroport.", ("Netrunning", "Cybersuites"), tag=tag)
        return
    if h0 == "Hardware":
        for r in rows:
            d = rowdict(header, r)
            upgrade(d["Hardware"], "cyberdeck", d["Cost"], d["Slots"] if re.search(r"\d", d["Slots"]) else 1, para(inline(d["Effect"])), ("Netrunning", "Hardware"), tag=tag)
        return
    if h0 == "Quickhack":
        vehicle = "Type" not in header
        for r in rows:
            d = rowdict(header, r)
            quiet = "◆" in d["Quickhack"]
            name = plain(d["Quickhack"]) + (" (Vehicle Quickhack)" if vehicle and ("program", plain(d["Quickhack"]).lower()) in ITEMS else "")
            effect = QH_TEXT.get(plain(d["Quickhack"]).lower(), "")
            program(name, "booster", d["Cost"], para(inline(effect), fields_html({k: v for k, v in d.items() if k not in ("Quickhack", "Cost")}),
                                                     "<strong>Quiet</strong> (◆): keeps a Ghost run hidden." if quiet else ""),
                    ("Netrunning", "Vehicle Quickhacks" if vehicle else "Quickhacks"), tag, size=max(1, num(d.get("Slots"), 1)))
        return
    if h0 == "Program":
        for r in rows:
            d = rowdict(header, r)
            cls = d["Class"].lower()
            pclass = "booster" if "booster" in cls else "defender" if "defender" in cls else "antipersonnelattacker" if "personnel" in cls else "antiprogramattacker"
            program(d["Program"], pclass, d["Cost"], para(inline(d["Effect"]), fields_html({"Class": d["Class"]})), ("Netrunning", "Programs"), tag,
                    stats={"atk": num(d["ATK"]), "def": num(d["DEF"]), "rez": num(d["REZ"])})
        return
    if h0 == "ICE":
        for r in rows:
            d = rowdict(header, r)
            ice = "antipersonnel" if "personnel" in d["Class"].lower() else "antiprogram" if "program" in d["Class"].lower() else "other"
            program(d["ICE"], "blackice", d["Cost"], para(inline(d["Effect"]), fields_html({"Class": d["Class"]})), ("Netrunning", "Black ICE"), tag, size=2,
                    stats={k.lower(): num(d[k]) for k in ("PER", "SPD", "ATK", "DEF", "REZ")}, ice=ice)
        return
    if h0 == "App":
        for r in rows:
            d = rowdict(header, r)
            item("gear", d["App"], gear_sys(d["Cost"], isElectronic=True), para(inline(d["Effect"]), fields_html({"Publisher": d["Publisher"], "Cost": d["Cost"]})),
                 ("Gear & Goods", "Holophone Apps"), tag=tag)
        return
    if h0 == "Drone":
        for r in rows:
            d = rowdict(header, r)
            item("gear", d["Drone"], gear_sys(d["Cost"], isElectronic=True), para(inline(d.get("Profile") or d.get("Type & loadout", "")), fields_html(d, ("Drone", "Profile", "Type & loadout"))),
                 ("Gear & Goods", "Drones"), tag=tag)
        return
    if h0 == "Drug":
        for r in rows:
            d = rowdict(header, r)
            cost = d.get("Cost") or d.get("Category • Fabrication", "")
            system = {"price": {"market": price(cost)}, "amount": 1, "equipped": "owned", "usage": "toggled", "consumed": "None", "brand": "",
                      "concealable": {"concealable": True, "isConcealed": False}}
            item("drug", d["Drug"], system, para(inline(d["Effect"]), f"<strong>Cost:</strong> {inline(cost)}"),
                 ("Iconics", "Iconic Drugs") if chapter == "Iconics" else ("Drugs", "Drugs"), d.get("Source", ""), tag)
        return
    if h0 == "System":
        for r in rows:
            d = rowdict(header, r)
            item("gear", d["System"], gear_sys("", isElectronic=True), para(inline(d["Description"]), fields_html(d, ("System", "Description"))), ("Gear & Goods", "Security Systems"), tag=tag)
        return
    if h0 == "Vehicle":
        group = None
        for r in rows:
            if r[0].startswith("**") and all(not strip(x) for x in r[1:]):
                group = plain(r[0])
                continue
            path = ("Iconic Vehicles",) if chapter == "Iconics" else ((group or "Vehicles"),)
            add_vehicle(r, header, group, path, tag)
        return
    if h0 == "Bicycle":
        for r in rows:
            add_vehicle(r, header, "Land Vehicles", ("Bicycles",), tag)
        return
    if h0 in ("Upgrade", "Vehicle ICE", "Bicycle Upgrade") and chapter == "Vehicles":
        for r in rows:
            d = rowdict(header, r)
            cost = d.get("Cost / Moto") or d.get("Cost", "")
            upgrade(d[h0], "vehicle", cost, 0, para(inline(d["Effect"]), fields_html(d, (h0, "Effect"))),
                    ("Vehicles & Upgrades", {"Upgrade": "Vehicle Upgrades", "Vehicle ICE": "Vehicle ICE", "Bicycle Upgrade": "Bicycle Upgrades"}[h0]), tag=tag)
        return
    if h0 == "Skates & Boards":
        for r in rows:
            d = rowdict(header, r)
            item("gear", d[h0], gear_sys(d["Cost"]), para(inline(d["Effect"])), ("Vehicles & Upgrades", "Skates & Boards"), tag=tag)
        return
    if h0 == "Upgrade" and "Cost #2" in header:
        for r in rows:
            d = rowdict(header, r)
            item("gear", d["Upgrade"], gear_sys(d["Cost #2"]), para(inline(d["Effect"]), fields_html(d, ("Upgrade", "Effect")),
                                                                    f"An invented Tech Upgrade by {html.escape(ev['h2'] or ev['h3'] or 'a Night City Tech')}."),
                 ("Invented Tech", "Night City Techs"), tag=tag)
        return
    if h0 == "Heat" and "Upgrade" in header:
        heat_cost = {"mild": 100, "medium": 500, "hot": 1000, "extra hot": 5000, "diablo": 10000}
        for r in rows:
            d = rowdict(header, r)
            item("gear", d["Upgrade"], gear_sys(f"{heat_cost.get(plain(d['Heat']).lower(), 0)}eb"), para(inline(d["Effect"]), fields_html(d, ("Upgrade", "Effect"))),
                 ("Invented Tech", "Street Stock"), tag=tag)
        return
    if h0 == "Mod" and chapter == "Iconics":
        for r in rows:
            d = rowdict(header, r)
            upgrade(d["Mod"], "weapon", d["Category"], 0, para(inline(d["Effect"]), fields_html(d, ("Mod", "Effect"))), ("Iconics", "Iconic Weapon Mods"), tag=tag)
        return
    if h0 in ("Item", "Frame") or "Cost" in header:
        top = CH.get(chapter) or "Gear & Goods"
        sub = h1 if chapter != "Iconics" else h1
        effect_col = next((h for h in ("Effect", "Notes", "Profile") if h in header), header[-1])
        for r in rows:
            d = rowdict(header, r)
            name = d[h0]
            item("gear", name, gear_sys(d.get("Cost", "")), para(inline(d.get(effect_col, "")), f"<strong>Cost:</strong> {inline(d.get('Cost', ''))}" if d.get("Cost") else ""),
                 (top, sub), d.get("Source", ""), tag)
        return
    NOTES.append(f"unrouted table: {chapter} / {h1} / {header}")


QH_TEXT = {}

# Entries the book still prints in Corgo's own words: Neon Hub's rewording (stats and mechanics unchanged).
REWORDED = {
    "Militech Canto Mk.6": (
        "An Iconic Cyberdeck: 8 Program slots and 2 Hardware slots, and it only works installed in a Cybersuite. Once in, it stays in for a "
        "month, unless you pay 5,000eb and spend a week in a Hospital having it taken out. While you run it you get +1 NET Action every Turn, "
        "and you can take more than your limit: each NET Action past it costs 2 Humanity. It gives you the Blackwall Gateway quickhack. Now and "
        "then, while you use it, you hear voices from the far side of the Blackwall. Play that. "
        "**Blackwall Gateway** (DV 10, +2 per extra target, max 14): choose up to 2 more targets within 20 m/yds of the first. One roll covers all "
        "three; the second is hit the Round after the first, the third the Round after that. It works however many Passwalls you've Breached. "
        "**Every attempt, hit or miss, costs you 1d6 Humanity and 1d6 HP.** A target it hits takes 6d6 straight to HP (no ablation) and 1d6 "
        "Humanity Loss, loses 1d6 MOVE for 3 Rounds, and suffers Short Circuit; a double 6 also gives them Brain Injury (no Bonus Damage). "
        "Seriously Wounded: 8d6, −2d6 MOVE and Prone. Mortally Wounded: also an immediate Death Save at +10 Death Save Penalty."),
    "NetWatch Netdriver Mk.1": (
        "An Iconic Cyberdeck: 14 slots for Programs or Hardware, and it only works installed in a Cybersuite. When you Jack In, you can activate "
        "one non-Black ICE Program or use one Interface Ability without spending a NET Action. While you run it you get +1 NET Action every Turn. "
        "Quickhacks and Programs that deal damage roll 1d6 extra and drop the lowest die, and their durations, if any, are doubled."),
}


def capacity_attachments():
    raw = open(os.path.join(BOOK, "out", "compendium_markup.txt"), encoding="utf-8").read()
    chart = re.search(r"title=Capacity Chart[^\n]*\n((?:\|[^\n]*\n)+)", raw)
    prices = re.search(r"^Capacity attachments: (.+)$", raw, re.M)
    if not (chart and prices):
        NOTES.append("Capacity attachments: chart or prices not found")
        return
    rows = [[c.strip() for c in l.strip().strip("|").split("|")] for l in chart.group(1).strip().split("\n")]
    header, rows = rows[0], rows[1:]
    for m in re.finditer(r"\*\*(.+?)\*\* ([\d,]+eb(?: \([^)]*\))?), (\d+) slots?", prices.group(1)):
        name, cost, slots = m.group(1), m.group(2), m.group(3)
        col = next(i for i, h in enumerate(header) if h.split()[0].lower() in name.lower())
        adds = ", ".join(f"{r[0]} {r[col]}" for r in rows)
        upgrade(name, "weapon", cost, slots,
                para(f"A capacity attachment: it adds rounds to the weapon's base capacity, by weapon type: {adds}.",
                     "One capacity attachment per weapon. Crossbows can take one too; a loaded crossbow magazine holds one arrow type "
                     "(you can still hand-load another with a free hand)."), ("Attachments & Mods", "Attachments"))


def main():
    global SYSDIR
    import src_quickhacks as QH
    for q in QH.QUICKHACKS:
        QH_TEXT[q[0].lower()] = q[-1]
    for q in QH.VEHICLE_HACKS:
        QH_TEXT.setdefault(q[0].lower(), q[-1])
    fixup_defaults() if SYSDIR else None
    load_elsewhere()
    events = read_markup()
    for ev in events:
        if ev["kind"] == "table" and ev["header"][:3] == ["Type", "Fits", "What it does"]:
            for r in ev["rows"]:
                TYPE_RULES[plain(r[0]).lower()] = inline(r[2])
    # Cards first, so variants and ACPAs can find their base weapons.
    for ev in events:
        if ev["kind"] == "card":
            route(ev)
    for ev in events:
        if ev["kind"] == "table":
            route(ev)
    for pkg in EXO.EXOTIC_PACKAGES:
        name, cost, hlv, size, includes, flavor = pkg[:6]
        item("gear", name, gear_sys(cost), para(f"<em>{inline(flavor)}</em>", fields_html({"Package": size, "Humanity Loss": hlv, "Includes": includes}),
                                               "Install the pieces it includes as cyberware; the package price covers them all."),
             ("Cyberware", "Exotic Packages"), tag="DLC: Exotics of 2045 • HOUSE RULE (2070 editions)")
    capacity_attachments()
    flavor = dict(HOUSE.ACPA_FLAVOR)
    for m in sorted(HOUSE.CORGO_ACPAS, key=lambda m: m[0].lower()):
        add_acpa(m, flavor.get(m[0], ""), ("ACPAs",))
    for p in PETS.PETS:
        add_pet(p, ("Cyberpets",))
    dv_tables()
    for make in LATER:
        make()


def write(pack, docs, folders):
    d = os.path.join(ROOT, "packs/_source", pack)
    if os.path.isdir(d):
        shutil.rmtree(d)
    os.makedirs(d)
    for f in folders:
        json.dump(f, open(os.path.join(d, f"folder_{re.sub(r'[^a-z0-9]+', '-', f['name'].lower()).strip('-')}_{f['_id']}.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    for doc in docs:
        slug = re.sub(r"[^a-z0-9]+", "-", doc["name"].lower()).strip("-")[:60]
        json.dump(doc, open(os.path.join(d, f"{doc.get('type', 'table')}_{slug}_{doc['_id']}.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False)


if __name__ == "__main__":
    SYSDIR = os.environ.get("CPR_SYSTEM", "")
    main()
    used = {d["folder"] for d in ITEMS.values()} | {d["folder"] for d in ACTORS.values()}
    # keep every ancestor of a used folder
    byid = {f["_id"]: f for f in FOLDERS.values()}
    keep = set()
    for fid in used:
        while fid:
            keep.add(fid)
            fid = byid[fid]["folder"]
    write("items-2070", list(ITEMS.values()), [f for k, f in FOLDERS.items() if k[0] == "items-2070" and f["_id"] in keep])
    write("rides-2070", list(ACTORS.values()), [f for k, f in FOLDERS.items() if k[0] == "rides-2070" and f["_id"] in keep])
    write("dv-tables-2070", TABLES, [])
    if SYSDIR:
        ICONS.write_upgrade_icons(os.path.join(ROOT, "assets/items/upgrades"))
        wdir = os.path.join(ROOT, "assets/items/weapons")
        if os.path.isdir(wdir):
            shutil.rmtree(wdir)
        os.makedirs(wdir)
        for fname, svg in sorted(DERIVED.items()):
            open(os.path.join(wdir, fname), "w", encoding="utf-8").write(svg)
        open(os.path.join(wdir, "LICENSE.md"), "w", encoding="utf-8").write(ICONS.WEAPON_LICENSE)
    import collections
    print("items:", len(ITEMS), dict(collections.Counter(d["type"] for d in ITEMS.values())))
    open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "effects_report.txt"), "w").write("\n".join(sorted(EFFECT_NOTES)))
    print("effects:", len(EFFECT_NOTES))
    print("actors:", len(ACTORS), "tables:", len(TABLES), "dupes:", len(DUPES), "already in Neon Hub:", len(SKIPPED))
    for n in NOTES:
        print("NOTE", n)
