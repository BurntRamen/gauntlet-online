"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const sourceManifest = require("./contentAssetManifest.json"), backs = require("./presentationAssetManifest.json");
const entries = [...sourceManifest.entries, ...backs];
const version = crypto.createHash("sha256").update(JSON.stringify(entries)).digest("hex");
const verified = new Map();
function verify(directory = path.join(__dirname, "../client/public")) {
  for (const row of entries) {
    const file = path.join(directory, row.path);
    try {
      const stat = fs.statSync(file, { bigint: true }), signature = `${stat.ino}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`;
      if (verified.get(file) === signature) continue;
      const body = fs.readFileSync(file);
      if (body.length !== row.bytes || crypto.createHash("sha256").update(body).digest("hex") !== row.sha256) throw new Error();
      verified.set(file, signature);
    } catch { throw Object.assign(new Error(`Required shipped asset unavailable or corrupt: ${row.id}. Nothing was activated.`), { status: 422 }); }
  }
  return { version, count: entries.length, bytes: entries.reduce((n, row) => n + row.bytes, 0), delivery: "immutable-frontend-build", frames: "source-controlled CSS and renderer", entries };
}
function validate(metadata) {
  if (metadata?.version !== version || JSON.stringify(metadata.entries) !== JSON.stringify(entries)) throw Object.assign(new Error("The release's shipped asset dependencies do not match this deployment."), { status: 422 });
}
module.exports = { verify, validate, entries, version, backs };
