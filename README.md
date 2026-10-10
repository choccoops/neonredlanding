# Neon Hub: Landing Pages & Headquarters for Cyberpunk RED

Two tools for **Cyberpunk RED - CORE** on Foundry VTT:

- **Hub pages.** Build a clickable landing-page scene in a visual editor. Each button is a
  [Monk's Active Tile Triggers](https://github.com/ironmonk88/monks-active-tiles) tile that takes
  players to a scene, opens a journal or character sheet, opens a Neon Market shop or the crew's
  Headquarters, plays sound, shows an image or runs a macro.
- **Headquarters.** A crew HQ screen built on the *No Place Like Home* rules: HQ IP, the twelve
  Improvements and their Upgrades, the ten Morale Boost levels, rent and access, the Server Room's
  eurobuck cost, and a monthly Humanity roll.

| Requirement | Version |
| --- | --- |
| Foundry VTT | v12 (built with v13+ APIs in mind, see below) |
| Cyberpunk RED - CORE | 0.92 (checked against the 0.92.4 source) |
| Monk's Active Tile Triggers | 12.02 or later (required) |
| Neon Market | optional, for shop buttons |

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
- Neon Hub's two actions also appear in MATT's own action list (group *Neon Hub*), so you can use
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
```

## Data this module relies on

**Monk's Active Tile Triggers.** Action data was read from MATT 12.02, the last v12 release, and
checked unchanged in 14.01. Tiles use `flags["monks-active-tiles"]` with `trigger: "click"`,
`pointer: true` and `allowpaused: true`. Entity fields are stored the way MATT's own editor stores
them (`{ id: <uuid>, name }`). The custom actions are registered through MATT's `setupTileActions`
hook as `cpr-neon-hub.openshop` and `cpr-neon-hub.openhq`.

**Cyberpunk RED - CORE 0.92.4.**

| Data | Path |
| --- | --- |
| Wallet | `system.wealth.value`, `system.wealth.transactions` |
| Humanity | `system.derivedStats.humanity.value / .max / .transactions`, then `actor.setMaxHumanity()` |
| Roles | `system.roleInfo.activeRole` and items of type `role` |
| Ledger lines | `CPR.ledger.increaseSentence` / `decreaseSentence`, reason `"... - <user>"` |

Headquarters are stored in a world setting (`cpr-neon-hub.headquarters`). Hub layouts are stored on
their scene (`flags.cpr-neon-hub.hub`), so exporting a scene keeps its layout.

## Forward compatibility (Foundry v13+)

- Every window uses **ApplicationV2**.
- `scripts/compat.js` resolves APIs that move into `foundry.*` in v13 (FilePicker, TextEditor,
  renderTemplate, loadTemplates), falling back to the v12 globals.
- Sidebar hooks are registered under both the v12 and v13 names.
- MATT's tile and action format is the same in its v12 and v14 releases.
- `module.json` declares v12 as verified with no maximum. When the CPR team ships their v13
  release, test there and bump `verified`.

## Known limits

- Tested with unit tests and rendered previews, not yet in a live Foundry world. Try it on a copy
  first.
- Uploading images needs the GM to have file upload permission (the default for GMs). On The Forge,
  images go to your Forge asset library.
- Generated images are new files each time a button changes; old ones stay in the world folder and
  can be deleted by hand.

## License

MIT. Cyberpunk RED is a trademark of R. Talsorian Games; *No Place Like Home* is © R. Talsorian
Games. This is unofficial fan content and isn't approved or endorsed by R. Talsorian Games.
