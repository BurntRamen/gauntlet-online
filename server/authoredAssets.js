"use strict";
// Uploaded bytes travel with the existing atomic store / GitHub release file.
// There is no mutable filesystem name, public draft bucket or second activation.
const crypto = require("node:crypto");
const MAX_UPLOAD = 3 * 1024 * 1024, MAX_IMAGE = 1024 * 1024, MAX_STORED = 6 * 1024 * 1024;
const VERSION = "gauntlet.uploaded-image.v1";
const digest = body => crypto.createHash("sha256").update(body).digest("hex");
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const keys = ["id", "assetId", "version", "schemaVersion", "sha256", "bytes", "mediaType", "width", "height", "originalSha256"];
const validVersion = row => exact(row, keys) && /^image-version-[a-f0-9-]{36}$/.test(row.id) && /^image-[a-f0-9-]{36}$/.test(row.assetId) && Number.isSafeInteger(row.version) && row.version > 0 && row.schemaVersion === VERSION && /^[a-f0-9]{64}$/.test(row.sha256) && /^[a-f0-9]{64}$/.test(row.originalSha256) && Number.isSafeInteger(row.bytes) && row.bytes > 0 && row.bytes <= MAX_IMAGE && row.mediaType === "image/webp" && [row.width, row.height].every(n => Number.isSafeInteger(n) && n >= 16 && n <= 4096) && row.width * row.height <= 8388608;
function validateVersions(rows) {
  return Array.isArray(rows) && rows.length <= 500 && rows.every(validVersion) && new Set(rows.map(row => row.id)).size === rows.length;
}
function verifiedBytes(row, blobs) {
  if (!validVersion(row)) fail(422, "Unsupported image version metadata.");
  const encoded = blobs?.[row.sha256];
  if (typeof encoded !== "string" || encoded.length > MAX_IMAGE * 1.34 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) fail(422, "Required image bytes are missing from the package.");
  const body = Buffer.from(encoded, "base64");
  if (body.length !== row.bytes || digest(body) !== row.sha256) fail(422, "Required image failed its integrity check. The previous release remains active.");
  return body;
}
let processing = false;
async function processUpload(input) {
  if (!input || Object.keys(input).some(key => !["expectedRevision", "requestId", "assetId", "title", "description", "notes", "data"].includes(key))) fail(400, "Unsupported image upload fields.");
  if (input.requestId != null && !/^[a-f0-9-]{36}$/.test(input.requestId)) fail(400, "Invalid upload request identity.");
  for (const [field, max] of [["title", 160], ["description", 1000], ["notes", 2000]]) {
    if (typeof input[field] !== "string" || input[field].length > max || (field === "title" && !input[field].trim()) || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(input[field])) fail(422, `Provide a valid ${field} (up to ${max} characters).`);
  }
  if (typeof input.data !== "string" || input.data.length > MAX_UPLOAD * 4 / 3 + 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(input.data)) fail(413, "Choose a PNG, JPEG or WebP image up to 3 MiB.");
  const body = Buffer.from(input.data, "base64");
  if (!body.length || body.length > MAX_UPLOAD) fail(413, "Images must be at most 3 MiB.");
  if (!(body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || body.subarray(0, 3).equals(Buffer.from([255, 216, 255])) || (body.toString("ascii", 0, 4) === "RIFF" && body.toString("ascii", 8, 12) === "WEBP"))) fail(422, "Only PNG, JPEG and WebP image contents are supported.");
  if (processing) fail(429, "Another image is processing. Please retry shortly.");
  processing = true;
  try {
    const sharp = require("sharp");
    const options = { failOn: "warning", limitInputPixels: 8388608, sequentialRead: true, animated: false };
    const metadata = await sharp(body, options).metadata();
    if (!["png", "jpeg", "webp"].includes(metadata.format) || (metadata.pages || 1) !== 1 || ![metadata.width, metadata.height].every(n => n >= 16 && n <= 4096)) fail(422, "Use a still PNG, JPEG or WebP, 16–4,096 pixels per side and at most 8 megapixels.");
    // Full decode, orientation normalization and metadata stripping. This fixed
    // output is the stored version; it is never regenerated during delivery.
    const { data, info } = await sharp(body, options).timeout({ seconds: 10 }).rotate().webp({ quality: 90, effort: 4 }).toBuffer({ resolveWithObject: true });
    if (data.length > MAX_IMAGE) fail(413, "Processed artwork exceeds 1 MiB. Choose a smaller image.");
    return { data: data.toString("base64"), metadata: { schemaVersion: VERSION, sha256: digest(data), bytes: data.length, mediaType: "image/webp", width: info.width, height: info.height, originalSha256: digest(body) } };
  } catch (error) {
    if (error.status) throw error;
    fail(422, "This file could not be decoded safely. Choose a complete still PNG, JPEG or WebP image within the limits.");
  } finally { processing = false; }
}
function uploadHash({ expectedRevision, ...input }) { return digest(Buffer.from(JSON.stringify(input))); }
function capacity(state) {
  const blobs = Object.values(state.assetBlobs || {});
  const storedBytes = blobs.reduce((n, value) => n + Buffer.from(value, "base64").length, 0);
  const versionCount = new Set([...(state.uploads || []).flatMap(asset => asset.versions), ...Object.values(state.releases || {}).flatMap(release => release.snapshot.assetVersions || [])].map(row => row.id)).size;
  return { storedBytes, remainingBytes: Math.max(0, MAX_STORED - storedBytes), maxBytes: MAX_STORED, versionCount, remainingVersions: Math.max(0, 500 - versionCount), maxVersions: 500,
    encodedBytes: blobs.reduce((n, value) => n + Buffer.byteLength(value), 0), metadataBytes: Buffer.byteLength(JSON.stringify(state.uploads || [])),
    statePayloadBytes: Buffer.byteLength(JSON.stringify(state, null, 2) + "\n"), uniqueBlobCount: blobs.length, maxUploadBytes: MAX_UPLOAD, maxImageBytes: MAX_IMAGE };
}
function priorUpload(state, input, actor) {
  const operation = input?.requestId && state.assetOperations?.[input.requestId];
  if (!operation) return null;
  if (operation.actorId !== actor || operation.hash !== uploadHash(input)) fail(409, "This upload request was already used for different input.");
  return state.uploads.flatMap(record => record.versions).find(row => row.id === operation.versionId);
}
function insert(state, input, processed, actorId) {
  state.uploads ||= []; state.assetBlobs ||= {};
  const previous = input.assetId && state.uploads.find(row => row.id === input.assetId);
  if (input.assetId && !previous) fail(404, "The logical asset does not exist.");
  if (previous?.archived) fail(422, "Restore this asset before adding a version.");
  if (capacity(state).versionCount >= 500) fail(422, "All 500 retained image versions are used. Reuse an existing version; creating printings does not require another upload. Storage expansion needs a separate adapter milestone.");
  const record = previous || { id: `image-${crypto.randomUUID()}`, versions: [], archived: false };
  const row = { id: `image-version-${crypto.randomUUID()}`, assetId: record.id, version: record.versions.length + 1, ...processed.metadata };
  verifiedBytes(row, { [row.sha256]: processed.data });
  const total = Object.values(state.assetBlobs).reduce((n, value) => n + Buffer.from(value, "base64").length, 0);
  if (!state.assetBlobs[row.sha256] && total + row.bytes > MAX_STORED) fail(422, "The retained upload package has reached its 6 MiB limit. No assets were removed. Larger libraries require a separate storage milestone.");
  Object.assign(record, { title: input.title.trim(), description: input.description, notes: input.notes, updatedBy: actorId });
  record.versions.push(row); if (!previous) state.uploads.push(record);
  state.assetBlobs[row.sha256] = processed.data;
  if (input.requestId) { state.assetOperations ||= {}; state.assetOperations[input.requestId] = { versionId: row.id, actorId, hash: uploadHash(input) }; }
  return row;
}
function attachVersions(snapshot, state) {
  const referenced = new Set();
  const visit = value => { if (typeof value === "string" && value.startsWith("image-version-")) referenced.add(value); else if (value && typeof value === "object") Object.values(value).forEach(visit); };
  visit(snapshot.domains);
  if (!referenced.size) { delete snapshot.assetVersions; return; }
  const available = new Map((state.uploads || []).flatMap(asset => asset.versions.map(row => [row.id, row])));
  for (const release of Object.values(state.releases)) for (const row of release.snapshot.assetVersions || []) available.set(row.id, row);
  snapshot.assetVersions = [...referenced].sort().map(id => { const row = available.get(id); if (!row) fail(422, "Choose an uploaded immutable image version."); verifiedBytes(row, state.assetBlobs); return row; });
}
function publicPath(row) { return `/api/content-assets/${row.id}/${row.sha256}.webp`; }
function entries(state) {
  const live = new Set((state.releases[state.activeReleaseId]?.snapshot.assetVersions || []).map(row => row.id));
  const saved = new Set((state.draft?.snapshot.assetVersions || []).map(row => row.id));
  const packaged = new Set(Object.values(state.releases).flatMap(release => (release.snapshot.assetVersions || []).map(row => row.id)));
  return (state.uploads || []).flatMap(asset => {
    const ids = new Set(asset.versions.map(row => row.id));
    const dependencies = [...(state.draft ? [{ label: "Saved draft", snapshot: state.draft.snapshot }] : []), ...Object.values(state.releases)].flatMap(release => {
      const versions = release.snapshot.assetVersions?.filter(row => ids.has(row.id)) || [];
      return versions.length ? [{ release: release.label, versions: versions.map(row => row.version), active: release.id === state.activeReleaseId }] : [];
    });
    return asset.versions.map(row => ({ ...row, label: asset.title, description: asset.description, notes: asset.notes, archived: asset.archived, dependencies, source: `${asset.title} · version ${row.version}`, path: `/api/admin/authoring/assets/${row.id}`, stage: live.has(row.id) ? "Active" : saved.has(row.id) ? "Saved in draft" : packaged.has(row.id) ? "Packaged · retained" : "Uploaded · private" }));
  });
}
function packageAssets(state, snapshot) {
  const versions = [...new Map(Object.values(state.releases).flatMap(release => release.snapshot.assetVersions || []).concat(snapshot.assetVersions || []).map(row => [row.id, row])).values()].sort((a, b) => a.id.localeCompare(b.id));
  const blobs = {};
  for (const row of versions) blobs[row.sha256] = verifiedBytes(row, state.assetBlobs).toString("base64");
  return { dependencies: versions.length ? require("./releaseAssetDependencies").verify() : null, schemaVersion: "gauntlet.asset-package.v1", sourceManifestVersion: require("./contentAssets").assetManifest.version, versions, blobs };
}
function validatePackage(pack, snapshot) {
  if (!pack && !snapshot.assetVersions?.length) return;
  if (!pack || pack.schemaVersion !== "gauntlet.asset-package.v1" || pack.sourceManifestVersion !== require("./contentAssets").assetManifest.version || !validateVersions(pack.versions)) fail(422, "The release image package is missing or incompatible.");
  require("./releaseAssetDependencies").validate(pack.dependencies);
  for (const row of pack.versions) verifiedBytes(row, pack.blobs);
  for (const row of snapshot.assetVersions || []) if (!pack.versions.some(entry => JSON.stringify(entry) === JSON.stringify(row))) fail(422, "The package does not contain the exact required image version.");
}
module.exports = { capacity, priorUpload, MAX_UPLOAD, MAX_STORED, VERSION, digest, validateVersions, verifiedBytes, processUpload, insert, attachVersions, entries, publicPath, packageAssets, validatePackage };
