"""Reads Corgo's 77 Collection: Mooks stat blocks and writes tools/gen/data/mooks.json, the numbers the mook pack is
built from.

Run: python3 -I parse_mooks.py <folder of Corgo's NPC markdown, one file per faction>

The markdown is the Google Docs export of Corgo's NPC document (as kept in the aky9/corgo-77-module repository,
data/npcs/). Only the stat blocks are kept: name, threat, role abilities, STATs, Skill bases, attacks, armor, gear and
cyberware. Corgo's background text is not copied; the pack's descriptions are our own (data/mook_text.json).
Two layouts exist: the mook layout (COM#, INIT, COOL, MOVE) and the full layout the named bosses use (all ten STATs).
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "data", "mooks.json")


def clean(s):
    s = re.sub(r"\\([#\[\]()+\-.*_])", r"\1", s)
    s = re.sub(r"\*+", "", s)
    s = s.replace("\u200b", "").replace("’", "'").replace("“", '"').replace("”", '"').replace("‘", "'")
    return re.sub(r"\s+", " ", s).strip()


def cells(line):
    parts = [clean(c) for c in line.strip().strip("|").split("|")]
    return [c for c in parts if c and not re.fullmatch(r":?-+:?", c)]


def bullets(s):
    """'A ⦁ B ⦁ C' -> [A, B, C]; the export sometimes drops a bullet between two entries ('16First Aid')."""
    s = re.sub(r"(\d|\))(?=[A-Z][a-z])", r"\1 ⦁ ", s)
    return [x.strip(" ⦁") for x in re.split(r"\s*⦁\s*", s) if x.strip(" ⦁")]


SKILL = re.compile(r"([A-Z][A-Za-z/' &-]*?(?:\s*\([^)\d]*\))?)\s*(\d+)(?:\s*\(([\d/ ]+)\))?")


TYPOS = {"Steetslang": "Streetslang", "Steetwise": "Streetwise"}


def skill_list(s):
    """Every 'Name 12 (14)' in the line, bullets or not (the export drops some: 'Drugs 16Stealth 18')."""
    for a, b in TYPOS.items():
        s = s.replace(a, b)
    return [{"name": m.group(1).strip(), "base": int(m.group(2)), "with": (m.group(3) or "").strip()}
            for m in SKILL.finditer(s.replace("⦁", " "))]


def num(s, default=0):
    m = re.search(r"-?\d+", s or "")
    return int(m.group()) if m else default


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower().replace("ó", "o")).strip("-")


def parse_block(faction, title, rows):
    b = {"faction": faction, "title": title, "level": "", "name": "", "roles": "", "rep": 0, "facedown": 0, "hp": 0, "ds": 0,
         "sw": 0, "com": 0, "stats": {}, "skills": [], "weapons": [], "chooseWeapon": False, "armor": {}, "gear": [], "cyber": [],
         "layout": "mook"}
    section = None
    for line in rows:
        c = cells(line)
        if not c:
            continue
        head = c[0]
        if head.startswith("LEVEL:"):
            b["level"] = head.split(":", 1)[1].strip()
            continue
        if head == "NAME":                      # full layout
            b["layout"] = "full"
            b["name"] = c[1]
            kv = dict(zip(c[2::2], c[3::2]))
            b["rep"], b["sw"], b["hp"] = num(kv.get("REP")), num(kv.get("SERIOUSLY WOUNDED")), num(kv.get("HP"))
            continue
        if head == "ROLE":
            b["roles"] = c[1]
            b["ds"] = num(c[3]) if len(c) > 3 else 0
            continue
        if head in ("STATS",):
            section = "stats"
            continue
        if head.startswith("SKILL BASES"):
            section = "skills"
            m = re.search(r"COMBAT\s*#\s*(\d+)", " ".join(c))
            if m:
                b["com"] = int(m.group(1))
            continue
        if head == "ATTACKS":
            section = "attacks"
            continue
        if head.startswith("WEAPON"):
            section = "attacks"
            b["chooseWeapon"] = "Choose" in head
            continue
        if head.startswith("ARMOR"):
            section = "armor"
            continue
        if head in ("TYPE", "LOCATION"):
            continue
        if head.startswith("GEAR & CYBERWARE"):
            section = "gearcyber"
            continue
        if head == "GEAR":
            section = "gear"
            continue
        if head == "CYBERWARE":
            section = "cyber"
            continue
        if b["layout"] == "mook" and not b["name"] and len(c) >= 3 and c[1] == "HP":
            b["name"], b["hp"] = c[0], num(c[2])
            continue
        if len(c) >= 3 and c[-2] == "DS":
            b["roles"] = "" if c[0] == "N/A" else c[0]
            b["ds"] = num(c[-1])
            continue
        if head.startswith("REPUTATION"):
            b["rep"] = num(head.split("/")[0])
            b["facedown"] = num(head.split("/")[1]) if "/" in head else 0
            continue
        if section == "stats":
            for k, v in zip(c[0::2], c[1::2]):
                k = k.replace("COM#", "COM").strip()
                if k == "COM":
                    b["com"] = num(v)
                elif k == "EMP" and "/" in v:
                    b["stats"]["emp"] = num(v.split("/")[0])
                    b["stats"]["empMax"] = num(v.split("/")[1])
                elif k == "LUCK":
                    b["stats"]["luck"] = num(v, 0)
                else:
                    b["stats"][k.lower()] = num(v)
        elif section == "skills":
            b["skills"] += skill_list(" ".join(c))
        elif section == "attacks":
            if "SPECIAL FEATURES" in head and b["weapons"]:
                b["weapons"][-1]["notes"] = " ".join(c[1:])
            elif b["layout"] == "full":
                name, skill, rof, dmg = (c + ["", "", "", ""])[:4]
                ammo, notes = (c[4] if len(c) > 4 else ""), (c[5] if len(c) > 5 else "")
                m = re.match(r"(.+?)\s*\(Base (\d+)\)", skill)
                b["weapons"].append({"name": name, "skill": m.group(1) if m else skill, "base": int(m.group(2)) if m else 0,
                                     "rof": num(rof, 1), "dmg": dmg, "ammo": "" if ammo == "N/A" else ammo,
                                     "notes": "" if notes in ("None", "N/A") else notes})
            else:
                name, rof, dmg = (c + ["", "", ""])[:3]
                b["weapons"].append({"name": name, "rof": num(rof, 1), "dmg": dmg})
        elif section == "armor":
            if b["layout"] == "full":
                loc, typ, full, half = (c + ["", "", "", ""])[:4]
                b["armor"][loc.lower()] = {"type": typ, "sp": num(full), "notes": "" if len(c) < 5 or c[4] == "None" else c[4]}
            else:
                typ, sp, melee = (c + ["", "", ""])[:3]
                th, _, tb = typ.partition(" / ")
                sh, _, sb = sp.partition("/")
                mh, _, mb = melee.partition("/")
                b["armor"] = {"head": {"type": th.strip(), "sp": num(sh)}, "body": {"type": (tb or th).strip(), "sp": num(sb or sh)},
                              "melee": [num(mh), num(mb or mh)]}
        elif section in ("gearcyber", "gear", "cyber"):
            key = "cyber" if section == "cyber" else "gear"
            text = " ".join(c)
            # The export runs the Enforcer abilities and a netrunner's program list into the last gear line.
            m = re.search(r"\s*Enforcer:\s*(.+)$", text)
            if m:
                b["abilities"] = m.group(1).strip()
                text = text[:m.start()]
            m = re.search(r"\s*Programs:\s*(.+)$", text)
            if m:
                b["programs"] = [p.strip() for p in re.split(r",\s*", m.group(1)) if p.strip()]
                text = text[:m.start()]
            b[key] += bullets(text)
    b["slug"] = slug(f"{faction}-{title}") if not b["layout"] == "full" else slug(b["name"])
    return b


def main(src):
    out = []
    for f in sorted(glob.glob(os.path.join(src, "*.md"))):
        faction, title, rows = None, None, []

        def flush():
            if title and rows:
                out.append(parse_block(faction, title, rows))

        for line in open(f, encoding="utf-8"):
            line = line.rstrip("\n")
            m = re.match(r"^##\s+(.+)$", line)
            if line.startswith("## ") and not line.startswith("### "):
                flush()
                faction, title, rows = clean(line[3:]).title(), None, []
                continue
            if line.startswith("### "):
                flush()
                title, rows = clean(line[4:]).title(), []
                continue
            if line.startswith("|"):
                rows.append(line)
        flush()
    json.dump(out, open(OUT, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(len(out), "stat blocks ->", OUT)


if __name__ == "__main__":
    main(sys.argv[1])
