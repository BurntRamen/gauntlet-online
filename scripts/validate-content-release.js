"use strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
// Validation never connects to player stores or writes production state.
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-content-check-"));
Object.assign(process.env, { NODE_ENV: "test", GAUNTLET_CONTENT_PROVIDER: "file", ACCOUNT_DATA_FILE: path.join(directory, "accounts.json"), MATCH_DATA_FILE: path.join(directory, "matches.json"), MATCH_ARCHIVE_DATA_DIR: path.join(directory, "archive"), GAUNTLET_CONTENT_DATA_DIR: path.join(directory, "content"), ROOM_STATE_RECOVERY_ENABLED: "false" });
for (const key of ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "GAUNTLET_GITHUB_TOKEN"]) delete process.env[key];
try {
  const { __test } = require("../server/index");
  const { createGitHubContentPublication } = require("../server/githubContentPublication");
  const baseline = __test.contentPublication.status().live;
  const content = createGitHubContentPublication({ baseline, token: "" }).active();
  const manifest = require("../server/contentAssetManifest.json");
  for (const asset of manifest.entries) {
    const filename = path.resolve(__dirname, "../client/public", `.${asset.path}`);
    const body = fs.readFileSync(filename);
    if (body.length !== asset.bytes || crypto.createHash("sha256").update(body).digest("hex") !== asset.sha256) throw new Error(`Asset integrity mismatch: ${asset.id}`);
  }
  console.log(`Validated ${content.releaseId}; ${content.manifest.cards.length} cards; ${manifest.entries.length} immutable asset references.`);
} finally { fs.rmSync(directory, { recursive: true, force: true }); }
