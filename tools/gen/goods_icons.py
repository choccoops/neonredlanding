"""Draw the Street Goods icons (assets/goods) in the system's style, and give the pack's Local Expert skills theirs.

Run: python3 -I -B tools/gen/goods_icons.py <Neon Hub root>
The pack is edited by hand (packs/_source/street-goods); its goods already point at assets/goods/<name>.svg,
so they pick up the new drawings as they are.
"""
import glob, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import icons2070 as ICONS

ROOT = sys.argv[1]
ICONS.write_goods_icons(os.path.join(ROOT, "assets/goods"))
img = "modules/cpr-neon-hub/assets/goods/local-expert.svg"
changed = 0
for f in sorted(glob.glob(os.path.join(ROOT, "packs/_source/street-goods/*.json"))):
    raw = open(f, encoding="utf-8").read()
    d = json.loads(raw)
    if d.get("type") == "skill" and d.get("name", "").startswith("Local Expert") and d.get("img") != img:
        d["img"] = img
        open(f, "w", encoding="utf-8").write(json.dumps(d, indent=2, ensure_ascii=False) + ("\n" if raw.endswith("\n") else ""))
        changed += 1
print(f"goods icons: {len(ICONS.GOODS_ICONS)}, Local Expert skills updated: {changed}")
