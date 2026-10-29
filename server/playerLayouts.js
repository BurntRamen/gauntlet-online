const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const LAYOUT_VERSION = 1;
const MAX_LAYOUT_MODULES = 64;
const MAX_LAYOUT_BYTES = 16 * 1024;
const MAX_REVISION = Number.MAX_SAFE_INTEGER - 1;
// Only optional landing-page modules belong here. Match recovery, invitations,
// queues, eligibility, account management and focused workflows are excluded.
const LAYOUT_MODULES = Object.freeze({
  play: ["basic-ai", "faction-ai", "private-duel", "join-table", "ranked", "draft", "campaign", "competition", "active-deck", "recent-matches"],
  campaign: ["tutorial", "lore", "rulebook"],
  decks: ["editor", "collection", "packs", "draft-library"],
  compete: ["ranked", "events", "para", "standings"],
  matches: ["recent", "replays", "record"],
  community: ["friends", "challenges", "messages"],
  learn: ["tutorial", "rulebook", "practice", "formats", "lore"],
  profile: ["record", "library"]
});

class LayoutValidationError extends Error {}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

function emptyLayoutPreferences() {
  return { version: LAYOUT_VERSION, pages: {} };
}

function layoutModuleAllowlist(factionIds = []) {
  const campaign = [...new Set(factionIds)]
    .filter((id) => typeof id === "string" && /^[a-z0-9_-]{1,48}$/.test(id))
    .slice(0, MAX_LAYOUT_MODULES - LAYOUT_MODULES.campaign.length)
    .map((id) => `faction-${id}`);
  return { ...LAYOUT_MODULES, campaign: [...campaign, ...LAYOUT_MODULES.campaign] };
}

function validateLayoutPreferences(value, factionIds = []) {
  if (!isRecord(value) || value.version !== LAYOUT_VERSION || !isRecord(value.pages)) {
    throw new LayoutValidationError("Page layouts require version 1 and a pages object.");
  }
  if (Object.keys(value).some((key) => !["version", "pages"].includes(key))
    || Object.keys(value.pages).length > 16
    || Buffer.byteLength(JSON.stringify(value), "utf8") > MAX_LAYOUT_BYTES) {
    throw new LayoutValidationError("Page layout preferences exceed the supported schema.");
  }
  const allowlist = layoutModuleAllowlist(factionIds);
  const pages = {};
  for (const [pageId, layout] of Object.entries(value.pages)) {
    if (!isRecord(layout) || Object.keys(layout).some((key) => !["order", "hidden"].includes(key))) {
      throw new LayoutValidationError("Each page layout must contain order and hidden lists.");
    }
    for (const field of ["order", "hidden"]) {
      if (!Array.isArray(layout[field]) || layout[field].length > MAX_LAYOUT_MODULES
        || layout[field].some((id) => typeof id !== "string" || !/^[a-z0-9_-]{1,64}$/.test(id))) {
        throw new LayoutValidationError("Page layout module lists are invalid or too large.");
      }
    }
    // Retired pages and IDs are ignored. They cannot become arbitrary stored
    // account data, and old clients remain usable when published content changes.
    if (!Object.hasOwn(allowlist, pageId)) continue;
    const allowed = new Set(allowlist[pageId]);
    pages[pageId] = {
      order: [...new Set(layout.order)].filter((id) => allowed.has(id)),
      hidden: [...new Set(layout.hidden)].filter((id) => allowed.has(id))
    };
  }
  return { version: LAYOUT_VERSION, pages };
}

function validateLayoutUpdate(body, factionIds = []) {
  if (!isRecord(body) || Object.keys(body).some((key) => !["revision", "preferences"].includes(key))
    || !Number.isSafeInteger(body.revision) || body.revision < 0 || body.revision > MAX_REVISION) {
    throw new LayoutValidationError("Include the current page layout revision when saving.");
  }
  return { revision: body.revision, preferences: validateLayoutPreferences(body.preferences, factionIds) };
}

function publicLayoutEnvelope(record, factionIds) {
  const revision = Number.isSafeInteger(record?.revision) && record.revision >= 0 ? record.revision : 0;
  let preferences = emptyLayoutPreferences();
  try {
    if (record?.preferences) preferences = validateLayoutPreferences(record.preferences, factionIds);
  } catch (error) {
    if (!(error instanceof LayoutValidationError)) throw error;
  }
  return { revision, preferences };
}

function createPlayerLayoutStore({ filePath, useSupabase = () => false, supabaseRequest, getFactionIds = () => [] }) {
  function loadLocal() {
    let source;
    try { source = fs.readFileSync(filePath, "utf8"); }
    catch (error) {
      if (error.code === "ENOENT") return { version: 1, accounts: {} };
      throw error;
    }
    const store = JSON.parse(source);
    if (!isRecord(store) || store.version !== 1 || !isRecord(store.accounts)) {
      throw new Error("The page layout store is unavailable.");
    }
    return store;
  }

  function saveLocal(store) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.${process.pid}.${crypto.randomBytes(8).toString("hex")}.tmp`;
    try {
      const descriptor = fs.openSync(temporary, "wx", 0o600);
      try {
        fs.writeFileSync(descriptor, JSON.stringify(store), "utf8");
        fs.fsyncSync(descriptor);
      } finally { fs.closeSync(descriptor); }
      fs.renameSync(temporary, filePath);
    } finally {
      try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
  }

  async function get(accountId) {
    const factions = getFactionIds();
    if (useSupabase()) {
      const rows = await supabaseRequest(`gauntlet_account_layouts?account_id=eq.${encodeURIComponent(accountId)}&select=revision,preferences`);
      return publicLayoutEnvelope(rows?.[0], factions);
    }
    const store = loadLocal();
    return publicLayoutEnvelope(Object.hasOwn(store.accounts, accountId) ? store.accounts[accountId] : null, factions);
  }

  async function put(accountId, body) {
    const factions = getFactionIds();
    const { revision, preferences } = validateLayoutUpdate(body, factions);
    const next = { revision: revision + 1, preferences };
    if (!useSupabase()) {
      // Match the account store's exclusive transaction lock and atomic, synced
      // replacement. A separate sidecar prevents gameplay writes losing layouts.
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      let lock;
      try { lock = fs.openSync(`${filePath}.lock`, "wx", 0o600); }
      catch (error) {
        if (error.code === "EEXIST") throw Object.assign(new Error("Page layout storage is busy. Retry your save."), { code: "LAYOUT_STORAGE_BUSY" });
        throw error;
      }
      try {
        const store = loadLocal();
        const current = publicLayoutEnvelope(Object.hasOwn(store.accounts, accountId) ? store.accounts[accountId] : null, factions);
        if (current.revision !== revision) return { conflict: true, ...current };
        Object.defineProperty(store.accounts, accountId, { value: next, enumerable: true, configurable: true, writable: true });
        saveLocal(store);
        return { conflict: false, ...next };
      } finally { fs.closeSync(lock); fs.unlinkSync(`${filePath}.lock`); }
    }

    let rows;
    if (revision === 0) {
      // A unique account key resolves simultaneous first saves atomically.
      try {
        rows = await supabaseRequest("gauntlet_account_layouts?select=revision,preferences", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ account_id: accountId, ...next, updated_at: new Date().toISOString() })
        });
      } catch (error) {
        if (error.code !== "23505") throw error;
        return { conflict: true, ...await get(accountId) };
      }
    } else {
      // The database compares the revision in the UPDATE itself; multiple app
      // processes/devices cannot overwrite a newer revision after a stale read.
      rows = await supabaseRequest(`gauntlet_account_layouts?account_id=eq.${encodeURIComponent(accountId)}&revision=eq.${revision}&select=revision,preferences`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ ...next, updated_at: new Date().toISOString() })
      });
      if (Array.isArray(rows) && rows.length === 0) return { conflict: true, ...await get(accountId) };
    }
    if (!Array.isArray(rows) || rows.length !== 1 || rows[0].revision !== next.revision) {
      throw new Error("The page layout save could not be confirmed.");
    }
    return { conflict: false, ...publicLayoutEnvelope(rows[0], factions) };
  }

  return { get, put };
}

function registerPlayerLayoutRoutes(app, { requireAccount, store, logger = console }) {
  async function handle(req, res, save) {
    res.set("Cache-Control", "private, no-store");
    res.set("Vary", "Authorization");
    try {
      const context = await requireAccount(req, res);
      if (!context) return;
      const accountId = context.account.id;
      if (!save) { res.json(await store.get(accountId)); return; }
      const { conflict, ...envelope } = await store.put(accountId, req.body);
      if (conflict) {
        res.status(409).json({ error: "Your page layouts changed on another device. Choose which layout to keep.", ...envelope });
        return;
      }
      res.json(envelope);
    } catch (error) {
      if (error instanceof LayoutValidationError) { res.status(400).json({ error: error.message }); return; }
      logger.error("[PlayerLayouts] Account layout storage unavailable", { code: error.code || null });
      res.status(503).json({ error: "Your account layouts could not be saved or loaded. Try again when the connection returns." });
    }
  }
  app.get("/api/account/layouts", (req, res) => handle(req, res, false));
  app.put("/api/account/layouts", (req, res) => handle(req, res, true));
}

module.exports = {
  LAYOUT_MODULES,
  LAYOUT_VERSION,
  MAX_LAYOUT_MODULES,
  createPlayerLayoutStore,
  emptyLayoutPreferences,
  layoutModuleAllowlist,
  registerPlayerLayoutRoutes,
  validateLayoutPreferences,
  validateLayoutUpdate
};
