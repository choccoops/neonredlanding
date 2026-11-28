"""Builds Neon Hub's Mook Pack (packs/_source/mooks-2070): Corgo's 77 Collection mook stat blocks as CPR mook actors.

Run: CPR_SYSTEM=<cyberpunk-red-core src> python3 -I -B tools/gen/mooks2070.py <Neon Hub root> <book source dir>
It runs the item generator in memory first (without rewriting its packs), so a mook's guns, armor and chrome are the same
items Neon Hub's Item Compendium ships. Reads tools/gen/data/mooks.json (the numbers, from parse_mooks.py) and
data/mook_text.json (our own descriptions); portraits are assets/art/mooks/<slug>.webp.

How a stat block becomes an actor:
- Mook layout: REF = INIT, COOL and MOVE as printed, BODY = Death Save; every other STAT is 0, so a Skill's level carries
  its whole printed base. Full layout (the named bosses): all ten STATs as printed, each Skill's level is its base less
  its STAT.
- COM# is the base of every attack Skill the block doesn't list itself.
- Printed numbers win: a weapon's damage and ROF are the block's, whatever the catalog item says.
- What has no item (a "GM's Choice" weapon, Self-ICE, Enforcer abilities, bracketed Skill values) goes in the notes.
A compendium actor gets none of what CPRActor.create gives a new one, so each carries the 63 core Skills and the three
core cyberware containers itself.
"""
import functools, html, glob, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import items2070 as G  # reads <root> <book> from sys.argv itself
import fullborg2070 as FBM  # lookup(), copy()
import yaml

ROOT = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
PACK = "mooks-2070"
ART = f"modules/{G.MOD}/assets/art/mooks"
SOURCE = "Corgo's 77 Collection: Mooks"
PREFIX = {"Tyger Claws": "Tyger Claw", "Lazarus Group": "Lazarus", "Generics": "", "Mercs": ""}
FACTION_NAMES = {"Ncpd": "NCPD", "Nusa": "NUSA", "Max-Tac": "MAX-TAC", "Netwatch": "NetWatch"}
CORE_ROLES = {"Solo", "Netrunner", "Nomad", "Tech", "Fixer", "Medtech", "Media", "Lawman", "Exec", "Rockerboy"}
ATTACK = {"Archery", "Autofire", "Brawling", "Handgun", "Heavy Weapons", "Melee Weapon", "Shoulder Arms"}
EXTRA_SKILLS = {"Medical Tech": ("tech", "techniqueSkills"), "Paramedic": ("tech", "techniqueSkills"), "Surgery": ("tech", "techniqueSkills")}
NOTES = []
FOLDERS = {}


def folder(name):
    if name not in FOLDERS:
        fid = G.rid("mook-folder", name)
        FOLDERS[name] = {"_id": fid, "_key": f"!folders!{fid}", "name": name, "type": "Actor", "folder": None, "sorting": "a",
                         "sort": len(FOLDERS) * 100, "color": None, "description": "", "flags": {}}
    return FOLDERS[name]["_id"]


def load_yaml(pattern):
    return [yaml.safe_load(open(f, encoding="utf-8")) for f in sorted(glob.glob(pattern))]


def item_from_yaml(d):
    return {"name": d["name"], "type": d["type"], "img": d["img"], "system": d["system"], "effects": [], "flags": dict(G.MIGRATION)}


def esc(s):
    return G.inline(s)


TYPOS = [(r"\bBlace Lace\b", "Black Lace"), (r"\bBlace\b", "Lace"), (r"\bGradted\b", "Grafted"), (r"\bCyberye\b", "Cybereye"), (r"\bBahammer\b", "Banhammer"),
         (r"\bKereznikov\b", "Kerenzikov"), (r"Low-Light", "Low Light"), (r"\s*&\s*", " and "), (r"^Cyberlegs\b", "Cyberleg")]
NAMES = {"malorian overture": "Malorian Arms Overture", "militech ajax": "Militech M251s Ajax", "constitutional arms tactician":
         "Constitutional Arms M2038 Tactician", "m2038 tactician": "Constitutional Arms M2038 Tactician", "bigwave foxtail": "Tsunami Arms Kyubi",
         "mantis blades": "Mantis Blade", "custom monoblade mantis blades": "Mantis Blade", "higurashi 20-13 mantis blade": "Higurashi 20-13 Mantis Blades",
         "dual higurashi blades": "Higurashi 20-13 Mantis Blades", "spring-loaded dual mantis blades": "Mantis Blade", "skate feet": "Skate Foot",
         "grip feet": "Grip Foot", "interface plug": "Interface Plugs", "medical-grade cyberarm": "Medical Grade Cyberarm", "bounce back": "Bounce-Back",
         "kendachi mono-wakizashi": "Kendachi M-35 Mono-Wakizashi", "improved smart shotgun slugs": "Improved Smart Ammunition (Shotgun Slug)",
         "kiroshi t.o.p.": "Kiroshi Tactical Optics Platform", "kiroshi a.t.o.p.": "Kiroshi Tactical Optics Platform", "max-helm": "Gibson Battlegear Max-Helm",
         "max-vest": "Gibson Battlegear Max-Vest (body)", "nightstalker ballistic mask": "'Nightstalker' Ballistic Mask",
         "smoke grenade": "Grenade (Smoke)", "flashbang": "Grenade (Flashbang)", "emp grenade": "Grenade (EMP)", "improved emp grenade": "Improved EMP Ammunition",
         "external 'wolfpack' linear frame": "Wolfpack Linear Frame", "internal linear frame sigma": "Implanted Linear Frame ∑ (Sigma)",
         "implanted linear frame sigma": "Implanted Linear Frame ∑ (Sigma)", "businesswear fashion": "Businesswear", "fleshweave": "Sycust FleshWeave",
         "heavy subdermal": "Heavy Subdermal Plating", "sycust fleshweave": "Sycust FleshWeave", "fang": "Fang (Kurt Hansen’s Knife)",
         "'kagami' neo-kabuto": 'Arasaka "Kagami" Neo-Kabuto', "m-98a3 helmet": "M-98A3 Enhanced Combat Helmet",
         "m-98a3 advanced combat helmet": "M-98A3 Enhanced Combat Helmet",
         # the 2070 book's Cybersuite replaces the CEMK port; a Trauma Team "Cryobag" is the Cryopump and its bag (CP:R p.212)
         "neuroport cyberdeck port": "Cybersuite", "cryobag": "Cryopump", "trauma team atlus av-4": "Trauma Team Atlus",
         "exotic bodysculpt": "Exotic Bodysculpting"}
DECKS = {"eq cyberdeck": "Cyberdeck (Excellent)", "pq cyberdeck": "Cyberdeck (Poor)", "cyberdeck": "Cyberdeck"}
# Neon Hub's picks for the netrunners, whose blocks say only "Cyberdeck": a deck from the Item Compendium at the block's price
# (500eb for a Cyberdeck, 1,000eb for an EQ one; NetWatch's Special Agent gets the agency's Iconic), filled with quickhacks that
# suit the faction and that the mook's Interface can land. By slug.
NETRUNNERS = {
    "arasaka-netrunner": ("Arasaka Shadow Mk.5", ["Ping", "Weapon Glitch", "Reboot Optics", "Overheat", "Cyberware Malfunction"]),
    "netwatch-officer": ("Microtech Warrior", ["Scannerz", "Comms Jam", "Impair Movement", "Sonic Shock", "Weapon Glitch", "Short Circuit", "Q-KRASH"]),
    "netwatch-special-agent": ("NetWatch Netdriver Mk.1", ["Scannerz", "Ping", "Q-KRASH", "Poison Pointers", "Speedware Crash", "Cyberware Malfunction",
                                                           "Short Circuit", "Reboot Optics", "Slow", "Synapse Burnout", "Frame Lock", "System Reset"]),
    "scavengers-spider": ("Microtech Hydra", ["Scannerz", "Cripple Movement", "Limb Seize", "Reboot Optics", "Overheat"]),
    "tyger-claws-jonin": ("Kirama Advanced Deck", ["PopUp-geddon", "Sonic Shock", "Impair Movement", "Weapon Glitch", "Overheat"]),
    "voodoo-boys-netrunner": ("Microtech Scout", ["Ping", "Reboot Optics", "Overheat", "Contagion", "Synapse Burnout"]),
    "voodoo-boys-manbo": ("Raven Mk.3 Viral", ["Ping", "Contagion", "Synapse Burnout", "Cyberware Malfunction", "System Reset"]),
}
# a block's ride by class, as the nearest model in Neon Hub's vehicles: (model, what to add to it)
RIDES = {"roadbike (w/ smuggling upgrade)": ('Brennan Apollo "Harriet"', ""), "roadbike (w/ nos & smuggling upgrade)": ('Brennan Apollo "Harriet"', "add NOS"),
         "trauma team atlus av-4": ("Trauma Team Atlus", "")}
# a maker's own model of a standard piece the catalog doesn't list ("Arasaka Corpochrome Cyberarm"): the standard piece, under its name
CHROME_BASE = re.compile(r"\b(Cyberarm|Cyberleg|Cybereye|Cyberaudio Suite)$")
# a block's armor by the name the catalog sells its head and body pieces under
ARMOR_NAMES = {"kevlar": "Kevlar®", "leather": "Leathers", "heavy flak": "Heavy Flak Armor", "flak armor": "Flak", "hybrid flak": "Hybrid Flak Armor",
               "executive armor": "Torrell and Chiang Executive Armor", "max-vest": "Gibson Battlegear Max-Vest", "'kagami' neo-kabuto": 'Arasaka "Kagami" Neo-Kabuto', "metalgear": "Metalgear®",
               "light metalgear": "Light Metalgear®", "heavy metalgear": "Heavy Metalgear®", "hybrid metalgear": "Hybrid Metalgear®"}
# a plain class word the catalog's nearest name would wrongly claim (a "Katana" is not the Arasaka Murasame)
GENERIC_WEAPONS = {"katana"}
OUTFITS = {"businesswear": ("Jacket", "Top", "Bottoms", "Footwear"), "businesswear fashion": ("Jacket", "Top", "Bottoms", "Footwear")}
MA_FORMS = {"mct": "Militech Commando", "militech commando training": "Militech Commando"}
SQUASH = lambda x: re.sub(r"[^a-z0-9]", "", (x or "").lower())
# robot limbs and the like, which no word in melee_icon covers
BLUNT = re.compile(r"steamroller|crusher|crane|\bleg$|hydraulic leg|stomp", re.I)


def weapon_icon(e, quality):
    """The icon a weapon's name and quality call for: Neon Hub's badged copy if the item generator made one, else the system's."""
    s, name = e["system"], e["name"]
    wtype = s.get("weaponType")
    base = (G.melee_icon(name) or ("Sledgehammer" if BLUNT.search(name) else None)) if wtype in G.MELEE_TYPES else None
    base = base or G.WIMG.get(wtype)
    if not base:
        return None
    rb = e.get("flags", {}).get(G.MOD, {}).get("weaponType2070")
    iconic = "_iconic" in e.get("img", "")
    if rb or iconic:
        fname = f"{base}_{quality}" + (f"_{rb}" if rb else "") + ("_iconic" if iconic else "") + ".svg"
        if os.path.exists(os.path.join(ROOT, "assets/items/weapons", fname)):
            return f"modules/{G.MOD}/assets/items/weapons/{fname}"
    f, _ = G.ICONS.system_weapon_file(G.SYSDIR, base, quality)
    if not f:
        f, _ = G.ICONS.system_weapon_file(G.SYSDIR, base, "standard")
    return f"{G.SYS}/weapons/{f}.svg" if f else None
AMMO = re.compile(r"^(.*?)\s*(Very Heavy Pistol|Heavy Pistol|Medium Pistol|Heavy SMG|SMG|Rifle|Machine Gun|Shotgun Slugs?|Shotgun|Grenade)?\s*(?:Ammunition|Ammo|Grenade)s?$", re.I)
CALIBER = {"heavy smg": "Heavy Pistol", "smg": "Medium Pistol", "machine gun": "Rifle", "shotgun": "Shotgun Shell", "shotgun slug": "Shotgun Slug",
           "shotgun slugs": "Shotgun Slug", "grenade": "Grenade"}


@functools.lru_cache(maxsize=None)
def find(name, types):
    """Neon Hub's catalog first (each type in turn), then Cyberpunk RED's own core items."""
    n = name.strip()
    n = NAMES.get(n.lower()) or n.strip("'\"")
    for a, b in TYPOS:
        n = re.sub(a, b, n)
    n = NAMES.get(n.lower(), n)
    tries = [n]
    m = AMMO.match(n)
    if m and ("ammo" in types) and re.search(r"Ammo|Ammunition|Grenade", n):
        kind, cal = m.group(1).strip(), (m.group(2) or "").strip()
        if re.search(r"Grenade$", n) and not cal:
            cal = "Grenade"
        cal = CALIBER.get(cal.lower(), cal)
        tries += [f"{kind} Ammunition ({cal})" if cal else f"{kind} Ammunition", f"{kind} Ammunition"]
        if cal == "Grenade":
            tries.insert(1, f"Grenade ({kind})")
    if "ammo" in types and any(x.startswith("Grenade (") for x in tries):
        types = ("ammo",) + tuple(t for t in types if t != "ammo")  # "Grenade" alone would fuzzy-match the Popup Grenade Launcher
    for t in types:
        for x in tries:
            it = FBM.lookup(x, (t,))
            if it:
                return it
    for t in types:
        for x in tries:
            it = CORE_ITEMS.get((t, x.lower()))
            if it:
                return it
    if m and "ammo" in types and kind and not cal:  # no caliber given: any of that kind (fit_ammo then picks the mook's guns')
        key = SQUASH(f"{kind} Ammunition")
        return next((v for (t, k), v in G.ITEMS.items() if t == "ammo" and "(" in k and SQUASH(k.split("(")[0]) == key), None)
    return None


class Mook:
    def __init__(self, b, text):
        self.b, self.text = b, text
        self.aid = G.rid("mook", b["slug"])
        self.items, self.installed, self.notes, self.missing = [], [], [], []
        self.gm_grenade = False
        self.pending = []
        self.choice, self.rides = [], []
        self.loaded = False

    # -------------------------------------------------------------- items
    def embed(self, doc):
        e = FBM.copy(doc)
        e["_id"] = G.rid("mook-embed", self.aid, doc.get("_id") or doc["name"], len(self.items))
        e["_key"] = f"!actors.items!{self.aid}.{e['_id']}"
        for k in ("folder", "sort", "ownership"):
            e.pop(k, None)
        e.setdefault("flags", {}).update(G.MIGRATION)
        if "installedItems" in e["system"]:
            e["system"]["installedItems"] = {**e["system"]["installedItems"], "list": [], "usedSlots": 0}
        for fx in e.get("effects", []):
            fx["_key"] = f"!actors.items.effects!{self.aid}.{e['_id']}.{fx['_id']}"
        self.items.append(e)
        return e

    def install(self, parent, child):
        ii = parent["system"]["installedItems"]
        ii["allowed"] = True
        if child["type"] not in ii["allowedTypes"]:
            ii["allowedTypes"].append(child["type"])
        ii["list"].append(child["_id"])
        ii["usedSlots"] += child["system"].get("size", 0) or 0
        ii["slots"] = max(ii["slots"], ii["usedSlots"])

    # -------------------------------------------------------------- stats & skills
    def stats(self):
        s = self.b["stats"]
        if self.b["layout"] == "full":
            st = {k: s.get(k, 0) for k in ("int", "ref", "dex", "tech", "cool", "will", "move", "body")}
            emp, empmax = s.get("emp", 0), s.get("empMax", s.get("emp", 0))
        else:
            st = {"int": 0, "ref": s.get("init", 0), "dex": 0, "tech": 0, "cool": s.get("cool", 0), "will": 0, "move": s.get("move", 0),
                  "body": self.b["ds"]}
            emp = empmax = 0
        self.stat = st
        out = {k: {"value": v} for k, v in st.items()}
        out["luck"] = {"value": 0, "max": 0}
        out["emp"] = {"value": emp, "max": empmax}
        return out

    def skills(self):
        listed = {s["name"]: s for s in self.b["skills"]}
        com = self.b["com"]
        done = set()
        for core in CORE_SKILLS:
            name, stat = core["name"], core["system"]["stat"]
            base = listed[name]["base"] if name in listed else (com if name in ATTACK and com else None)
            e = self.embed(item_from_yaml(core))
            e["system"]["level"] = max(0, base - self.stat.get(stat, 0)) if base is not None else 0
            done.add(name)
        for name, s in listed.items():
            if name in done:
                continue
            if "GM's Choice" in name:
                self.notes.append(f"{name} {s['base']} (the GM picks which)")
                continue
            ma = re.match(r"Martial Arts \((.+)\)$", name)
            doc = G.ITEMS.get(("skill", name.lower()))
            if not doc:
                if ma:
                    doc = {"name": name, "type": "skill", "img": f"{G.SYS}/weapons/martial_arts.svg",
                           "system": {"stat": "dex", "category": "fightingSkills", "difficulty": "difficult", "skillType": "martialArt",
                                      "core": False, "basic": False, "level": 0, "description": {"value": ""}}}
                elif name.startswith("Language"):
                    doc = {"name": name, "type": "skill", "img": f"{G.SYS}/default/Default_Skill.svg",
                           "system": {"stat": "int", "category": "educationSkills", "difficulty": "typical", "skillType": "language",
                                      "core": False, "basic": False, "level": 0, "description": {"value": ""}}}
                elif name.startswith("Local Expert"):
                    doc = {"name": name, "type": "skill", "img": f"{G.SYS}/default/Default_Skill.svg",
                           "system": {"stat": "int", "category": "educationSkills", "difficulty": "typical", "skillType": "generic",
                                      "core": False, "basic": False, "level": 0, "description": {"value": ""}}}
                elif name in EXTRA_SKILLS:
                    stat, cat = EXTRA_SKILLS[name]
                    doc = {"name": name, "type": "skill", "img": f"{G.SYS}/default/Default_Skill.svg",
                           "system": {"stat": stat, "category": cat, "difficulty": "typical", "skillType": "generic", "core": False, "basic": False,
                                      "level": 0, "description": {"value": "<p>A role Skill (Medtech).</p>"}}}
                else:
                    NOTES.append(f"{self.b['name']}: unknown skill {name}")
                    continue
            e = self.embed(doc)
            e["system"]["level"] = max(0, s["base"] - self.stat.get(e["system"]["stat"], 0))
        brackets = [f"{s['name']} {s['base']} ({s['with']})" for s in self.b["skills"] if s["with"]]
        if brackets:
            self.notes.append("With gear or role bonuses: " + ", ".join(brackets))

    # -------------------------------------------------------------- weapons
    def martial_form(self):
        forms = [s["name"] for s in self.b["skills"] if s["name"].startswith("Martial Arts (") and "GM's" not in s["name"]]
        return forms[0] if forms else None

    def own_skill(self, name):
        """The mook's own Skill item of that name (case, 'MA', 'MCT' and a shortened form's name forgiven), or None."""
        key = SQUASH(re.sub(r"^MA\b", "Martial Arts", name or "").replace("(MCT)", "(Militech Commando Training)"))
        if not key:
            return None
        skills = [i for i in self.items if i["type"] == "skill"]
        hit = next((i for i in skills if SQUASH(i["name"]) == key), None)
        if not hit and key.startswith("martialarts"):
            hit = next((i for i in skills if SQUASH(i["name"]).startswith(key) or key.startswith(SQUASH(i["name"]))), None)
        return hit

    def finish(self, e, w, extra, quality=None):
        """The block's own numbers on the item: quality, ROF, damage, Autofire, the Skill it attacks with and its attack base."""
        s = e["system"]
        dmg = re.search(r"\d+d\d+", w.get("dmg", ""))
        af = re.search(r"Autofire \((?:[A-Za-z]+ )?(\d+)\)", w.get("dmg", ""))
        if quality and quality != s.get("quality"):
            s["attackmod"] = (s.get("attackmod") or 0) + (quality == "excellent") - (s.get("quality") == "excellent")
            s["quality"] = quality
            if e["type"] == "weapon":
                e["img"] = weapon_icon(e, quality) or e["img"]
        s["rof"] = w["rof"] or s.get("rof", 1)
        if dmg:
            s["damage"] = dmg.group()
            s["unarmedAutomaticCalculation"] = False
        if af:
            s.setdefault("fireModes", {"autoFire": 0, "suppressiveFire": False})["autoFire"] = int(af.group(1))
        m = re.match(r"(.*?)(?:\s+Base\s+(\d+))?$", (w.get("skill") or "").strip())
        own = self.own_skill(m.group(1)) or self.own_skill(s.get("weaponSkill"))
        if own:
            s["weaponSkill"] = own["name"]
            base = int(m.group(2)) if m.group(2) else (w.get("base") or 0)
            if base:  # the printed attack base wins: what the Skill and its STAT don't cover is the weapon's own modifier
                s["attackmod"] = base - self.stat.get(own["system"]["stat"], 0) - own["system"]["level"]
        else:
            NOTES.append(f"{self.b['name']}: {e['name']} attacks with {s.get('weaponSkill')!r}, a Skill the mook doesn't have")
        if e["type"] == "weapon":
            s["equipped"] = "equipped"
        if extra:
            s["description"]["value"] = f"<p><strong>{esc(self.b['name'])}:</strong> {esc('; '.join(extra))}</p>" + s["description"]["value"]

    def stand_in(self, raw, w, quality):
        """A weapon the catalog doesn't carry: its class's generic item (in its quality, where the catalog has that)."""
        dmg = re.search(r"\d+d\d+", w.get("dmg", ""))
        cls = next((c for pat, c in WEAPON_CLASSES if re.search(pat, raw, re.I)), None)
        if not cls and dmg and w["rof"] and not re.search(r"Autofire|Aimed|Shell|Slug", w.get("dmg", "")):
            cls = MELEE_BY_DAMAGE.get(dmg.group())  # a named blade the catalog doesn't carry: the melee class its damage implies
        if not cls:
            return None, None
        it = (G.ITEMS.get(("weapon", f"{cls} ({quality.title()})".lower())) if quality else None) or G.ITEMS.get(("weapon", cls.lower()))
        return it, cls

    def weapon(self, w):
        raw = w["name"]
        extra = [x for x in (w.get("notes"), w.get("ammo")) if x]
        name = re.sub(r"^OPTIONAL:\s*", "", raw)
        if "GM's" in name or "GM’s" in name:
            self.notes.append(f"Weapon: {raw} (ROF {w['rof']}, {w.get('dmg', '?')})")
            return
        m = re.match(r"(?:Braw\w*)(?: Attack)?\s*\(BODY (\d+)\)", name)
        mm = re.match(r"Martial Arts \((.+)\)$", name)
        quality = None
        if m:
            e = self.embed(item_from_yaml(UNARMED))
            e["name"] = "Brawling"
        elif mm:
            form = mm.group(1) if not mm.group(1).startswith("BODY") else (self.martial_form() or "")
            form = re.sub(r"^Martial Arts \((.+)\)$", r"\1", form)
            key = SQUASH(MA_FORMS.get(form.lower(), form))
            src = next((v for (t, k), v in G.ITEMS.items() if t == "weapon" and SQUASH(k) == f"martialarts{key}"), None) if form else None
            e = self.embed(src) if src else self.embed(item_from_yaml(UNARMED))
            if not src:
                e["name"] = f"Martial Arts ({form})" if form else "Martial Arts"
                e["img"] = f"{G.SYS}/weapons/martial_arts.svg"
                e["system"].update({"weaponType": "martialArts", "weaponSkill": e["name"] if form else "Brawling", "canIgnoreArmor": True,
                                    "ignoreArmorPercent": 50})
        else:
            count = re.search(r"\s*[\[(]?x(\d+)[\])]?", name)
            notes = re.findall(r"\[([^\]]+)\]", name)
            base = re.sub(r"\s*\[[^\]]*\]", "", name)
            base = re.sub(r"\s*\(x\d+\)|\s+x\d+\b", "", base)
            base = re.sub(r"^TUp \([^)]*\)\s*", "", base).strip()
            gloss = re.findall(r"\(([^)]*)\)", base)
            plain = re.sub(r"\s*\([^)]*\)", "", base).strip()
            q = " ".join(gloss + notes + [plain])
            quality = "poor" if re.search(r"\bPQ\b|Poor", q) else "excellent" if re.search(r"\bEQ\b|Excellent", q) else None
            wt = ("weapon", "cyberware")
            it, fake, cls = (None if SQUASH(plain) in GENERIC_WEAPONS else find(base, wt) or find(plain, wt)), False, None
            if it and it["type"] == "cyberware" and not it["system"].get("isWeapon"):
                it = None
            if not it:
                it = next((find(re.sub(r"Ironfake Variant\s*", "", n), ("weapon",)) for n in notes if "Ironfake" in n), None)
                fake = bool(it)
            if not it:
                it, cls = self.stand_in(raw, w, quality)
                if not it:
                    self.notes.append(f"Weapon: {raw} (ROF {w['rof']}, {w.get('dmg', '?')}); no catalog item")
                    self.missing.append(raw)
                    return
            extra = [g for g in gloss if g not in ("PQ", "EQ")] + notes + extra
            if count and int(count.group(1)) > 1:
                extra.append(f"×{count.group(1)}")
            if it["type"] == "cyberware":  # chrome that is a weapon: the piece in the mook's body carries the attack
                self.pending.append((it, w, extra, quality, raw))
                return
            e = self.embed(it)
            generic = cls and SQUASH(re.sub(r"^(PQ|EQ)\s+", "", plain)) in (SQUASH(cls), SQUASH(cls.replace(" Weapon", "")))
            if cls and not generic:  # a stand-in keeps the block's name, with the icon its name calls for
                e["name"] = plain or e["name"]
                e["img"] = weapon_icon(e, quality or e["system"].get("quality", "standard")) or e["img"]
                extra.insert(0, f"a {cls} with the block's numbers; the catalog has no {plain}")
            elif fake:
                e["name"] = plain or e["name"]
            elif plain and SQUASH(plain) not in SQUASH(it["name"]) and SQUASH(re.sub(r"^(PQ|EQ)\s+", "", plain)) not in SQUASH(it["name"]):
                extra.insert(0, f"listed as {plain}")
        self.finish(e, w, extra, quality)

    def chrome_weapons(self):
        """Weapons that are chrome (Mantis Blades, a Gorilla Arm): the installed piece attacks; a second listing of it is a stand-in."""
        used = set()
        for it, w, extra, quality, raw in self.pending:
            same = [i for i in self.items if i["type"] == "cyberware" and i["name"] == it["name"]]
            e = next((i for i in same if id(i) not in used), None)
            if e is None and same:
                src, cls = self.stand_in(raw, w, quality)
                if not src:
                    self.notes.append(f"Weapon: {raw} (ROF {w['rof']}, {w.get('dmg', '?')}); another way to attack with the {it['name']}")
                    continue
                e = self.embed(src)
                e["name"] = re.sub(r"\s*[\[(].*$", "", raw).strip()
                e["img"] = weapon_icon(e, quality or "standard") or e["img"]
                extra = [f"another way to attack with the {it['name']}"] + extra
            elif e is None:
                e = self.embed(it)
            used.add(id(e))
            self.finish(e, w, extra, quality)

    # -------------------------------------------------------------- armor
    def wear(self, doc, name, sps, printed):
        e = self.embed(doc)
        e["name"] = name
        s = e["system"]
        s.update({"isHeadLocation": "head" in sps, "isBodyLocation": "body" in sps, "headLocation": {"sp": sps.get("head", 0), "ablation": 0},
                  "bodyLocation": {"sp": sps.get("body", 0), "ablation": 0}, "equipped": "equipped", "penalty": 0})
        if SQUASH(re.sub(r"\s*\((?:Head|Body)\)$", "", name)) != SQUASH(printed):
            s["description"]["value"] = f"<p><strong>{esc(self.b['name'])}:</strong> {esc(printed)}</p>" + s["description"]["value"]

    def armor(self):
        a = self.b["armor"]
        head, body = a.get("head", {}), a.get("body", {})
        clean = lambda t: re.sub(r"^TUp \([^)]*\)\s*|^TUp\s+|\s*\(.*$", "", t or "").strip().replace('"', "'")
        worn = lambda d: d.get("type") and d["type"] != "None" and d.get("sp")
        if worn(head) and worn(body) and clean(head["type"]) == clean(body["type"]):
            entries = [(clean(head["type"]), head["type"], {"head": head["sp"], "body": body["sp"]})]
        else:
            entries = [(clean(d["type"]), d["type"], {loc: d["sp"]}) for loc, d in (("head", head), ("body", body)) if worn(d)]
        for name, printed, sps in entries:
            n = ARMOR_NAMES.get(name.lower(), name)
            pieces = {loc: G.ITEMS.get(("armor", f"{n} ({loc.title()})".lower())) for loc in sps}
            if all(pieces.values()):  # the catalog sells it as a head piece and a body piece
                for loc, doc in pieces.items():
                    self.wear(doc, doc["name"], {loc: sps[loc]}, printed)
                continue
            src = find(n, ("armor", "cyberware"))
            if src and src["type"] == "armor":
                self.wear(src, src["name"], sps, printed)
                continue
            # chrome that armors (Subdermal Armor, Skinweave): CPR counts SP from armor items, so its SP is one, with the chrome's icon
            kind = "_Head" if list(sps) == ["head"] else ""
            self.wear({"name": name, "type": "armor", "img": src["img"] if src else f"{G.SYS}/default/Default_Armor{kind}.svg",
                       "system": {"description": {"value": ""}, "price": {"market": 0}, "penalty": 0, "usage": "equipped"}}, name, sps, printed)
        if a.get("melee"):
            self.notes.append(f"Melee SP (head/body): {a['melee'][0]}/{a['melee'][1]}")
        for loc in ("head", "body"):
            if a.get(loc, {}).get("notes"):
                self.notes.append(f"{loc.title()} armor: {a[loc]['notes']}")

    def fit_ammo(self, it):
        """Ammo that none of the mook's guns can load (no caliber given, or Corgo's differs) comes in the one they fire."""
        guns = [v for i in self.items if i["type"] == "weapon" for v in i["system"].get("ammoVariety", [])]
        if not guns or it["system"]["variety"] in guns:
            return it
        base = re.sub(r"\s*\([^)]*\)$", "", it["name"])
        for v in guns:
            fit = G.ITEMS.get(("ammo", f"{base} ({G.VLABEL[v]})".lower()))
            if fit:
                return fit
        return it

    def thrower(self):
        """Cyberpunk RED throws grenades from a Thrown Weapon: a mook with grenades has one, loaded and ready."""
        nades = [i for i in self.items if i["type"] == "ammo" and i["system"].get("variety") == "grenade"]
        if not nades and not self.gm_grenade:
            return
        w = self.embed(G.ITEMS[("weapon", "thrown weapon")])
        w["system"]["equipped"] = "equipped"
        if not nades:  # the GM picks the grenade, then loads it
            return
        self.install(w, nades[0])
        w["system"]["magazine"]["value"] = 1
        nades[0]["system"]["amount"] -= 1

    # -------------------------------------------------------------- gear & chrome
    def piece(self, text):
        raw = text
        if re.search(r"GM['’]s", text) and re.search(r"\bGrenade\b", text):
            self.gm_grenade = True
            self.notes.append(f"Grenade: {text} (load it in the Thrown Weapon)")
            return
        if re.search(r"^[^(\[]*\(GM['’]s Choice|for Primary Weapon$", text):  # the GM's pick, or ammo for a gun the GM picks
            self.choice.append(text)
            return
        text = re.sub(r"^TUp \([^)]*\)\s*|^TUp\s+", "", text)
        if text.lower() in OUTFITS:  # a whole outfit: its pieces
            for part in OUTFITS[text.lower()]:
                self.piece(f"{text.split()[0]} {part}")
            return
        text = re.sub(r"\s+dose of\s+", " ", re.sub(r"^Always on\s+", "", text))
        where = re.search(r"\s*\(in ([^)]+)\)$", text)  # "x1 Speedheal (in Airhypo)"
        if where:
            text = text[:where.start()].strip()
        count = re.match(r"x(\d+)\s+", text) or re.search(r"\s+x(\d+)$", text)
        n = int(count.group(1)) if count else 1
        text = re.sub(r"^x\d+\s+|\s+x\d+$", "", text).strip()
        fits, deck = [], None
        m = re.search(r"\s*\((?:w/|Has|Functions as)\s*(.+)\)$", text)
        if m and text.count("(") == 1 or (m and "w/" in m.group(0)[:5]):
            deck = re.search(r"Cyberdeck Port \[w/ ((?:EQ |PQ )?Cyberdeck)\b", m.group(1))
            fits = [x.strip(" []") for x in re.split(r",\s*(?:&\s*)?|\s*&\s*|\s+and\s+", re.sub(r"\[[^\]]*\]", "", m.group(1))) if x.strip(" []")]
            text = text[:m.start()].strip()
        text = re.sub(r"\s*[\[(].*$", "", text).strip()
        it = find(text, ("cyberware", "gear", "drug", "ammo", "clothing", "weapon", "armor", "cyberdeck", "program", "itemUpgrade", "vehicle"))
        model = None
        if not it and CHROME_BASE.search(text):
            it, model = find(CHROME_BASE.search(text).group(1), ("cyberware",)), text
        if not it:
            self.missing.append(raw)
            return
        if it["type"] == "vehicle":  # a mook sheet lists no vehicles: the ride stays in the compendium, named in the notes
            model, add = RIDES[raw.lower()]
            assert ("vehicle", model.lower()) in G.ITEMS, model
            e = self.embed(G.ITEMS[("vehicle", model.lower())])  # the vehicle item; Neon Hub lists it under the sheet's Special Gear
            if SQUASH(model) not in SQUASH(raw):
                e["system"]["description"]["value"] = (f"<p><strong>{esc(self.b['name'])}:</strong> listed as {esc(raw)}"
                                                       + (f"; {esc(add)}" if add else "") + "</p>" + e["system"]["description"]["value"])
            self.rides.append(model + (f" ({add})" if add else "") + ("" if SQUASH(model) in SQUASH(raw) else f", for the block's {raw}"))
            return
        if it["type"] == "ammo":
            it = self.fit_ammo(it)
        worn = next((i for i in self.items if i["type"] == "armor" and i["name"] == it["name"]), None) if it["type"] == "armor" else None
        if worn:  # already on from the armor line: the gear line only adds what's built into it
            if fits:
                worn["system"]["description"]["value"] = (f"<p><strong>{esc(self.b['name'])}:</strong> includes {esc(', '.join(fits))}</p>"
                                                          + worn["system"]["description"]["value"])
            return
        for _ in range(1 if it["type"] in ("ammo", "drug") else n):
            e = self.embed(it)
            if e["type"] in ("ammo", "drug"):
                e["system"]["amount"] = n  # one stack, not n items
            if model:
                e["name"] = model
                e["system"]["description"]["value"] = (f"<p><strong>{esc(self.b['name'])}:</strong> {esc(model)}, on a standard {esc(it['name'])}'s numbers</p>"
                                                       + e["system"]["description"]["value"])
            if deck and e["type"] == "cyberware":  # the deck in a netrunner's port
                model, hacks = NETRUNNERS.get(self.b["slug"], (DECKS[deck.group(1).lower()], []))
                d = self.embed(G.ITEMS[("cyberdeck", model.lower())])
                d["system"]["equipped"] = "equipped"
                d["system"]["description"]["value"] = (f"<p><strong>{esc(self.b['name'])}:</strong> in the Cybersuite; listed as "
                                                       f"{esc(deck.group(1))}</p>" + d["system"]["description"]["value"])
                for h in hacks:
                    self.install(d, self.embed(G.ITEMS[("program", h.lower())]))
                assert d["system"]["installedItems"]["usedSlots"] <= G.ITEMS[("cyberdeck", model.lower())]["system"]["installedItems"]["slots"], model
                self.loaded = bool(hacks)
            if e["type"] in ("cyberware",):
                for f in fits:
                    up = find(re.sub(r"^x\d+\s+|\s+x\d+$|^TUp \([^)]*\)\s*|^TUp\s+", "", f), ("cyberware", "itemUpgrade", "program"))
                    if up and up["type"] != "weapon":
                        self.install(e, self.embed(up))
                        continue
                    # what the piece holds rather than what's built into it (a dose in an Airhypo, a Concealment Sleeve)
                    held = find(re.sub(r"^x\d+\s+|\s+x\d+$", "", f), ("drug", "gear", "ammo")) if f else None
                    if held:
                        c = self.embed(held)
                        doses = re.search(r"(?:^x|\sx)(\d+)", f)
                        if c["type"] in ("drug", "ammo"):
                            c["system"]["amount"] = int(doses.group(1)) if doses else 1
                        c["system"]["description"]["value"] = (f"<p><strong>{esc(self.b['name'])}:</strong> in the {esc(text)}</p>"
                                                               + c["system"]["description"]["value"])
                    elif f:
                        self.missing.append(f"{f} (in {text})")
            elif fits:  # a helmet or mask's built-in kit: part of the item, so it goes in its description
                e["system"]["description"]["value"] = (f"<p><strong>{esc(self.b['name'])}:</strong> includes {esc(', '.join(fits))}</p>"
                                                       + e["system"]["description"]["value"])
            if where:
                e["system"]["description"]["value"] = (f"<p><strong>{esc(self.b['name'])}:</strong> in the {esc(where.group(1))}</p>"
                                                       + e["system"]["description"]["value"])
            if e["type"] in ("gear", "clothing", "weapon", "armor"):
                e["system"]["equipped"] = "equipped" if e["type"] != "gear" else e["system"].get("equipped", "owned")

    def place_chrome(self):
        """Foundations into the body, everything else into the matching foundation or core container."""
        inside = {c for i in self.items if "installedItems" in i["system"] for c in i["system"]["installedItems"]["list"]}
        cores = {i["system"]["type"]: i for i in self.items if i["type"] == "cyberware" and i["system"].get("core")}
        for e in self.items:
            if e["type"] != "cyberware" or e["_id"] in inside or e["system"].get("core"):
                continue
            s = e["system"]
            if s.get("isFoundational") or s.get("type") == "borgware":
                self.installed.append(e["_id"])
            else:
                spot = cores.get(s.get("type")) or next((i for i in self.items if i["type"] == "cyberware" and i["system"].get("isFoundational")
                                                         and i["system"].get("type") == s.get("type")), None)
                if spot:
                    self.install(spot, e)
                else:
                    self.installed.append(e["_id"])
        self.installed += [c["_id"] for c in cores.values()]

    # -------------------------------------------------------------- the actor
    def build(self):
        b, t = self.b, self.text
        system = {"stats": self.stats(), "derivedStats": {"hp": {"value": b["hp"], "max": b["hp"]}},
                  "reputation": {"value": b["rep"]}, "roleInfo": {"activeRole": next((r for r in CORE_ROLES if b["roles"].startswith(r)), "")}}
        self.skills()
        for c in CORE_CYBER:
            self.embed(item_from_yaml(c))
        for w in b["weapons"]:
            self.weapon(w)
        if not any(i["type"] == "weapon" and i["system"].get("weaponSkill") == "Brawling" for i in self.items):
            e = self.embed(item_from_yaml(UNARMED))  # anyone can throw a punch: Brawling damage by BODY
            e["name"] = "Brawling"
            e["system"]["equipped"] = "equipped"
        self.armor()
        for g in b["gear"] + b["cyber"]:
            self.piece(g)
        self.chrome_weapons()
        self.place_chrome()
        self.thrower()
        system["installedItems"] = {"allowed": True, "allowedTypes": ["cyberware"], "list": self.installed}
        if b["chooseWeapon"]:
            self.notes.insert(0, "Carries one of the listed weapons (GM's choice); both are on the sheet.")
        if b.get("programs"):
            self.notes.append(("Programs for a NET Architecture run (not loaded: the deck's slots hold its quickhacks): " if self.loaded else "Programs: ")
                              + ", ".join(b["programs"]))
        if self.rides:
            self.notes.append("Ride (its item is on the sheet; the vehicle to put on the map is in Neon Hub's vehicles compendium): " + "; ".join(self.rides))
        if self.choice:
            self.notes.append("Also carries, at the GM's choice: " + "; ".join(self.choice))
        if self.missing:
            self.notes.append("Also carries (no catalog item): " + "; ".join(self.missing))
        faction = FACTION_NAMES.get(b["faction"], b["faction"])
        head = [f"<strong>Threat:</strong> {esc(b['level'])}", f"<strong>Reputation:</strong> {b['rep']}"]
        if b["facedown"]:
            head.append(f"<strong>Facedown #:</strong> {b['facedown']}")
        if b["com"]:
            head.append(f"<strong>COM#:</strong> {b['com']}")
        if b["roles"]:
            head.append(f"<strong>Role:</strong> {esc(b['roles'])}")
        notes = "<p>" + " • ".join(head) + "</p>"
        if b.get("abilities"):
            notes += f"<p><strong>Enforcer:</strong> {esc(b['abilities'])}</p>"
        notes += "".join(f"<p>{esc(n)}</p>" for n in self.notes)
        blurb = TEXT["factions"][b["faction"]]["blurb"]
        desc = (f"<p>{esc(t['desc'])}</p><p><em>{esc(faction)}:</em> {esc(blurb)}</p>"
                + ("<p><small>Stat block by Neon Hub. Portrait:" if b.get("own") else
                   f"<p><small>Stat block from {esc(SOURCE)} by Corgopolis, unofficial content under R. Talsorian Games' Homebrew Content Policy. Portrait:") +
                f" Neon Hub fan art of the Cyberpunk 2077 setting (CD PROJEKT RED), free to use, not for sale.</small></p>")
        system["information"] = {"description": desc, "alias": "", "history": "", "notes": notes}
        img = f"{ART}/{b['slug']}.webp"
        if not os.path.exists(os.path.join(ROOT, "assets/art/mooks", f"{b['slug']}.webp")):
            NOTES.append(f"{b['name']}: no portrait")
            img = f"{G.SYS}/default/Default_Mook.svg"
        # named from the block's heading (Corgo's row labels repeat in two places); bosses by their own name
        prefix = PREFIX.get(faction, faction)
        name = b["name"] if b["layout"] == "full" else f"{prefix} {b['title']}".strip()
        # a named mook with a top-down token (assets/art/tokens) uses it; everyone else stands as the portrait in a round token
        # a round token made from the portrait (tools/gen/ring_tokens.py): Foundry's own ring doesn't crop the picture it frames
        round_ = f"assets/art/ring/{b['slug']}.webp"
        token = {"texture": {"src": f"modules/{G.MOD}/{round_}" if os.path.exists(os.path.join(ROOT, round_)) else img}, "ring": {"enabled": False}}
        if os.path.exists(os.path.join(ROOT, "assets/art/tokens", f"{b['slug']}.webp")):
            token = {"texture": {"src": f"modules/{G.MOD}/assets/art/tokens/{b['slug']}.webp"}, "ring": {"enabled": False}}
        return {"_id": self.aid, "_key": f"!actors!{self.aid}", "name": name, "type": "mook", "img": img, "folder": folder(faction),
                "system": system, "items": self.items, "effects": [],
                "prototypeToken": {"name": name, "actorLink": False, "width": 1, "height": 1, "disposition": -1,
                                   "displayName": 20, "displayBars": 20, "bar1": {"attribute": "derivedStats.hp"}, **token},
                "flags": {**G.MIGRATION, G.MOD: {"mook2070": {"slug": b["slug"], "faction": faction, "threat": b["level"], **({"own": True} if b.get("own") else {})}}},
                "ownership": {"default": 0}}


TOKENS = f"modules/{G.MOD}/assets/art/tokens"


class Drone(Mook):
    """An Item Compendium drone as a mook. Its compendium entry gives MOVE, HP, SP and CN; data/drones.json the rest.
    CN (Combat Number) is the base of its attacks, Evasion and Perception, the way COM# is a mook's."""

    def __init__(self, d):
        self.d = d
        self.doc = G.ITEMS[("gear", d["name"].lower())]
        text = html.unescape(re.sub(r"<[^>]+>", " ", self.doc["system"]["description"]["value"]))
        st = {k: int(m.group(1)) for k in ("move", "hp", "sp", "cn") if (m := re.search(rf"\b{k.upper()}:\s*(\d+)", text))}
        st.update(d.get("stats", {}))
        self.st, cn = st, st.get("cn")
        slug = re.sub(r"[^a-z0-9]+", "-", d["name"].lower()).strip("-")
        b = {"slug": slug, "name": d["name"], "faction": "Drones", "layout": "full", "hp": st.get("hp", 0), "rep": 0, "roles": "", "level": "Drone",
             "facedown": 0, "com": cn, "stats": {"move": st.get("move", 0), "body": d.get("body", 0)},
             "skills": [{"name": n, "base": cn, "with": ""} for n in ("Evasion", "Perception")] if cn else [], "weapons": [], "gear": [], "cyber": [],
             "armor": {}, "chooseWeapon": False}
        super().__init__(b, {})

    def build(self):
        b, d = self.b, self.d
        system = {"stats": self.stats(), "derivedStats": {"hp": {"value": b["hp"], "max": b["hp"]}}, "reputation": {"value": 0},
                  "roleInfo": {"activeRole": ""}}
        self.skills()
        for c in CORE_CYBER:
            self.embed(item_from_yaml(c))
        for w in d["weapons"]:
            self.weapon({"name": w["name"], "rof": w.get("rof", 0), "dmg": w.get("dmg", ""), "notes": w.get("notes")})
        if d.get("brawl", True) and d.get("body"):
            e = self.embed(item_from_yaml(UNARMED))  # robot hands: Brawling damage by their BODY
            e["name"] = "Brawling"
            e["system"]["equipped"] = "equipped"
        if self.st.get("sp"):
            e = self.embed(G.armor_plate(d["name"], self.st["sp"]))
            e["system"]["equipped"] = "equipped"
        for g in d.get("gear", []):
            self.embed(G.ITEMS[("gear", g.lower())])
        system["installedItems"] = {"allowed": True, "allowedTypes": ["cyberware"], "list": []}
        cn = self.st.get("cn")
        head = ["<strong>Threat:</strong> Drone", f"<strong>CN:</strong> {cn}" if cn else "<strong>CN:</strong> none (it doesn't fight)"]
        notes = ["CN (Combat Number) is the base of its attacks, Evasion and Perception." if cn else ""]
        if d.get("choose"):
            n = d["choose"]
            notes.append(f"Mounts {'one' if n == 1 else n} of the listed {'weapon' if n == 1 else 'weapons'} (GM's choice"
                         f"{', repeats allowed' if n > 1 else ''}); all are on the sheet.")
        if d.get("note"):
            notes.append(d["note"])
        if self.missing:
            notes.append("Also carries (no catalog item): " + "; ".join(self.missing))
        system["information"] = {"description": self.doc["system"]["description"]["value"]
                                 + "<p><small>Art: Neon Hub fan art of the Cyberpunk 2077 setting (CD PROJEKT RED), free to use, not for sale.</small></p>",
                                 "alias": "", "history": "", "notes": "<p>" + " • ".join(head) + "</p>" + "".join(f"<p>{esc(n)}</p>" for n in notes if n)}
        img = f"{ART}/{b['slug']}.webp"
        if not os.path.exists(os.path.join(ROOT, "assets/art/mooks", f"{b['slug']}.webp")):
            NOTES.append(f"{b['name']}: no art")
            img = f"{G.SYS}/default/Default_Mook.svg"
        token = {"texture": {"src": img}, "ring": {"enabled": True, "colors": {"ring": "#05d9e8", "background": "#07070b"}}}
        if os.path.exists(os.path.join(ROOT, "assets/art/tokens", f"{b['slug']}.webp")):
            token = {"texture": {"src": f"{TOKENS}/{b['slug']}.webp"}, "ring": {"enabled": False}}
        return {"_id": self.aid, "_key": f"!actors!{self.aid}", "name": b["name"], "type": "mook", "img": img, "folder": folder("Drones"),
                "system": system, "items": self.items, "effects": [],
                "prototypeToken": {"name": b["name"], "actorLink": False, "width": d["size"], "height": d["size"], "disposition": -1,
                                   "displayName": 20, "displayBars": 20, "bar1": {"attribute": "derivedStats.hp"}, **token},
                "flags": {**G.MIGRATION, G.MOD: {"drone2070": {"slug": b["slug"], "cn": cn}}}, "ownership": {"default": 0}}


MELEE_BY_DAMAGE = {"1d6": "Light Melee Weapon", "2d6": "Medium Melee Weapon", "3d6": "Heavy Melee Weapon", "4d6": "Very Heavy Melee Weapon"}
WEAPON_CLASSES = [(r"Constitutional Arms HAR", "Heavy SMG"), (r"Very Heavy Melee|VH Melee", "Very Heavy Melee Weapon"), (r"Heavy Melee", "Heavy Melee Weapon"),
                  (r"Medium Melee", "Medium Melee Weapon"), (r"Light Melee", "Light Melee Weapon"),
                  (r"Very Heavy Pistol", "Very Heavy Pistol"), (r"Heavy Pistol", "Heavy Pistol"), (r"Medium Pistol", "Medium Pistol"),
                  (r"Heavy SMG", "Heavy SMG"), (r"\bSMG", "SMG"), (r"Assault Rifle", "Assault Rifle"), (r"Sniper Rifle", "Sniper Rifle"),
                  (r"Shotgun", "Shotgun"), (r"Grenade Launcher", "Grenade Launcher"), (r"Rocket Launcher", "Rocket Launcher"), (r"Machine Gun", "Militech Mk. 29 LMG"), (r"Machete|Baton|Knife", "Medium Melee Weapon")]


def main():
    global CORE_SKILLS, CORE_CYBER, UNARMED, TEXT, CORE_ITEMS
    CORE_ITEMS = {}
    G.SYSDIR = os.environ.get("CPR_SYSTEM", "")
    if not G.SYSDIR:
        sys.exit("Set CPR_SYSTEM to the cyberpunk-red-core src folder (for its core Skills and cyberware containers).")
    G.main()
    CORE_SKILLS = load_yaml(os.path.join(G.SYSDIR, "packs/internal/skills/*.yaml"))
    CORE_CYBER = load_yaml(os.path.join(G.SYSDIR, "packs/internal/cyberware-core/*.yaml"))
    UNARMED = yaml.safe_load(open(os.path.join(G.SYSDIR, "packs/core/weapons/weapon.unarmed.yaml"), encoding="utf-8"))
    for pack in ("gear", "drugs", "cyberware", "armor", "weapons", "clothing", "ammo"):
        for d in load_yaml(os.path.join(G.SYSDIR, f"packs/core/{pack}/*.yaml")):
            CORE_ITEMS.setdefault((d["type"], d["name"].lower()), {"_id": d["_id"], **item_from_yaml(d)})
    for c in CORE_CYBER:
        c["system"]["installedItems"].update({"slots": 7, "allowedTypes": ["itemUpgrade", "cyberware"]})
    TEXT = json.load(open(os.path.join(HERE, "data/mook_text.json"), encoding="utf-8"))
    blocks = json.load(open(os.path.join(HERE, "data/mooks.json"), encoding="utf-8"))
    blocks += json.load(open(os.path.join(HERE, "data/mooks_own.json"), encoding="utf-8"))["mooks"]  # Neon Hub's own blocks
    actors = [Mook(b, TEXT["mooks"][b["slug"]]).build() for b in blocks]
    drones = json.load(open(os.path.join(HERE, "data/drones.json"), encoding="utf-8"))["drones"]
    actors += [Drone(d).build() for d in drones]
    for i, a in enumerate(actors):
        a["sort"] = i * 100
    d = os.path.join(ROOT, "packs/_source", PACK)
    if os.path.isdir(d):
        G.shutil.rmtree(d)
    os.makedirs(d)
    for f in FOLDERS.values():
        json.dump(f, open(os.path.join(d, f"folder_{re.sub(r'[^a-z0-9]+', '-', f['name'].lower()).strip('-')}_{f['_id']}.json"), "w",
                          encoding="utf-8"), indent=2, ensure_ascii=False)
    for a in actors:
        slug = re.sub(r"[^a-z0-9]+", "-", a["name"].lower()).strip("-")[:60]
        json.dump(a, open(os.path.join(d, f"mook_{slug}_{a['_id']}.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    missing = sum(1 for a in actors if "no catalog item" in a["system"]["information"]["notes"])
    print(f"mooks: {len(actors)} in {len(FOLDERS)} factions; {missing} with gear that has no catalog item")
    for n in NOTES:
        print("NOTE", n)


if __name__ == "__main__":
    main()
