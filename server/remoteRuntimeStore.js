"use strict";
const crypto = require("node:crypto");
const unavailable = () => Object.assign(new Error("Durable runtime storage is unavailable. No success was acknowledged; reconnect to check the committed result."), { status: 503, code: "RUNTIME_UNAVAILABLE" });

// An uncertain HTTP response is retried only with the identical request ID and
// payload. PostgreSQL returns the original receipt without applying it twice.
function createRemoteRuntimeStore({ request, id, contract, maxBytes = 64 * 1024 * 1024 }) {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(id) || !contract) throw new Error("Invalid runtime store identity.");
  let revision = null, lastCommittedAt = null, health = "unconfigured";
  return {
    async load() {
      try {
        const rows = await request(`gauntlet_runtime_states?id=eq.${id}&select=revision,contract,state,updated_at`, { signal: AbortSignal.timeout(15000) });
        if (!Array.isArray(rows) || rows.length > 1) throw unavailable();
        const row = rows[0];
        if (row && (row.contract !== contract || !Number.isSafeInteger(row.revision) || row.revision < 0 || !row.state)) throw unavailable();
        revision = row?.revision || 0; lastCommittedAt = row?.updated_at || null; health = "healthy";
        return row?.state || null;
      } catch (error) { health = "unavailable"; throw unavailable(); }
    },
    async save(state) {
      if (revision == null || health === "unavailable") throw unavailable();
      const serialized = JSON.stringify(state);
      if (Buffer.byteLength(serialized) > maxBytes) throw Object.assign(new Error("Runtime capacity limit reached. No state was discarded."), { status: 503, code: "RUNTIME_CAPACITY" });
      const body = JSON.stringify({ p_id: id, p_expected_revision: revision, p_request_id: crypto.randomUUID(), p_contract: contract, p_state: JSON.parse(serialized) });
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const receipt = await request("rpc/commit_gauntlet_runtime", { method: "POST", body, signal: AbortSignal.timeout(15000) });
          if (!Number.isSafeInteger(receipt?.revision) || receipt.revision !== revision + 1) throw unavailable();
          revision = receipt.revision; lastCommittedAt = receipt.committedAt; health = "healthy";
          return receipt;
        } catch (error) {
          if (error.code === "40001" || error.code === "22023" || attempt === 1) { health = "unavailable"; throw unavailable(); }
          health = "degraded";
        }
      }
    },
    status: () => ({ provider: "supabase", health, revision, lastCommittedAt, durable: true, recoveryVerified: false, maxBytes })
  };
}
module.exports = { createRemoteRuntimeStore };
