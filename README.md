# Neon Hub: Landing Pages, Headquarters, Lifestyle, Calendar & Journal for Cyberpunk RED

Five tools for **Cyberpunk RED - CORE** on Foundry VTT:

- **Hub pages.** Build a clickable landing-page scene in a visual editor. Each button is a
  [Monk's Active Tile Triggers](https://github.com/ironmonk88/monks-active-tiles) tile that takes
  players to a scene, opens a journal or character sheet, opens a Neon Market shop, the crew's
  Headquarters, Lifestyle, the calendar or Night City Messenger, plays sound, shows an image or
  runs a macro.
- **Headquarters.** A crew HQ screen built on the *No Place Like Home* rules: HQ IP, the twelve
  Improvements and their Upgrades, the ten Morale Boost levels, rent and access, the Server Room's
  eurobuck cost, and a monthly Humanity roll.
- **Lifestyle.** Each character's rent and monthly expenses as equippable items: housing,
  lifestyle packages, memberships, health plans, screamsheets, transit, fuel, loans and
  furnishings, billed monthly through the wealth ledger, with compendiums of ready-made items
  and templates for your own.
- **Calendar.** Group calendars, one per crew, each with its own date and rent day. Passing rent
  day starts the month for that group's lifestyle bills and Headquarters, and every day shows the
  real Moon's phase. Downtime gives the crew time to spend, for other modules' downtime actions too.
- **Neon Journal.** Foundry's journals in Neon Hub's style, with a gig tracker (objectives,
  rewards and pay-outs), weekly screamsheets, worldbuilding with a 2070s Worldbook, a journal for
  each character, a story journal for sessions and events, and a log of every downtime.

| Requirement | Version |
| --- | --- |
| Foundry VTT | v12 (built with v13+ APIs in mind, see below) |
| Cyberpunk RED - CORE | 0.92 (checked against the 0.92.4 source) |
| Monk's Active Tile Triggers | 12.02 or later (required) |
| Neon Market | optional, for shop buttons |
| [Night City Messenger](https://github.com/christinophrappuccino/night-city-messenger) | optional, for messenger buttons |
| [SmallTime](https://github.com/unsoluble/smalltime) | optional: 1.24.0 on Foundry v12, for the world clock in the calendar |

![A landing page in the Night City chrome theme](docs/hub-page.webp)

**One look.** Everything in Neon Hub shares the calendar's style: black chrome, notched corners,
`//` labels and the Tektur typeface. New hub pages, Headquarters and the Lifestyle window use the
**Night City chrome** theme; the other eight themes are still there for pages and HQs that suit
them (existing ones keep the theme they had).

![Hub page themes](docs/hub-themes.webp)

## Install

**From a manifest URL (recommended, gets automatic updates):** in Foundry's setup screen open
*Add-on Modules*, click *Install Module*, paste the manifest URL from this project's release page,
and click *Install*. See [PUBLISHING.md](PUBLISHING.md) for the URL format.

**By hand:** unzip `module.zip` into `Data/modules/cpr-neon-hub/`.

Enable **Neon Hub** and **Monk's Active Tile Triggers** in your world.

## Hub pages (GM)

![Hub editor](docs/hub-editor.webp)

1. In the **Scenes** sidebar, click **New hub**. To edit an existing hub later, right-click its scene
   and choose **Edit hub page**.
2. Set the page on the left: title, theme, background art, page size and columns.
3. Add buttons. Drag a scene, journal, page, actor, playlist, track or macro onto the button list
   to make a button for it in one step, or click **Add** and fill it in on the right.
4. For each button, pick what happens **when clicked** and who sees it:

   | Action | What it does | Built with |
   | --- | --- | --- |
   | Go to a scene | Take the clicker there, pull everyone's view there, or make it the active scene | MATT `scene` |
   | Open a journal | A whole journal or one page, for the clicker or everyone | MATT `openjournal` |
   | Open a character sheet | A chosen actor, or **the clicking player's own character** | MATT `openactor` |
   | Open a Neon Market shop | Opens the shop on the clicker's screen | Neon Hub's own MATT action |
   | Open a Headquarters | Opens the crew HQ screen | Neon Hub's own MATT action |
   | Open Lifestyle | Opens each clicking player's own Lifestyle window (the GM gets the month overview) | Neon Hub's own MATT action |
   | Open calendar | Opens the calendar window for whoever it's shown to | Neon Hub's own MATT action |
   | Open Night City Messenger | Opens the clicker's Agent inbox, a new message or contacts; GM: Network Management or the Admin Panel | Neon Hub's own MATT action |
   | Play a sound | For the clicker or everyone | MATT `playsound` |
   | Control a playlist | Play, stop, pause, next, previous | MATT `playlist` |
   | Show an image | Image popout with a caption | MATT `showimage` |
   | Run a macro | As the player who clicked, or as the GM | MATT `runmacro` |

5. Click **Build hub scene**. Neon Hub draws the page and every button as images, saves them to
   `worlds/<your world>/cpr-neon-hub/`, and creates one locked click tile per button. **Rebuild**
   after any change; the same tiles are updated, not duplicated.
6. Click **Make active scene** (or put it in navigation) so players land on it.

**Good to know**

- Players click buttons with the token layer selected, which is their default. A GM on the Tiles
  layer selects tiles instead of clicking them; switch to the token layer to test.
- Buttons work while the game is paused.
- **Hover.** The pointer turns into a hand over a working button, and the button lights up:
  inverted into its accent colour, with the second accent on its border (picture buttons get an
  accent wash). Each player sees only their own hover. Turn it off with **Light buttons up under
  the pointer** in the page settings. Pages built before 1.4.0 need one **Rebuild** to get it.
  Lighting up works from the token layer, like MATT's hover triggers. If a button doesn't light up,
  `game.modules.get("cpr-neon-hub").api.hoverStatus()` in the console lists the lit images loaded.

  ![Hub buttons idle and lit on hover](docs/hub-hover.webp)

- **GM only** buttons are hidden from players and only respond to the GM.
- Want buttons in exact spots? Set **Button layout** to *Keep tiles where I put them* and rebuild
  once (the tiles unlock), move or resize them on the scene, then rebuild again. Each button is redrawn at its new size.
- The tiles are ordinary MATT tiles. You can open one with MATT's own editor and add more actions;
  rebuilding replaces the action list, so add extra steps after you're done with the hub editor.
- **Shop buttons** list every Neon Market shop: on actors in the Actors directory, and on unlinked
  tokens (a shop set up from a token's HUD belongs to that token), grouped by scene. Ones not yet
  ticked *Open for business* in Neon Market are marked *closed*, and the editor warns you, since players can't open
  a closed shop. Dropping a shop's actor anywhere on the editor (the button list or a button's drop
  zone) makes a shop button for it.
- Neon Hub's five actions also appear in MATT's own action list (group *Neon Hub*), so you can use
  them on any tile.

## Headquarters

![Headquarters screen](docs/headquarters.webp)

Open it from the **Headquarters** button in the **Actors** sidebar, a hub button, or a macro.

**GM setup:** click **New Headquarters**, then on **Setup** name it, choose a theme, set rent and
beds, and drag the crew's characters in. Players who own a crew character can open it. Tick
*Every player can open it* to show it to everyone. Use **Bookkeeping** to record Improvements a
crew already had before you installed the module (no HQ IP spent).

**Running it**

- **Award** HQ IP after missions. The DLC gives the crew HQ IP equal to the Group IP it earned.
- Every Improvement and Upgrade costs **40 HQ IP**. The Server Room also costs **20,000eb**, paid by
  one crew member or split evenly across the crew, through the Cyberpunk RED wealth ledger.
- **Players** see a **Propose** button instead of Buy. The GM gets a confirmation, because spending
  HQ IP is a crew decision.
- **Rent Reduction** can be upgraded once per original bed (it caps at double the beds).
  **Morale Boost** has ten levels; the screen shows which ones currently apply, since some
  replace earlier ones.
- **New month** rolls Morale Boost Humanity for each crew character (1d6/2, then 1d6 at level 4,
  then the higher of two 1d6 at level 9), adds it up to their maximum through the Humanity ledger,
  lets the system re-sync EMP, marks rent due and posts a summary to the crew.
- **Pay rent** takes it from one crew member or splits it. Paying rent on an HQ with no access
  restores access.
- Set **Access** to *No access* (benefits stop) or *Destroyed* (every Improvement is lost).
- The Garage, Server Room and Workstation each hold a link: drop the crew car, the NET
  Architecture or the Exec team member onto the panel.

The screen tracks and applies what can be automated (HQ IP, purchases, eurobucks, Humanity, rent).
Skill bonuses, LUCK, healing and the like are shown with the crew members who benefit, for the GM
and players to apply at the table.

**About the rules text.** Improvement and level descriptions are short summaries written for this
module. They are not the DLC's own wording. *No Place Like Home* (R. Talsorian Games, August 2024)
is free from R. Talsorian; check it for full details. To adjust a summary, edit `lang/en.json`
under `NEONHUB.Improvement` and `NEONHUB.Morale`.

## Lifestyle

![Lifestyle window](docs/lifestyle.webp)

Rent, food and everything else a character pays for each month. Open it from the **Lifestyle**
button on a character sheet, in the **Actors** sidebar or on the Headquarters screen, or from a hub
button set to *Open Lifestyle*.

**How it works.** A lifestyle item is an ordinary Cyberpunk RED **gear** item with Neon Hub's
lifestyle settings. It shows in the gear tab like anything else.

- **Active means equipped.** Equipping the item, either with the switch in the Lifestyle window or
  CPR's own equip toggle, makes it active. Active items are billed each month and their Active
  Effects (stat and skill bonuses) apply, because their usage is *equipped*. Switch an item off to
  stop both without losing it.
- Only one **lifestyle package** is active at a time; switching one on switches the others off.
- **Quantity** multiplies the cost, e.g. fuel for two cars.
- Add items with the catalog's **Add** button, so loans pay out and furnishings are charged. An
  item dragged straight from the compendium onto a sheet arrives switched off and free; a car loan
  added that way does nothing until the GM sets its amount and months on its Lifestyle settings.

**The window**

![Lifestyle catalog](docs/lifestyle-catalog.webp)

- **Expenses** lists the character's items by group, with the month's bill, wallet, what's left
  after paying, and reminders (rough nights, monthly checks). Items have their own buttons: **Buy**
  a rented home outright (no more rent), **Pay off** a loan, **Call it in** on a health plan (rolls
  the response time to chat).
- **Catalog** lists Neon Hub's lifestyle compendium plus any lifestyle items in the world's Items
  sidebar (homebrew). **Add** puts one on the character, active. Furnishings are paid for up front.
  Loans pay out their cash; a car loan asks for the vehicle's price, takes 10% down and sets 20
  monthly payments.
- **Bills** shows the character's last 24 bills.
- **Month** (GM) shows every player character's wallet, bill and status, with **Charge**,
  **Mark paid** and **Bill everyone due**. **New month** starts the next month. It can also charge
  everyone at once and start a new month at every Headquarters.

**Paying.** **Pay this month** charges the bill through the CPR wealth ledger and posts a receipt
to the owner and GM. Installment loans count down, and paid-off ones are removed. Bills can push a
wallet below zero (CPR allows negative eurobucks); the *Bills can put characters in debt* setting
turns that off.

**Who can do what.** Owners can always pay their bills, pay off loans, buy their home and roll
health plans. With *Players manage their own lifestyle* on (the default), they can also add,
switch and remove items. Otherwise, and for corporate perks or removing a loan, they send the GM a
request to confirm, like Headquarters purchases.

**With Headquarters**

- Crew of an active HQ with **Morale Boost** get its 50eb lifestyle discount on every bill.
- The window shows the HQ's rent and each member's share. Rent is still paid on the HQ screen.
- Active **furnishings** add their Humanity bonus (+1 to +3, best set only) to the HQ's monthly
  Morale Boost Humanity roll.

**Homebrew (GM)**

- **New homebrew item** in the catalog creates a world item in a *Neon Hub: Lifestyle homebrew*
  folder and opens its settings.
- The compendium's **Homebrew Templates** folder has a blank item per category; **Make a homebrew
  copy** copies one into the world.
- Any gear item's sheet has a **Lifestyle** header button: set its category, monthly cost and the
  category's details (sleeps, purchase price, Rough Night DV; package tier; response time; Humanity
  bonus; loan terms; a monthly check like *Library Search DV15*), or turn an item into a lifestyle
  item. Add bonuses on the item's Effects tab.

**Compendiums**

| Compendium | Contents |
| --- | --- |
| Neon Hub: Lifestyle | 11 homes (rents from the core rules, with purchase prices), the 4 core lifestyle packages and 4 "+" membership packages with stat bonuses, 7 memberships, 6 health plans, 7 screamsheets, 6 transit passes, 3 fuel tiers, 5 loans, 9 furniture sets, and 10 homebrew templates |
| Neon Hub: Street Goods & Lifepath | One-time items: 8 homebrew street drugs (Primary and Addiction effects), the Rough Night and Living the Good Life conditions, 15 food and livestock items, 5 home goods, and 8 Local Expert districts the core skill list doesn't have |

The numbers and rules come from the core rules and from the **Datapool: Lifestyles** homebrew
compendium by aru.guy and Henzard; the descriptions and icons are Neon Hub's own. Compared with
Datapool:

- Bonuses to Streetwise now apply (the original used a key CPR doesn't recognise).
- Smokestack's effects match its text (+2 / −1 COOL).
- Stardust's Performance Anxiety leaves out Play Instrument, which CPR splits into one skill per
  instrument.
- Core duplicates are left out: MRE, Kibble Pack, the Language skills and 13 of the Local Experts
  are already in Cyberpunk RED's own compendiums.

**With calendars.** Once the GM makes a calendar, it runs the months (see below): each character
is billed by their group's calendar, the window shows that month ("November 2045") and the days
to rent day, and a character who missed several rent days owes each month (up to 12). Without a
calendar, the GM starts months with **New month** as before.

### Households

A home several characters share. The GM sets one up on the **Households** tab of the Lifestyle
window: pick the home from the catalog (its rent can be changed), who lives there, and how the rent
is paid:
- **Split evenly**: each inhabitant's monthly bill carries an even share.
- **One character pays**: the payer's bill carries all of it; the others pay nothing for the home.
- **Pool until it's covered**: nobody's bill carries it; during the month anyone **chips in** from
  their own wallet until the rent is met (only what's still needed is taken). A new month starts an
  empty pool. Players chip in themselves; the GM sees each household's progress.

Each inhabitant's Lifestyle shows the household as their home, with its part of the rent. Owned
homes and corporate perks cost nothing. In the 2070s the home's houseware slots are shared: every
inhabitant's houseware fills them, and CyberBeds raise how many it sleeps. The home's Humanity tax,
credit and monthly roll apply to each inhabitant, while furnishings and art stay their own. Moving
in more people than the home sleeps asks before going ahead.

### The 2070s: Living & Humanity Rework

![2070s Lifestyle: the home's slots and art, the rent-day Humanity check, Make art and a Humanity incident](docs/lifestyle-2070.webp)

**Pick the era per campaign.** *Lifestyle era* in the module settings chooses between **2045
(Time of the Red)**, the catalog above and the default, and the **2070s**, built from a GM's
Living & Humanity Rework homebrew (a 2070s update of the Datapool lifestyles). The 2070s have their
own compendium, **Neon Hub: Lifestyle (2070s)**, which the catalog switches to, and these rules. The
numbers and mechanics are the homebrew's; the descriptions are Neon Hub's own.

![The 2070s catalog as a player sees it: memberships by lifestyle tier, locked above theirs, starting on rent day](docs/lifestyle-2070-catalog.webp)

**The 2070s catalog (88 items).**
- **Lifestyle packages**: Kibble (100eb, −1 COOL and WILL), Generic PrePak (300eb), Good PrePak
  (600eb, +1 WILL, the full-body-conversion perks) and Fresh Food (1,500eb, +1 WILL, +1 maximum EMP).
- **Memberships and health plans by tier**, with their skill bonuses: BrainBuster and the Supplement
  Shack (Kibble), HerbalCare, Shave & Save, Cryobank and REO Meatsavers (Generic PrePak),
  TicketMiser, Cleansing Matrix and Trauma Team Silver (Good PrePak), Mallbuster, the Diamond Club
  and Trauma Team Executive (Fresh Food), Corpo-Care Gold and Platinum, and the corporate housemate fee.
  Health plans and cabs roll their arrival with **Call it in**.
- **Transit**: the bus, NCART, NCab, North Oak Express, CombatCab, Delamain Ground and SkyRider,
  and the lifetime Delamain Excelsior (20,000eb once); **fuel** for bikes, cars, AVs and boats;
  Insider Trading Today; loan sharks and bank loans (bank loans need Good PrePak).
- **Real estate**: from living on the street to a North Oak McMansion, with rent or purchase price,
  bedrooms, how many it sleeps, parking, **houseware slots** and its Humanity tax or credit, plus
  Living in a Ship.
- **Furnishings** (bought per room): the nine megabuilding, apartment and North Oak sets, with their
  quality and their modifiers to Humanity Loss and Gain rolls.
- **Houseware**: the Augmented Reality Art Display, the Double-Trouble CyberBed, the Drinks Globe,
  the Auto Barista, both showers, soundproofing, the SmartOven and the Virtual Barbeque, each taking
  slots. **Art pieces** at each quality, and therapy and Immunoblockers for reference.

**Rent day.** When a character pays the month:
- Memberships bought after the last bill start now (until then they show *Starts on rent day*),
  and memberships the lifestyle no longer covers are cancelled. Players can't take a membership
  above their lifestyle; the GM can.
- The month's **environmental Humanity check** comes due. The GM opens it from the character's
  Lifestyle window or the month table: what their package, home, furnishings and displayed art
  bring is filled in, and the GM ticks the rest (worked for a corp, deaths, a loved one, a week off,
  a true friend…). One click rolls it all, adds the furnishings' modifiers, the Humanity tax or
  credit and the art, adds Living the good life when it applies, and applies the net change through
  the Humanity ledger with a chat card. Gains stop at maximum Humanity; losses can reach Cyberpsychosis.
- What comes automatically: Kibble is a 2 Humanity tax plus the 1d6 for living below Good PrePak;
  Generic PrePak is the 1d6; Fresh Food a 2d6 gain. Homes add their tax or credit and roll: the
  megabuilding-or-worse 1d6 (2d6 in a vehicle), the upscale 2d6 gain, and for a ship the 1d6 for
  time outside the city too. Living on the street is a 6 tax and the 1d6; the 3d6 for living rough
  is the GM's tick, for when it fits what happened.
- **Three weeks in a home.** A home's Humanity tax and credit only count after 21 days there; any
  time on the street or in a vehicle that month, that tax applies instead. Neon Hub dates each
  move-in on the character's calendar (adding or switching on a home, or joining a household), and
  the check's *Living-space tax this month* starts on "None: under three weeks" when the dates say
  so, else on the home's. The GM can pick the street, a vehicle or an upgraded vehicle instead. The
  rolls follow where they live either way, and Kibble's tax always applies. Without calendars (or
  for homes from before this was added) it starts on the home's.

![The GM's rent-day Humanity check: effects from the lifestyle filled in, the rest ticked by the GM](docs/lifestyle-2070-humanity.webp)

**Humanity incidents.** *Humanity incident* rolls the one-time Humanity Loss and Gain table (or
custom dice) for any characters, furnishing modifiers included, partying included.

**The home and art.** The Lifestyle window shows the home's houseware slots used, how many it
sleeps, the furnishings, and the art on display. Each piece of art needs its own ARAD, a home shows
no more pieces than it sleeps (a CyberBed's extra sleeper doesn't count), and a piece only counts in
a room furnished at its quality or finer. Second-hand furnishings allow no upgrades at all.
**Make art** spends the materials for a quality, rolls the art skill (Paint/Draw/Sculpt, Composition,
Photography/Film, Play Instrument or Acting) against its DV, and on a success adds the piece, worth 1
to 4+ Humanity a month on display. Music and acting can be performed too: the second skill's roll adds
the quality it reaches.

**Data.** Item settings live in `flags.cpr-neon-hub.lifestyle`, a character's bills in
`flags.cpr-neon-hub.lifestyleState`, and the month in a world setting. Neon Hub also mirrors
active housing, lifestyle package and health plans into the actor's `system.lifestyle.housing`,
`lifeStyle` and `traumaTeam` fields (part of CPR's data model, not shown on the 0.92 sheet).

## Calendar

![Calendar with the time strip, weekly forecast, weather on each day and the GM's weather note](docs/calendar.webp)

Open it from the calendar button in the left toolbar (Token Controls), a hub button set to *Open
calendar*, or the Lifestyle window. It works with no scene on the canvas.

**Month in its own window.** The pop-out button beside the month picker moves the month grid into
a window of its own, leaving the calendar window to the date, time, rent, forecast and notes.
Popped out, days have room to name their weather. Both windows stay in step: pick a day in the
month to read its notes in the calendar, and the GM can still double-click a day to set the date.
Close the month window (or **Back into the calendar**) to dock it again; it remembers your choice.

![The calendar with its month popped out into its own window](docs/calendar-popout.webp)

**Calendars per group.** The GM makes a calendar for each group of edgerunners, with its own
name, color, date, rent day and players. Players see the calendars open to them (no players ticked
means everyone) and can page through months, but only the GM changes dates. A **yours** tag marks a
player's own group, and colored diamonds on the grid show where the other calendars are.

**Setting the date (GM).**
- **±1 d, ±7 d, ±1 mo** move the date.
- Click a day to target it, then **Set as today**; double-click a day to set it at once; or type
  the date in the **Target** fields.
- **To rent day** jumps to the next rent day.
- The speech-bubble button posts the date to chat (whispered to the group if it has players).
- Players get a notice when the GM changes a calendar they can see.

**Notes.** Click a day to open its notes beside the grid. Anyone who can see the calendar can
write notes there, Simple Calendar style:

- The GM's notes are hidden from players until **Visible to players** is on.
- A player's notes are private to them (and the GM) until they tick **Share with my group**,
  which shows them to everyone who can see that calendar.
- The GM sees, edits and deletes every note; players edit their own. The eye button shows or
  hides a note in one click.
- Days with notes are marked on the grid: yellow for shared, cyan for private, grey for the GM's
  hidden ones. Drag a journal, actor or item into a note to link it.
- Player notes are saved on the player's own user, so they can write them without a GM online.
- Hiding is done in the interface. Foundry sends world settings and user data to every client,
  so a player reading the game data directly could find a hidden note; keep real secrets elsewhere.

**Rent day.** Each calendar has a rent day (the 1st by default; a day later than the month has
falls on its last day). The window counts down to it and marks it on the grid. Players see whether
their characters have paid, and the GM sees how many have. When the GM moves a calendar past
its rent day:

- A new month begins for every character on that calendar (their player is on it, or it's the
  first calendar): lifestyle bills become due. Turn on *Charge bills automatically on rent day* to
  charge them at once.
- Every Headquarters on that calendar rolls its new month (Morale Boost Humanity, rent due). Pick
  an HQ's calendar on its Setup tab; by default it follows its crew.
- A rent-day notice goes to the group's chat.
- Jumping past several rent days asks first: **Start N months** (bills for each month, HQ months
  for each) or **Just move the date** (a time skip: nobody owes for the skipped months).

**The Moon.** Every day shows the real Moon's phase, computed with the full method of Jean Meeus,
*Astronomical Algorithms* (chapter 49), which places new, first quarter, full and last quarter moons
to within a minute or two. Those four phases glow on the day they happen; hover for the name and
time. Days are counted in Night City's time zone (`America/Los_Angeles`), which decides the day a
phase lands on. Change it in the *Calendar time zone* setting. Each player can hide the moon in
their own settings.

**Time of day, with SmallTime.** With [SmallTime](https://github.com/unsoluble/smalltime)
enabled (1.24.0, its last release for Foundry v12; later ones need v13), the calendar runs on the
world clock that SmallTime shows:

- **Days follow the clock.** Each time the world clock passes midnight, every calendar that moves
  with the clock goes on a day, with rent days, bills and HQ months as usual. It doesn't matter what
  moved the clock: SmallTime's buttons, the calendar's, a macro or combat rounds. Going back past
  midnight moves the calendars back. A calendar's own **±1 d / ±7 d / ±1 mo** buttons still change
  only that calendar and leave the clock alone, so groups can be on different dates.
- **Moves with the world clock** is on for every calendar; untick it in the calendar's settings
  (the pen button) for one that should stay put, like a flashback. A link icon on the time strip
  shows which way it's set.
- **Time controls in the calendar (GM).** The time strip shows the time and has SmallTime's step
  buttons (its *small* and *large step* settings), a slider for the time of day (night, dawn, day
  and dusk along it, from SmallTime's sunrise and sunset), and a button that shows or hides
  SmallTime's own window. These move the same world clock, so SmallTime's window and its darkness
  link follow along. The slider stays on the same day; step past midnight to change the day.
- Players see the time when SmallTime lets them see its clock in that scene.
- **Skip time** (GM, the **Skip** button on the time strip) opens a Cyberpunk 2077-style window
  on everyone's screen. Players drag the hand around a 24-hour dial to how long they'd skip and
  vote; everyone sees the votes and the **group's call** (the median vote, so one wild vote can't
  drag it). The GM uses the call, any one vote, or sets the dial, then **Skip**: every screen winds
  the clock through it, with the sky over a Night City skyline going from day to night and back,
  the sun and moon rising and setting, and each sunrise, sunset, moonrise, moonset and midnight
  called out as it passes. The world clock moves on at the end, so calendars change day as usual.
  Sun times come from SmallTime's sunrise and sunset; the moon rises with the sun when new and at
  sunset when full, about 50 minutes later each day, using its real phase. **Call it off** closes
  it for everyone. Up to 24 hours at a time.

  ![Skip time winding through sunset, with the group's votes](docs/skip-time.webp)

- **SmallTime's moon** is set to the real Moon's phase on the date of the first calendar that moves
  with the clock, which also drives SmallTime's moonlight darkness. Turn off *SmallTime shows the
  real Moon* to set it by hand in SmallTime.

**Downtime.** The GM calls a stretch of downtime and each character taking part gets that much
time to spend on downtime actions, from a pool of days, hours and minutes. Neon Hub keeps the
books; what the time is spent on (healing, crafting, gigs, a module's own downtime actions) is up
to the table and to other modules, which spend it through the API.

- **Calling it (GM).** The mug button in the calendar's header opens **Downtime**. **Call
  downtime** picks who takes part, a name for it ("After the Arasaka job") and either a set amount
  in days, hours and minutes, or **put it to a vote**: like Skip time, players propose an amount
  (1 day, 3 days, a week, two weeks, a month, or their own), everyone sees the votes and the
  group's call, and the GM starts it with the call, a vote or their own number. A card goes to
  chat with the total and who's in it, and Downtime opens for the GM and the players taking part.
- **Spending it.** Each character's card shows the time left and spent and their log, each entry
  placed on their calendar ("Mar 14–16") in the order it was spent. **Log downtime** spends time
  by hand; other modules spend it for their own actions. Players can take back what they logged
  by hand; the GM can take back anything. Players see only their own characters.
- **Everyone's spent.** When the last character's time runs out, the GM gets a full-screen alert
  and a whispered card. The GM reviews the log, then **Complete downtime**: a card sums it up
  (with any time left unused), and the Skip time clock opens on every screen and winds through
  the whole downtime on its own, counting the days (over three days, the sky plays the first and
  last day and holds still in between rather than flickering). The world clock moves on at the end
  and calendars change day with it. **Call it off** ends it without passing any time. Past downtime is listed
  under *Earlier downtime*.

**Night City weather.** Weather from R. Talsorian's free **Night City Weather** for Cyberpunk RED.
Neon Hub uses its dice tables; the rules summaries are Neon Hub's own short versions, with core
rulebook pages.

![The Weather window: planning, the weekly forecast and which weather can happen](docs/weather.webp)

- **Planning (GM).** The cloud button on a calendar (or **Weather** on its forecast strip) plans
  days ahead from the calendar's date. Each day rolls a temperature and a sky (Clear, Overcast,
  Light or Heavy Rain, sleet when it's cold) on the season's table, and a 6 goes to Strange Weather
  with its duration: short events (acid rain for 3 hours from about 14:00) or ones that last days
  (flooding, inversion smog, cold snaps, heat waves, blackouts), which carry on across the days
  and set the temperature for cold snaps and heat waves. *Keep weather planned five weeks ahead*
  extends it as the date moves.
- **Weather you don't want.** Untick any condition and rolls that land on it are rolled again. The
  **2070s** preset turns off radioactive windstorms and blood rain.
- **Notes.** Each day's weather appears as a hidden note on that day for the GM, with how the
  temperature and conditions play at the table. The eye button reveals it to players.
- **The calendar.** Days show their weather beside the date, and multi-day events run as a coloured
  band along the days they cover. The GM sees the real weather; players see what they'd know:
  past days and today as they were, and the forecast (dashed, with temperature ranges) for the
  days ahead.
- **The weekly forecast.** On the calendar's forecast day (Monday by default) players get a
  forecast for the next seven days, posted to the group's chat too. It's usually right about
  tomorrow and close to a coin flip a week out, temperatures come as ranges that widen with
  distance, and short strange weather shows only as a chance ("Acid Rain possible: 30%") that can
  be missed or a false alarm. Obvious multi-day storms are called; blackouts never are. Players
  find out for sure on the day: the forecast strip shows today's real weather.

![A player's calendar: past days as they were, the forecast dashed, nothing further ahead](docs/calendar-player.webp)

**Settings.** *Calendar time zone* and *SmallTime shows the real Moon* (world). *First day of the
week*, *Show moon phases* and *Notify on date change* (per player).

The calendar's layout and look follow Vokashu's **Cyberpunk Calendar** module, rebuilt for Neon
Hub; none of its code is used. The Tektur font is © 2023 The Tektur Project Authors, under the SIL
Open Font License 1.1 (`fonts/Tektur-OFL.txt`).

## Neon Journal

Every journal in the world, in one window in Neon Hub's style. With *Open journals in the Neon
Journal* on (a per-player setting, on by default), opening any journal (from the Journal tab,
a link, or the GM's **Show to players**) opens it here; the **Neon Journal** button on the Journal
tab opens it any time. The book button on an entry opens it in Foundry's own journal.

- **Sections.** *Journals* is every other journal, by folder. *Gigs*, *Screamsheets*,
  *Worldbuilding*, *Characters*, *Story & Events* and *Downtime Log* hold Neon Hub's own records,
  each filed in a folder of that name. Compendium journals still open in Foundry's own window. A search box
  filters the list, and Back and Forward step through what you've looked at.
- **Pages.** Text, image, video and PDF pages show in the window; links and inline rolls work as
  usual. Owners add pages and edit them in Foundry's page editor (the pencil).
- **For the GM.** On each entry: who can see it (the eye: all players, or only the GM), **Show
  to players**, permissions, rename and delete. The list marks entries no player can see.

**Gigs.** **New gig** makes one and opens its editor:

- The gig's name, an image (shown as a banner), client, location, deadline and danger, the crew
  taking it, and a briefing in the rich-text editor.
- **Objectives**, each open, done or failed. The gig shows them grouped (current, completed,
  failed) with a progress bar; the GM clicks an objective's box to move it along.
- **Rewards:** eddies (each, or split between the crew), IP each, HQ IP for a Headquarters, items
  and homes (drop them from the sidebar or a compendium), or anything else as a line of text.
- **Players can see this gig** decides whether players find it in their Gigs list.

The GM moves a gig along with **Take the gig**, **Completed**, **Failed** or **Reopen**, each
stamping the in-world date it happened. Once it's completed, **Pay out** asks who gets paid:
eddies go through the wealth ledger, IP through the Improvement Points ledger, HQ IP to the
Headquarters, items and homes to the character picked, and other rewards are marked as given. A
card goes to the crew in chat and the rewards show as paid. **Post to chat** sends the crew a
card with the gig's state and objectives and a link to open it (everyone, if players can see it).
The list filters gigs by Open, Found, Active, Done, Failed or All.

**Screamsheets.** A weekly paper for the crew, laid out like one: masthead, breaking news, news
in columns, developing stories, adverts and classifieds.

- **New issue** (GM) starts a draft numbered after the last one and dated today, with any
  developing story marked *Follow up* carried over as an update.
- **Roll stories** fills the issue from roll tables, a number of each kind. The **Neon Hub:
  Screamsheet Tables** compendium has starter tables (breaking news, city news, developing stories,
  adverts and classifieds, all original); **Generator tables** swaps in your own tables and sets how
  many stories each kind adds. A result reads `Headline | the story`; without a bar, a long
  result's first sentence is the headline.
- Write or change any story in the editor (the pencil): its kind, headline, text and byline.
- **Publish** lets players read the issue, posts a card with the headlines to chat, runs a
  breaking-news ticker across the top of everyone's screen (click it to read the issue), and, with
  **Night City Messenger**, sends each player character the headlines in their inbox (a world
  setting turns that off). Drafts are the GM's until published; **Send the alert again** repeats
  the card and ticker.

**Worldbuilding.** Entries for corporations, gangs, places, organizations and people. **New entry**
(GM) asks which kind and starts it from that kind's template: a line about it, facts to fill in
(a corporation's headquarters, industry and leadership; a gang's turf, rivals and hangouts; and so
on), and a write-up outlined with headings and a GM-only secrets block. Entries are GM-only until
**Players can read this** is ticked. Filter the list by kind.

- **The Worldbook (2070s).** The **Neon Hub: Worldbook (2070s)** compendium has 65 entries for
  the Night City of *Cyberpunk: Edgerunners*: the megacorps, the gangs, the districts with their
  notable spots, the NCPD, MaxTac, Netwatch and the nomad nations, and notable people from the
  fixers to the Edgerunners crew (marked as spoilers), plus a timeline. Each is a short summary
  written for Neon Hub from the facts in R. Talsorian's *Edgerunner's Handbook* (from the
  *Cyberpunk: Edgerunners Mission Kit*), with the handbook page, and a gig hook or two. **Import the
  Worldbook** copies them into the world, filed by kind and hidden from players, ready to edit.

**Characters.** A journal for each player character, theirs to write in. **Start a journal** makes
one (players for their own characters, the GM for anyone, or everyone at once); it belongs to the
character's players and the GM can read it. It opens on a **Profile**: handle, where they're from,
goals to tick off, contacts, and notes. **Log entry** adds a dated page for what happened, dated on
the character's calendar.

**Story & Events (GM).** **New chapter** starts a chapter of the campaign with an Overview page.
**Session** adds a session page, numbered after the last one, dated in-world and with today's
date, and with the player characters ticked: write what happened in the editor and list the key
events, starring the turning points. Chapters are the GM's own until shown to players.

**Downtime Log.** Each time the GM completes a downtime, its full record is filed here: the
total, the dates it ran, and each character's log with what they spent their time on and when,
as it stood at the end. Records are kept as they were and are GM-only until shown.

Neon Journal records are ordinary text pages with their data attached, and each keeps a
readable copy in its text, so they read fine in Foundry's own journal and without Neon Hub.

## Night City Messenger

[Night City Messenger](https://github.com/christinophrappuccino/night-city-messenger) by
christinophrappuccino (MIT) gives every character an Agent with messages, contacts and eurobuck
transfers, plus networks, data shards, terminals and hacking. It's a separate module with its own
look, its own updates and its own sounds; install it alongside Neon Hub to use it.

With both enabled, a hub button set to **Open Night City Messenger** opens one of its windows for
the player who clicks (or whoever the button shows to):

| Opens | Who |
| --- | --- |
| Inbox (the character's Agent) | everyone |
| New message | everyone |
| Contacts | everyone |
| Network Management | GM (players get their inbox) |
| Admin Panel | GM (players get their inbox) |

The new starter hub page includes a **Messenger** button. Without Night City Messenger the button
does nothing but say so, and the hub editor warns about it.

## Macros and API

```js
const hub = game.modules.get("cpr-neon-hub").api;
hub.editHub();                 // GM: open the editor for a new hub
hub.editHub(scene);            // GM: edit an existing hub scene (Scene or uuid)
await hub.rebuildHub(scene);   // GM: rebuild from the saved layout
hub.listHQs();                 // Headquarters this user can see
hub.openHQ(id);                // open one on this client
hub.showHQ(id);                // GM: open it on every connected player's screen
await hub.awardHQIP(id, 20, "Arasaka extraction"); // GM

hub.openLifestyle();           // your own character's Lifestyle window (or pass an Actor/uuid)
hub.showLifestyle();           // GM: open it on every connected player's screen
await hub.lifestyleBill(actor);   // { bill: { lines, groups, discount, total }, wallet, status, ... }
await hub.payLifestyle(actor);    // pay this month's bill
await hub.newLifestyleMonth({ hqs: true, bill: true }); // GM: next month, roll HQ months, bill everyone
await hub.billLifestyles();       // GM: charge everyone still due
hub.lifestyleMonth();             // the counter month (worlds without calendars)

hub.openCalendar();               // the calendar window on this client
hub.showCalendar();               // GM: open it on every connected player's screen
hub.listCalendars();              // calendars this user can see
hub.getDate("Afterlife Crew");    // { year, month, day } by id or name
await hub.setDate("Afterlife Crew", { year: 2045, month: 11, day: 1 }); // GM; { rent: false } skips billing
await hub.addDays("Afterlife Crew", 7);  // GM
await hub.toRentDay("Afterlife Crew");   // GM: jump to the next rent day
hub.dateToChat("Afterlife Crew");
hub.time();                       // world clock: { minutes, time: "21:47" }
await hub.advanceTime(90);        // GM: 90 minutes on; following calendars change day at midnight
await hub.setTime("06:00");       // GM: time of day, same day (or minutes after midnight)
hub.skipTime();                   // GM: open Skip time on everyone's screen
hub.weather("Afterlife Crew");    // today's weather as you see it: { actual } or { forecast }
await hub.planWeather("Afterlife Crew", 42); // GM: plan six weeks from the calendar's date
hub.postForecast("Afterlife Crew");          // GM: post the current forecast to chat
hub.openMessenger("contacts");   // Night City Messenger: inbox, compose, contacts (GM: networks, admin)
hub.showMessenger("inbox");      // GM: open it on every connected player's screen
hub.downtime.open();                    // the Downtime window
hub.downtime.current();                 // the open downtime, or null
hub.downtime.remaining(actor);          // minutes this character has left (0 if not taking part)
hub.downtime.balance(actor);            // { total, spent, left, taking }
hub.downtime.log(actor);                // their spends, each with from/to minutes into the downtime
await hub.downtime.spend(actor, 2 * 1440, { label: "Crafting: smart scope", source: "my-module", data: { itemId } });
await hub.downtime.refund(entryId);     // take a spend back
await hub.downtime.start({ total: 3 * 1440, label: "Recovery", participants: [actor.uuid] }); // GM
await hub.downtime.complete();          // GM: end it and wind the clock through it
await hub.downtime.cancel();            // GM: call it off, no time passes
hub.journal.open();                     // the Neon Journal (or an entry, page, uuid, or "gigs"/"story"/"downtime")
const gig = await hub.journal.createGig("The Glen Courier"); // GM: a new gig entry
hub.journal.gig(gig);                   // its record: { status, client, objectives, rewards, crew, ... }
await hub.journal.moveGig(gig, "take"); // GM: "take", "complete", "fail" or "reopen"
await hub.journal.setObjective(gig, objectiveId, "done"); // GM: "open", "done" or "failed"
await hub.journal.payGig(gig, { recipients: [actor.uuid], rewards: { [rewardId]: {} } }); // GM
const issue = await hub.journal.newScreamsheet(); // GM: a draft issue, follow-ups carried over
await hub.journal.generateScreamsheet(issue);    // GM: roll stories into it
await hub.journal.publishScreamsheet(issue);     // GM: publish: chat, ticker, Messenger inboxes
await hub.journal.newLore("gang", "The Wraiths"); // GM: a worldbuilding entry from its template
await hub.journal.importWorldbook();              // GM: the 2070s Worldbook into the world
await hub.journal.characterJournal(actor);        // a character's journal (made on first use)
await hub.journal.newChapter("Act One");  // GM: a Story & Events chapter
await hub.journal.addSession(chapter);    // GM: a numbered session page in it
hub.notes("Afterlife Crew", { year: 2045, month: 11, day: 29 }); // notes this user can read
await hub.addNote("Afterlife Crew", { year: 2045, month: 11, day: 29 }, { title: "Meet Rogue", text: "Afterlife, midnight", shared: true });
```

**Downtime for other modules.** Times are minutes (a day is 1440). `spend` works from any client:
a player's spend is checked and saved by the GM, and it throws when there's no open downtime, the
character isn't taking part or doesn't have enough left, so check `remaining` first. `source` names
who logged it (shown in the log; anything but `"manual"` can only be taken back by the GM) and
`data` is kept on the entry for your own use. Hooks fire on every client, with the downtime and,
for spends and refunds, the entry:
`cpr-neon-hub.downtimeStarted`, `.downtimeSpent`, `.downtimeRefunded`, `.downtimeAllSpent`,
`.downtimeCompleted`, `.downtimeCancelled`, and `cpr-neon-hub.downtimeChanged` on any change.

```js
Hooks.on("cpr-neon-hub.downtimeSpent", (downtime, entry) => {
  if (entry.source === "my-module") console.log(`${entry.label}: ${entry.minutes} minutes`);
});
```

## Data this module relies on

**Monk's Active Tile Triggers.** Action data was read from MATT 12.02, the last v12 release, and
checked unchanged in 14.01. Tiles use `flags["monks-active-tiles"]` with
`trigger: ["click", "hoverin", "hoverout"]`, `pointer: true` and `allowpaused: true`. MATT only
shows the hand cursor for tiles with a hover trigger, so working buttons have one; their action
list starts with a `_click` landing and ends with `_hoverin` and `_hoverout` landings that stop at
once, so hovering never runs the click actions. The lit image is not a MATT action (MATT runs
players' hover actions only when no GM is connected): its path is in the tile's
`flags["cpr-neon-hub"].hover`, and each client swaps the tile's texture locally under the pointer. Entity fields are stored the way MATT's own editor stores
them (`{ id: <uuid>, name }`). The custom actions are registered through MATT's `setupTileActions`
hook as `cpr-neon-hub.openshop`, `cpr-neon-hub.openhq`, `cpr-neon-hub.openlifestyle`,
`cpr-neon-hub.opencalendar` and `cpr-neon-hub.openmessenger`. Night City Messenger windows open
through its own `game.nightcity` launchers (`openNCM`, `composeMessage`, `openContacts`,
`openNetworkManagement`, `openAdmin`).

**Cyberpunk RED - CORE 0.92.4.**

| Data | Path |
| --- | --- |
| Wallet | `system.wealth.value`, `system.wealth.transactions` |
| Humanity | `system.derivedStats.humanity.value / .max / .transactions`, then `actor.setMaxHumanity()` |
| Roles | `system.roleInfo.activeRole` and items of type `role` |
| Ledger lines | `CPR.ledger.increaseSentence` / `decreaseSentence`, reason `"... - <user>"` |
| Lifestyle items | `gear` items: `system.equipped` (`"equipped"` = active), `system.usage: "equipped"`, `system.amount`, `system.price.market` |
| Lifestyle fields | `system.lifestyle.housing / lifeStyle / traumaTeam` `.cost` and `.description` |
| Skill bonuses | Active Effect keys `bonuses.<skill>` named as CPR's `SystemUtils.slugify` names skills |

Headquarters are stored in a world setting (`cpr-neon-hub.headquarters`), calendars in another
(`cpr-neon-hub.calendars`), the GM's calendar notes in `cpr-neon-hub.calendarNotes`, and each
player's notes in their user's `flags.cpr-neon-hub.calendarNotes`. Hub layouts are stored on
their scene (`flags.cpr-neon-hub.hub`), so exporting a scene keeps its layout. Planned weather and
forecasts are in a world setting (`cpr-neon-hub.calendarWeather`), as are the conditions turned
off (`cpr-neon-hub.weatherOff`); like hidden notes, they reach every client.

**SmallTime.** Read from SmallTime 1.24.0. It keeps the time of day in Foundry's world time
(`game.time.worldTime`, midnight at every multiple of 86,400 seconds, no offset outside PF2e) and
moves it with `game.time.advance`, so Neon Hub watches the core `updateWorldTime` hook and moves
the clock the same way. It reads SmallTime's `small-step`, `large-step`, `time-format`,
`sunrise-*` / `sunset-*` settings and its `clockAuth` permission, writes its `moon-phase` setting
(0 new to 7 waning crescent), and toggles its window with `SmallTimeApp.toggleAppVis("toggle")`.

## Forward compatibility (Foundry v13+)

- Every window uses **ApplicationV2**.
- `scripts/compat.js` resolves APIs that move into `foundry.*` in v13 (FilePicker, TextEditor,
  renderTemplate, loadTemplates), falling back to the v12 globals.
- Sidebar hooks are registered under both the v12 and v13 names, and sheet header buttons for both
  Application V1 sheets (CPR 0.92) and V2 sheets.
- MATT's tile and action format is the same in its v12 and v14 releases.
- `module.json` declares v12 as verified with no maximum. When the CPR team ships their v13
  release, test there and bump `verified`.

## Known limits

- Tested with unit tests and rendered previews, not yet in a live Foundry world. Try it on a copy
  first.
- Lifestyle billing is per character; it doesn't split an HQ's rent (pay that on the HQ screen).
- An HQ's rent is one "due" flag: a jump past several rent days rolls each HQ month but leaves one
  rent payment due.
- Calendars are Gregorian dates without a time of day.
- Uploading images needs the GM to have file upload permission (the default for GMs). On The Forge,
  images go to your Forge asset library.
- Generated images are new files each time a button changes; old ones stay in the world folder and
  can be deleted by hand.
- Buttons with an action list edited in MATT's own editor keep working, but if you remove the
  `_hoverin` / `_hoverout` landings, hovering runs the click actions; rebuild to restore them.

## Building from source

Releases are built by the workflows; you only need this to work on the module. With Node 22:

```bash
npm ci
npm run check        # scripts parse, JSON is valid, every localization key exists
npm test             # lifestyle rules unit tests
npm run build:packs  # compile packs/_source/*/ into Foundry compendium packs
```

Compendium items are edited as JSON in `packs/_source/`; the compiled `packs/lifestyle` and
`packs/street-goods` folders aren't committed.

## License

MIT. Icons in `assets/` are original to Neon Hub. The Tektur font (`fonts/`) is under the SIL Open
Font License 1.1. Cyberpunk RED is a trademark of R. Talsorian Games; *No Place Like Home* is © R. Talsorian
Games. The Worldbook (2070s) summarizes, in Neon Hub's own words, setting facts from the *Edgerunner's
Handbook* in the *Cyberpunk: Edgerunners Mission Kit* (R. Talsorian Games); Cyberpunk, Cyberpunk 2077
and Cyberpunk: Edgerunners are trademarks of CD PROJEKT S.A. The screamsheet starter tables are
original to Neon Hub. This is unofficial fan content and isn't approved or endorsed by R. Talsorian
Games or CD PROJEKT.
