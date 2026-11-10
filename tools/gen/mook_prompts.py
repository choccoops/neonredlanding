#!/usr/bin/env python3
"""The image prompts for the mook portraits (assets/art/mooks): each faction's style plus the mook's own look, from
data/mook_text.json, with the setting's names taken out (the image generator refuses them). Prints {slug: brief}."""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
NAMES = (r"Trauma Team|Tyger Claws?|Valentinos?|Maelstrom|Aldecaldos?|Animals|Arasaka|Barghest|Kang Tao|Lazarus(?: Group)?|MAX-?TAC|MaxTac|Militech|NCPD|"
         r"NetWatch|NUSA|Scavengers?|Voodoo Boys?|Wraiths?|Night City|Cyberpunk 2077|Phantom Liberty|Dogtown|Afterlife|Kiroshi|Sandevistan|Mantis")
SKIP = {"kurt-hansen", "sasquatch"}  # drawn from their own briefs


def briefs():
    t = json.load(open(os.path.join(HERE, "data/mook_text.json"), encoding="utf-8"))
    blocks = json.load(open(os.path.join(HERE, "data/mooks.json"), encoding="utf-8")) + json.load(open(os.path.join(HERE, "data/mooks_own.json"), encoding="utf-8"))["mooks"]
    out = {}
    for b in blocks:
        if b["slug"] in SKIP:
            continue
        look = re.sub(r"\s+", " ", re.sub(NAMES, "", t["mooks"][b["slug"]]["look"], flags=re.I)).strip(" ,")
        out[b["slug"]] = f"{t['factions'][b['faction']]['style']}; {look}."
    return out


if __name__ == "__main__":
    json.dump(briefs(), sys.stdout, ensure_ascii=False)
