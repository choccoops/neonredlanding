export const MODULE_ID = "cpr-neon-full-borg";
export const HUB_ID = "cpr-neon-hub";
export const SYSTEM_ID = "cyberpunk-red-core";
export const TEMPLATE_PATH = `modules/${MODULE_ID}/templates`;

/** The 2070 bodies, one Actor each with its chrome installed. */
export const BODIES_PACK = `${MODULE_ID}.fbc-bodies-2070`;
/** Body packages (for shops), chassis parts, the Biosystem and brain food. */
export const ITEMS_PACK = `${MODULE_ID}.fbc-2070`;

/** Actor flag: { body: { id, name }, since, worn: [body ids], coreSlots: { itemId: slots } }. */
export const FBC_FLAG = "fbc";
/** Item flag on every piece a body put in: the body actor's id. */
export const BODY_FLAG = "body";
