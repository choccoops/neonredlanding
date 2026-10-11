# Changelog

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
