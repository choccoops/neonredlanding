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


# ------------------------------------------------------------------ cyberware: the system's head / torso / hand shapes
HEAD = '<path d="M196 476v-74q-82-22-82-120 0-134 140-152 128-2 148 118l32 52q6 14-10 16l-22 2v44q0 30-30 30h-40v84z"/>'
TORSO = '<circle cx="256" cy="110" r="66"/><path d="M118 476V302q0-104 92-112h92q92 8 92 112v174z"/>'

CYBER_ICONS = {
    # neuralware: a chip wired into the head
    "neuralware": ("neuralware", HEAD +
                   f'<g fill="{BG}"><path d="M214 200h72v72h-72z"/><path d="M180 222h34v10h-34zM180 244h34v10h-34zM286 222h34v10h-34zM286 244h34v10h-34zM230 166h10v34h-10zM260 166h10v34h-10zM230 272h10v34h-10zM260 272h10v34h-10z"/></g>'
                   f'<path d="M232 218h36v36h-36z"/>'),
    # fashionware: sparkles on the head
    "fashionware": ("fashionware", HEAD +
                    f'<g fill="{BG}"><path d="M246 168l12 36 36 12-36 12-12 36-12-36-36-12 36-12z"/><path d="M318 268l7 20 20 7-20 7-7 20-7-20-20-7 20-7z"/><path d="M184 266l6 16 16 6-16 6-6 16-6-16-16-6 16-6z"/></g>'),
    # internal body: a heart with a pulse, in the torso
    "internal": ("internal body cyberware", TORSO +
                 f'<path fill="{BG}" d="M256 420l-76-74a46 46 0 0 1 76-50 46 46 0 0 1 76 50z"/>'
                 f'<path fill="none" stroke="{RED}" stroke-width="12" stroke-linejoin="round" d="M186 340h30l14-24 22 48 16-30 12 14h36"/>'),
    # external body: plates over the torso
    "external": ("external body cyberware", TORSO +
                 f'<g fill="none" stroke="{BG}" stroke-width="12" stroke-linejoin="round">'
                 '<path d="M212 254l44-24 44 24v48l-44 24-44-24z"/><path d="M168 336l44-24 44 24v48l-44 24-44-24z"/><path d="M256 336l44-24 44 24v48l-44 24-44-24z"/></g>'),
    # borgware: heavy chrome, a gear in the chest
    "borgware": ("borgware", TORSO + gear(256, 330, 62, 8, 20, 24).replace("<path", f'<path fill="{BG}"')
                 + f'<g fill="{BG}"><circle cx="150" cy="232" r="10"/><circle cx="362" cy="232" r="10"/><circle cx="150" cy="440" r="10"/><circle cx="362" cy="440" r="10"/></g>'),
    # a cyberfinger: a hand with one finger tooled
    "cyberfinger": ("a cyberfinger",
                    '<path d="M132 300h236v116q0 60-60 60H192q-60 0-60-60z"/>'
                    '<rect x="138" y="196" width="44" height="130" rx="22"/><rect x="190" y="150" width="44" height="170" rx="22"/>'
                    '<rect x="242" y="140" width="44" height="180" rx="22"/><path d="M294 300V90q0-22 22-22t22 22v210z"/>'
                    '<path d="M368 340l52-62q16-18 34-6t4 34l-66 96z"/>'
                    f'<path fill="{BG}" d="M294 118h44v12h-44zM294 150h44v12h-44zM294 182h44v12h-44z"/>'
                    '<path d="M308 70h16v-24h-16z"/><path d="M316 20l6 14 14 6-14 6-6 14-6-14-14-6 14-6z"/>'),
}


def cyber_icon(name, ctype, path, sysdir=""):
    """(our icon's key or None, the system's icon or None) for a piece of cyberware: the system's by name, else its kind's."""
    low = norm(name)
    leaf = path[-1] if path else ""
    for pat, rel in CYBER_ALIASES:
        if re.search(pat, low):
            return None, rel
    best = None
    for k in system_icons(sysdir, "cyberware"):
        toks = k.split("_")
        if f" {' '.join(toks)} " in f" {low} " or f" {''.join(toks)} " in f" {low} " or all(f" {t} " in f" {low} " for t in toks):
            if not best or len(k) > len(best):
                best = k
    if best:
        return None, f"cyberware/{best}.svg"
    if leaf == "Dynalar Cyberfingers" or "cyberfinger" in low:
        return "cyberfinger", None
    fallback = {"cyberArm": "cyberware/cyberarm.svg", "cyberLeg": "cyberware/cyberleg.svg", "cyberEye": "cyberware/cybereye.svg",
                "cyberAudioSuite": "cyberware/cyberaudio_suite.svg"}
    if ctype in fallback:
        return None, fallback[ctype]
    return {"neuralWare": "neuralware", "fashionware": "fashionware", "cyberwareInternal": "internal", "cyberwareExternal": "external",
            "borgware": "borgware"}.get(ctype, "internal"), None


def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", str(s).lower().replace("&", "and").replace("'", "").replace("’", "")).strip()


# names the system draws under another name
CYBER_ALIASES = [
    (r"\blow light infrared uv\b", "cyberware/lowlight_ir_uv.svg"),
    (r"\bhardened shielding\b", "cyberware/hardend_shielding.svg"),
    (r"\brealskinn?\b", "cyberware/realskin_covering.svg"),
    (r"\bsuperchrome\b", "cyberware/superchrome_covering.svg"),
    (r"\blinear frame (∑|σ|sigma)|\bsigma\b", "cyberware/implanted_linearframe_sigma.svg"),
    (r"\blinear frame (ß|β|beta)|\bbeta\b", "cyberware/implanted_linearframe_beta.svg"),
    (r"\blinear frame\b", "default/default-implanted-linearframe.svg"),
    (r"\bmantis blades?\b|\bchainripp\b|\bmonowire\b", "cyberware/popup_melee_weapon.svg"),
    (r"\bpopup (shotgun|net launcher)\b|\bprojectile launch system\b", "cyberware/popup_ranged_weapon.svg"),
    (r"\bhealth monitor\b", "cyberware/biomonitor.svg"),
    (r"\bholophone\b", "cyberware/radio_communicator.svg"),
    (r"\b(translation|poser) chip\b", "cyberware/skill_chip.svg"),
    (r"\bc link socket\b", "cyberware/chipware_socket.svg"),
    (r"\bneuroport\b", "cyberware/interface_plugs.svg"),
    (r"\bcybersuite\b", "cyberware/cyberdeck.svg"),
    (r"\b(monovision|bug eye|cybereyes|optics)\b", "cyberware/cybereye.svg"),
    (r"\boptical camo\b|\bchameleon\b|\bmasking ink\b", "cyberware/color_shift.svg"),
    (r"\b(dragoon|subdermal|nano) plating\b|\bfbc .*coating\b", "cyberware/subdermal_armor.svg"),
    (r"\bcyberhands?\b", "cyberware/standard_hand.svg"),
]

_SYSTEM_ICONS = {}


def system_icons(sysdir, folder):
    if not sysdir:
        return []
    if folder not in _SYSTEM_ICONS:
        d = os.path.join(sysdir, "icons/compendium", folder)
        _SYSTEM_ICONS[folder] = sorted(f[:-4] for f in os.listdir(d) if f.endswith(".svg")) if os.path.isdir(d) else []
    return _SYSTEM_ICONS[folder]


def write_cyber_icons(out):
    """Our cyberware icons, and a starred copy of each for Iconic cyberware."""
    os.makedirs(out, exist_ok=True)
    for key, (note, body) in CYBER_ICONS.items():
        svg = flat(key, body, note)
        open(os.path.join(out, f"{key}.svg"), "w", encoding="utf-8").write(svg)
        open(os.path.join(out, f"{key}_iconic.svg"), "w", encoding="utf-8").write(svg.replace("</svg>", STAR + "\n</svg>"))


# ------------------------------------------------------------------ marks laid over the system's own vector icons
def overlay(svg, fragment):
    """Lay a 512x512 fragment over a system vector icon, whatever its viewBox."""
    m = re.search(r'<svg\b[^>]*?viewBox="([-\d.\s]+)"', svg, re.S)
    x, y, w, h = (float(v) for v in m.group(1).split()) if m else (0, 0, 512, 512)
    end = svg.rstrip().rindex("</svg>")
    return (svg[:end] + f'<svg x="{x:g}" y="{y:g}" width="{w:g}" height="{h:g}" viewBox="0 0 512 512">{fragment}</svg>\n</svg>\n')


def starred_system(sysdir, rel):
    """A system icon with the Iconic star, and a note of where it came from."""
    src = open(os.path.join(sysdir, "icons/compendium", rel), encoding="utf-8").read()
    head = f"<!-- Derived from the Cyberpunk RED - CORE system icon {rel} (GPL-3.0); the Iconic star added by Neon Hub. -->\n"
    out = overlay(src, STAR)
    i = out.index(">", out.index("<svg")) + 1
    return out[:i] + "\n" + head + out[i:]


# A Full Body Conversion's role, as a white emblem on a dark disc, top-right of its frame's icon
EMBLEMS = {
    "talk": '<path d="M396 52h80q14 0 14 14v44q0 14-14 14h-46l-24 20v-20h-10q-14 0-14-14V66q0-14 14-14z"/>',
    "blade": '<path d="M472 44l14 14-70 70-20 4 4-20z"/><path d="M398 118l-22 22 10 10 22-22z"/>',
    "mask": '<path d="M386 74q50-20 104 0v26q-10 34-52 34t-52-34z"/><path fill="#1b1f21" d="M398 88h30v12h-30zM448 88h30v12h-30z"/>',
    "shield": '<path d="M436 42l50 18v34q0 34-50 52-50-18-50-52V60z"/>',
    "circuit": '<path d="M414 70h44v44h-44z"/><path d="M400 80h14v8h-14zM400 96h14v8h-14zM458 80h14v8h-14zM458 96h14v8h-14zM424 56h8v14h-8zM440 56h8v14h-8zM424 114h8v14h-8zM440 114h8v14h-8z"/>',
    "leaf": '<path d="M396 132q-4-80 92-90 4 92-80 92l40-46z"/>',
    "crown": '<path d="M390 120l-6-62 28 26 24-40 24 40 28-26-6 62z"/>',
    "flame": '<path d="M436 40q30 30 30 64a30 30 0 0 1-60 0q0-18 14-30 0 18 12 22 4-26 4-56z"/>',
    "radiation": '<circle cx="436" cy="92" r="10"/><path d="M436 82l-20-34a40 40 0 0 1 40 0zM446 98l40 0a40 40 0 0 1-20 34zM426 98l-20 34a40 40 0 0 1-20-34z"/>',
    "wave": '<path fill="none" stroke="#ffffff" stroke-width="12" stroke-linecap="round" d="M390 74q12-12 24 0t24 0 24 0 24 0M390 104q12-12 24 0t24 0 24 0 24 0"/>',
    "eye": '<path d="M386 92q50-56 100 0-50 56-100 0z"/><circle cx="436" cy="92" r="16" fill="#1b1f21"/>',
    "bomb": '<circle cx="430" cy="102" r="32"/><path d="M448 70l14-14 8 8-14 14z"/><path d="M470 46l6 6M480 56l6 2M476 40l2-6" stroke="#ffffff" stroke-width="6"/>',
    "bolt": '<path d="M446 38l-48 62h32l-12 46 52-66h-34z"/>',
    "wrench": '<path d="M468 46a32 32 0 0 0-40 42l-38 38 14 14 38-38a32 32 0 0 0 42-40l-20 20-16-4-4-16z"/>',
    "anchor": '<circle cx="436" cy="52" r="10" fill="none" stroke="#ffffff" stroke-width="8"/><path d="M432 62h8v74h-8zM414 78h44v8h-44z"/><path fill="none" stroke="#ffffff" stroke-width="8" d="M396 108q4 30 40 30t40-30"/>',
    "rocket": '<path d="M436 36q28 24 28 64v20h-56v-20q0-40 28-64z"/><path d="M408 104l-18 26h18zM464 104l18 26h-18z"/><circle cx="436" cy="80" r="10" fill="#1b1f21"/>',
    "person": '<circle cx="436" cy="62" r="18"/><path d="M402 136q0-50 34-50t34 50z"/>',
    "note": '<path d="M422 50l50-10v62a14 14 0 1 1-8-12V62l-34 7v47a14 14 0 1 1-8-12z"/>',
    "cross": '<path d="M424 46h24v34h34v24h-34v34h-24v-34h-34V80h34z"/>',
    "spark": '<path d="M436 42l12 38 38 12-38 12-12 38-12-38-38-12 38-12z"/>',
    # fashion styles
    "heart": '<path d="M436 136l-40-40a26 26 0 0 1 40-34 26 26 0 0 1 40 34z"/>',
    "gem": '<path d="M408 60h56l22 26-50 54-50-54z"/><path fill="#1b1f21" d="M420 72h32l-16 14z"/>',
    "wheel": '<circle cx="436" cy="92" r="40" fill="none" stroke="#ffffff" stroke-width="12"/><circle cx="436" cy="92" r="10"/><path d="M432 56h8v72h-8zM400 88h72v8h-72z"/>',
    "chevrons": '<path d="M398 64l38 22 38-22v18l-38 22-38-22zM398 96l38 22 38-22v18l-38 22-38-22z"/>',
    "skull": '<path d="M436 46q40 0 40 40 0 20-12 30v18h-56v-18q-12-10-12-30 0-40 40-40z"/><circle cx="420" cy="90" r="10" fill="#1b1f21"/><circle cx="452" cy="90" r="10" fill="#1b1f21"/><path fill="#1b1f21" d="M430 122h4v12h-4zM438 122h4v12h-4z"/>',
    "stitch": '<path d="M404 60h64v64h-64z"/><path fill="none" stroke="#1b1f21" stroke-width="7" stroke-linecap="round" d="M414 72l12 12M426 72l-12 12M446 100l12 12M458 100l-12 12M414 100l12 12M426 100l-12 12"/>',
    "flag": '<path d="M404 42h10v96h-10z"/><path d="M414 48h66l-14 22 14 22h-66z"/>',
    # martial arts families
    "fist": '<path d="M404 72q0-14 14-14h44q14 0 14 14v40q0 24-24 24h-28q-20 0-20-20z"/><path fill="#1b1f21" d="M418 74h6v22h-6zM434 74h6v22h-6zM450 74h6v22h-6zM404 96h48v6h-48z"/>',
    "grapple": '<path fill="none" stroke="#ffffff" stroke-width="12" d="M402 92a34 34 0 0 1 58-24M470 92a34 34 0 0 1-58 24"/><path d="M462 50v26h-26zM410 134v-26h26z"/>',
    "staff": '<path d="M404 128l64-64 10 10-64 64z"/><path d="M398 134l12 12-8 8-12-12zM468 54l12 12 8-8-12-12z"/>',
    "bow": '<path fill="none" stroke="#ffffff" stroke-width="10" d="M414 44q44 48 0 96"/><path d="M412 44h6v96h-6z"/><path d="M412 89h68v6h-68z"/><path d="M480 92l-14-10v20z"/>',
    "gun": '<path d="M396 70h86v22h-44l-8 14h-14l-8 30h-20l10-44h-2z"/><path fill="#1b1f21" d="M440 98h10v10h-10z"/>',
    "chrome": '<circle cx="436" cy="92" r="30"/><path d="M430 50h12v84h-12zM394 86h84v12h-84z"/><circle cx="436" cy="92" r="12" fill="#1b1f21"/>',
}

# The 2070s Martial Arts Forms, by family, each family with its emblem on the system's Martial Arts icon
MA_FAMILY = {
    "fist": ["Karate", "Taekwondo", "Boxing", "Muay Thai", "Krav Maga", "Kung Fu", "Choy Li Fut", "Silat", "Sov-System", "Game-fu"],
    "grapple": ["Aikido", "Judo", "Jujutsu", "Wrestling", "Sumo", "Thamoc", "Thrash Sambo"],
    "blade": ["Kendo", "Kenjutsu", "Fencing", "Niten Ichi Ryu", "Arnis"],
    "staff": ["Bojutsu"], "bow": ["Kyudo"], "gun": ["Gun Fu"], "mask": ["Ninjitsu"],
    "chrome": ["PanzerFaust", "Multiarm Melee", "Militech Commando", "Arasaka-te"],
    "wave": ["Capoeira", "Drunken Fist", "Tai Chi"], "flame": ["Rampage"],
}
MA_EMBLEM = {form: fam for fam, forms in MA_FAMILY.items() for form in forms}
BODY_ROLES = {
    "Arasaka ZSR-05 Murasaki": "talk", "Arasaka ZSR-07 Kawakami": "blade", "Arasaka ZSR-09 Fuma": "mask", "Arasaka ZSR-11 Benkei": "shield",
    "Arasaka ZSR-13 Seimei": "circuit", "Biotechnica Demeter": "leaf", "Continental Brands Laureate": "crown", "Dynalar Salamander": "flame",
    "Dynalar Thalassa": "wave", "Kiroshi Argus": "eye", "Militech Arachne": "mask", "Militech Hoplite War Platform": "shield",
    "Militech Kratos": "shield", "Militech Nemesis": "blade", "Militech Phoenix Security Unit": "bomb", "Moore Technologies Avalanche": "bolt",
    "Moore Technologies Gehenna": "radiation", "NovelTech Atlas": "wrench", "Orbital Air Galileo": "rocket", "Raven Microcybernetics Gemini IV": "person",
    "Raven Microcybernetics Sage": "circuit", "Sanroo Hello Cutie Pwr-Up Idol": "note", "Techtronika Burlak": "anchor", "Trauma Team Osler": "cross",
    "Zetatech Newman": "spark",
}


def emblemed(sysdir, rel, emblem):
    """A system icon with a white emblem on a dark disc, top-right, and a note of where it came from."""
    src = open(os.path.join(sysdir, "icons/compendium", rel), encoding="utf-8").read()
    mark = f'<circle cx="436" cy="92" r="70" fill="#1b1f21"/><circle cx="436" cy="92" r="70" fill="none" stroke="#ffffff" stroke-width="6"/><g fill="#ffffff">{EMBLEMS[emblem]}</g>'
    out = overlay(src, mark)
    i = out.index(">", out.index("<svg")) + 1
    return out[:i] + f"\n<!-- Derived from the Cyberpunk RED - CORE system icon {rel} (GPL-3.0); the {emblem} emblem added by Neon Hub. -->\n" + out[i:]


def body_icon(sysdir, frame_rel, name):
    """A body's icon: its frame's system icon with its role's emblem (or None, for a body without one)."""
    role = BODY_ROLES.get(name)
    return emblemed(sysdir, frame_rel, role) if role and sysdir else None


# Neon Hub's 2070s fashion styles, each with its emblem
STYLE_EMBLEMS = {"Kitsch": "heart", "Neo-Kitsch": "gem", "High Fashion": "crown", "Nomad Leathers": "wheel", "Neo-Militarism": "chevrons",
                 "Gang Colors": "skull", "Entropism": "stitch", "Colors & Uniforms": "flag"}
# the system's clothing icon for each kind of clothing
CLOTHING_ICONS = {"jacket": "generic_jacket", "top": "generic_top", "bottoms": "generic_bottoms", "footwear": "generic_footwear",
                  "jewelry": "generic_jewelry", "glasses": "generic_glasses", "mirrorshades": "generic_mirrorshades",
                  "contactLenses": "generic_contact_lenses", "hats": "generic_hat"}


DERIVED_LICENSE = """# Derived icons (GPL-3.0)

These icons are the Cyberpunk RED - CORE system's own icons (from
https://gitlab.com/cyberpunk-red-team/fvtt-cyberpunk-red-core) with marks added by Neon Hub: the
Iconic star on Iconic cyberware, a role emblem on each Full Body Conversion's frame icon, and a
style emblem on each 2070s fashion item's clothing icon. As
derivatives of the system's art they are under its license, the GNU General Public License v3.0,
not Neon Hub's MIT license. Each file names its source icon. They are generated by
`tools/gen/items2070.py`, `tools/gen/fullborg2070.py` and `tools/gen/fashion_icons.py` (see
`tools/gen/icons2070.py`).
"""


# ------------------------------------------------------------------ street goods (assets/goods), flat red like the system's gear
BOTTLE = f'<path d="M226 60h60v40l-6 14q46 30 46 82v226q0 26-26 26H212q-26 0-26-26V196q0-52 46-82l-6-14z"/><path fill="{BG}" d="M206 250h100v110H206z"/><path d="M226 276h60v12h-60zM226 310h40v12h-40z"/>'
CARROT = f'<path d="M136 440q-12 0-6-14l150-196 72 66-196 140q-10 6-20 4z"/><path d="M312 214l40-80q8 22-6 52 30-24 58-16-12 30-44 40 34-6 52 16-30 16-62 4z"/><path fill="{BG}" d="M222 318l22 18-8 8-22-18zM190 360l20 16-8 8-20-16z"/>'
FRUITS = (f'<circle cx="196" cy="306" r="100"/><circle cx="336" cy="318" r="92"/><circle cx="336" cy="318" r="104" fill="none" stroke="{BG}" stroke-width="14"/>'
          f'<path d="M196 206q4-50 44-74l10 14q-36 22-38 60z"/><path d="M232 150q46-20 76 6-44 20-76-6z"/>')
SMALL_STAR = '<path fill="#ffffff" d="M440 34l13 30 32 3-24 21 7 32-28-17-28 17 7-32-24-21 32-3z"/>'

GOODS_ICONS = {
    "bottle": ("a bottle", BOTTLE),
    "bottle-fine": ("a fine bottle", BOTTLE, True),
    "can": ("canned goods", f'<path d="M150 120q0-28 106-28t106 28v272q0 28-106 28t-106-28z"/><path fill="none" stroke="{BG}" stroke-width="12" d="M150 136q0 26 106 26t106-26M150 380q0 26 106 26t106-26"/><path fill="{BG}" d="M150 220h212v100H150z"/><path d="M190 250h132v40H190z"/>'),
    "carrot": ("root vegetables", CARROT),
    "veggies-exotic": ("exotic vegetables", CARROT, True),
    "fruits": ("fresh fruits", FRUITS),
    "fruits-exotic": ("exotic fruits", FRUITS, True),
    "chicken": ("a live chicken", '<path d="M200 140q0-50 44-50 26 0 40 22l34 6-24 22q8 30-8 56 80-10 132 30 18 70-30 130-50 54-150 50-110-6-130-100-16-70 62-110z"/><path d="M228 72l14-30 14 26 16-22 6 30z"/><path d="M200 412h16v54h-16zM280 412h16v54h-16zM184 466h48v12h-48zM264 466h48v12h-48z"/>' + f'<circle cx="250" cy="134" r="10" fill="{BG}"/>'),
    "fish": ("a live fish", f'<path d="M60 256q110-130 270-60l90-70q-14 64 0 260l-90-70q-160 70-270-60z"/><circle cx="150" cy="236" r="16" fill="{BG}"/><path fill="none" stroke="{BG}" stroke-width="12" d="M220 196q30 60 0 120"/>'),
    "pig": ("a live pig", f'<path d="M110 250q0-110 150-110 76 0 116 40l30-30 6 50q26 26 26 60l30 6v40l-36 10q-20 40-66 56v58h-44v-46h-90v46h-44v-62q-78-30-78-118z"/><circle cx="380" cy="226" r="12" fill="{BG}"/><path d="M80 236q-30 0-30-26 18 20 40 6z"/>'),
    "frozen": ("frozen goods", f'<path d="M180 70h152v240q0 22-22 22H202q-22 0-22-22z"/><path d="M244 332h24v120q0 12-12 12t-12-12z"/><path fill="{BG}" d="M214 100h16v170h-16zM282 100h16v170h-16z"/>'),
    "prepak": ("a bag of Prepak", f'<path d="M256 64l180 90v204l-180 90-180-90V154z"/><path fill="none" stroke="{BG}" stroke-width="14" stroke-linejoin="round" d="M76 154l180 90 180-90M256 244v204"/><path fill="{BG}" d="M150 110l180 90 26-12-180-90z"/>'),
    "sack": ("a sack of grain", f'<path d="M190 110h132l-26 46q120 60 120 200 0 90-100 90H196q-100 0-100-90 0-140 120-200z"/><path d="M182 84h148v30H182z"/><path fill="none" stroke="{BG}" stroke-width="14" stroke-linecap="round" d="M196 300q60 30 120 0M206 360q50 24 100 0"/>'),
    "snack-bag": ("packaged goods", f'<path d="M150 70l20 20 20-20 20 20 20-20 20 20 20-20 20 20 20-20 20 20 20-20v372l-20-20-20 20-20-20-20 20-20-20-20 20-20-20-20 20-20-20-20 20z"/><circle cx="256" cy="256" r="58" fill="{BG}"/><circle cx="256" cy="256" r="32"/>'),
    "coffee": ("coffee", f'<path d="M100 196h260v120q0 100-100 100h-60q-100 0-100-100z"/><path fill="none" stroke="#e64539" stroke-width="30" d="M360 236h20q46 0 46 46t-46 46h-30"/><path d="M80 436h320v24H80z"/>'
               '<path fill="none" stroke="#e64539" stroke-width="18" stroke-linecap="round" d="M180 150q-20-30 0-60M240 150q-20-30 0-60M300 150q-20-30 0-60"/>'),
    "grill": ("a barbecue grill", f'<path d="M96 196h320q0 120-160 120T96 196z"/><path d="M80 180h352v24H80z"/>'
              f'<path d="M190 300l-50 160h28l46-150zM322 300l50 160h-28l-46-150z"/><path d="M244 316h24v144h-24z"/>'
              '<path fill="none" stroke="#e64539" stroke-width="18" stroke-linecap="round" d="M190 140q-20-30 0-60M256 140q-20-30 0-60M322 140q-20-30 0-60"/>'),
    "oven": ("a smart oven", f'<path d="M76 110h360q20 0 20 20v252q0 20-20 20H76q-20 0-20-20V130q0-20 20-20z"/><path fill="{BG}" d="M100 150h240v212H100z"/><path d="M130 320q0-80 90-80t90 80z"/><path fill="{BG}" d="M362 162h56v24h-56zM362 210h56v24h-56zM362 258h56v24h-56z"/>'),
    "shower": ("a shower head", f'<path d="M110 460V150q0-80 80-80h70q60 0 60 60v40h-36v-40q0-24-24-24h-70q-44 0-44 44v310z"/><path d="M240 170h160l-24 60H264z"/>'
               '<path d="M268 270h18v50h-18zM312 270h18v70h-18zM356 270h18v50h-18zM290 350h18v40h-18zM334 360h18v50h-18z"/>'),
    "soundproofing": ("soundproofing", f'<path d="M88 88h336v336H88z"/><path fill="none" stroke="{BG}" stroke-width="14" stroke-linejoin="round" d="M120 130l40 40-40 40 40 40-40 40 40 40-40 40M200 130l40 40-40 40 40 40-40 40 40 40-40 40M280 130l40 40-40 40 40 40-40 40 40 40-40 40M360 130l40 40-40 40 40 40-40 40 40 40-40 40"/>'),
    "good-life": ("living the good life", f'<path d="M110 120h292l-146 160z"/><path d="M244 270h24v160h-24zM160 430h192v26H160z"/><circle cx="360" cy="110" r="34"/><path fill="{BG}" d="M160 140h192l-18 20H178z"/>'),
    "rough-night": ("a rough night", f'<path d="M330 120a160 160 0 1 0 100 280 150 150 0 0 1-100-280z"/>'
                    f'<path fill="none" stroke="{RED}" stroke-width="18" stroke-linejoin="round" d="M110 110h64l-64 70h64M210 70h44l-44 48h44"/>'),
    "drug": ("a drug", f'<path d="M150 140h212v300q0 22-22 22H172q-22 0-22-22z"/><path d="M134 80h244v60H134z"/><path fill="{BG}" d="M236 250h40v50h50v40h-50v50h-40v-50h-50v-40h50z"/>'),
    "local-expert": ("a Local Expert skill", f'<path d="M60 460V300h60v-60h50v-80h60v300zM290 460V220h56v-40h60v280z"/><path d="M40 460h432v20H40z"/>'
                     f'<path fill="{BG}" d="M256 40a96 96 0 0 1 96 96c0 70-96 170-96 170s-96-100-96-170a96 96 0 0 1 96-96z"/>'
                     f'<path d="M256 62a74 74 0 0 1 74 74c0 56-74 138-74 138s-74-82-74-138a74 74 0 0 1 74-74z"/><circle cx="256" cy="136" r="28" fill="{BG}"/>'),
}


def write_goods_icons(out):
    """The street goods' icons; the finer and exotic ones carry a white star."""
    os.makedirs(out, exist_ok=True)
    for key, (note, body, *star) in GOODS_ICONS.items():
        svg = flat(key, body, note)
        if star:
            svg = svg.replace("</svg>", SMALL_STAR + "\n</svg>")
        open(os.path.join(out, f"{key}.svg"), "w", encoding="utf-8").write(svg)


# ------------------------------------------------------------------ grenades: a red canister with a hazard diamond
# As the system's own grenade ammo icons are drawn: a red grenade on its side, a yellow hazard diamond
# over its lower right, and the grenade's kind in black inside the diamond. Drawn here, not copied.
INK, HAZARD = "#111214", "#f6c400"
CANISTER = (
    '<g transform="translate(226 262) rotate(38) scale(0.86)" stroke="#1b1f21" stroke-width="12" stroke-linejoin="round">'
    '<path fill="#2a2e33" d="M-84 136h168v62q0 18-18 18H-66q-18 0-18-18z"/>'  # base cap
    '<rect x="-100" y="-150" width="200" height="300" rx="34" fill="#d3282b"/>'  # body
    '<path fill="#8f1416" stroke="none" d="M44 -138h22q28 0 28 28v220q0 28-28 28H44z"/>'  # shade
    '<path fill="#ffffff" fill-opacity="0.55" stroke="none" d="M-74 -116h20v150h-20zM-44 -116h12v90h-12z"/>'  # shine
    '<path fill="none" stroke="#8f1416" stroke-width="10" d="M-96 -60h192M-96 40h192"/>'  # seams
    '<path fill="#2a2e33" d="M-80 -214h160v68H-80z"/>'  # top cap
    '<path fill="none" stroke="#5b6170" stroke-width="8" d="M-48 -206v52M-16 -206v52M16 -206v52M48 -206v52"/>'
    '<path fill="#2a2e33" d="M-30 -250h60v40h-60z"/>'  # fuse
    '<path fill="#3a3f5e" d="M24 -246l92 30v170l-26 10v-160l-66-24z"/>'  # spoon
    '<circle cx="-62" cy="-250" r="30" fill="none" stroke="#3a3f5e" stroke-width="12"/>'  # pin ring
    '</g>')
DIAMOND = (f'<path fill="{HAZARD}" stroke="#1b1f21" stroke-width="14" stroke-linejoin="round" d="M368 236l132 132-132 132-132-132z"/>'
           f'<path fill="none" stroke="{INK}" stroke-width="5" stroke-linejoin="round" d="M368 262l106 106-106 106-106-106z"/>')


def _star(n, ro, ri, rot=-90):
    import math
    pts = []
    for i in range(n * 2):
        r = ro if i % 2 == 0 else ri
        a = math.radians(rot + i * 180 / n)
        pts.append(f"{r * math.cos(a):.1f} {r * math.sin(a):.1f}")
    return f'<path d="M{"L".join(pts)}z"/>'


def _biohazard():
    import math
    rings = "".join(f'<circle cx="{24 * math.cos(math.radians(a)):.1f}" cy="{24 * math.sin(math.radians(a)):.1f}" r="22" fill="none" stroke="{INK}" stroke-width="9"/>'
                    for a in (-90, 30, 150))
    return rings + f'<circle r="10" fill="{HAZARD}" stroke="{INK}" stroke-width="7"/>'


# Each kind's symbol, in black, drawn about the diamond's centre in a box about 110 across.
GRENADE_GLYPHS = {
    "Armor-Piercing": ("an arrow through a plate", '<path d="M-8 -48h16v96H-8z"/><path d="M-54 -6h82v-18l30 24-30 24v-18h-82z"/>'),
    "Biotoxin": ("a biohazard sign", _biohazard()),
    "EMP": ("a lightning bolt", '<path d="M10 -54L-34 6h28l-14 48 46-62H-2z"/>'),
    "Flashbang": ("a flash", _star(8, 50, 20)),
    "Incendiary": ("a flame", '<path d="M0 -54c10 26 40 40 40 74a40 40 0 0 1-80 0c0-20 10-30 18-40 2 14 8 20 16 22-6-22 0-40 6-56z"/>'),
    "Poison": ("a skull and crossbones",
               f'<path fill="none" stroke="{INK}" stroke-width="10" stroke-linecap="round" d="M-44 14l88 36M-44 50l88-36"/>'
               f'<circle cy="-16" r="32"/><path d="M-18 4h36v22h-36z"/><circle cx="-12" cy="-18" r="9" fill="{HAZARD}"/><circle cx="12" cy="-18" r="9" fill="{HAZARD}"/>'),
    "Sleep": ("Zzz", f'<path fill="none" stroke="{INK}" stroke-width="10" stroke-linejoin="round" d="M-46 -6h34l-34 40h34M0 -40h26l-26 30h26M30 -58h18l-18 20h18"/>'),
    "Smoke": ("drifting smoke", f'<path fill="none" stroke="{INK}" stroke-width="10" stroke-linecap="round" d="M-30 44c-24-24 24-36 0-60s20-30 0-44M0 44c-24-24 24-36 0-60s20-30 0-44M30 44c-24-24 24-36 0-60s20-30 0-44"/>'),
    "Teargas": ("a crying eye", f'<path d="M-52 -8q52-50 104 0-52 50-104 0z"/><circle cy="-8" r="16" fill="{HAZARD}"/><circle cy="-8" r="8"/><path d="M16 22q12 18 12 26a12 12 0 0 1-24 0q0-8 12-26z"/>'),
    "Airburst": ("a capsule bursting", f'<g transform="rotate(-40)"><path d="M-36 -14h72a14 14 0 0 1 0 28h-72a14 14 0 0 1 0-28z"/><path fill="{HAZARD}" d="M0 -8h32a8 8 0 0 1 0 16H0z"/></g>'
                 f'<path fill="none" stroke="{INK}" stroke-width="8" stroke-linecap="round" d="M-48 -48l-10-10M48 48l10 10M48 -40l12-6M-48 40l-12 6"/>'),
    "Arachnid": ("a spider", f'<path fill="none" stroke="{INK}" stroke-width="7" stroke-linecap="round" d="M-8 -8l-30-24-10 18M-8 0l-36-6-12 22M-8 6l-32 14-6 26M-6 12l-20 28-2 16M8 -8l30-24 10 18M8 0l36-6 12 22M8 6l32 14 6 26M6 12l20 28 2 16"/>'
                 '<ellipse cy="-2" rx="14" ry="18"/><circle cy="-26" r="10"/>'),
    "KTech Security": ("a shield", f'<path d="M0 -54l44 16v30q0 44-44 64-44-20-44-64v-30z"/><path fill="none" stroke="{HAZARD}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" d="M-20 2l14 14 28-30"/>'),
    "Shuriken Tornado": ("a throwing star", _star(4, 54, 14, -45) + f'<circle r="9" fill="{HAZARD}"/>'),
    "Sonic": ("sound waves", f'<path d="M-50 -14h20l26-24v76l-26-24h-20z"/><path fill="none" stroke="{INK}" stroke-width="8" stroke-linecap="round" d="M10 -16q12 16 0 32M24 -30q24 30 0 60M38 -44q36 44 0 88"/>'),
    "Hello Cutie Chromatic Rave": ("music notes", '<path d="M-26 -40l56-14v66a14 12 0 1 1-10-12v-34l-36 9v50a14 12 0 1 1-10-12z"/>'),
    "Recon": ("a radar sweep", f'<circle r="48" fill="none" stroke="{INK}" stroke-width="8"/><circle r="22" fill="none" stroke="{INK}" stroke-width="6"/><path d="M0 0V-48a48 48 0 0 1 42 25z"/><circle cx="22" cy="18" r="7"/>'),
    "CO2": ("a snowflake", f'<path fill="none" stroke="{INK}" stroke-width="9" stroke-linecap="round" d="M0 -52v104M-45 -26l90 52M-45 26l90-52M-12 -44l12 12 12-12M-12 44l12-12 12 12"/>'),
    "Wall-Piercing": ("a blast spreading through a wall", '<path d="M-54 -50h22v30h-22zM-28 -50h10v30h-10zM-54 -16h10v32h-10zM-40 -16h22v32h-22zM-54 20h22v30h-22zM-28 20h10v30h-10z"/>'
                      f'<path fill="none" stroke="{INK}" stroke-width="9" stroke-linecap="round" d="M-6 0l52-40M-6 0h56M-6 0l52 40"/>'),
    "Laser": ("a hovering drone's beams", f'<ellipse cy="-34" rx="38" ry="14"/><path fill="none" stroke="{INK}" stroke-width="7" stroke-linecap="round" d="M-16 -22l-30 72M0 -20v70M16 -22l30 72"/>'),
    "Improved Smart": ("a target reticle", f'<circle r="40" fill="none" stroke="{INK}" stroke-width="9"/><path d="M-5 -56h10v34h-10zM-5 22h10v34h-10zM-56 -5h34v10h-34zM22 -5h34v10H22z"/><circle r="9"/>'),
}


def grenade_slug(kind):
    return re.sub(r"[^a-z0-9]+", "-", kind.lower()).strip("-")


def grenade_icon(kind):
    note, glyph = GRENADE_GLYPHS[kind]
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">\n'
            f'<!-- Neon Hub: a {kind} grenade ({note}). Drawn in the style of the Cyberpunk RED system\'s grenade ammo icons. -->\n'
            f'{CANISTER}\n{DIAMOND}\n<g transform="translate(368 368) scale(1.08)" fill="{INK}">{glyph}</g>\n</svg>\n')


def write_grenade_icons(out):
    os.makedirs(out, exist_ok=True)
    for kind in GRENADE_GLYPHS:
        open(os.path.join(out, f"{grenade_slug(kind)}.svg"), "w", encoding="utf-8").write(grenade_icon(kind))
