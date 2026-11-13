import { MODULE_ID } from "../constants.js";
import { Compat } from "../compat.js";

const L = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));

/**
 * Chrome takes upgrades (2070 Core Rules Ch09: every piece has one Enhancement slot, which is also
 * where an Operating System goes). Two things in Cyberpunk RED 0.92.4 stood in the way:
 *
 * - CPR only lets an upgrade into an item whose "installed items" switch is on. The Item Compendium's
 *   chrome used to ship with it off, and so does CPR's own (its Sandevistan, Kerenzikov, Berserk...).
 *   The compendium now ships it on; this opens the copies already in a world, once per SLOTS_VERSION,
 *   and older copies as they arrive. Chrome is recognised by Neon Hub's flag or, for CPR's own pieces,
 *   copies made before the flag and anything bought or imported without it, by its name in the Item
 *   Compendium (2070s).
 * - CPR's Cyberware tab never offers "Manage Upgrades" on chrome: its row template filters the actor's
 *   upgrades by `type` ("itemUpgrade") instead of `system.type` ("cyberware"), so the list is always
 *   empty, and installed chrome opens read-only, without the item sheet's own control. Neon Hub adds
 *   the button to every piece of chrome that takes upgrades and opens CPR's own upgrade picker from it.
 *   CPR also has no way to drop an upgrade onto chrome: an Operating System dragged from the compendium
 *   onto a chrome row now lands on the sheet and goes straight into that piece.
 */
export const SLOTS_SETTING = "chromeSlotsMigration";
/** Raise to run the fix-up again in every world. 2: chrome recognised by name too (CPR's own, unflagged copies). */
export const SLOTS_VERSION = 2;
/** Cyberfingers have no Enhancement slot: they're the modular part. */
export const NO_ENHANCEMENT = /cyberfinger/i;
const ITEMS_PACK = `${MODULE_ID}.items-2070`;

/** A name as the compendium and CPR might each spell it (curly quotes, spacing, case). */
export const normName = (s) => String(s ?? "").replace(/[‘’`]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Is this a piece of chrome with an Enhancement slot? Neon Hub's own (flagged), or any cyberware named
 * like a piece in the Item Compendium (2070s), `names` being those names (normName). Not CPR's core
 * Internal/External/Fashionware boxes, and not cyberfingers.
 */
export function eligible(item, names = null) {
  if (item?.type !== "cyberware" || item.system?.core || NO_ENHANCEMENT.test(item.name ?? "")) return false;
  return !!item.flags?.[MODULE_ID]?.source2070 || !!names?.has(normName(item.name));
}

/**
 * What to change on a piece of chrome so upgrades can go in, pure: an update ({ path: value }) or
 * null when it's already open (or has no Enhancement slot, or isn't chrome we know).
 */
export function slotFix(item, names = null) {
  if (!eligible(item, names)) return null;
  const ii = item.system?.installedItems ?? {};
  const types = Array.isArray(ii.allowedTypes) ? ii.allowedTypes : [];
  const out = {};
  if (!ii.allowed) out["system.installedItems.allowed"] = true;
  if (!types.includes("itemUpgrade")) out["system.installedItems.allowedTypes"] = [...types, "itemUpgrade"];
  return Object.keys(out).length ? out : null;
}

/** Does this piece of chrome take upgrades (and so get a Manage Upgrades button and accept a dropped one)? */
export function takesUpgrades(item) {
  const ii = item?.system?.installedItems;
  return item?.type === "cyberware" && !item.system?.core && !!ii?.allowed && !!ii.allowedTypes?.includes("itemUpgrade");
}

/**
 * What CPR's picker would offer this chrome: the actor's cyberware upgrades not installed anywhere, plus the
 * ones already in it. `items` is the actor's items as plain data ({ _id, type, system }).
 */
export function upgradeChoices(item, items) {
  const mine = new Set(item?.system?.installedItems?.list ?? []);
  const installed = new Set(items.flatMap((i) => i.system?.installedItems?.list ?? []));
  return items.filter((i) => i.type === "itemUpgrade" && i.system?.type === "cyberware" && (mine.has(i._id) || !installed.has(i._id)));
}

/** Is this dropped item (a Document, or a compendium index entry with only { type }) an upgrade a chrome row should take? */
export const isUpgradeDrop = (doc) => doc?.type === "itemUpgrade";

const plain = (i) => ({ _id: i.id, type: i.type, name: i.name, system: i.system, flags: i.flags });

export const ChromeSlots = {
  /** The Item Compendium (2070s)'s chrome names (normName), loaded at ready. */
  names: new Set(),

  init() {
    game.settings.register(MODULE_ID, SLOTS_SETTING, { scope: "world", config: false, type: Number, default: 0 });
    // An older copy (a world compendium, another world's export, CPR's own pack) arriving on a sheet or in the sidebar.
    Hooks.on("preCreateItem", (item) => {
      const fix = slotFix(item, this.names);
      if (fix) item.updateSource(fix);
    });
    Hooks.on("renderActorSheet", (sheet, html) => {
      try {
        this.decorate(sheet, html);
      } catch (err) {
        console.warn(`${MODULE_ID} | chrome upgrade button`, err);
      }
    });
  },

  async loadNames() {
    const index = await game.packs.get(ITEMS_PACK)?.getIndex();
    this.names = new Set([...(index ?? [])].filter((e) => e.type === "cyberware").map((e) => normName(e.name)));
  },

  /** Load the names everywhere; once per world (and per SLOTS_VERSION), on the active GM's client, open the chrome. */
  async ready() {
    await this.loadNames();
    if (Compat.activeGM?.id !== game.user.id) return;
    if ((Number(game.settings.get(MODULE_ID, SLOTS_SETTING)) || 0) >= SLOTS_VERSION) return;
    const n = await this.migrate();
    await game.settings.set(MODULE_ID, SLOTS_SETTING, SLOTS_VERSION);
    if (n) ui.notifications.info(L("NEONHUB.ChromeSlots.Fixed", { count: n }));
  },

  /** Every actor the world has: the sidebar's, and each unlinked token's own copy. */
  actors() {
    const out = [...(game.actors ?? [])];
    for (const scene of game.scenes ?? []) {
      for (const tok of scene.tokens ?? []) if (!tok.actorLink && tok.actor) out.push(tok.actor);
    }
    return out;
  },

  /** GM: open every piece of chrome in the world to upgrades. Returns how many were changed. */
  async migrate() {
    if (!game.user.isGM) return 0;
    if (!this.names.size) await this.loadNames();
    let n = 0;
    for (const item of game.items ?? []) {
      const fix = slotFix(item, this.names);
      if (!fix) continue;
      await item.update(fix);
      n++;
    }
    for (const actor of this.actors()) {
      const updates = [...(actor.items ?? [])]
        .map((i) => ({ fix: slotFix(i, this.names), id: i.id }))
        .filter((u) => u.fix)
        .map((u) => ({ _id: u.id, ...u.fix }));
      if (!updates.length) continue;
      try {
        await actor.updateEmbeddedDocuments("Item", updates);
        n += updates.length;
      } catch (err) {
        console.warn(`${MODULE_ID} | chrome upgrade slots: ${actor.name}`, err);
      }
    }
    return n;
  },

  /** Add "Manage Upgrades" to the Cyberware tab's chrome rows that take upgrades, and let an upgrade be dropped on them. */
  decorate(sheet, html) {
    const actor = sheet.actor ?? sheet.document;
    if (!(actor instanceof Actor) || !sheet.isEditable) return;
    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root) return;
    for (const row of root.querySelectorAll("li.item[data-item-id]")) {
      const actions = row.querySelector(":scope > .cyberware-actions");
      if (!actions || row.dataset.neonHubUpgrades) continue;
      const item = actor.items.get(row.dataset.itemId);
      if (!item || !takesUpgrades(plain(item))) continue;
      row.dataset.neonHubUpgrades = "1";
      // CPR's own button would only be there if it ever fixes its filter; don't add a second.
      if (!actions.querySelector('[data-action-type="manage-upgrades"]')) {
        const button = document.createElement("a");
        button.className = "item-action neon-hub-upgrades";
        button.dataset.tooltip = L("NEONHUB.ChromeSlots.Manage");
        button.setAttribute("aria-label", L("NEONHUB.ChromeSlots.Manage"));
        button.innerHTML = '<i class="fab fa-superpowers"></i>';
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.manage(item).catch((err) => console.warn(`${MODULE_ID} | manage upgrades`, err));
        });
        actions.append(button);
      }
      row.addEventListener("dragover", (event) => event.preventDefault());
      row.addEventListener("drop", (event) => this.onDrop(item, event));
    }
  },

  /** CPR's own upgrade picker for a piece of chrome (the one its item sheet opens), or how to get an upgrade there. */
  async manage(item) {
    if (!upgradeChoices(plain(item), item.actor.items.map(plain)).length) {
      return ui.notifications.info(L("NEONHUB.ChromeSlots.NoneToFit", { item: item.name }));
    }
    const sheet = item.sheet;
    if (typeof sheet?._manageInstalledItems === "function") return sheet._manageInstalledItems("itemUpgrade");
    return sheet?.render(true, { editable: true });
  },

  /**
   * An upgrade dropped on a chrome row: it goes into that piece (put on the sheet first when it comes from a
   * compendium, the sidebar or another actor). Anything else is left to CPR's sheet. Decided as the event is
   * dispatched, from the drag data alone, so CPR's own drop handler doesn't also make a copy.
   */
  onDrop(item, event) {
    let data = null;
    try {
      data = Compat.getDragEventData(event);
    } catch {
      return;
    }
    if (data?.type !== "Item" || !data.uuid) return;
    let quick = null;
    try {
      quick = fromUuidSync(data.uuid);
    } catch {
      return;
    }
    if (!isUpgradeDrop(quick)) return;
    event.preventDefault();
    event.stopPropagation();
    this.fit(item, data.uuid).catch((err) => {
      console.warn(`${MODULE_ID} | dropping an upgrade on ${item.name}`, err);
      ui.notifications.error(L("NEONHUB.ChromeSlots.DropFailed", { item: item.name }));
    });
  },

  /** Put the upgrade at `uuid` into a piece of chrome, through CPR's own install. */
  async fit(item, uuid) {
    const actor = item.actor;
    const source = await fromUuid(uuid);
    if (!source || source.type !== "itemUpgrade") return;
    if (source.system?.type !== "cyberware") {
      return ui.notifications.warn(L("NEONHUB.ChromeSlots.WrongKind", { upgrade: source.name, item: item.name }));
    }
    let upgrade = source.parent === actor ? source : null;
    if (upgrade?.system.isInstalled) {
      if (upgrade.system.installedIn?.includes(item.id)) return;
      return ui.notifications.warn(L("NEONHUB.ChromeSlots.InstalledElsewhere", { upgrade: upgrade.name }));
    }
    if (!upgrade) {
      const data = source.toObject();
      delete data._id;
      [upgrade] = await actor.createEmbeddedDocuments("Item", [data]);
      if (!upgrade) return;
    }
    const done = await item.installItems([upgrade]);
    if (done) ui.notifications.info(L("NEONHUB.ChromeSlots.Fitted", { upgrade: upgrade.name, item: item.name }));
  }
};
