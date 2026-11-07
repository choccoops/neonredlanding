# Neon Hub: Full Borg

The 2070s Full Body Conversions for **Cyberpunk RED - CORE** on Foundry VTT, from the *Cyberpunk: The
Unification Era* Item Compendium. It's a companion to [Neon Hub](https://github.com/choccoops/neonredlanding)
and needs it.

| Requirement | Version |
| --- | --- |
| Foundry VTT | v12 |
| Cyberpunk RED - CORE | 0.92 (checked against the 0.92.4 source) |
| Neon Hub | the same release (1.17.0 or later) |

**Manifest URL:** `https://github.com/choccoops/neonredlanding/releases/latest/download/cpr-neon-full-borg.json`

## What's in it

- **Full Borg: Bodies (2070s)**: the Item Compendium's 25 bodies as actors, by maker, each built
  the way the book lists it:
  - the standard chassis, free in an FBC with its option slots doubled: Cyberarm ×2, Cyberaudio Suite,
    Cyberleg ×2, Cyberskull, an Internal Linear Frame and a Neuroport;
  - the body's eyes and base chrome, at no HL;
  - its chrome, installed where it goes, with enhancements and operating systems fitted.
- **Full Borg: Packages & Parts (2070s)**:
  - a package item for each body (price, Humanity Loss, the book's text) for shops;
  - the chassis parts;
  - the Biosystem;
  - Glucose-Rich Brain Solution, and a **Brain Starved** toggle (−2 to everything).

The bodies use the same chrome items as Neon Hub's Item Compendium (2070s), with its Active
Effects. A body's frame sets BODY, and so HP and Death Save; Internal Hydraulics raise REF, DEX and
MOVE before other chrome's penalties.

## Go Metal (GM)

Use the **Go Metal** button in a character or mook sheet's header, or drop a body package on the sheet.

1. Pick a body.
2. Choose how to take its Humanity Loss: **roll** the package's dice once, **take the average** (the
   FBC Baselines allow it), or **none**.
3. Choose whether to install a Biosystem (if there isn't one) and to uninstall the old body's chrome.
   The old chrome stays on the sheet, uninstalled.

Go Metal then:
- creates the body's chrome, installed where the body has it;
- doubles the Internal and External Body slots;
- rolls the Humanity Loss;
- lets CPR work out the new Maximum Humanity: the free chassis costs nothing, other chrome is −2 a
  piece, and Borgware and the Biosystem are −4.

**Switch bodies** takes out everything the old body put in, and **Leave the body** leaves just the
Biosystem.

Macros can use `game.modules.get("cpr-neon-full-borg").api`: `open(actor)`,
`goMetal(actor, bodyId, { hl, biosystem, stripOld })`, `leaveBody(actor)`, `isFBC(actor)`,
`state(actor)` and `bodies()`.

The rest of the FBC Baselines are the table's to run (Core Rules (2070), Chapter 09):
- the injury and Wound State immunities;
- immunity to drugs, poison and radiation;
- monthly brain food;
- repairs.

## License

MIT, like Neon Hub. The bodies carry the *Cyberpunk: The Unification Era* Item Compendium's Full Body
Conversions in its own wording; icons point to the Cyberpunk RED system's own. Cyberpunk RED is a
trademark of R. Talsorian Games. This is unofficial fan content and isn't approved or endorsed by R.
Talsorian Games or CD PROJEKT.
