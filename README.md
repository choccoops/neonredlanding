# Neon Hub: Landing Pages, Headquarters, Lifestyle & Calendar for Cyberpunk RED

Four tools for **Cyberpunk RED - CORE** on Foundry VTT:

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
  real Moon's phase.

| Requirement | Version |
| --- | --- |
| Foundry VTT | v12 (built with v13+ APIs in mind, see below) |
| Cyberpunk RED - CORE | 0.92 (checked against the 0.92.4 source) |
| Monk's Active Tile Triggers | 12.02 or later (required) |
| Neon Market | optional, for shop buttons |
| [Night City Messenger](https://github.com/christinophrappuccino/night-city-messenger) | optional, for messenger buttons |

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
- **GM only** buttons are hidden from players and only respond to the GM.
- Want buttons in exact spots? Set **Button layout** to *Keep tiles where I put them* and rebuild
  once (the tiles unlock), move or resize them on the scene, then rebuild again. Each button is redrawn at its new size.
- The tiles are ordinary MATT tiles. You can open one with MATT's own editor and add more actions;
  rebuilding replaces the action list, so add extra steps after you're done with the hub editor.
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

**Data.** Item settings live in `flags.cpr-neon-hub.lifestyle`, a character's bills in
`flags.cpr-neon-hub.lifestyleState`, and the month in a world setting. Neon Hub also mirrors
active housing, lifestyle package and health plans into the actor's `system.lifestyle.housing`,
`lifeStyle` and `traumaTeam` fields (part of CPR's data model, not shown on the 0.92 sheet).

## Calendar

![Calendar with day notes](docs/calendar.webp)

Open it from the calendar button in the left toolbar (Token Controls), a hub button set to *Open
calendar*, or the Lifestyle window. It works with no scene on the canvas.

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

**Settings.** *Calendar time zone* (world). *First day of the week*, *Show moon phases* and
*Notify on date change* (per player).

The calendar's layout and look follow Vokashu's **Cyberpunk Calendar** module, rebuilt for Neon
Hub; none of its code is used. The Tektur font is © 2023 The Tektur Project Authors, under the SIL
Open Font License 1.1 (`fonts/Tektur-OFL.txt`).

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
hub.openMessenger("contacts");   // Night City Messenger: inbox, compose, contacts (GM: networks, admin)
hub.showMessenger("inbox");      // GM: open it on every connected player's screen
hub.notes("Afterlife Crew", { year: 2045, month: 11, day: 29 }); // notes this user can read
await hub.addNote("Afterlife Crew", { year: 2045, month: 11, day: 29 }, { title: "Meet Rogue", text: "Afterlife, midnight", shared: true });
```

## Data this module relies on

**Monk's Active Tile Triggers.** Action data was read from MATT 12.02, the last v12 release, and
checked unchanged in 14.01. Tiles use `flags["monks-active-tiles"]` with `trigger: "click"`,
`pointer: true` and `allowpaused: true`. Entity fields are stored the way MATT's own editor stores
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
their scene (`flags.cpr-neon-hub.hub`), so exporting a scene keeps its layout.

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
Games. This is unofficial fan content and isn't approved or endorsed by R. Talsorian Games.
