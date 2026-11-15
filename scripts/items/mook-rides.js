import { MODULE_ID } from "../constants.js";

/**
 * A mook's ride on its sheet. A mook can own a vehicle item like any other, but Cyberpunk RED 0.92.4's mook sheet
 * only lists ammo, clothing, cyberdecks, drugs, gear, upgrades and NET architectures under Special Gear, so a vehicle
 * (the Mook Pack's nomads' bikes, the Trauma Team Pilot's Atlus, or one a GM drops on) was there and never shown.
 * This adds the vehicles to the end of that list, opening the item on a click like the sheet's own entries.
 */
export const vehiclesOf = (actor) =>
  [...(actor?.items ?? [])].filter((i) => i.type === "vehicle").sort((a, b) => a.name.localeCompare(b.name));

export const MookRides = {
  init() {
    Hooks.on("renderActorSheet", (sheet, html) => {
      try {
        this.decorate(sheet, html);
      } catch (err) {
        console.warn(`${MODULE_ID} | mook rides`, err);
      }
    });
  },

  decorate(sheet, html) {
    const actor = sheet.actor ?? sheet.document;
    if (actor?.type !== "mook") return;
    const root = typeof HTMLElement !== "undefined" && html instanceof HTMLElement ? html : html?.[0];
    const list = root?.querySelector?.(".mook-special-list");
    if (!list || list.querySelector(".neon-hub-ride")) return;
    const rides = vehiclesOf(actor);
    if (!rides.length) return;
    let first = !list.querySelector("a.item");
    for (const item of rides) {
      if (!first) list.append(", ");
      first = false;
      const link = document.createElement("a");
      link.className = "name item neon-hub-ride";
      link.dataset.itemId = item.id;
      link.tabIndex = 0;
      link.textContent = item.name;
      link.addEventListener("click", (event) => {
        event.preventDefault();
        item.sheet?.render(true);
      });
      list.append(link);
    }
  }
};
