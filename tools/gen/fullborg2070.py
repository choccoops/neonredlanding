"""Builds the Full Borg module's packs from the 2070 Item Compendium's Full Body Conversions chapter.

Run: python3 -I -B tools/gen/fullborg2070.py <Neon Hub root> <book source dir>
It runs the item generator in memory first (without rewriting Neon Hub's packs), so every body's chrome is the same
item Neon Hub's Item Compendium ships. Writes, under full-borg/packs/_source:
  fbc-bodies-2070  one Actor per body: the standard chassis (free in an FBC, option slots doubled) and the body's
                   chrome installed where it goes, ready to read on the sheet or to install with Go Metal;
  fbc-2070         Items: a package item per body (price and HL, for shops), the chassis parts, the Biosystem
                   and brain food.
The bodies are read from the book's rendered markup (out/compendium_markup.txt), which matches the PDF.
"""
import json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import items2070 as G  # reads <root> <book> from sys.argv itself

ROOT, BOOK = sys.argv[1], sys.argv[2]
FB = "cpr-neon-full-borg"
OUT = os.path.join(ROOT, "full-borg", "packs", "_source")
SYS = G.SYS
CHAPTER = "Full Body Conversions"
FRAMES = {"Sigma": ("Σ", 12, f"{SYS}/cyberware/implanted_linearframe_sigma.svg"),
          "Beta": ("β", 14, f"{SYS}/cyberware/implanted_linearframe_beta.svg"),
          "Omega": ("Ω", 16, f"{SYS}/default/default-implanted-linearframe.svg"),
          "Built in": ("", 10, f"{SYS}/default/default-implanted-linearframe.svg")}
# Chrome a body names that the catalog spells another way.
ALIASES = {"toolhand": "Tool Hand", "skinweave": "Skin Weave", "scrambler descrambler": "Scrambler/Descrambler",
           "cyberdeck cyberarm option": "Cyberdeck (arm)", "hello cutie sparkle-ize": "Hello Cutie Sparkle-ize",
           "xtremsight cybereye": "XtremSight", "miitech mk.31 hmg": "Militech Mk. 31 HMG"}
NOTES = []
FOLDERS = {}


def folder(pack, path, color=None):
    parent = None
    for depth in range(1, len(path) + 1):
        key = (pack,) + tuple(path[:depth])
        if key not in FOLDERS:
            fid = G.rid("fb-folder", *key)
            FOLDERS[key] = {"_id": fid, "_key": f"!folders!{fid}", "name": path[depth - 1], "type": "Actor" if pack == "fbc-bodies-2070" else "Item",
                            "folder": parent, "sorting": "a", "sort": len(FOLDERS) * 100, "color": color if depth == 1 else None, "description": "", "flags": {}}
        parent = FOLDERS[key]["_id"]
    return parent


def split_list(s):
    """Split a chrome list on commas outside (), [] and the "Midnight Lady™ or Mr. Studd™" kind of choice."""
    out, depth, cur = [], 0, ""
    for ch in s:
        depth += ch in "([" and 1 or ch in ")]" and -1 or 0
        if ch == "," and depth == 0:
            out.append(cur.strip())
            cur = ""
        else:
            cur += ch
    out.append(cur.strip())
    return [x for x in out if x]


# ------------------------------------------------------------------ the book
def read_bodies():
    raw = open(os.path.join(BOOK, "out", "compendium_markup.txt"), encoding="utf-8").read()
    sec = re.search(r"^# Full Body Conversions\n(.*?)(?=^# )", raw, re.M | re.S).group(1)
    intro, *entries = re.split(r"^### ", sec, flags=re.M)
    bodies = []
    for e in entries:
        name, rest = e.split("\n", 1)
        get = lambda label: (re.search(rf"\*\*{re.escape(label)}\*\*:?\s*(.+?)(?:\s+•|$)", rest, re.M) or [None, ""])[1].strip()
        line = lambda label: (re.search(rf"^\*\*{re.escape(label)}:\*\*\s*(.+)$", rest, re.M) or [None, ""])[1].strip()
        flavor = re.search(r"^\*(.+)\*$", rest, re.M)
        bodies.append({"name": name.strip(), "flavor": flavor.group(1) if flavor else "", "cost": get("Cost"), "hl": get("HL"),
                       "frame": get("Frame"), "eyes": get("Eyes"), "base": line("Base chrome (no HL)"), "chrome": line("Chrome"),
                       "note": line("Note")})
    return intro.strip(), bodies


def hl_of(s):
    """'58 ([1d6/2] + 17d6)' -> 58 and a Foundry formula with the whole dice first ('17d6 + floor(1d6/2)')."""
    m = re.match(r"(\d+)\s*\((.+)\)\s*$", s)
    static, dice = int(m.group(1)), m.group(2)
    whole = re.findall(r"(?<![\[/\d])(\d+d6)(?![^\[]*\])", dice)
    halves = [f"{'ceil' if 'Round Up' in h else 'floor'}({re.search(r'\d+d6', h).group(0)}/2)" for h in re.findall(r"\[([^\]]+)\]", dice)]
    return static, " + ".join(whole + halves)


def frame_of(s):
    m = re.match(r"(Sigma|Beta|Omega|Built in)\s*\((\d+)\)", s)
    return m.group(1), int(m.group(2))


# ------------------------------------------------------------------ documents
def copy(doc):
    return json.loads(json.dumps(doc))


def lookup(name, types=("cyberware", "itemUpgrade", "cyberdeck", "program", "weapon", "ammo")):
    n = re.sub(r"^TUp\s+", "", name)
    n = ALIASES.get(n.lower(), n)
    tries = [n, re.sub(r"\s*\(([^)]*)\)$", r", \1", n), re.sub(r"\s*\([^)]*\)$", "", n), re.sub(r"\s+deck$", "", n), re.sub(r"s$", "", n)]
    squash = lambda x: re.sub(r"[^a-z0-9]", "", x.lower())
    for t in tries:
        for k, v in G.ITEMS.items():
            if k[0] in types and squash(k[1]) == squash(t):
                return v
    for t in tries:
        it = G.find_item(t, types)
        if it:
            return it
    return None


def effect(owner_id, name, changes, disabled=False):
    eid = G.rid("fb-effect", owner_id, name)
    cats = {str(i): c[3] for i, c in enumerate(changes)}
    return {"_id": eid, "_key": f"!items.effects!{owner_id}.{eid}", "name": name, "img": "icons/svg/aura.svg", "type": "base", "system": {},
            "changes": [{"key": k, "mode": mode, "value": str(v), "priority": prio} for k, mode, v, _cat, prio in changes],
            "disabled": disabled, "transfer": True, "origin": None, "duration": {}, "description": "", "statuses": [], "tint": "#ffffff", "sort": 0,
            "flags": {"cyberpunk-red-core": {"changes": {"cats": cats, "situational": {str(i): {"isSituational": False, "onByDefault": False}
                                                                                         for i in range(len(changes))}}}}}


def base_doc(type_, name, system, desc, path, img, flags=None, effects=None):
    iid = G.rid("fb-item", type_, name.lower())
    system = {"description": {"value": desc + G.source_html(CHAPTER)}, "source": {"book": G.SOURCE, "page": 0}, "revealed": True,
              "favorite": False, **system}
    doc = {"_id": iid, "_key": f"!items!{iid}", "name": name, "type": type_, "img": img, "folder": folder("fbc-2070", path), "sort": 0,
           "system": system, "effects": [], "flags": {**G.MIGRATION, FB: {"source2070": {"book": G.SOURCE, "chapter": CHAPTER}, **(flags or {})}},
           "ownership": {"default": 0}}
    for fx in effects or []:
        fx = copy(fx)
        fx["_key"] = f"!items.effects!{iid}.{fx['_id']}"
        doc["effects"].append(fx)
    return doc


FREE = ("<p><strong>Free in an FBC:</strong> standard chassis chrome costs no Humanity Loss and doesn't lower your Maximum Humanity "
        "(Core Rules (2070), Chapter 09). Its option slots are doubled.</p>")


def chassis_part(src_name, label=None, double=True, as_type=None):
    """A catalog part as FBC chassis: no HL, doubled option slots, and still the catalog's own effects."""
    src = lookup(src_name, ("cyberware",))
    d = copy(src)
    name = f"{label or src['name']} (FBC)"
    iid = G.rid("fb-item", "cyberware", name.lower())
    s = d["system"]
    s["humanityLoss"] = {"static": 0, "roll": "0"}
    if as_type:
        s["type"] = as_type
    if double and s["isFoundational"]:
        # A pair sold as one item ("Paired cyberarms, priced and HL'd as one item, each with 1 option slot") holds both arms' slots.
        pair = 2 if re.search(r"Paired cyber(?:arms|legs), priced and HL'd as one", s["description"]["value"]) else 1
        s["installedItems"]["slots"] = s["installedItems"]["slots"] * 2 * pair
    s["description"]["value"] = s["description"]["value"].replace(G.source_html(src["flags"][G.MOD]["source2070"]["chapter"]), "") + FREE + G.source_html(CHAPTER)
    d.update({"_id": iid, "_key": f"!items!{iid}", "name": name, "folder": folder("fbc-2070", ("Chassis",))})
    d["flags"] = {**G.MIGRATION, FB: {"chassis": True, "from": src["_id"], "source2070": {"book": G.SOURCE, "chapter": CHAPTER}}}
    for fx in d["effects"]:
        fx["_id"] = G.rid("fb-effect", iid, fx["_id"])
        fx["_key"] = f"!items.effects!{iid}.{fx['_id']}"
    return d


def frame_part(kind, body):
    sym, n, img = FRAMES[kind]
    name = "Internal Linear Frame (built in, FBC)" if kind == "Built in" else f"Internal Linear Frame {sym} ({kind}) (FBC)"
    iid = G.rid("fb-item", "cyberware", name.lower())
    text = (f"The FBC's own skeleton. BODY becomes {n}, changing HP and Death Save; other chrome's penalties still apply. "
            + ("It's built into this body, and can't be removed or replaced. " if kind == "Built in" else "")
            + "As standard FBC chassis it costs no Humanity Loss and doesn't lower your Maximum Humanity: CPR counts any Borgware as −4, "
              "so this frame carries +4 to cancel it.")
    fx = [effect(iid, f"{name}: BODY {n}", [("system.stats.body.value", 5, n, "stat", 10)]),
          effect(iid, "Free in an FBC", [("bonuses.maxHumanity", 2, 4, "combat", None)])]
    return base_doc("cyberware", name, {"type": "borgware", "installLocation": "hospital", "humanityLoss": {"static": 0, "roll": "0"},
                                        "isFoundational": True, "size": 0, "price": {"market": 0}, "usage": "installed", "brand": "", "core": False,
                                        "isWeapon": False, "isElectronic": True, "concealable": {"concealable": False, "isConcealed": False},
                                        "providesHardening": False,
                                        "installedItems": {"allowed": False, "allowedTypes": ["itemUpgrade"], "list": [], "slots": 0, "usedSlots": 0}},
                    G.para(G.inline(text)), ("Chassis",), img, {"chassis": True}, fx)


def core_box(ctype, label, slots):
    name = f"{label} ({slots} Option Slots)"
    iid = G.rid("fb-item", "cyberware", name.lower())
    return base_doc("cyberware", name, {"type": ctype, "installLocation": "hospital", "humanityLoss": {"static": 0, "roll": "0"},
                                        "isFoundational": True, "size": 0, "price": {"market": 0}, "usage": "toggled", "brand": "", "core": False,
                                        "isWeapon": False, "isElectronic": False, "concealable": {"concealable": False, "isConcealed": False},
                                        "providesHardening": False,
                                        "installedItems": {"allowed": True, "allowedTypes": ["itemUpgrade", "cyberware"], "list": [], "slots": slots,
                                                           "usedSlots": 0}},
                    G.para(f"The body's {label} option slots, doubled in an FBC. Go Metal moves what's in here into the character's own "
                           f"{label} slots."), ("Chassis",), "icons/svg/item-bag.svg", {"core": ctype})


# ------------------------------------------------------------------ one body
class Body:
    def __init__(self, b):
        self.b = b
        self.aid = G.rid("fb-actor", b["name"].lower())
        self.items = []
        self.missing = []
        self.actor_list = []

    def embed(self, doc, note=""):
        e = copy(doc)
        e["_id"] = G.rid("fb-embed", self.aid, doc["_id"], len(self.items))
        e["system"].setdefault("installedItems", {"allowed": False, "allowedTypes": [], "list": [], "slots": 0, "usedSlots": 0})
        e["system"]["installedItems"]["list"] = []
        e["system"]["installedItems"]["usedSlots"] = 0
        e["flags"].setdefault(FB, {})["body"] = self.aid
        if note:
            e["system"]["description"]["value"] = f"<p><strong>In the {self.b['name']}:</strong> {G.inline(note)}</p>" + e["system"]["description"]["value"]
        self.items.append(e)
        return e

    def install(self, parent, child):
        ii = parent["system"]["installedItems"]
        ii["allowed"] = True
        if child["type"] not in ii["allowedTypes"]:
            ii["allowedTypes"].append(child["type"])
        ii["list"].append(child["_id"])
        ii["usedSlots"] += child["system"].get("size", 0) or 0
        if ii["usedSlots"] > ii["slots"]:
            NOTES.append(f"{self.b['name']}: {parent['name']} widened to {ii['usedSlots']} slots for {child['name']}")
            ii["slots"] = ii["usedSlots"]

    def foundations(self, ctype):
        return [i for i in self.items if i["type"] == "cyberware" and i["system"]["isFoundational"] and i["system"]["type"] == ctype
                and i["system"]["installedItems"]["slots"] > 0]

    def place(self, e):
        """Where a piece goes: borgware and foundations into the body itself, options into the roomiest foundation of their type."""
        if e["type"] != "cyberware":
            return  # decks, programs and ammo are carried
        s = e["system"]
        if s["type"] == "borgware" or s["isFoundational"]:
            self.actor_list.append(e["_id"])
            return
        spots = self.foundations(e["flags"][FB].get("placeAs") or s["type"]) or self.foundations("cyberwareInternal")
        spots.sort(key=lambda f: (bool(f["flags"][FB].get("core")), -(f["system"]["installedItems"]["slots"] - f["system"]["installedItems"]["usedSlots"])))
        self.install(spots[0], e)

    def piece(self, text, free=False):
        """One entry of a chrome list ("(+1 SP) Heavy Subdermal Plating (w/ Rangeguard)", "Grip Foot ×2") -> embedded items."""
        raw = text
        notes = []
        pre = re.match(r"^\(([^)]*\([^)]*\)[^)]*|[^)]*)\)\s*", text)
        if pre:
            notes.append(pre.group(1))
            text = text[pre.end():]
        notes += [n.strip() for n in re.findall(r"\[([^\]]*)\]", text)]
        text = re.sub(r"\s*\[[^\]]*\]", "", text).strip()
        count = re.search(r"\s*×(\d+)", text)
        n = int(count.group(1)) if count else 1
        text = re.sub(r"\s*×\d+", "", text).strip()
        fits = []
        m = re.search(r"\s*\(w/ (.+)\)$", text)
        if m:
            fits = [x.strip() for x in re.split(r"\s*&\s*", m.group(1))]
            text = text[:m.start()].strip()
        it = lookup(text)
        if not it:
            m2 = re.match(r"(.+?)\s*\(([^)]+)\)$", text)
            if m2 and lookup(m2.group(1)):
                it, notes = lookup(m2.group(1)), notes + [m2.group(2)]
        if not it:
            self.missing.append(raw)
            return []
        out = []
        for _ in range(n):
            e = self.embed(it, "; ".join(notes))
            if any(re.fullmatch(r"legs?", x, re.I) for x in notes):
                e["flags"][FB]["placeAs"] = "cyberLeg"
            if free:
                e["system"]["humanityLoss"] = {"static": 0, "roll": "0"}
            for f in fits:
                up = lookup(f, ("itemUpgrade", "cyberware", "program"))
                gun = None if up else lookup(f, ("weapon",))
                if up:
                    self.install(e, self.embed(up))
                elif gun:
                    g = self.embed(gun, f"carried in the {text}" + (f" ({'; '.join(notes)})" if notes else ""))
                    g["system"]["equipped"] = "equipped"
                else:
                    self.missing.append(f"{f} (in {text})")
            out.append(e)
        return out

    def build(self):
        b = self.b
        kind, body_n = frame_of(b["frame"])
        base = re.split(r"(?<=[a-z\])])\.\s", b["base"])[0] if b["base"] else ""
        base = re.sub(r"\s*\(replace the standard parts\)", "", base)
        base_list = [p for x in split_list(base) for p in re.split(r"\s+and\s+(?=[A-Z])", x)]
        # Chassis: the standard parts, unless the body's base chrome names its own of that kind.
        chassis = [("Cyberarm", 2, "cyberArm"), ("Cyberleg", 2, "cyberLeg"), ("Cyberaudio Suite", 1, "cyberAudioSuite"), ("Cyberskull", 1, None),
                   ("Neuroport", 1, "neuralWare")]
        own = {}
        extras = []
        for p in base_list:
            core_name = re.sub(r"\s*(×\d+|\(w/.*\)|\[.*\])", "", p).strip()
            it = lookup(core_name, ("cyberware",))
            t = it and it["system"]["isFoundational"] and it["system"]["type"]
            generic = it and it["name"] in ("Cyberarm", "Cyberleg", "Cybereye", "Cyberaudio Suite")
            if it and t and not generic and (t in [c[2] for c in chassis] or t == "cyberEye") or core_name.lower() == "neuroport":
                own[t or "neuralWare"] = p
            elif re.match(r"Internal Linear Frame", core_name):
                own["frame"] = p
            else:
                extras.append(p)
        for name, n, t in chassis:
            if t in own:
                continue
            for _ in range(n):
                self.embed(CHASSIS[name])
        for t, p in own.items():
            if t == "frame":
                continue
            for e in self.piece_chassis(p):
                pass
        frame = FRAME_DOCS["Built in" if kind == "Built in" else kind]
        fe = self.embed(frame)
        if "frame" in own:
            for f in re.findall(r"\(w/ ([^)]+)\)", own["frame"]):
                up = lookup(f, ("itemUpgrade", "cyberware"))
                self.install(fe, self.embed(up)) if up else self.missing.append(f"{f} (in the frame)")
        eyes = b["eyes"]
        if "cyberEye" not in own:
            if eyes.startswith("MonoVision"):
                self.embed(CHASSIS["MonoVision"])
            elif eyes.startswith("Cybereye"):
                for _ in range(2):
                    self.embed(CHASSIS["Cybereye"])
            else:
                NOTES.append(f"{b['name']}: eyes '{eyes}' and no eyes in its base chrome")
        for ctype, label, slots in (("cyberwareInternal", "Internal Body", 14), ("cyberwareExternal", "External Body", 14), ("fashionware", "Fashionware", 7)):
            self.embed(CORE[ctype])
        for p in extras:
            generic = re.sub(r"\s*×\d+", "", p).strip()
            if generic in CHASSIS:  # more of the standard parts (the Arachne's second pair of arms)
                for _ in range(int((re.search(r"×(\d+)", p) or [0, 1])[1])):
                    self.embed(CHASSIS[generic])
            else:
                self.piece(p, free=True)
        for p in split_list(b["chrome"]):
            # "Midnight Lady™ or Mr. Studd™" is the catalog's one "Midnight Lady™ / Mr. Studd™"
            self.piece(re.sub(r"\s+or\s+", " / ", p) if " or " in p and "(w/" not in p else p)
        installed = {c for i in self.items for c in i["system"]["installedItems"]["list"]}
        for e in sorted([i for i in self.items if i["_id"] not in installed], key=lambda i: not (i["type"] == "cyberware" and i["system"]["isFoundational"])):
            if e["type"] == "cyberware" and e["system"]["isFoundational"]:
                self.actor_list.append(e["_id"])
            else:
                self.place(e)
        return kind, body_n

    def piece_chassis(self, p):
        """A body's own arms, legs, eyes or ears in place of the standard ones: free, with doubled slots."""
        core_name = re.sub(r"\s*(×\d+|\(w/.*\)|\[.*\])", "", p).strip()
        if core_name.lower() == "neuroport":
            src = CHASSIS["Neuroport"]
        else:
            src = chassis_part(core_name)
            CHASSIS.setdefault(src["name"], src)
        n = int((re.search(r"×(\d+)", p) or [0, 1])[1])
        notes = re.findall(r"\[([^\]]*)\]", p)
        out = []
        for _ in range(n):
            e = self.embed(src, "; ".join(notes))
            for f in re.findall(r"\(w/ ([^)]+)\)", re.sub(r"\[[^\]]*\]", "", p)):
                for ff in re.split(r"\s*&\s*", f):
                    up = lookup(ff, ("itemUpgrade", "cyberware"))
                    self.install(e, self.embed(up)) if up else self.missing.append(f"{ff} (in {core_name})")
            out.append(e)
        return out


def body_desc(b, kind, n, static, formula, body):
    rows = {"Cost": b["cost"], "Humanity Loss": b["hl"], "Frame": f"{b['frame']}: BODY {n}", "Eyes": b["eyes"],
            "Base chrome (no HL)": b["base"], "Chrome": b["chrome"]}
    parts = [f"<em>{G.inline(b['flavor'])}</em>", G.fields_html(rows)]
    if b["note"]:
        parts.append(f"<strong>Note:</strong> {G.inline(b['note'])}")
    parts.append("Every body includes the standard chassis (Cyberarm ×2, Cyberaudio Suite, Cyberleg ×2, Cyberskull, an Internal Linear Frame and "
                 "a Neuroport) at no HL, plus its eyes and base chrome. Going metal needs a Biosystem (bought separately) and a Hospital.")
    if body.missing:
        parts.append("Not fitted on the sheet (no catalog entry): " + G.inline(", ".join(body.missing)) + ".")
    return G.para(*parts)


def maker(name):
    for m in ("Arasaka", "Biotechnica", "Continental Brands", "Dynalar", "Kiroshi", "Militech", "Moore Technologies", "NovelTech", "Orbital Air",
              "Raven Microcybernetics", "Sanroo", "Techtronika", "Trauma Team", "Zetatech"):
        if name.startswith(m):
            return m
    return "Other"


# ------------------------------------------------------------------ build
def main():
    G.SYSDIR = os.environ.get("CPR_SYSTEM", "")
    G.main()
    global CHASSIS, FRAME_DOCS, CORE
    CHASSIS = {"Cyberarm": chassis_part("Cyberarm"), "Cyberleg": chassis_part("Cyberleg"), "Cybereye": chassis_part("Cybereye"),
               "Cyberaudio Suite": chassis_part("Cyberaudio Suite"), "Cyberskull": chassis_part("Cyberskull"),
               "Neuroport": chassis_part("Neuroport"),
               "MonoVision": chassis_part("Kiroshi MonoVision", as_type="cyberEye")}
    FRAME_DOCS = {k: frame_part(k, None) for k in FRAMES}
    CORE = {t: core_box(t, label, n) for t, label, n in (("cyberwareInternal", "Internal Body", 14), ("cyberwareExternal", "External Body", 14),
                                                          ("fashionware", "Fashionware", 7))}
    intro, bodies = read_bodies()
    actors, packages = [], []
    for b in bodies:
        body = Body(b)
        kind, n = body.build()
        static, formula = hl_of(b["hl"])
        img = FRAMES[kind][2]
        desc = body_desc(b, kind, n, static, formula, body)
        info = {"cost": b["cost"], "hl": {"static": static, "roll": formula, "text": b["hl"]}, "frame": kind, "body": n, "eyes": b["eyes"]}
        for e in body.items:
            e["_key"] = f"!actors.items!{body.aid}.{e['_id']}"
            for fx in e.get("effects", []):
                fx["_key"] = f"!actors.items.effects!{body.aid}.{e['_id']}.{fx['_id']}"
            e.pop("folder", None)
            e.pop("sort", None)
        actors.append({"_id": body.aid, "_key": f"!actors!{body.aid}", "name": b["name"], "type": "mook", "img": img,
                       "folder": folder("fbc-bodies-2070", (maker(b["name"]),)),
                       "system": {"stats": {"body": {"value": n}}, "installedItems": {"allowed": True, "allowedTypes": ["cyberware"], "list": body.actor_list},
                                  "information": {"description": desc + G.source_html(CHAPTER), "alias": "", "history": "", "notes": ""}},
                       "items": body.items, "effects": [],
                       "prototypeToken": {"name": b["name"], "actorLink": False, "texture": {"src": img}, "width": 1, "height": 1, "disposition": 0,
                                          "displayName": 20, "displayBars": 20, "bar1": {"attribute": "derivedStats.hp"}},
                       "flags": {**G.MIGRATION, FB: {"fbcBody": info, "source2070": {"book": G.SOURCE, "chapter": CHAPTER}}}, "ownership": {"default": 0}})
        packages.append(base_doc("gear", b["name"], {"price": {"market": G.price(b["cost"])}, "equipped": "owned", "usage": "toggled", "brand": maker(b["name"]),
                                                     "concealable": {"concealable": False, "isConcealed": False}, "isElectronic": False, "amount": 1},
                                 desc + "<p>Drop it on a character (as GM) to install it with <strong>Go Metal</strong>.</p>",
                                 ("Bodies", maker(b["name"])), img, {"fbcPackage": {"actor": body.aid, **info}}))
        if body.missing:
            NOTES.append(f"{b['name']}: listed in the description only: {', '.join(body.missing)}")
    parts = list(CHASSIS.values()) + list(FRAME_DOCS.values()) + list(CORE.values())
    bio = copy(G.ITEMS[("cyberware", "biosystem")])
    bid = G.rid("fb-item", "cyberware", "biosystem")
    bio.update({"_id": bid, "_key": f"!items!{bid}", "folder": folder("fbc-2070", ("Chassis",))})
    bio["flags"] = {**G.MIGRATION, FB: {"biosystem": True, "from": G.ITEMS[("cyberware", "biosystem")]["_id"],
                                       "source2070": {"book": G.SOURCE, "chapter": CHAPTER}}}
    care = [base_doc("gear", "Glucose-Rich Brain Solution", {"price": {"market": 100}, "equipped": "owned", "usage": "toggled", "brand": "", "amount": 1,
                                                             "concealable": {"concealable": True, "isConcealed": False}, "isElectronic": False},
                     G.para("A month's feed for a Biosystem, injected into its port. Free with a Good PrePak Lifestyle or better.",
                            "Skip a month: −2 to everything (turn on <strong>Brain Starved</strong>). Skip two: you die."),
                     ("Body Care",), f"{SYS}/drugs/stim.svg")]
    starved_id = G.rid("fb-item", "gear", "brain starved")
    care.append(base_doc("gear", "Brain Starved", {"price": {"market": 0}, "equipped": "equipped", "usage": "toggled", "brand": "", "amount": 1,
                                                   "concealable": {"concealable": False, "isConcealed": False}, "isElectronic": False},
                         G.para("A Biosystem that missed its monthly Glucose-Rich Brain Solution: −2 to everything until it's fed. "
                                "A second missed month kills."),
                         ("Body Care",), "icons/svg/degen.svg", effects=[effect(starved_id, "Brain Starved", [("bonuses.allActions", 2, -2, "misc", None)])]))
    for d in care:
        for fx in d["effects"]:
            fx["_key"] = f"!items.effects!{d['_id']}.{fx['_id']}"
    for d in parts + [bio]:
        d.setdefault("sort", 0)
    write("fbc-bodies-2070", actors)
    write("fbc-2070", packages + parts + [bio] + care)
    print(f"bodies: {len(actors)}, items: {len(packages) + len(parts) + 1 + len(care)}")
    for n in NOTES:
        print("NOTE", n)


def write(pack, docs):
    d = os.path.join(OUT, pack)
    if os.path.isdir(d):
        G.shutil.rmtree(d)
    os.makedirs(d)
    used = {doc["folder"] for doc in docs}
    byid = {f["_id"]: f for f in FOLDERS.values()}
    keep = set()
    for fid in used:
        while fid:
            keep.add(fid)
            fid = byid[fid]["folder"]
    for k, f in FOLDERS.items():
        if k[0] == pack and f["_id"] in keep:
            json.dump(f, open(os.path.join(d, f"folder_{re.sub(r'[^a-z0-9]+', '-', f['name'].lower()).strip('-')}_{f['_id']}.json"), "w", encoding="utf-8"),
                      indent=2, ensure_ascii=False)
    for i, doc in enumerate(docs):
        doc["sort"] = (i + 1) * 100
        slug = re.sub(r"[^a-z0-9]+", "-", doc["name"].lower()).strip("-")[:60]
        json.dump(doc, open(os.path.join(d, f"{doc['type']}_{slug}_{doc['_id']}.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
