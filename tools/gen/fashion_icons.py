"""Give each item in Neon Hub's Fashion (2070s) pack its clothing icon with its style's emblem.

Run: CPR_SYSTEM=<CPR system src> python3 -I -B tools/gen/fashion_icons.py <Neon Hub root>
The pack is edited by hand (packs/_source/fashion-2070); this sets each item's img from its clothing
kind (system.type) and its style (its folder), and writes the icons to assets/items/derived/fashion_*.svg.
"""
import glob, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import icons2070 as ICONS

ROOT = sys.argv[1]
SYSDIR = os.environ.get("CPR_SYSTEM", "")
SYS = "systems/cyberpunk-red-core/icons/compendium"
ASSETS = "modules/cpr-neon-hub/assets/items"
if not SYSDIR:
    sys.exit("Set CPR_SYSTEM to the Cyberpunk RED system's src folder.")

src = os.path.join(ROOT, "packs/_source/fashion-2070")
folders = {}
for f in glob.glob(os.path.join(src, "folder_*.json")):
    d = json.load(open(f, encoding="utf-8"))
    folders[d["_id"]] = d["name"]
icons, changed = {}, 0
for f in sorted(glob.glob(os.path.join(src, "*.json"))):
    if os.path.basename(f).startswith("folder_"):
        continue
    raw = open(f, encoding="utf-8").read()
    d = json.loads(raw)
    kind = ICONS.CLOTHING_ICONS.get(d.get("system", {}).get("type"))
    style = folders.get(d.get("folder"))
    emblem = ICONS.STYLE_EMBLEMS.get(style)
    if not kind:
        continue
    rel = f"clothing/{kind}.svg"
    if emblem:
        fname = f"fashion_{kind.replace('generic_', '')}_{re.sub(r'[^a-z0-9]+', '_', style.lower()).strip('_')}.svg"
        icons.setdefault(fname, ICONS.emblemed(SYSDIR, rel, emblem))
        img = f"{ASSETS}/derived/{fname}"
    else:
        img = f"{SYS}/{rel}"
    if d.get("img") != img:
        d["img"] = img
        open(f, "w", encoding="utf-8").write(json.dumps(d, indent=2, ensure_ascii=False) + ("\n" if raw.endswith("\n") else ""))
        changed += 1

out = os.path.join(ROOT, "assets/items/derived")
os.makedirs(out, exist_ok=True)
for f in os.listdir(out):
    if f.startswith("fashion_"):
        os.remove(os.path.join(out, f))
for fname, svg in sorted(icons.items()):
    open(os.path.join(out, fname), "w", encoding="utf-8").write(svg)
open(os.path.join(out, "LICENSE.md"), "w", encoding="utf-8").write(ICONS.DERIVED_LICENSE)
print(f"fashion items updated: {changed}, icons: {len(icons)}")
