"use strict";
// Deterministic packaging, not an upload service. Old digest paths are retained.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const registry = require("../server/gameContent");
const root = path.resolve(__dirname, "../client/public");
const output = path.resolve(__dirname, "../server/contentAssetManifest.json");
const refs = new Map();
function add(source, usage, object) {
  if (!source?.startsWith("/assets/gauntlet/")) return;
  if (!refs.has(source)) refs.set(source, { source, associations: [] });
  refs.get(source).associations.push({ object, usage });
}
function visit(value, location) {
  if (typeof value === "string") add(value, location.split(".").pop(), location);
  else if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) visit(child, `${location}.${key}`);
}
visit(registry.getPublicGameContent(), "content");
visit(registry.factionsData, "factions");
const faces = {}, illustrations = {};
for (const { id, factionId } of registry.COLLECTION_CARDS) {
  const source = `/assets/gauntlet/constructed/${factionId}/${id}.webp`;
  add(source, "card-illustration", id); illustrations[id] = source;
  for (const suit of ["spades", "hearts", "diamonds", "clubs"]) {
    const face = `/assets/gauntlet/constructed/faces/${id}-${suit}.webp`;
    add(face, "card-face", id); faces[`${id}:${suit}`] = face;
  }
}
for (const file of fs.readdirSync(path.join(root, "assets/gauntlet/playing-cards")).filter((file) => file.endsWith(".webp")).sort()) {
  const source = `/assets/gauntlet/playing-cards/${file}`;
  add(source, "playing-card-face", file.slice(0, -5)); faces[`ordinary:${file.slice(0, -5)}`] = source;
}
const mime = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".m4a": "audio/mp4" };
const entries = [...refs.values()].sort((a, b) => a.source.localeCompare(b.source)).map((row) => {
  const bytes = fs.readFileSync(path.join(root, row.source)), digest = crypto.createHash("sha256").update(bytes).digest("hex"), ext = path.extname(row.source);
  const immutablePath = `/assets/gauntlet/releases/${digest}${ext}`, destination = path.join(root, immutablePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (fs.existsSync(destination)) {
    if (crypto.createHash("sha256").update(fs.readFileSync(destination)).digest("hex") !== digest) throw new Error(`Corrupt immutable asset: ${destination}`);
  } else fs.writeFileSync(destination, bytes, { flag: "wx" });
  return { id: `asset:${row.source.slice("/assets/gauntlet/".length)}`, ...row, path: immutablePath, mediaType: mime[ext], sha256: digest, bytes: bytes.length };
});
const data = { schemaVersion: "gauntlet.asset-manifest.v1", entries, faces, illustrations };
const version = `gauntlet-assets-${crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex")}`;
fs.writeFileSync(output, JSON.stringify({ ...data, version }, null, 2) + "\n");
console.log(JSON.stringify({ version, assets: entries.length, bytes: entries.reduce((sum, row) => sum + row.bytes, 0) }));
