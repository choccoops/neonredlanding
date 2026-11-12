# Changelog

## 1.25.0

- **Chrome takes its upgrades without editing the item.** Every piece of 2070 cyberware has one
  Enhancement slot (Core Rules Ch09), which is also where an Operating System goes, but the Item
  Compendium's chrome shipped with Cyberpunk RED's "installed items" switch off: a Sandevistan
  had to be edited before its Operating System would install. All 291 pieces now ship with it on
  (Cyberfingers excepted: they have no Enhancement slot), and limbs and other foundational pieces
  accept upgrades beside their options.
- **Chrome already in your world is fixed once.** The first time a GM opens the world after
  updating, every 2070 piece of chrome on character sheets, on unlinked tokens and in the Items
  sidebar gets the switch turned on, and an older copy dropped on a sheet later is fixed as it
  lands. To run it again: `game.modules.get("cpr-neon-hub").api.items.fixChromeSlots()`.
- **Counts as Borgware.** The Operating Systems and Enhancements whose entry says their piece
  counts as Borgware for Maximum Humanity (Falcon OS, Baldur OS, Endo-Lace Bracing, Firewall Port,
  Painducer; and the Apogee itself) carry `flags.cpr-neon-hub.countsAsBorgware`. Neon At Home
  1.14.0 reads it for the 2070 Maximum Humanity: −4 for that piece in place of −2.
- **Burst guns spend their bursts.** A weapon whose card says *Single Shot fires a 3-round
  burst* (the Yukimura, the Masamune, the Kenshin and some forty more) now spends that many
  rounds on a Single Shot or Aimed Shot. One that *won't fire with fewer* is refused by Cyberpunk
  RED's own ammo check; one that *empties the magazine* fires what's left. A card that says
  *Autofire uses 6 rounds instead of 10* (or 3 shells) is spent at that count, before the
  attachments' own changes. Both are read from the card's text, so weapons already on sheets
  count without being replaced.

## 1.24.0

- **Art redrawn to the 2077 setting.** Every aerodyne, aerozep and ground vehicle has new sheet art
  and a new top-down token, described from the game's own models: aerodynes with their thrusters
  set into the hull (no rotors or pods), aerozeps as long slab-sided hulls on lift fans, the Kujira
  as a twin-hull carrier with stepped decks, and each car, truck and bike line by its in-game shape
  and colors. The looks are in `tools/gen/ride_prompts.py`.
- **Boats, submersibles and ACPAs redrawn too.** The eight Hydrosubsidium, Arasaka and Zetatech
  boats are angular offshore-powerboat wedges in the game's car styling, and each has its own
  picture (the Bimac jetski and the Anguilla yacht had each other's). The six ACPAs are man-sized
  hydraulic exoskeletons under bolted plate rather than giant robots, with tokens seen from straight
  overhead. Token sizes follow the new art: Bimac 1 square (was 5), Viper 3 (was 5), Dumbo 3
  (was 2), Anguilla 5 (was 1).
- **Mook portraits redrawn and cut out.** All 136 portraits follow the factions' in-game looks and
  have a transparent background, so they sit cleanly in a token ring and in overlays that show the
  portrait on its own. The looks are in `tools/gen/data/mook_text.json`.
- **Named mooks stand on the map as top-down tokens:** Kurt Hansen, Melissa Rory, Sandayu Oda and
  Sasquatch. Any mook with a token in `assets/art/tokens/` uses it instead of the ring portrait.
- **New vehicles** (an actor and an item each), liveries on their base model's numbers:
  *Militech Manticore "MaxTac"*, *Militech Manticore "Herakles" (MaxTac)*, *Villefort Columbus
  V340-F NCPD "Tactical"* (8 seats), *Chevillon Centurion 1000 "REO Meatwagon"* (an old box
  ambulance), *Chevillon Thrax 388 Jefferson "Combat Cab"* and *Chevillon Emperor 620 Ragnar
  "Combat Cab"*. And one Iconic: *Quadra Turbo-R “Bigfoot” (Sasquatch’s Cab)*, a supercar in a cab's
  paint (MOVE 80, NOS ×3).
- **New mooks, Neon Hub's own stat blocks** built to the ranges of Corgo's (their sheets say so):
  **REO Meatwagon** (Paramedic, Driver, Senior Medtech, Hired Gun) and **Combat Cab** (Battledriver,
  Shotgun Rider, Veteran Battledriver, and the boss **Sasquatch**: Moto 10, Drive Land Vehicle 20).
- The two Surveyors' tokens are 3 squares like the other aerodynes (they were 1).

## 1.23.0

- **Range Table Modifications change the table.** The book's one *Range Table Modification* entry is
  now fifteen upgrades, one per option, in *Attachments & Mods › Range Table Modifications*: Snub
  Barrel and Long Barrel (Pistol), Short Barrel (SMG), Short Barrel and Choke (Shotgun), Carbine,
  Battle and Marksman Barrel (Assault Rifle), Scout Barrel and Long Barrel (Sniper Rifle), Short and
  Long Limbs (Bow), and Short, Standard and Long Tube (Launcher). Installing one sets the weapon's
  own range table (a Snub Barrel puts a pistol on DV Snubnose Pistol), and taking it out, or
  deleting it, puts the old table back. CPR's attack, Diwako's DV display and Neon Combat Manager
  follow, since they all read that table.
- **They have to fit, one at a time.** One for another kind of weapon, a second one, one with a
  Conversion Kit in, or one in the Magnum Opus Howitzer is refused with a warning. Exotic Weapons
  take the ones for the table they fire on.
- The book's single entry keeps its id and changes nothing; installing it says to pick the option.
  Older copies named after their option (the ACPAs' "Range Table Modification (Scout Barrel)") work
  by name. The ACPAs' guns carry the option's own upgrade now.
- `api.items.rangeMods.check(weapon, upgrade)`, which Neon At Home's Weaponbench (1.13.1) asks first.
- **Autofire works on the new tables.** Cyberpunk RED's Autofire switch looks for "*table*
  (Autofire)", and DV Tables (2070s) now has one for every table an autofire gun sits on: Snubnose,
  Pistol and Long Barrel Pistol, Subcompact SMG, the three shotguns, and Carbine, Battle and
  Marksman Rifle. Each copies its family's Autofire table: pistols and shotguns Machine Pistol, the
  Subcompact SMG SMG, and the rifles Assault Rifle, so a Carbine Barrel keeps an assault rifle on
  Assault Rifle. Before, Autofire on these measured on the single-shot table or on none. They show in
  CPR's DV table list next to their table but aren't for giving a weapon. Neon Combat Manager still
  uses the Autofire table a gun's card names.
- **Autofire attachments change the gun.** Pistol Autosear, SMG Cyclic Internals, the Shotgun
  Automatic Control Group, the Constant Recoil System, Upsized Power, the Binary Trigger and the ETE set the gun's Autofire rating
  and Suppressive Fire when they go in, and the Autofire table it fires on (a flag Neon Combat
  Manager 1.23.1 reads), and put the gun's own back when they come out or are deleted. A Pistol
  Autosear gives a pistol Autofire (Machine Pistol 3) and Suppressive Fire; a Constant Recoil System
  puts an assault rifle on Machine Gun 3; a Binary Trigger or an ETE takes Autofire and Suppressive
  Fire away. One that doesn't fit, a second one, or one the gun has built in is refused with a
  warning, and the Weaponbench asks first.
- **Rounds per burst follow the attachments.** Cyberpunk RED spends 10 on every Autofire and
  Suppressive Fire attack; now the Shotgun Automatic Control Group's slug bursts spend 4, the Gatling
  Barrel doubles, the Efficient Autosear makes 10 into 6, the Superior Autosear halves 20 or more,
  and the Burst Governor takes 5 off (to 5). CPR's ammo check and the rounds it takes out use the new
  count. The IronWind, the Mk. 31 HMG and the Huge-Man-Gun spend their cards' 20.
- **The control group's shell attack.** With shells loaded, its Autofire is the book's shell attack:
  the Autofire Skill for 4 shells, dodged at −3 (Neon Combat Manager 1.23.1 rolls the shells' damage
  and puts the −3 on the Evade).
- **New: Burst Governor**, the Street Stock Tech Upgrade, as an upgrade to install in the gun
  (*Invented Tech › Street Stock*, 1,000eb).
- **SMG Cyclic Internals is two items**, *(SMG 4)* and *(Machine Pistol 4)*; the book's entry keeps
  its id as the SMG 4 one. The BigSuit's Happy Dancer carries the Machine Pistol 4 one, as the book
  says, and the GunMart HomeSafe its control group's Machine Pistol 3.

## 1.22.3

- **Fixed: a wrong (Basic) on 2070s ammo in the Load Ammo dialog.** Ammo of a kind Cyberpunk RED has no type for (Explosive, Burrowing, Serrated, Harpoon and Hypo arrows, the Laser, Sonic and Recon grenades, HVAP and Combo Casings rounds, the ModBalls and the rest) was typed Basic, and the dialog adds the type to the name: *Arrow (Explosive) (Basic)*. They're the system's *Special* now, as its own odd ammo is (*Grenade (Arachnid)*). The type only labels the ammo; damage and ablation don't change.

## 1.22.2

- **Fixed: the Dayton M405 AdZep's token is 5×5**, like the other airships (it was 2×2).

## 1.22.1

- **Fixed: bows and arrows load the way Cyberpunk RED's do.** A bow holds one arrow, nocked as part of the Attack action (no Reload Action): load a stack of arrows and reload after each shot.
  - The generic **Bows / Crossbows** and the Nomad Laser-Bow held no arrows at all; every bow now holds one, with the Archery rule in its description. The crossbows whose entries give them a cassette, cylinder or magazine (Wasp, Hachi, Orion, WIP Crossbow, Hush, Xiezi, Twin Fang) keep it, with its Reload Action.
  - Arrows are named the system's way (*Arrow (Poison)*) in *Ammo & Explosives › Arrows*, come in stacks of 10 priced per 10 like the system's, and carry its damage settings and ablation (Poison 2d6, Biotoxin 3d6, Sleep and the Hypo arrow no damage; Poison, Biotoxin and Rubber don't ablate).
  - No more arrow / bullet hybrids: *Serrated Arrow / Hollow Point Ammunition* is now *Arrow (Serrated)* and *Hollow Point Ammunition (Heavy Pistol)* and the rest; likewise *Arrow (Warbow)* and *Overpressure Ammunition*. The stray *Improved Smart Ammunition (Arrow)* is gone (the book points arrows to Improved Smart Arrows).
  - **Arrow icons:** the system's own for the kinds it has (Basic, Armor-Piercing, Biotoxin, Expansive, Incendiary, Poison, Rubber, Sleep, Smart), and new ones in its style for the rest.
- **Mook ammo fits their guns.** Ammo a mook's guns couldn't load (no caliber given, or Corgo's caliber differs from the catalog gun) comes in the caliber they fire.

## 1.22.0

- **Mook Pack.** A new compendium, *Neon Hub: Mook Pack (Corgo's 77)*, with enemies ready to drop on a scene:
  - **128 mooks** from *Corgo's 77 Collection: Mooks* by Corgopolis (under R. Talsorian Games' Homebrew Content Policy), in 20 faction folders, as CPR mook actors: STATs, Skills, armor, weapons and gear from the Item Compendium, chrome installed, and notes for the rest;
  - **29 drones** from the Item Compendium (robots, walkers, air drones and turrets) as mooks, with CN as the base of their attacks, Evasion and Perception, and their weapons on the sheet;
  - every one has a painted portrait; the mooks show it in a token ring, the drones get a top-down token sized to the drone.
- **Art for every vehicle, ACPA and cyberpet.** All 197 ride actors have painted art on their sheet. Vehicles and ACPAs get a top-down token for the map, cut out on a clear background and sized by the ride (1 to 5 squares); cyberpets show their art in a token ring.
- **Grenades throw the way Cyberpunk RED throws them.** The Item Compendium now has the **Thrown Weapon** (Athletics with DEX, the DV Thrown Weapon table, one grenade loaded at a time): equip it, load a grenade like a gun, and throw.
  - The grenades sit with it in *Ammo & Explosives › Grenades*, named the system's way (*Grenade (Flashbang)*, *Grenade (Armor-Piercing)*), and keep their ids.
  - **Fixed:** the grenades now carry the system's damage settings. A thrown Flashbang, Smoke, Sleep, EMP or Teargas grenade no longer deals 6d6; Poison deals 2d6 and Biotoxin 3d6, as in Cyberpunk RED.
  - The Homing and Sticky Adapter Kits are gear (they modify a grenade; they aren't one to load).
  - **New grenade icons** in the style of the system's own: a red grenade with a hazard diamond showing its kind, one for each of the 20 kinds.
  - Mooks that carry grenades have a Thrown Weapon loaded with one.

## 1.21.0

- **Martial Arts Forms.** The Core Rules' 34 Martial Arts Forms (Chapter 07: the core four, the *Cyberfists of Fury* Forms and the house Forms) are in the Item Compendium under *Martial Arts*, each two ways:
  - **a Skill** (*Forms (Skills)*): Martial Arts (×2), DEX, a Fighting Skill and a Martial Art to Cyberpunk RED, with both its Special Moves and the shared rules (Special Move rolls, Recovery) in its description;
  - **a weapon** (*Attacks (Weapons)*) to attack with it on the sheet: ROF2, ignores half armor, and Brawling damage by BODY, worked out by Cyberpunk RED as for its own Martial Arts.
  - Their icon is the system's Martial Arts icon with an emblem for the Form's family: strikes, grapples and throws, blades, the staff, the bow, the gun, stealth, chrome, flow and rage.
- **Street Goods in the system's style.** The goods icons (food and drink, home goods, the Good Life and Rough Night) are redrawn as flat red icons like the rest of the compendiums; the exotic and finer goods keep their star. The Local Expert Skills get an icon of their own (a pin over the skyline) instead of the plain skill icon. Goods already in a world update with them.

## 1.20.0

- **Hub buttons open the other Neon modules' windows.** Neon Combat Manager and Neon At Home ship a macro for each of their windows. A new button action, **Open a Neon module window**, opens the same windows on the clicking player's screen, with the same calls those macros make:
  - Neon Combat Manager: the **Night City Map**, Holocall, Biomon Link, Plot Die and the Condition Lab (GM);
  - Neon At Home: Home, Loadout, Cyberdeck, Vehicle Bay, Weaponbench, Maintenance, Downtime, Biomonitor, Deep Dive, Perk Tree and Spend IP.

  Character windows open for the selected token's character, or the player's own. The action is in Monk's Active Tile Triggers' own action list too, for any tile, and in the API (`api.companions`).
- **The starter page's Night City button opens the Night City Map** when Neon Combat Manager is active (otherwise it's still a scene button). To point an existing page at the map, set its button to *Open a Neon module window: Night City Map* and Rebuild.
- **A Macros compendium.** *Neon Hub: Macros* has one macro per Neon Hub window, for the hotbar or Neon Combat Manager's Action HUD: Lifestyle, Calendar, Street Cred, Style Check, Headquarters, Neon Journal and Downtime, plus Skip Time and New Hub Page for the GM. Lifestyle, Street Cred and Style Check open for the selected token's character, or your own. The API's new `chooseHQ()` opens your HQ, or asks which one when there are several.
- **Night City Messenger: GM contacts.** Messenger buttons can open its GM contacts window too.

## 1.19.0

- **An icon for every piece of cyberware.** The Item Compendium's 292 pieces all used the system's plain cyberware icon. Now:
  - 175 take the system's own icons. Where the system draws the piece, it's matched by name, from the Cybereye and Sandevistan to Gills, the Linear Frames and the Popup weapons, including pieces it draws under another name (Realskinn, Superchrome Skin, Low Light / Infrared / UV, Mantis Blades, Optical Camo and the like). Other limb, eye and audio options take its Cyberarm, Cyberleg, Cybereye or Cyberaudio Suite icon, and cyberhands its Standard Hand.
  - Everything else takes a new icon for its kind, in the system's cyberware style: neuralware (a chip in the head), fashionware, internal body (a heart with a pulse), external body (plates), borgware (a gear in the chest) and the Dynalar cyberfingers.
  - Iconic cyberware carries the white Iconic star.
- **Fashion (2070s): each piece shows its style.** The 92 pieces keep the system's icon for their kind of clothing (jacket, top, bottoms, footwear, hat, jewelry, glasses, mirrorshades, contact lenses) with a white emblem for their style: a heart for Kitsch, a gem for Neo-Kitsch, a crown for High Fashion, a wheel for Nomad Leathers, rank chevrons for Neo-Militarism, a skull for Gang Colors, a stitched patch for Entropism and a flag for Colors & Uniforms.
- **Full Borg: each body has an icon of its own.** All 25 used one of three frame icons. Each keeps its frame (Σ, β or built in) and adds a white emblem for its role: the Murasaki's speech bubble, the Kawakami's blade, the Thalassa's waves, the Osler's cross, the Galileo's rocket and so on. The chrome in the bodies uses the new cyberware icons, and the bodies' option-slot boxes their kind's icon instead of a plain bag.

## 1.18.0

- **Fixed: broken icons on 423 items.** Every upgrade in the Item Compendium (the Melee Rebuilds, attachments, weapon mods, cyberware enhancements, operating systems, hardware, vehicle and armor upgrades, shields), and the same upgrades in the vehicles and Full Borg bodies, pointed at an icon the Cyberpunk RED system doesn't have. They show icons now:
  - the system's own where it has one for that upgrade (scopes, Smartgun Links, magazines, bayonets, underbarrels, KRASH Barrier, Backup Drive...);
  - otherwise a new icon for its kind, drawn in the system's upgrade style: Mono-edge Blading and Propulsion Impact, weapon attachments and mods, cyberware enhancements and operating systems, netrunning hardware, vehicle ICE, vehicle, bicycle and armor upgrades, armor enhancements, shield styles, Iconic weapon mods.
- **Generic Power, Smart and Tech guns.** Each generic gun comes in all three 2070s types, at Poor, Standard and Excellent Quality, in *Generic Weapons › Power / Smart / Tech Weapons*. The type is built in, free, and its rules are in the description. Grenade and Rocket Launchers stay as they are: Heavy Weapons take no Rebuild (HOUSE RULE).
- **An icon for every kind of vehicle.** Cars, trucks and the rest no longer all share the race car. Each vehicle shows what the book calls it, in the system's vehicle style: compact, high performance and super groundcars, pickups, vans, coaches, haulers, military rigs, roadbikes, superbikes, aerodynes, a jetski and a hoverboard. Gyrocopters, helicopters, aerozeps, boats, ships and the bicycle keep the system's own icons. Iconic vehicles carry a white star. ACPAs and cyberpets get icons of their own too (an armor frame, a paw).
- **Bicycle upgrades use the system's own icons** from *Spinning Your Wheels* where it has them (Bottle Dynamo, Cycle Armor, Trailer, Enclosure...).
- **Weapon icons show their type, and Iconics their star.** In the system's own pixel-art icons, a white badge bottom-left marks a Power (bolt), Smart (reticle) or Tech (double chevron) gun, and a star top-right marks an Iconic. The quality badge stays bottom-right.
- **Fixed: some weapons showed the plain default icon.** Medium Pistols, Heavy Pistols and Heavy SMGs (Iconics among them) asked for the system's icons with the wrong letter case. Excellent bows now use the system's Excellent bow icon too.
- **Smart weapons get their +1.** Every Smart gun (catalog, variant, Iconic or generic) has +1 to ranged Attacks on the weapon. Each typed gun also carries its type in the flag `cpr-neon-hub.weaponType2070`.

## 1.17.1

- **The Skydrivers and the CyberConductor now follow the Item Compendium.** The book now prints both, and Neon Hub uses its rows instead of its own entries:
  - the **Rocklin Augmentics Skydrivers** cost 1,000eb, like the Wyzard Romanova Cyberlegs;
  - the **Integrated Zetatech CyberConductor**'s program swap is once per Round, since a Program activates only once per Round.

  The Phoenix Security Unit and the Sage bodies carry the new text too.

## 1.17.0

- **Neon Hub: Full Borg**, a new companion module in the same repository and release. It brings the Item Compendium's 25 Full Body Conversions, each built on the sheet with its free chassis and chrome installed. A package item for each body can be sold in shops. **Go Metal** (GM) moves a character into a body: it uninstalls the old chrome, adds a Biosystem, doubles the Internal and External Body slots and rolls the package's Humanity Loss once. It can also switch bodies or leave one. Install it from `releases/latest/download/cpr-neon-full-borg.json`.
- **Two new catalog entries** in the book's style: the **Rocklin Augmentics Skydrivers** (paired cyberlegs with built-in Jump Boosters, which the Phoenix Security Unit stands on) and the **Integrated Zetatech CyberConductor** (the Sage's Borgware that runs its integrated decks as one). When the Item Compendium prints its own versions, the generator uses those instead.
- **Internal Hydraulics and implanted Linear Frames work on the sheet.** Their "REF, DEX and MOVE become 6 unless higher" and "BODY becomes 14" are Active Effects now. They apply before other chrome's penalties, so Dragoon Plating's −2 still counts.
- **Fixed: the Street Cred and Style Check tabs.** Their tab buttons used a name Foundry v12 keeps for itself, so clicking a tab did nothing. They switch tabs now, and the pre-release check stops that name coming back.

## 1.16.0

- **The 2070s Item Compendium.** The *Cyberpunk: The Unification Era* Item Compendium in Foundry, built from the book's own tables and text, with each item's chapter in its footer.
  - **Neon Hub: Item Compendium (2070s)**: about 1,800 items in the book's chapters. Weapons by class (generic, variants and iconics included), ammunition per ammo kind, explosives, attachments, rebuilds and mods, armor with SP and penalties, armor upgrades and shields, ACPA parts, cyberware by system with install, Humanity Loss and option slots, enhancements and operating systems, exotic packages, decks, cybersuites, hardware, quickhacks, programs and Black ICE, gear, apps, drones, drugs, security systems, vehicle upgrades, invented Tech Upgrades, and every vehicle as an item for character sheets.
  - **Neon Hub: Vehicles, ACPAs & Cyberpets (2070s)**: 197 actors for MMuton's CPR Vehicle Actor Sheet. Vehicles have SDP, SP, MOVE and crew seats from their seat count (driver, gunner, passengers), with bulletproof glass; ACPAs have a pilot seat with their onboard weapons mounted (attachments fitted, barrels on their new range tables) and their cyberware installed; and the eight cyberpets.
  - **Active Effects** for about 80 items' flat bonuses, read from the book's own lines. Cyberware works while installed, gear while equipped, drugs once dosed and booster programs while rezzed. Upgrades and activated chrome start switched off, and conditional skill bonuses are situational toggles on the roll.
  - **Neon Hub: DV Tables (2070s)**: the 2070 Core Rules' range tables (Chapter 07), plus CPR's own table names. Neon Hub offers the GM, once, to make them Cyberpunk RED's DV tables (`api.items.useDvTables`).
  - Items already in Street Goods, Lifestyle (2070s) and Fashion (2070s) aren't repeated. Full Body Conversions come in their own module.

## 1.15.0

- **Style Check.** Fashion analysis for 2070s Night City, from **Style Check** in the Actors sidebar, the **Style** button on a character sheet, or a new hub button action (and MATT action).
  - **The 2070 styles**: Entropism, Nomad Leathers, Kitsch, Neo-Militarism, Neo-Kitsch, High Fashion and Gang Colors. Older clothing reads as its 2070 heir, and in the 2070s era the sheet's style names show it.
  - **Look**: a grade from S to F out of 100 (coverage, cohesion, quality, fashionware flair, Wardrobe & Style, Personal Grooming and COOL), the full look, and the weapons, chrome and armor in plain sight.
  - **Districts**: how the look fits each of the eighteen districts and the Badlands, from Belongs to Marked, with a suggested social modifier and every reason, including colors on rival turf, chrome and weapons where they're unwelcome, money, and Street Cred Standing and Heat.
  - **Factions & Disguise**: which faction the look reads as, and a disguise planner with a roll.
  - **Shopping**: a shopping list for a district or a faction within a budget, with the grade and fit before and after, and **Buy and wear** through the wealth ledger.
  - **Street Feed**: the street's comments on the look, postable to chat.
  - **Scene (GM)**: the scene's district, every token's look and fit, the crew's cohesion and weakest link, and flashpoints.
- **Neon Hub: Fashion (2070s)**, a new compendium: 63 pieces, one of every style for every slot at the Item Compendium's prices, and 29 faction colors and uniforms.

## 1.14.0

- **Street Cred.** A new window for who knows you, who likes you and how hot the badge runs, by the 2070s rules' *Street Cred* chapter. Open it from **Street Cred** in the Actors sidebar, the **Cred** button on a character sheet, or a new hub button action (and Monk's Active Tile Triggers action).
  - **Reputation** is the character's own CPR Reputation. The GM raises or lowers it through its ledger, and anyone can roll **Recognize** or a **Facedown** to chat.
  - **Standing** from −10 to +10 with every faction, starting with the Players' Board: the gangs, the Scavengers, the Aldecaldos and Wraiths, the Afterlife, the corps, MaxTac and Lazarus. Each band says what it gets you and what their stores sell you at what discount. The GM moves it with −/+, along the bar, or with a deed (±1/±2/±3 with a reason, and rivals that drop by 1). New bands are whispered to the character's owners.
  - **Joining up.** At +4 a gang jumps them in or a corp hires them, one at a time; a *Ganger* or *Exec* role item's Rank follows Standing, and below +4 they're patched out. **Cooling off** flags Standing of +6 or better after three months without contact.
  - **Heat** with the NCPD, the other way round: what the badge does at each level.
  - **Relationships** with NPCs, Worldbook people or other characters (drop them onto the tab): how they feel from Arch-Nemesis to Ride or Die, tags, notes, romance, mutual with another character, and hidden ones for the GM.
  - The GM's **Board** shows every character against every faction. Settings: players see the whole crew, players edit their relationships, tell players about changes.

## 1.13.0

- **The Worldbook, revised to the Night City 2070 setting book.** It grows from 65 entries to 178 and now reads as the Night City of *Cyberpunk: The Unification Era*, just after the Arvin Accord.
  - **Revised.** Existing entries now follow the book: the NCPD as the city's one badge under Commissioner Ramos, MaxTac under Contender, Ziggurat's CitiNet and its fall, NetWatch and the Linkup, Barghest in the Occupied Zone, the gangs' 2070 leaders, and the boroughs with their eighteen districts. El Coyote Cojo now belongs to Rosa Delgado and La Catrina has Padre Ignacio, replacing the Mamá Welles and Padre Ibarra entries. The timeline is the book's.
  - **New.** All eighteen districts, each with its data block, places and people. Notable places: the Totentanz, Lizzie's Bar, the Bridgehead, the Clock Tower, the old Ziggurat tower, the Moon Garden, Bartmoss's Thumb and more, plus the NET itself. Danger Gal, the Puma Squad and the other new corporations and organizations. The Kimen-Gumi and twelve booster crews. Forty-odd people, from Lyle Thompson and the Static Night crew to every gang leader.
  - **GM secrets.** Sealed files and Lyle Thompson's theories (who Contender really is, the two Roxannes, the Flicker) sit in each entry's GM secrets block.
- **Events.** Worldbuilding has a sixth kind of entry, for history: when, where, who was involved and what it changed, outlined as what happened and its aftermath. The Worldbook brings twelve, from the Mob Wars to the Purge, Static Night and the Arvin Accord.
- Entries already imported into a world are left as they are. To get the new versions, delete them and **Import the Worldbook** again; new entries come in either way.

## 1.12.2

- **The Worldbook reads as an encyclopedia.** Its entries no longer end in gig hooks, and new worldbuilding entries are no longer outlined with a Gig hooks heading. Entries already imported into a world keep theirs: delete them and **Import the Worldbook** again to bring in the new versions.

## 1.12.1

- **Neon Journal editors keep what's already written.** The rich-text fields (a worldbook entry's write-up, a gig's briefing, a session's summary, a profile's notes, a log entry) opened empty instead of showing the existing text, so saving replaced it. They now open with it, and a field that hasn't finished loading when you save keeps its text.
- **Gig rewards up front.** The gig editor now goes details, crew, objectives, rewards, then the briefing, and the gig page shows objectives and rewards before the briefing. Record editors scroll as a whole, with Save and Cancel always in view.
- **Character journals for any character.** The GM can start a journal for any character, whether or not a player owns it yet (it used to offer only player-owned characters, so the button could vanish), and the button is always there for the GM.

## 1.12.0

The Neon Journal: Foundry's journals in Neon Hub's style, with gigs, the story and the downtime log.

- **The Neon Journal.** One window for every journal, with sections for Journals (by folder), Gigs, Story & Events and the Downtime Log, a search box, Back and Forward, and page tabs. Opening a journal anywhere in Foundry opens it here (a per-player setting, on by default); the book button opens an entry in Foundry's own journal. The GM can show, hide, set permissions on, rename and delete entries from it.
- **Gigs.** Each gig has a client, location, deadline, danger, crew, an image and a briefing, objectives that are open, done or failed, and rewards: eddies (each or split), IP, HQ IP, items, homes or a line of text. The GM takes, completes, fails or reopens it (stamping the in-world date), ticks objectives off, and **Pays out** a completed gig through the wealth and Improvement Points ledgers, the Headquarters and characters' inventories, with a chat card. **Post to chat** sends the crew its state and a link.
- **Screamsheets.** Weekly issues laid out like a paper: breaking news, news, developing stories, adverts and classifieds. **Roll stories** fills an issue from roll tables (starter tables in the new **Neon Hub: Screamsheet Tables** compendium, or your own); developing stories can be carried into the next issue. **Publish** opens it to players, posts the headlines to chat, runs a breaking-news ticker across every screen, and sends each character the headlines in Night City Messenger.
- **Worldbuilding.** Entries for corporations, gangs, places, organizations and people, each started from a template of facts and an outlined write-up with a GM secrets block.
- **The Worldbook (2070s).** A new compendium of 65 entries for the Night City of *Cyberpunk: Edgerunners*, written for Neon Hub from the facts in the *Edgerunner's Handbook*, with page references and gig hooks, plus a timeline. **Import the Worldbook** brings them into the world.
- **Character journals.** One per player character, owned by its players: a profile (handle, origin, goals, contacts, notes) and dated log entries.
- **Story & Events.** Chapters for the GM, each with session pages: numbered, dated in-world and in the real world, who was there, what happened and the key events.
- **Downtime Log.** Completing a downtime files its full record in the journal: the dates it ran and each character's log.
- Neon Journal records are text pages with a readable copy in their text, so they still read in Foundry's journal and without the module.
- Gig rewards in IP go through the CPR Improvement Points ledger, like eddies through the wealth ledger.

### Downtime vote fixes (from 1.11.1, not released separately)

- **Downtime vote:** typing an amount and clicking **Vote** (or the GM's **Start downtime**) straight away now always goes through. Before, leaving the field redrew the window under the click and the vote was lost. The amount on the button updates as you type.
- **Presets vote.** A player clicking a preset (1d, 3d, 1w…) now casts that vote straight away; before, it only filled in the amount until **Vote** was clicked. The GM's presets still just set the amount.
- Your own row in the vote is highlighted.

## 1.11.0

- **Downtime.** The GM calls downtime from the calendar (the mug button) for the characters taking part: a set amount in days, hours and minutes, or put to a vote like Skip time, with presets from a day to a month and the group's call. Each character gets that much time to spend, and a card with the total goes to chat.
- **The Downtime window.** Each character's time left and spent, and their log with where each spend falls on their calendar. **Log downtime** spends it by hand; players take back their own hand-logged spends, the GM anything. Players see only their own characters; the GM sees everyone.
- **Everyone's spent.** A full-screen alert for the GM, and a whispered card, when the last character's time runs out. **Complete downtime** posts a summary (with any unused time) and the Skip time clock winds through it on every screen on its own; the world clock and calendars move on at the end. **Call it off** ends it with no time passing. Earlier downtime is listed in the window.
- **For other modules.** `api.downtime` (`spend`, `remaining`, `balance`, `log`, `refund`, `current`, `open`, and for the GM `start`, `complete`, `cancel`) and `downtimeStarted/Spent/Refunded/AllSpent/Completed/Cancelled` hooks, so downtime actions elsewhere can spend the time into the log. No downtime actions are built in.
- Skip time shows days on the amount once past 24 hours ("+5d 3h"), and fires a `cpr-neon-hub.timeSkipped` hook when the clock has moved.

## 1.10.0

- **Households.** A home several characters share, set up by the GM on the Lifestyle window's new **Households** tab: pick the home from the catalog (and its rent, if different), who lives there, and how rent is paid. **Split evenly** puts a share in each inhabitant's bill; **one character pays** puts it all in the payer's; **pool** lets anyone chip in from their wallet during the month until it's covered, with a chat note for each contribution.
- Inhabitants see the household as their home on the Expenses tab, with their share, the payer, or the pool and a **Chip in** button.
- **Three weeks in a home (2070s).** Moving in is dated on the character's calendar (adding or switching on a home, joining a household). In the rent-day Humanity check, a new *Living-space tax this month* choice starts on "None: under three weeks" when they've lived there under 21 days, else on the home's tax and credit, and offers the street (6), a vehicle (3) or an upgraded vehicle (1) for a month with time in those. Kibble's tax and the rolls are unaffected.
- In the 2070s, the home's houseware slots are shared by everyone living there, CyberBeds add to how many it sleeps, and the home's Humanity tax, credit and monthly roll apply to each inhabitant; furnishings and art stay personal. Going over the home's sleepers asks the GM first.

## 1.9.2

- **2070s Kibble:** living on Kibble is now a flat **2 Humanity tax** each month plus the 1d6 for living below Good PrePak, instead of two 1d6 rolls. Kibble already on characters follows the new rule without being re-added. The rent-day check lists each tax (Kibble, home) on its own line.
- **2070s Living on the Street:** the 6 Humanity tax and the megabuilding-or-worse 1d6 each month; the 3d6 for living on the streets is now the GM's tick in the rent-day check, for when it fits what happened, instead of automatic. Homes already on characters follow this too.

## 1.9.1

- **2070s catalog:** each membership shows one *Needs Kibble / Generic PrePak / Good PrePak / Fresh Food* badge, with a lock when the character's lifestyle is below it, instead of the 2045 "in packages from tier" badge as well.
- Item descriptions in the Lifestyle window no longer show a stray space before punctuation after bold text (both eras).
- The rent-day Humanity check lines its two columns up at the top.
- README: screenshots of the 2070s catalog and the rent-day Humanity check.

## 1.9.0

Lifestyle for the 2070s, from a Living & Humanity Rework homebrew, alongside the 2045 Lifestyle.

- **Lifestyle era.** A world setting picks the era per campaign: **2045 (Time of the Red)**, the original catalog and the default, or the **2070s**. World homebrew can belong to one era or both.
- **Neon Hub: Lifestyle (2070s)** compendium, 88 items: the four 2070s lifestyle packages with their stat changes; memberships and health plans by lifestyle tier with their skill bonuses and arrival rolls; transit from the bus to the lifetime Delamain Excelsior, four fuels, a screamsheet, loan sharks and bank loans; real estate from the street to North Oak with houseware slots and Humanity tax or credit, and Living in a Ship; nine furnishing sets with their Humanity modifiers; houseware; art pieces; therapy and Immunoblockers for reference; homebrew templates. The existing pack is now labelled Lifestyle (2045).
- **Rent day (2070s).** Memberships bought mid-month start on rent day, and lapse when the lifestyle drops below them. Paying opens the month's **environmental Humanity check**: the GM ticks what happened, Neon Hub fills in what the lifestyle brings, rolls it all with the furnishing modifiers, housing tax or credit and displayed art, adds Living the good life when earned, and applies the net through the Humanity ledger.
- **Humanity incidents.** One-time Humanity Loss and Gain rolls for any characters, from the incident tables or custom dice.
- **Houseware and art.** Housing has slots, houseware fills them, and the Lifestyle window shows slots, sleepers, furnishings and art on display. **Make art** pays the materials, rolls the art skill against the quality's DV and adds the piece; music and acting can be performed for more.
- New item settings: era, up-front price, housing slots, Humanity tax and credit, the monthly Humanity effect, furnishing quality and modifiers, houseware slots, displays and extra sleepers, art Humanity. Cabs can be called like health plans.
- New icons for houseware, art, ships, megabuildings, Delamain, therapy and more.

## 1.8.0

- **Pop the month out.** A button beside the month picker moves the month grid into its own resizable window, so the calendar window keeps the date, time, rent, forecast and notes without crowding. Popped out, each day names its weather under the date. The two windows stay in step (pick a day in the month to read its notes; the GM's double-click still sets the date), and closing the month window docks it again. Each user's choice is remembered.

## 1.7.0

Night City weather on the calendar, from R. Talsorian's free Night City Weather.

- **Planned weather.** The GM plans weeks of weather per calendar from the DLC's tables: each day a temperature and a sky for the season, and Strange Weather on a 6 with its duration. Short events get a time of day; multi-day ones (flooding, inversion smog, cold snaps, heat waves, blackouts) carry on across the days. It can keep itself planned five weeks ahead as the date moves.
- **Turn weather off.** Any condition can be unticked so it's never rolled (rolls on it are rolled again), with a 2070s preset that drops radioactive windstorms and blood rain.
- **Hidden notes.** Each day's weather is a GM note on that day, with how it plays at the table (in Neon Hub's own words, with CP:R pages), revealed to players with the eye button.
- **On the calendar.** Weather icons and temperatures on each day, multi-day events as a coloured band across the days. The GM sees the real weather, players what they'd know: past days, today, and the forecast.
- **Weekly forecast.** On a set weekday players get a seven-day forecast, also posted to chat: reliable for tomorrow, shakier further out, temperatures as ranges, short strange weather as a chance that may be a false alarm, obvious multi-day storms called, blackouts never. Today's real weather is always shown.
- API: `weather()`, `planWeather()`, `postForecast()`.
- The calendar window opens a little taller to fit the forecast.

## 1.6.2

- **Fixed: Lifestyle and Headquarters tabs did nothing on Foundry v12**, and neither did Lifestyle's **Browse catalog** button. Foundry's own windows claim clicks on anything marked as a "tab" action and handle them their own way, so Neon Hub's tab switching never ran. The catalog, bills, month overview and every HQ tab open again.

## 1.6.1

- **Fixed: shop buttons didn't list Neon Market shops set up on tokens.** Neon Market's shop settings open from the token HUD, and an unlinked token (how Cyberpunk RED NPCs come by default) keeps its shop on the token, not on the actor in the Actors directory, which was the only place the list looked. The list now also shows those token shops, grouped by scene, and the button opens that token's shop.
- **Closed shops are listed too.** The list only showed shops ticked *Open for business*, and Neon Market starts shops closed. It now lists every shop, marks closed ones, and warns on a button whose shop is closed (players clicking it would get "shop closed").
- **Dropping a shop's actor now makes a shop button**, open or closed, on the button list or a button's drop zone. Dropping an actor that isn't a shop on a shop button says so instead of doing nothing, and a drop that fails shows the error.
- Each drop zone says what it takes ("Or drop a shop's actor here", "Or drop a scene here", …).
- The hub editor no longer breaks for shop buttons when Neon Market is disabled.

## 1.6.0

- **Skip time.** A Cyberpunk 2077-style time skip, from the **Skip** button on the calendar's time strip (GM) or `skipTime()` in the API. It opens on everyone's screen: players drag the hand around a 24-hour dial and vote, everyone sees the votes and the group's call (the median vote), and the GM goes with the call, any one vote or their own dial. Then every screen winds the clock through the skip: the sky over a Night City skyline turns from day to night, the sun and moon rise and set (sun times from SmallTime, the moon from its real phase), and each sunrise, sunset, moonrise, moonset and midnight is called out as it passes. The world clock moves on at the end, so calendars change day as usual.

## 1.5.0

The calendar runs on SmallTime's clock.

- **Days follow the world clock.** With [SmallTime](https://github.com/unsoluble/smalltime) 1.24.0 (its last release for Foundry v12) enabled, each calendar moves on a day whenever the world clock passes midnight, whatever moved it: SmallTime, the calendar, a macro or combat. Rent days, bills and HQ months run as usual, and going back past midnight moves the calendars back. Each calendar can opt out with **Moves with the world clock** in its settings.
- **Time controls in the calendar.** A time strip under the date shows the time to the GM, and to players when SmallTime lets them see the clock. The GM gets SmallTime's small and large steps, a day/night slider for the time of day, and a button that shows or hides SmallTime's window. SmallTime's window and darkness link follow along.
- **SmallTime shows the real Moon.** SmallTime's moon phase, and the moonlight darkness that goes with it, is set to the real Moon on the date of the first calendar that follows the clock (a world setting turns this off).
- API: `time()`, `advanceTime(minutes)` and `setTime("HH:MM")`.

## 1.4.1

- **Fixed: hovered buttons didn't light up.** Neon Hub changed only the tile's mesh, and Foundry v12 redrew the tile from its own texture straight away. The lit image now goes on both, the way Monk's Active Tile Triggers swaps tile images, and the pointer is read the way MATT reads it for its hover triggers. No rebuild needed if you rebuilt for 1.4.0.
- New console helper for troubleshooting: `game.modules.get("cpr-neon-hub").api.hoverStatus()`.

## 1.4.0

Hub buttons react to the pointer.

- **Hand cursor.** Working buttons now show Monk's Active Tile Triggers' pointer cursor. Their tiles trigger on click and hover, with landings that keep hovering from running the click actions.
- **Lit buttons.** Each working button gets a second, lit image: the button inverted into its accent colour, dark text and icon, and the second accent on its border and corner stripe (picture buttons get an accent wash over the picture). It's swapped in on each player's own screen while they hover, so it works for players while the GM is online and nobody sees anyone else's hover. Turn it off per page with **Light buttons up under the pointer**.
- Existing hub pages need one **Rebuild** to get both.

## 1.3.1

- **Fixed: building a hub page failed with "FP is undefined" on Foundry v12, and browse buttons did nothing.** Neon Hub looked up Foundry v12's FilePicker, TextEditor and FormDataExtended in a way that only works in v13. This also broke the hub editor's image and sound pickers, the HQ picture picker, dragging documents into the hub editor, HQ and calendar notes, links in notes, and saving Lifestyle item settings. All fixed, and uploads on The Forge go to your asset library.

## 1.3.0

One look across Neon Hub, and a door to Night City Messenger.

- **Night City Messenger buttons.** A new hub button action and MATT action, *Open Night City Messenger*, open the clicker's Agent inbox, a new message or contacts, or (GM) Network Management and the Admin Panel, from christinophrappuccino's [Night City Messenger](https://github.com/christinophrappuccino/night-city-messenger) module, installed alongside. The starter hub page has a Messenger button, and the API adds `openMessenger` and `showMessenger`.
- **Night City chrome theme.** The calendar's look as a theme for hub pages, Headquarters and Lifestyle: black chrome, notched corners with an accent stripe, uppercase Tektur titles and scanlines. It's the default for new pages and HQs and for the Lifestyle window; existing pages and HQs keep their theme.
- **Calendar styling everywhere.** Every Neon Hub window has the calendar's title bar; Headquarters and Lifestyle get notched panels, cards and buttons, `//` kickers and Tektur labels in any theme; the hub editor, item settings, dialogs and chat cards match.
- **Icons** redrawn as notched black chrome tiles to match.
- README screenshots updated, with a landing page and the chrome theme.

## 1.2.0

Calendar: group calendars that run the rent month, with the real Moon.

- **Calendar window.** One calendar per group, each with its own date, color, players and rent day. The GM shifts dates (±1 day, ±7 days, ±1 month), targets a day or double-clicks it, and posts the date to chat. Players see their calendars read-only and get a notice when the date changes. Other groups' dates show as markers on the grid. Opens from the left toolbar, a new *Open calendar* hub button and MATT action, the API, or the Lifestyle window.
- **Day notes.** Click a day to read and write its notes, Simple Calendar style. The GM's notes are hidden until made visible to players; players write their own, private until shared with their group. The GM sees and manages them all. Days with notes are marked on the grid, and dragged-in journals, actors and items become links.
- **Rent day.** Each calendar counts down to its rent day and marks it on the grid. Passing it starts the month for that calendar's characters (lifestyle bills due, or charged automatically with the new setting) and Headquarters (Morale Boost Humanity, rent due), and posts a rent-day notice. Jumping several months asks whether to bill each month or just skip the time. **To rent day** jumps straight there.
- **Lifestyle runs on the calendar.** Months are named after the character's calendar ("November 2045"), the window shows days to rent day, and characters who missed several rent days owe each month (installment loans count down month by month). Worlds without a calendar keep the **New month** counter.
- **Headquarters** can be tied to a calendar on their Setup tab and show the days to rent day.
- **The Moon.** Every day shows the real Moon's phase, computed with Meeus's *Astronomical Algorithms* method (new, quarter and full moons to within a minute or two), counted in Night City's time zone (a world setting).
- Layout and look follow Vokashu's Cyberpunk Calendar, rebuilt for Neon Hub; bundles the Tektur font (SIL Open Font License).

## 1.1.1

- **Lavish Luxury** furniture now costs 10,000eb (it was 100eb, cheaper than the +2 set). Copies already added to characters or imported into a world keep their old price; fix those by hand or re-add them from the compendium.

## 1.1.0

Lifestyle: rent and monthly expenses for every character.

- **Lifestyle window.** Each character's housing, lifestyle package, memberships, health plans, screamsheets, transit, fuel, loans and furnishings, with the month's bill, wallet and status. Open it from a hub button, the character sheet, the Actors sidebar or the Headquarters screen.
- **Equippable lifestyle items.** Lifestyle items are Cyberpunk RED gear: equipping one makes it active, so it's billed each month and its stat and skill bonuses apply; switching it off stops both. Only one lifestyle package is active at a time.
- **Monthly billing.** Players pay their own bill, or the GM bills everyone. Payments go through the CPR wealth ledger with a chat receipt. Installment loans count down and clear themselves. Wallets can go into debt (a world setting can turn that off). A month overview shows the GM who has paid.
- **Lifestyle compendium.** 72 items rewritten from the Datapool: Lifestyles homebrew (aru.guy & Henzard): 11 homes with purchase prices, core and "+" membership lifestyle packages, memberships, Trauma Team and other health plans with a response-time roll, 7 screamsheets, transit passes, fuel, loan-shark and car loans, and 9 furniture sets. Fixes the original's Streetwise bonus, which never applied.
- **Homebrew.** A template for every category, a "New homebrew item" button, and a Lifestyle settings form on any gear item's sheet for monthly cost, category and rules.
- **Street Goods & Lifepath compendium.** One-time items: 8 homebrew street drugs with their effects, Rough Night and Living the Good Life conditions, 15 food and livestock items, 5 home goods, and 8 Local Expert districts not in the core skill list.
- **Integration.** A new hub button action and MATT action, *Open Lifestyle*. Headquarters crew get the Morale Boost lifestyle discount automatically. Active furnishings add to the Headquarters' monthly Humanity roll. "New month" can roll every Headquarters' month too. The actor's own `system.lifestyle` fields are kept in sync.
- Tooling: unit tests, a pre-release check, and compendium packs built from JSON sources with Foundry's CLI.

## 1.0.0

First release, for Foundry VTT v12, Cyberpunk RED - CORE 0.92 and Monk's Active Tile Triggers 12.02+.

- Hub page editor with live preview, eight themes, background art, picture buttons, four button sizes, grid or hand-placed layout.
- Builds a hub scene of locked Monk's Active Tile Triggers click tiles and rebuilds it in place.
- Button actions: go to a scene, open a journal or page, open a character sheet (or the clicker's own), open a Neon Market shop, open a Headquarters, play a sound, control a playlist, show an image, run a macro; per-button click sounds; GM-only buttons.
- Two new MATT actions, usable on any tile: Open Neon Market shop and Open Headquarters.
- Headquarters screen from *No Place Like Home*: HQ IP awards and history, all twelve Improvements and their Upgrades, ten Morale Boost levels, rent and access status, Server Room eurobucks through the CPR wealth ledger, monthly Humanity roll with the Humanity ledger, player purchase proposals confirmed by the GM.
