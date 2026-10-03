"use strict";

const fs = require("node:fs");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const failure = (status, message) => Object.assign(new Error(message), { name: "PlayerMetadataError", status });

// Profile metadata has a deliberately small write contract. Never accept a raw
// account object here: identities, credentials and gameplay records are separate.
function createPlayerMetadataEditor({ useSupabase, request, accountFile, normalizeName, validName }) {
  return async function edit(id, input) {
    if (!UUID.test(id)) throw failure(400, "Invalid player.");
    if (!input || Array.isArray(input) || Object.keys(input).some((key) => !["expectedName", "metadata"].includes(key))
      || typeof input.expectedName !== "string" || !input.metadata || Array.isArray(input.metadata)
      || Object.keys(input.metadata).length !== 1 || typeof input.metadata.name !== "string") {
      throw failure(400, "Only player name metadata can be edited here.");
    }
    const name = normalizeName(input.metadata.name);
    if (!validName(name)) throw failure(400, "Player name must be 3–24 characters using letters, numbers, spaces, hyphens or underscores.");
    const conflict = () => failure(409, "This player's name changed elsewhere. Refresh the profile before saving again.");
    const taken = () => failure(409, "That player name is already taken.");
    if (useSupabase()) {
      // Patch only the two name columns, so game results, decks, portraits and
      // unlocks cannot be overwritten by a simultaneous profile save.
      const rows = await request(`gauntlet_accounts?id=eq.${id}&select=id,name`);
      if (!rows?.length) throw failure(404, "Player not found.");
      if (rows[0].name !== input.expectedName) throw conflict();
      try {
        const saved = await request(`gauntlet_accounts?id=eq.${id}&name=eq.${encodeURIComponent(JSON.stringify(input.expectedName))}&select=id,name`, {
          method: "PATCH", headers: { Prefer: "return=representation" },
          body: JSON.stringify({ name, name_key: name.toLowerCase() })
        });
        if (!Array.isArray(saved) || saved.length !== 1) throw conflict();
        return saved[0];
      } catch (error) {
        if (error.code === "23505") throw taken();
        throw error;
      }
    }
    // Local account writes are synchronous, matching the existing account store.
    const store = JSON.parse(fs.readFileSync(accountFile, "utf8"));
    if (!Array.isArray(store.accounts)) throw failure(503, "Player metadata is temporarily unavailable.");
    const player = store.accounts.find((account) => account.id === id);
    if (!player) throw failure(404, "Player not found.");
    if (player.name !== input.expectedName) throw conflict();
    if (store.accounts.some((account) => account.id !== id && normalizeName(account.name).toLowerCase() === name.toLowerCase())) throw taken();
    player.name = name;
    player.nameKey = name.toLowerCase();
    fs.writeFileSync(accountFile, JSON.stringify(store, null, 2));
    return { id: player.id, name: player.name };
  };
}

function registerPlayerMetadataRoutes(app, { authorize, edit }) {
  app.patch("/api/admin/players/:accountId/metadata", async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    if (!authorize(req, res)) return;
    try {
      const player = await edit(req.params.accountId, req.body);
      res.json({ player });
    } catch (error) {
      const status = error.name === "PlayerMetadataError" && [400, 404, 409].includes(error.status) ? error.status : 503;
      res.status(status).json({ error: status === 503 ? "Player metadata could not be saved. Your changes are still in the form; try again." : error.message });
    }
  });
}

module.exports = { createPlayerMetadataEditor, registerPlayerMetadataRoutes };
