"use strict";

const storeIO = require("./accountStore"), crypto = require("node:crypto");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const failure = (status, message) => Object.assign(new Error(message), { name: "PlayerMetadataError", status });

// Profile metadata has a deliberately small write contract. Never accept a raw
// account object here: identities, credentials and gameplay records are separate.
function createPlayerMetadataEditor({ useSupabase, request, accountFile, normalizeName, validName }) {
  return async function edit(id, input, actorId) {
    if (!UUID.test(id)) throw failure(400, "Invalid player.");
    if (!UUID.test(actorId || "")) throw failure(400, "An authorized operator identity is required.");
    if (!input || Array.isArray(input) || Object.keys(input).some((key) => !["expectedName", "metadata", "reason"].includes(key))
      || typeof input.expectedName !== "string" || !input.metadata || Array.isArray(input.metadata)
      || Object.keys(input.metadata).length !== 1 || typeof input.metadata.name !== "string"
      || typeof input.reason !== "string" || input.reason.trim().length < 8 || input.reason.length > 1000) {
      throw failure(400, "Supply the current name, a new name, and a specific correction reason (8–1000 characters).");
    }
    const name = normalizeName(input.metadata.name);
    if (!validName(name)) throw failure(400, "Player name must be 3–24 characters using letters, numbers, spaces, hyphens or underscores.");
    const conflict = () => failure(409, "This player's name changed elsewhere. Refresh the profile before saving again.");
    const taken = () => failure(409, "That player name is already taken.");
    const audited = stats => ({ ...stats, operatorAudit: [...(stats?.operatorAudit || []), { id: crypto.randomUUID(), action: "player-name", actorId, accountId: id, before: input.expectedName, after: name, reason: input.reason.trim(), at: new Date().toISOString() }] });
    if (useSupabase()) {
      if (await request("rpc/gauntlet_account_write_capability", { method: "POST", body: "{}" }) !== 1) throw failure(503, "Audited metadata changes require the account revision guard.");
      const rows = await request(`gauntlet_accounts?id=eq.${id}&select=id,name,stats`);
      if (!rows?.length) throw failure(404, "Player not found.");
      if (rows[0].name !== input.expectedName) throw conflict();
      try {
        const saved = await request(`gauntlet_accounts?id=eq.${id}&name=eq.${encodeURIComponent(JSON.stringify(input.expectedName))}&select=id,name`, {
          method: "PATCH", headers: { Prefer: "return=representation" },
          body: JSON.stringify({ name, name_key: name.toLowerCase(), stats: audited(rows[0].stats) })
        });
        if (!Array.isArray(saved) || saved.length !== 1) throw conflict();
        return saved[0];
      } catch (error) {
        if (error.code === "23505") throw taken();
        if (error.code === "40001") throw conflict();
        throw error;
      }
    }
    const store = storeIO.read(accountFile);
    if (!Array.isArray(store.accounts)) throw failure(503, "Player metadata is temporarily unavailable.");
    const player = store.accounts.find((account) => account.id === id);
    if (!player) throw failure(404, "Player not found.");
    if (player.name !== input.expectedName) throw conflict();
    if (store.accounts.some((account) => account.id !== id && normalizeName(account.name).toLowerCase() === name.toLowerCase())) throw taken();
    player.name = name;
    player.nameKey = name.toLowerCase();
    player.stats = audited(player.stats);
    storeIO.save(accountFile, store);
    return { id: player.id, name: player.name };
  };
}

function registerPlayerMetadataRoutes(app, { authorize, edit }) {
  app.patch("/api/admin/players/:accountId/metadata", async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    if (!authorize(req, res)) return;
    try {
      const player = await edit(req.params.accountId, req.body, req.gauntletAdminAccount?.id);
      res.json({ player });
    } catch (error) {
      const status = error.name === "PlayerMetadataError" && [400, 404, 409].includes(error.status) ? error.status : 503;
      res.status(status).json({ error: status === 503 ? "Player metadata could not be saved. Your changes are still in the form; try again." : error.message });
    }
  });
}

module.exports = { createPlayerMetadataEditor, registerPlayerMetadataRoutes };
