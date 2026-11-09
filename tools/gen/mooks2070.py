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
import functools, glob, json, os, re, sys

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


TYPOS = [(r"\bBlace\b", "Lace"), (r"\bGradted\b", "Grafted"), (r"\bCyberye\b", "Cybereye"), (r"\bBahammer\b", "Banhammer"),
         (r"\bKereznikov\b", "Kerenzikov"), (r"Low-Light", "Low Light"), (r"\s*&\s*", " and "), (r"^Cyberlegs\b", "Cyberleg")]
NAMES = {"malorian overture": "Malorian Arms Overture", "militech ajax": "Militech M251s Ajax", "constitutional arms tactician":
         "Constitutional Arms M2038 Tactician", "m2038 tactician": "Constitutional Arms M2038 Tactician", "bigwave foxtail": "Tsunami Arms Kyubi",
         "mantis blades": "Mantis Blade", "custom monoblade mantis blades": "Mantis Blade", "higurashi 20-13 mantis blade": "Higurashi 20-13 Mantis Blades",
         "dual higurashi blades": "Higurashi 20-13 Mantis Blades", "spring-loaded dual mantis blades": "Mantis Blade", "skate feet": "Skate Foot",
         "grip feet": "Grip Foot", "interface plug": "Interface Plugs", "medical grade cyberarm": "Medical-Grade Cyberarm",
         "kiroshi t.o.p.": "Kiroshi Tactical Optics Platform", "kiroshi a.t.o.p.": "Kiroshi Tactical Optics Platform", "max-helm": "Gibson Battlegear Max-Helm",
         "max-vest": "Gibson Battlegear Max-Vest (body)", "nightstalker ballistic mask": "'Nightstalker' Ballistic Mask",
         "smoke grenade": "Grenade (Smoke)", "flashbang": "Grenade (Flashbang)", "emp grenade": "Grenade (EMP)", "improved emp grenade": "Improved EMP Ammunition",
         "external 'wolfpack' linear frame": "Wolfpack Linear Frame", "internal linear frame sigma": "Implanted Linear Frame ∑ (Sigma)",
         "implanted linear frame sigma": "Implanted Linear Frame ∑ (Sigma)", "businesswear fashion": "Businesswear", "fleshweave": "Sycust FleshWeave",
         "heavy subdermal": "Heavy Subdermal Plating", "sycust fleshweave": "Sycust FleshWeave"}
AMMO = re.compile(r"^(.*?)\s*(Very Heavy Pistol|Heavy Pistol|Medium Pistol|Heavy SMG|SMG|Rifle|Machine Gun|Shotgun Slugs?|Shotgun|Grenade)?\s*(?:Ammunition|Ammo|Grenade)s?$", re.I)
CALIBER = {"heavy smg": "Heavy Pistol", "smg": "Medium Pistol", "machine gun": "Rifle", "shotgun": "Shotgun Shell", "shotgun slug": "Shotgun Slug",
           "shotgun slugs": "Shotgun Slug", "grenade": "Grenade"}


@functools.lru_cache(maxsize=None)
def find(name, types):
    """Neon Hub's catalog first (each type in turn), then Cyberpunk RED's own core items."""
    n = name.strip().strip("'\"")
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
    return None


class Mook:
    def __init__(self, b, text):
        self.b, self.text = b, text
        self.aid = G.rid("mook", b["slug"])
        self.items, self.installed, self.notes, self.missing = [], [], [], []
        self.gm_grenade = False

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

    def weapon(self, w):
        raw = w["name"]
        dmg = re.search(r"\d+d\d+", w.get("dmg", ""))
        af = re.search(r"Autofire \((?:[A-Za-z]+ )?(\d+)\)", w.get("dmg", ""))
        extra = [x for x in (w.get("notes"), w.get("ammo")) if x]
        name = re.sub(r"^OPTIONAL:\s*", "", raw)
        if "GM's" in name or "GM’s" in name:
            self.notes.append(f"Weapon: {raw} (ROF {w['rof']}, {w.get('dmg', '?')})")
            return
        m = re.match(r"(?:Braw\w*)(?: Attack)?\s*\(BODY (\d+)\)", name)
        mm = re.match(r"Martial Arts \((.+)\)$", name)
        if m:
            e = self.embed(item_from_yaml(UNARMED))
            e["name"] = "Brawling"
        elif mm:
            form = mm.group(1) if not mm.group(1).startswith("BODY") else (self.martial_form() or "")
            src = G.ITEMS.get(("weapon", f"martial arts ({form})".lower()))
            e = self.embed(src) if src else self.embed(item_from_yaml(UNARMED))
            if not src:
                e["name"] = f"Martial Arts ({form})" if form else "Martial Arts"
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
            wt = ("weapon", "cyberware")
            it = (find(base, wt) or find(plain, wt)
                  or next((find(re.sub(r"Ironfake Variant\s*", "", n), ("weapon",)) for n in notes if "Ironfake" in n), None))
            if it and it["type"] == "cyberware" and not it["system"].get("isWeapon"):
                it = None
            if not it:
                cls = next((c for pat, c in WEAPON_CLASSES if re.search(pat, raw, re.I)), None)
                if not cls and dmg and w["rof"] and not re.search(r"Autofire|Aimed|Shell|Slug", w.get("dmg", "")):
                    cls = MELEE_BY_DAMAGE.get(dmg.group())  # a named blade the catalog doesn't carry: the melee class its damage implies
                it = G.ITEMS.get(("weapon", cls.lower())) if cls else None
                if not it:
                    self.notes.append(f"Weapon: {raw} (ROF {w['rof']}, {w.get('dmg', '?')}); no catalog item")
                    self.missing.append(raw)
                    return
                extra.insert(0, f"stands in for the {raw}")
            e = self.embed(it)
            if it["name"] != plain:
                e["name"] = plain if plain else e["name"]
            q = " ".join(gloss + notes)
            if re.search(r"\bPQ\b|Poor", q):
                e["system"]["quality"] = "poor"
            elif re.search(r"\bEQ\b|Excellent", q):
                e["system"]["quality"] = "excellent"
            extra = [g for g in gloss if g not in ("PQ", "EQ")] + notes + extra
            if count and int(count.group(1)) > 1:
                extra.append(f"×{count.group(1)}")
        e["system"]["rof"] = w["rof"] or e["system"].get("rof", 1)
        if dmg:
            e["system"]["damage"] = dmg.group()
            e["system"]["unarmedAutomaticCalculation"] = False
        if af:
            e["system"].setdefault("fireModes", {"autoFire": 0, "suppressiveFire": False})["autoFire"] = int(af.group(1))
        if w.get("skill"):
            e["system"]["weaponSkill"] = w["skill"]
        e["system"]["equipped"] = "equipped"
        if extra:
            e["system"]["description"]["value"] = f"<p><strong>{esc(self.b['name'])}:</strong> {esc('; '.join(extra))}</p>" + e["system"]["description"]["value"]

    # -------------------------------------------------------------- armor
    def armor(self):
        a = self.b["armor"]
        head, body = a.get("head", {}), a.get("body", {})
        clean = lambda t: re.sub(r"^TUp \([^)]*\)\s*|^TUp\s+|\s*\(.*$", "", t or "").strip().replace('"', "'")
        parts = []
        if head.get("type") and clean(head["type"]) == clean(body.get("type")) and head.get("sp") == body.get("sp"):
            parts.append((clean(head["type"]), True, True, head["sp"], body["sp"], f"{head.get('type')}"))
        else:
            for loc, d in (("head", head), ("body", body)):
                if d.get("type") and d["type"] != "None" and d.get("sp"):
                    parts.append((clean(d["type"]), loc == "head", loc == "body", d["sp"], d["sp"], d["type"]))
        for name, is_head, is_body, hsp, bsp, printed in parts:
            src = find(name, ("armor", "cyberware"))
            src = src if src and src["type"] == "armor" else None
            doc = src or {"name": name, "type": "armor", "img": f"{G.SYS}/default/Default_Armor{'_Head' if is_head and not is_body else ''}.svg",
                          "system": {"description": {"value": ""}, "price": {"market": 0}, "penalty": 0, "usage": "equipped"}}
            e = self.embed(doc)
            e["name"] = name
            s = e["system"]
            s.update({"isHeadLocation": is_head, "isBodyLocation": is_body, "headLocation": {"sp": hsp if is_head else 0, "ablation": 0},
                      "bodyLocation": {"sp": bsp if is_body else 0, "ablation": 0}, "equipped": "equipped", "penalty": 0})
            if printed != name:
                s["description"]["value"] = f"<p><strong>{esc(self.b['name'])}:</strong> {esc(printed)}</p>" + s["description"]["value"]
        if a.get("melee"):
            self.notes.append(f"Melee SP (head/body): {a['melee'][0]}/{a['melee'][1]}")
        for loc in ("head", "body"):
            if a.get(loc, {}).get("notes"):
                self.notes.append(f"{loc.title()} armor: {a[loc]['notes']}")

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
        text = re.sub(r"^TUp \([^)]*\)\s*|^TUp\s+", "", text)
        count = re.search(r"\s+x(\d+)$", text)
        n = int(count.group(1)) if count else 1
        text = re.sub(r"\s+x\d+$", "", text).strip()
        fits = []
        m = re.search(r"\s*\((?:w/|Has|Functions as)\s*(.+)\)$", text)
        if m and text.count("(") == 1 or (m and "w/" in m.group(0)[:5]):
            fits = [x.strip(" []") for x in re.split(r",\s*(?:&\s*)?|\s*&\s*|\s+and\s+", re.sub(r"\[[^\]]*\]", "", m.group(1))) if x.strip(" []")]
            text = text[:m.start()].strip()
        text = re.sub(r"\s*[\[(].*$", "", text).strip()
        it = find(text, ("cyberware", "gear", "drug", "ammo", "clothing", "weapon", "armor", "cyberdeck", "program", "itemUpgrade"))
        if not it:
            self.missing.append(raw)
            return
        for _ in range(1 if it["type"] in ("ammo", "drug") else n):
            e = self.embed(it)
            if e["type"] in ("ammo", "drug"):
                e["system"]["amount"] = n  # one stack, not n items
            if e["type"] in ("cyberware",):
                for f in fits:
                    up = find(re.sub(r"^x\d+\s+|\s+x\d+$|^TUp \([^)]*\)\s*|^TUp\s+", "", f), ("cyberware", "itemUpgrade", "program"))
                    if up and up["type"] != "weapon":
                        self.install(e, self.embed(up))
                    elif f:
                        self.missing.append(f"{f} (in {text})")
            elif fits:  # a helmet or mask's built-in kit: part of the item, so it goes in its description
                e["system"]["description"]["value"] = (f"<p><strong>{esc(self.b['name'])}:</strong> includes {esc(', '.join(fits))}</p>"
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
        self.place_chrome()
        self.thrower()
        system["installedItems"] = {"allowed": True, "allowedTypes": ["cyberware"], "list": self.installed}
        if b["chooseWeapon"]:
            self.notes.insert(0, "Carries one of the listed weapons (GM's choice); both are on the sheet.")
        if b.get("programs"):
            self.notes.append("Programs: " + ", ".join(b["programs"]))
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
                f"<p><small>Stat block from {esc(SOURCE)} by Corgopolis, unofficial content under R. Talsorian Games' Homebrew Content "
                f"Policy. Portrait: Neon Hub fan art of the Cyberpunk 2077 setting (CD PROJEKT RED), free to use, not for sale.</small></p>")
        system["information"] = {"description": desc, "alias": "", "history": "", "notes": notes}
        img = f"{ART}/{b['slug']}.webp"
        if not os.path.exists(os.path.join(ROOT, "assets/art/mooks", f"{b['slug']}.webp")):
            NOTES.append(f"{b['name']}: no portrait")
            img = f"{G.SYS}/default/Default_Mook.svg"
        # named from the block's heading (Corgo's row labels repeat in two places); bosses by their own name
        prefix = PREFIX.get(faction, faction)
        name = b["name"] if b["layout"] == "full" else f"{prefix} {b['title']}".strip()
        return {"_id": self.aid, "_key": f"!actors!{self.aid}", "name": name, "type": "mook", "img": img, "folder": folder(faction),
                "system": system, "items": self.items, "effects": [],
                "prototypeToken": {"name": name, "actorLink": False, "texture": {"src": img}, "width": 1, "height": 1, "disposition": -1,
                                   "displayName": 20, "displayBars": 20, "bar1": {"attribute": "derivedStats.hp"},
                                   "ring": {"enabled": True, "colors": {"ring": "#ff2a6d", "background": "#07070b"}}},
                "flags": {**G.MIGRATION, G.MOD: {"mook2070": {"slug": b["slug"], "faction": faction, "threat": b["level"]}}},
                "ownership": {"default": 0}}


MELEE_BY_DAMAGE = {"1d6": "Light Melee Weapon", "2d6": "Medium Melee Weapon", "3d6": "Heavy Melee Weapon", "4d6": "Very Heavy Melee Weapon"}
WEAPON_CLASSES = [(r"Constitutional Arms HAR", "Heavy SMG"), (r"Very Heavy Melee|VH Melee", "Very Heavy Melee Weapon"), (r"Heavy Melee", "Heavy Melee Weapon"),
                  (r"Medium Melee", "Medium Melee Weapon"), (r"Light Melee", "Light Melee Weapon"),
                  (r"Very Heavy Pistol", "Very Heavy Pistol"), (r"Heavy Pistol", "Heavy Pistol"), (r"Medium Pistol", "Medium Pistol"),
                  (r"Heavy SMG", "Heavy SMG"), (r"\bSMG", "SMG"), (r"Assault Rifle", "Assault Rifle"), (r"Sniper Rifle", "Sniper Rifle"),
                  (r"Shotgun", "Shotgun"), (r"Grenade Launcher", "Grenade Launcher"), (r"Machete|Baton|Knife", "Medium Melee Weapon")]


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
    actors = [Mook(b, TEXT["mooks"][b["slug"]]).build() for b in blocks]
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
