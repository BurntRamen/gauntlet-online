"use strict";

// The entire existing authoring envelope stays private, including staged image
// bytes and notes. GitHub receives only explicitly published release packages.
const MAX_BYTES = 16 * 1024 * 1024;
const unavailable = () => Object.assign(new Error("Private authoring storage is unavailable. Check the Supabase migration; no changes were saved to GitHub."), { status: 503 });

function createPrivateAuthoringStore({ request }) {
  async function call(route, options) {
    try { return await request(route, options); }
    catch (error) {
      if (error.code === "40001") throw Object.assign(new Error("Private authoring changed in another session. Refresh before retrying; your local edits were not saved."), { status: 409 });
      throw unavailable();
    }
  }
  return {
    async probe() {
      const rows = await call("gauntlet_private_authoring?id=eq.shared&select=revision");
      if (!Array.isArray(rows) || rows.length > 1) throw unavailable();
      return { provider: "supabase-private", available: true, initialized: rows.length === 1 };
    },
    async load() {
      const rows = await call("gauntlet_private_authoring?id=eq.shared&select=revision,state");
      if (!Array.isArray(rows) || rows.length > 1) throw unavailable();
      if (!rows.length) return null;
      if (!Number.isSafeInteger(rows[0].revision) || rows[0].revision < 1 || !rows[0].state) throw unavailable();
      return { version: rows[0].revision, state: rows[0].state };
    },
    async save(version, state) {
      if (!Number.isSafeInteger(version) || version < 0) throw unavailable();
      if (Buffer.byteLength(JSON.stringify(state)) > MAX_BYTES) throw Object.assign(new Error("The retained authoring package exceeds 16 MiB. No history was removed."), { status: 422 });
      return call("rpc/save_gauntlet_private_authoring", { method: "POST", body: JSON.stringify({ p_expected_revision: version, p_state: state }) });
    }
  };
}

module.exports = { createPrivateAuthoringStore, MAX_BYTES };
