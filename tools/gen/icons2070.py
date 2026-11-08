"""Icons for Neon Hub's 2070s Item Compendium, in the Cyberpunk RED system's own two styles.

Weapons (assets/items/weapons, GPL-3.0): the system's pixel-art weapon icons (240x240, a 4px grid,
red #e64539 and navy #3a3f5e on #1b1f21, by Flintwyrm) with white pixel badges in the same grid as
the system's own +/- quality badges: the 2070s type bottom-left (Power, Smart, Tech) and a star
top-right for an Iconic. The quality badge stays bottom-right, as the system draws it.

Upgrades (assets/items/upgrades, MIT): flat red shapes with the system's navy inner shadow on
#1b1f21 (512x512), as its own upgrade icons are, drawn here for each kind of upgrade the system has
no icon for (melee rebuilds, weapon mods, cyberware enhancements, operating systems...).
"""
import os, re

# ------------------------------------------------------------------ weapons: pixel badges
CELL = 4
# 9x9 glyphs, white, in a 36px square (the system's +/- sit at x/y 184-220)
GLYPHS = {
    "power": [  # a lightning bolt
        ".....XXX.",
        "....XXX..",
        "...XXX...",
        "..XXXXXX.",
        ".XXXXXX..",
        "....XXX..",
        "...XXX...",
        "..XXX....",
        "..XX.....",
    ],
    "smart": [  # a target reticle
        "..XXXXX..",
        ".X..X..X.",
        "X...X...X",
        "X...X...X",
        "XXXX.XXXX",
        "X...X...X",
        "X...X...X",
        ".X..X..X.",
        "..XXXXX..",
    ],
    "tech": [  # a charged shot punching through: double chevron
        "X...X....",
        "XX..XX...",
        ".XX..XX..",
        "..XX..XX.",
        "...XX..XX",
        "..XX..XX.",
        ".XX..XX..",
        "XX..XX...",
        "X...X....",
    ],
    "iconic": [  # a star
        "....X....",
        "...XXX...",
        "...XXX...",
        "XXXXXXXXX",
        ".XXXXXXX.",
        "..XXXXX..",
        "..XXXXX..",
        ".XXX.XXX.",
        ".XX...XX.",
    ],
}
# top-left corner of each badge (bottom-left for the type, top-right for an Iconic)
SPOT = {"power": (20, 184), "smart": (20, 184), "tech": (20, 184), "iconic": (184, 20)}


def badge(kind):
    x0, y0 = SPOT[kind]
    # a backing square in the icon's own background, so the badge reads over any art beneath it
    out = [f'<path style="fill:#1b1f21; stroke:none;" d="M{x0 - 4} {y0 - 4}h44v44h-44z"/>']
    d = []
    for r, row in enumerate(GLYPHS[kind]):
        for c, ch in enumerate(row):
            if ch == "X":
                x, y = x0 + c * CELL, y0 + r * CELL
                d.append(f"M{x} {y}h{CELL}v{CELL}h-{CELL}z")
    out.append(f'<path style="fill:#ffffff; stroke:none;" d="{"".join(d)}"/>')
    return "\n".join(out)


# the system's own file names for a quality (one is misspelled in CPR 0.92.4)
SYS_QUALITY_FILE = {("Bow", "excellent"): ["Bow_excellent", "Bow_exellent"]}


def system_weapon_file(sysdir, base, quality):
    names = SYS_QUALITY_FILE.get((base, quality)) or [base if quality == "standard" else f"{base}_{quality}"]
    for n in names:
        p = os.path.join(sysdir, "icons/compendium/weapons", f"{n}.svg")
        if os.path.exists(p):
            return n, p
    return None, None


def derive_weapon(sysdir, base, quality, rebuild=None, iconic=False):
    """The system's icon for this weapon and quality, with the type and Iconic badges added."""
    _, p = system_weapon_file(sysdir, base, quality)
    if not p:
        _, p = system_weapon_file(sysdir, base, "standard")
    if not p:
        return None
    src = open(p, encoding="utf-8").read()
    if 'width="240"' not in src:
        return None  # only the pixel-art icons take pixel badges
    extra = [badge(rebuild)] if rebuild else []
    if iconic:
        extra.append(badge("iconic"))
    head = f"<!-- Derived from the Cyberpunk RED - CORE system icon weapons/{os.path.basename(p)} (art by Flintwyrm, GPL-3.0); badges added by Neon Hub. -->\n"
    body = src.rstrip()
    assert body.endswith("</svg>")
    body = body[: -len("</svg>")].rstrip()
    first = body.index("\n", body.index("<svg"))
    return body[: first + 1] + head + body[first + 1:] + "\n" + "\n".join(extra) + "\n</svg>\n"


# ------------------------------------------------------------------ upgrades: flat red icons
RED, BG = "#e64539", "#1b1f21"
FILTER = ('<filter id="nh-shade" x="-0.17" y="-0.17" width="1.33" height="1.33" style="color-interpolation-filters:sRGB">'
          '<feFlood flood-color="rgb(58,63,94)" result="flood"/>'
          '<feComposite in="flood" in2="SourceGraphic" operator="out" result="c1"/>'
          '<feGaussianBlur in="c1" stdDeviation="15" result="blur"/>'
          '<feComposite in="blur" in2="SourceGraphic" operator="atop"/></filter>')


def flat(name, body, note):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">\n'
            f'<!-- Neon Hub: {note}. Drawn in the style of the Cyberpunk RED system\'s upgrade icons. -->\n'
            f'<defs>{FILTER}</defs>\n<rect width="512" height="512" fill="{BG}"/>\n'
            f'<g fill="{RED}" stroke="none" filter="url(#nh-shade)">\n{body}\n</g>\n</svg>\n')


def chip(inner):
    """The system's electronics frame: a thick square outline with four pins a side, the symbol inside."""
    pins = []
    for i in range(4):
        o = 168 + i * 56
        pins += [f'<rect x="{o - 12}" y="62" width="24" height="56" rx="8"/>', f'<rect x="{o - 12}" y="394" width="24" height="56" rx="8"/>',
                 f'<rect x="62" y="{o - 12}" width="56" height="24" rx="8"/>', f'<rect x="394" y="{o - 12}" width="56" height="24" rx="8"/>']
    frame = '<path fill-rule="evenodd" d="M136 120h240a16 16 0 0 1 16 16v240a16 16 0 0 1-16 16H136a16 16 0 0 1-16-16V136a16 16 0 0 1 16-16zM158 158v196h196V158z"/>'
    return "\n".join(pins) + "\n" + frame + "\n" + inner


def gear(cx, cy, r, teeth=8, tooth=30, hole=0):
    import math
    pts = []
    n = teeth * 4
    for i in range(n):
        a = 2 * math.pi * i / n - math.pi / n
        rr = r + tooth if (i % 4) in (1, 2) else r
        pts.append(f"{cx + rr * math.cos(a):.1f} {cy + rr * math.sin(a):.1f}")
    d = "M" + "L".join(pts) + "z"
    if hole:
        d += f"M{cx - hole} {cy}a{hole} {hole} 0 1 0 {2 * hole} 0a{hole} {hole} 0 1 0 {-2 * hole} 0z"
    return f'<path fill-rule="evenodd" d="{d}"/>'


UPGRADE_ICONS = {
    # anything without its own: a gear with a plus cut out of it
    "upgrade": ("an item upgrade", gear(256, 256, 130, 8, 42) + f'<path fill="{BG}" d="M232 176h48v56h56v48h-56v56h-48v-56h-56v-48h56z"/>'),
    # a weapon attachment: a rail with a red-dot sight clamped on
    "attachment": ("a weapon attachment",
                   '<path d="M72 318h368v44H72z"/><path fill-rule="evenodd" d="M150 190h196a24 24 0 0 1 24 24v76a12 12 0 0 1-12 12H138a12 12 0 0 1-12-12v-76a24 24 0 0 1 24-24zM216 222a30 30 0 1 0 0.1 0z"/>'
                   '<path d="M176 302h40v20h-40zM288 302h40v20h-40z"/>'
                   + "".join(f'<rect x="{x}" y="372" width="28" height="22" rx="4"/>' for x in range(86, 430, 48))),
    # a weapon mod: a pistol with a gear on its grip
    "weaponMod": ("a weapon mod",
                  '<path d="M64 150h336v34h48v44h-48v22H226l-22 36h-46l-30 120H64l40-160H64z"/>'
                  + gear(352, 352, 58, 8, 22, 22)),
    # Mono-edge Blading: a blade whose edge is a separate, monomolecular sliver
    "monoEdge": ("Mono-edge Blading, a melee rebuild",
                 '<g transform="rotate(-45 256 256)">'
                 '<path d="M188 196h236l60 34-60 4H188z"/>'
                 '<path d="M194 250h232l56-6-56 34H194z"/>'
                 '<path d="M156 168h32v140h-32z"/><path d="M70 220h86v48H70z"/><circle cx="62" cy="244" r="28"/></g>'
                 '<path d="M400 300l14 40 40 14-40 14-14 40-14-40-40-14 40-14z"/>'),
    # Propulsion Impact: a hammer head with thrusters firing out of its back
    "propulsion": ("Propulsion Impact, a melee rebuild",
                   '<path d="M216 96h168a20 20 0 0 1 20 20v112a20 20 0 0 1-20 20H216z"/>'
                   '<path d="M276 248h48v216h-48z"/>'
                   '<path d="M216 108l-36 10v40l36 10zM216 176l-36 10v40l36 10z"/>'
                   '<path d="M172 120c-44-6-82 0-120 18 38 18 76 24 120 18zM172 188c-44-6-82 0-120 18 38 18 76 24 120 18z"/>'),

    # a cyberware enhancement: a chip with an arrow up
    "cyberEnhancement": ("a cyberware enhancement", chip('<path d="M256 182l70 76h-44v72h-52v-72h-44z"/>')),
    # an operating system: a chip with a command prompt
    "operatingSystem": ("a cyberware operating system", chip('<path d="M190 196l66 52-66 52v-34l26-18-26-18z"/><path d="M270 296h62v30h-62z"/>')),
    # netrunning hardware: a chip with a plug
    "hardware": ("netrunning hardware", chip('<path d="M222 186h20v34h28v-34h20v34h12v42a46 46 0 0 1-30 43v41h-32v-41a46 46 0 0 1-30-43v-42h12z"/>')),
    # vehicle ICE: a chip with a shield
    "vehicleIce": ("vehicle ICE", chip('<path d="M256 182l70 26v46c0 44-30 72-70 88-40-16-70-44-70-88v-46z"/>')),
    # an armor upgrade: a vest with a plus cut out
    "armorUpgrade": ("an armor upgrade",
                     f'<path d="M152 80h60v30c8 30 24 44 44 44s36-14 44-44V80h60v60c0 30 22 50 50 56v260H102V196c28-6 50-26 50-56z"/><path fill="{BG}" d="M236 238h40v48h48v40h-48v48h-40v-48h-48v-40h48z"/>'),

    # an armor enhancement: a vest of layered plates
    "armorEnhancement": ("an armor enhancement",
                         f'<path d="M152 80h60v30c8 30 24 44 44 44s36-14 44-44V80h60v60c0 30 22 50 50 56v260H102V196c28-6 50-26 50-56z"/>'
                         f'<path fill="{BG}" d="M102 250h308v18H102zM102 318h308v18H102zM102 386h308v18H102z"/>'),

    # a shield style: a riot shield with its viewport
    "shield": ("a shield style",
               f'<path d="M136 64h240a24 24 0 0 1 24 24v232c0 70-60 112-144 136-84-24-144-66-144-136V88a24 24 0 0 1 24-24z"/>'
               f'<path fill="{BG}" d="M172 116h168v44H172z"/>'
               + "".join(f'<circle cx="{x}" cy="{y}" r="12" fill="{BG}"/>' for x, y in ((164, 214), (348, 214), (164, 318), (348, 318), (256, 400)))),

    # a vehicle upgrade: a car with a gear
    "vehicleUpgrade": ("a vehicle upgrade",
                       f'<path fill-rule="evenodd" d="M108 196l40-72h176l40 72h40a20 20 0 0 1 20 20v92a20 20 0 0 1-20 20H64a20 20 0 0 1-20-20v-92a20 20 0 0 1 20-20zM164 152l-26 44h196l-26-44z"/>'
                       '<path d="M84 328h76v48H84zM312 328h76v48h-76z"/>' + f'<circle cx="122" cy="262" r="22" fill="{BG}"/><circle cx="350" cy="262" r="22" fill="{BG}"/>'
                       + gear(392, 402, 46, 8, 18, 18)),
    # a bicycle upgrade: a bike
    "bicycle": ("a bicycle upgrade",
                f'<g fill="none" stroke="{RED}" stroke-width="22" stroke-linejoin="round" stroke-linecap="round">'
                '<circle cx="132" cy="322" r="78"/><circle cx="380" cy="322" r="78"/>'
                '<path d="M132 322l70-122h130l48 122M202 200l58 122 72-122M246 168h-62M318 168h46l-32 32"/></g>'),
    # an Iconic's own weapon mod: a star with a gear
    "iconicMod": ("an Iconic weapon mod",
                  '<path d="M256 56l52 120 130 10-98 86 30 128-114-68-114 68 30-128-98-86 130-10z"/>'
                  + f'<circle cx="256" cy="260" r="46" fill="{BG}"/><circle cx="256" cy="260" r="22"/>'),
}

# upgrades whose name says what they are and the system already has an icon for
SYSTEM_UPGRADE_ICONS = [
    (r"smart ?gun link|smartlink", "upgrades/smartgun_link.svg"),
    (r"infrared|nightvision|night vision|thermal scope|tws", "upgrades/infrared_nightvision_scope.svg"),
    (r"scope|\bsight\b|\boptics?\b", "upgrades/sniping_scope.svg"),
    (r"drum", "upgrades/generic_drum_magazine.svg"),
    (r"extended mag|magazine|magwell", "upgrades/generic_extended_magazine.svg"),
    (r"bayonet", "upgrades/bayonet.svg"),
    (r"grenade launcher underbarrel", "upgrades/grenade_launcher_underbarrel.svg"),
    (r"shotgun underbarrel", "upgrades/shotgun_underbarrel.svg"),
    (r"range upgrade", "upgrades/range_upgrade.svg"),
    (r"backup drive", "upgrades/backup_drive.svg"),
    (r"krash barrier", "upgrades/krash_barrier.svg"),
    (r"hardened circuitry", "upgrades/hardened_circuitry.svg"),
    (r"insulated wiring", "upgrades/insulated_wiring.svg"),
    (r"dna lock", "upgrades/dna_lock.svg"),
    (r"interface plug", "upgrades/enhanced_interface_plug_integration.svg"),
    (r"security (upgrade|system)", "upgrades/security_upgrade.svg"),
    (r"seating", "upgrades/seating_upgrade.svg"),
    (r"smuggl", "upgrades/smuggling_upgrade.svg"),
    (r"bulletproof glass", "upgrades/bulletproof_glass.svg"),
    (r"armored chassis", "upgrades/armored_chassis.svg"),
    (r"heavy chassis", "upgrades/heavy_chasis.svg"),
    (r"combat plow", "upgrades/combat_plow.svg"),
    (r"\bnos\b|nitro", "upgrades/nos.svg"),
    (r"hover", "upgrades/hover_upgrade.svg"),
    (r"spike strip", "upgrades/deployable_spike_strip.svg"),
    (r"communications", "upgrades/communications_center.svg"),
    (r"onboard (machine gun|mg)", "upgrades/onboard_machine_gun.svg"),
    (r"onboard melee", "upgrades/onboard_melee_weapon.svg"),
    (r"rocket pod", "upgrades/onboard_rocket_pod.svg"),
    (r"heavy weapon mount", "upgrades/vehicle_heavy_weapon_mount.svg"),
    (r"engine", "upgrades/av_4_engine_upgrade.svg"),
]

# by where the upgrade sits in the compendium
FOLDER_ICONS = {
    "Melee Rebuilds": None,  # by name, below
    "Attachments": "attachment",
    "Weapon Mods": "weaponMod",
    "Enhancements": "cyberEnhancement",
    "Operating Systems": "operatingSystem",
    "Hardware": "hardware",
    "Vehicle ICE": "vehicleIce",
    "Vehicle Upgrades": "vehicleUpgrade",
    "Bicycle Upgrades": "bicycle",
    "Armor Upgrades": "armorUpgrade",
    "Armor Enhancements": "armorEnhancement",
    "Shields": "shield",
    "Iconic Weapon Mods": "iconicMod",
}


BIKE_ALIASES = {"smuggling compartment": "smuggling_upgrade"}


def upgrade_icon(name, path, sysdir=""):
    """(kind, system path or None): the system's own icon when the name matches one, else ours for its folder."""
    low = name.lower()
    leaf = path[-1] if path else ""
    # a bicycle upgrade the system draws (Spinning Your Wheels), by name
    if leaf == "Bicycle Upgrades":
        rel = f"spinning_your_wheels/{BIKE_ALIASES.get(low, re.sub(r'[^a-z0-9]+', '_', low).strip('_'))}.svg"
        if not sysdir or os.path.exists(os.path.join(sysdir, "icons/compendium", rel)):
            return None, rel
    if leaf == "Melee Rebuilds":
        return ("propulsion" if "propulsion" in low else "monoEdge"), None
    # the system's icons are for weapons and vehicles and decks: keep cyberware and armor in their own
    if leaf not in ("Enhancements", "Operating Systems", "Armor Upgrades", "Armor Enhancements", "Shields", "Bicycle Upgrades"):
        for pat, rel in SYSTEM_UPGRADE_ICONS:
            if re.search(pat, low) and (not sysdir or os.path.exists(os.path.join(sysdir, "icons/compendium", rel))):
                return None, rel
    return FOLDER_ICONS.get(leaf) or "upgrade", None


def write_upgrade_icons(out):
    os.makedirs(out, exist_ok=True)
    for key, (note, body) in UPGRADE_ICONS.items():
        open(os.path.join(out, f"{key}.svg"), "w", encoding="utf-8").write(flat(key, body, note))


WEAPON_LICENSE = """# Weapon icons (GPL-3.0)

These icons are the Cyberpunk RED - CORE system's own weapon icons (art by Flintwyrm, from
https://gitlab.com/cyberpunk-red-team/fvtt-cyberpunk-red-core), with badges added by Neon Hub:
the 2070s weapon type bottom-left (a bolt for Power, a reticle for Smart, a double chevron for
Tech) and a star top-right for an Iconic. As derivatives of the system's art they are under its
license, the GNU General Public License v3.0, not Neon Hub's MIT license. They are generated by
`tools/gen/items2070.py` (see `tools/gen/icons2070.py`) from the system's files.
"""


# ------------------------------------------------------------------ vehicles: flat red side views
def wheels(*spots, r=40):
    """Wheels cut into the body: a dark arch, the tire, a dark hub."""
    out = []
    for cx, cy in spots:
        out.append(f'<circle cx="{cx}" cy="{cy}" r="{r + 10}" fill="{BG}"/>')
        out.append(f'<circle cx="{cx}" cy="{cy}" r="{r}"/>')
        out.append(f'<circle cx="{cx}" cy="{cy}" r="{max(8, r // 3)}" fill="{BG}"/>')
    return "".join(out)


def rings(*spots, r=62, w=20):
    """Motorbike and bicycle wheels: open rings."""
    return "".join(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{RED}" stroke-width="{w}"/>'
                   f'<circle cx="{cx}" cy="{cy}" r="12"/>' for cx, cy in spots)


STAR = ('<path fill="#ffffff" d="M440 34l13 30 32 3-24 21 7 32-28-17-28 17 7-32-24-21 32-3z"/>')

VEHICLE_ICONS = {
    # Compact Groundcar: a sedan
    "compactCar": ("a compact groundcar",
                   '<path d="M60 330v-40q0-20 20-24l70-8 50-58q10-10 28-10h102q16 0 26 10l48 56 36 8q16 4 16 22v44q0 12-12 12H72q-12 0-12-12z"/>'
                   f'<path fill="{BG}" d="M220 208h58v48h-96zM294 208h38l42 48h-80z"/>' + wheels((150, 342), (366, 342))),
    # High Performance Groundcar: a low coupe with a wing
    "sportsCar": ("a high performance groundcar",
                  '<path d="M40 330q0-30 30-36l120-18 60-40q12-8 30-8l60 2q16 2 30 14l50 36 42 10q14 4 14 22v18q0 12-12 12H52q-12 0-12-12z"/>'
                  '<path d="M36 264h64v14H64v18H50v-18H36z"/>'
                  f'<path fill="{BG}" d="M266 246h56l40 30H226z"/>' + wheels((140, 342), (390, 342), r=38)),
    # Super Groundcar: a hypercar wedge
    "superCar": ("a super groundcar",
                 '<path d="M28 324q0-16 16-22l150-32 74-34q14-6 30-6h40q14 0 26 8l74 46 48 12q14 4 14 20v8q0 12-12 12H40q-12 0-12-12z"/>'
                 '<path d="M28 270h70v12H60v18H48v-18H28z"/>'
                 f'<path fill="{BG}" d="M284 246h42l58 34H222z"/><path fill="{BG}" d="M180 300h120v8H180z"/>' + wheels((136, 336), (396, 336), r=36)),
    # a pickup: cab and bed
    "pickup": ("a pickup truck",
               '<path d="M56 334v-68h170v-58q0-14 14-14h74q12 0 18 10l40 62h62q20 0 24 20v48q0 12-12 12H68q-12 0-12-12z"/>'
               f'<path fill="{BG}" d="M254 212h52l30 50h-82z"/><path fill="{BG}" d="M70 280h140v10H70z"/>' + wheels((142, 346), (384, 346))),
    # a van
    "van": ("a van",
            '<path d="M56 340V150q0-20 20-20h240q16 0 26 12l78 90q20 4 26 22v86q0 12-12 12H68q-12 0-12-12z"/>'
            f'<path fill="{BG}" d="M88 160h70v60H88zM178 160h70v60h-70zM272 160h44l52 60h-96z"/>' + wheels((140, 352), (382, 352))),
    # a bus or coach
    "bus": ("a coach",
            '<path d="M36 346V140q0-20 20-20h384q20 0 26 20l12 60v146q0 12-12 12H48q-12 0-12-12z"/>'
            f'<path fill="{BG}" d="' + "".join(f"M{x} 152h54v62h-54z" for x in range(64, 420, 72)) + '"/>'
            f'<path fill="{BG}" d="M36 236h432v10H36z"/>' + wheels((118, 360), (392, 360), r=38)),
    # a road train: cab and trailer
    "semi": ("a hauler",
             '<path d="M24 330V150h308v180z"/><path d="M342 330V204q0-16 16-16h58q14 0 22 12l38 52q8 10 8 24v54z"/>'
             f'<path fill="{BG}" d="M362 206h46l32 44h-78z"/>' + wheels((78, 344), (166, 344), (300, 344), (432, 344), r=32)),
    # military and police armor: an APC with a turret
    "apc": ("an armored vehicle",
            '<path d="M40 320l30-100 110-24h160l110 24 30 80v20q0 10-10 10H50q-10 0-10-10z"/>'
            '<path d="M196 196l22-46h104l22 46z"/><path d="M318 158h140v20H318z"/>'
            f'<path fill="{BG}" d="M104 236h70v14h-70zM338 236h70v14h-70z"/>' + wheels((112, 344), (256, 344), (400, 344))),
    # a roadbike: a cruiser
    "roadbike": ("a roadbike",
                 rings((118, 352), (394, 352)) +
                 '<path d="M150 306l46-62q10-12 26-12h92l48-36h26l-22 64-44 46H232z"/>'
                 f'<path d="M386 196l16-52h34v16h-22l-12 40z"/><path d="M380 210l14 142" stroke="{RED}" stroke-width="22"/>'
                 f'<path d="M150 306L118 352" stroke="{RED}" stroke-width="22"/><path d="M84 234h108v24H96z"/>'),
    # a superbike: a sport bike with a fairing
    "superbike": ("a superbike",
                  rings((118, 354), (394, 354), r=58) +
                  '<path d="M144 330l60-82 96-14 54-40 78 18 22 56-50 34h-74l-56 28z"/>'
                  '<path d="M80 252l130-6-20 34z"/>'
                  f'<path fill="{BG}" d="M362 214l44 10 10 26-46-4z"/><path d="M412 268l-18 86" stroke="{RED}" stroke-width="20"/>'),
    # an aerodyne (AV): fuselage over ducted thrusters
    "aerodyne": ("an aerodyne",
                 '<path d="M76 262q0-58 54-64l232-8q60 0 90 40l14 34q4 18-16 20l-350 6q-24 0-24-28z"/>'
                 f'<path fill="{BG}" d="M368 206q34 2 58 32h-74z"/>'
                 '<path d="M110 292h120v40q0 14-14 14h-92q-14 0-14-14zM298 288h120v40q0 14-14 14h-92q-14 0-14-14z"/>'
                 '<path d="M132 366h24v40h-24zM184 366h24v40h-24zM320 362h24v40h-24zM372 362h24v40h-24z"/>'),
    # a jetski on the waves
    "jetski": ("a jetski",
               '<path d="M56 330q0-30 32-34l230-8 64-40h40l52 50q12 22-10 32z"/>'
               f'<path d="M376 250l-22-52h24l24 52z"/><path d="M342 198h52v16h-52z"/>'
               f'<path fill="none" stroke="{RED}" stroke-width="18" stroke-linecap="round" d="M40 380q30-24 60 0t60 0t60 0t60 0t60 0t60 0t60 0"/>'),
    # a hoverboard
    "hoverboard": ("a hoverboard",
                   '<path d="M92 262h328q22 0 28 18l-12 26q-6 12-22 12H98q-16 0-22-12l-12-26q6-18 28-18z"/>'
                   '<path d="M132 330h72v20h-72zM308 330h72v20h-72z"/>'
                   f'<path fill="none" stroke="{RED}" stroke-width="12" stroke-linecap="round" d="M150 380h36M326 380h36M140 410h56M316 410h56"/>'),
    # an ACPA: a powered armor frame
    "acpa": ("an ACPA",
             '<path d="M222 58h68v60h-68z"/><path d="M176 126h160l20 120-40 34H196l-40-34z"/>'
             '<path d="M104 122h74v84h-74zM334 122h74v84h-74z"/><path d="M114 212h54v110h-54zM344 212h54v110h-54z"/>'
             '<path d="M106 326h70v46h-70zM336 326h70v46h-70z"/><path d="M194 286h124v40H194z"/>'
             '<path d="M196 330h52v116h-52zM264 330h52v116h-52z"/><path d="M182 448h72v22h-72zM258 448h72v22h-72z"/>'
             f'<path fill="{BG}" d="M234 78h44v14h-44z"/><path fill="{BG}" d="M226 160h60v12h-60zM226 190h60v12h-60z"/>'),
    # a cyberpet: a paw with a circuit in it
    "cyberpet": ("a cyberpet",
                 '<ellipse cx="256" cy="330" rx="104" ry="92"/>'
                 '<ellipse cx="150" cy="200" rx="40" ry="52"/><ellipse cx="226" cy="150" rx="40" ry="54"/>'
                 '<ellipse cx="306" cy="150" rx="40" ry="54"/><ellipse cx="380" cy="200" rx="40" ry="52"/>'
                 f'<path fill="none" stroke="{BG}" stroke-width="14" stroke-linecap="round" d="M196 336h44l20-30h52"/>'
                 f'<circle cx="196" cy="336" r="14" fill="{BG}"/><circle cx="316" cy="306" r="14" fill="{BG}"/>'),
}


def vehicle_icon(name, notes, kind):
    """(our icon's key, or None, and the system's icon or None) for a vehicle, by what the book says it is."""
    n, t = name.lower(), notes.lower()
    both = f"{n} {t}"
    if "bicycle" in n:
        return None, "spinning_your_wheels/bicycle.svg"
    if kind == "air":
        if "zep" in t:
            return None, "vehicles/blimp.svg"
        if re.search(r"gyrocopter|helicopter", t):
            return None, "vehicles/helicopter.svg"
        return "aerodyne", None
    if kind == "sea":
        if "jetski" in t:
            return "jetski", None
        if re.search(r"speedboat", t):
            return None, "vehicles/speed_boat.svg"
        return None, "vehicles/ship.svg"
    if "av-4 engine" in t or "hoverboard" in n or "hovers" in t[:20]:
        return ("hoverboard" if "hoverboard" in n else "aerodyne"), None
    if "superbike" in t:
        return "superbike", None
    if re.search(r"roadbike|\btrike\b|rickshaw", both):
        return "roadbike", None
    if re.search(r"road train|tows \d|tow rig|hauler|longbed", both):
        return "semi", None
    # military rigs (Militech's own, the riot walker, war-rigs); police cruisers stay cars
    if n.startswith("militech") or re.search(r"riot walker|war-rig|warhorse|dreadnought|grodno", both):
        return "apc", None
    if re.search(r"\bcoach\b", both):
        return "bus", None
    if re.search(r"\bvan\b|camper|meatwagon|columbus|delivery", both):
        return "van", None
    if re.search(r"pickup|flatbed|mackinaw|\bcolby\b|zeya|bratsk|centurion|tanishi", both):
        return "pickup", None
    if "super groundcar" in t:
        return "superCar", None
    if re.search(r"high perf", t):
        return "sportsCar", None
    return "compactCar", None


def write_vehicle_icons(out):
    """Every vehicle icon, and a starred copy of each for Iconic vehicles."""
    os.makedirs(out, exist_ok=True)
    for key, (note, body) in VEHICLE_ICONS.items():
        svg = flat(key, body, note)
        open(os.path.join(out, f"{key}.svg"), "w", encoding="utf-8").write(svg)
        open(os.path.join(out, f"{key}_iconic.svg"), "w", encoding="utf-8").write(svg.replace("</svg>", STAR + "\n</svg>"))
