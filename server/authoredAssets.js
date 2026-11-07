"use strict";
// Immutable versions retain legacy embedded bytes or verified private remote
// references. A release captures exact versions; draft storage is never public.
const crypto = require("node:crypto");
const remoteMedia = require("./remoteMediaStore");
const { processAudio, MAX_AUDIO } = require("./audioUpload");
const MAX_UPLOAD = 3 * 1024 * 1024, MAX_IMAGE = 1024 * 1024, MAX_STORED = 6 * 1024 * 1024;
const VERSION = "gauntlet.uploaded-image.v1";
const digest = body => crypto.createHash("sha256").update(body).digest("hex");
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const keys = ["id", "assetId", "version", "schemaVersion", "sha256", "bytes", "mediaType", "width", "height", "originalSha256"];
const validImage = row => exact(row, keys) && /^image-version-[a-f0-9-]{36}$/.test(row.id) && /^image-[a-f0-9-]{36}$/.test(row.assetId) && row.schemaVersion === VERSION && row.bytes <= MAX_IMAGE && row.mediaType === "image/webp" && [row.width, row.height].every(n => Number.isSafeInteger(n) && n >= 16 && n <= 4096) && row.width * row.height <= 8388608;
const validAudio = row => exact(row, keys.filter(key => !["width","height"].includes(key)).concat(["durationMs","channels","sampleRate"])) && /^audio-version-[a-f0-9-]{36}$/.test(row.id) && /^audio-[a-f0-9-]{36}$/.test(row.assetId) && row.schemaVersion === "gauntlet.uploaded-audio.v1" && row.bytes <= MAX_AUDIO && row.mediaType === "audio/wav" && [1,2].includes(row.channels) && Number.isSafeInteger(row.sampleRate) && row.sampleRate >= 8000 && row.sampleRate <= 96000 && Number.isSafeInteger(row.durationMs) && row.durationMs > 0 && row.durationMs <= 600000;
const validVersion = row => !!row && Number.isSafeInteger(row.version) && row.version > 0 && /^[a-f0-9]{64}$/.test(row.sha256) && /^[a-f0-9]{64}$/.test(row.originalSha256) && Number.isSafeInteger(row.bytes) && row.bytes > 0 && (validImage(row) || validAudio(row));
function validateVersions(rows) {
  return Array.isArray(rows) && rows.length <= 5000 && rows.every(validVersion) && new Set(rows.map(row => row.id)).size === rows.length;
}
function verifiedBytes(row, blobs) {
  if (!validVersion(row)) fail(422, "Unsupported image version metadata.");
  const encoded = blobs?.[row.sha256];
  // This validates a reference only. Publication and delivery separately fetch
  // and hash remote bytes; metadata validation is never a successful readback.
  if (remoteMedia.validReference(encoded, row)) return null;
  if (typeof encoded !== "string" || encoded.length > Math.max(MAX_IMAGE, MAX_AUDIO) * 1.34 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) fail(422, "Required media bytes or immutable reference are missing from the package.");
  const body = Buffer.from(encoded, "base64");
  if (body.length !== row.bytes || digest(body) !== row.sha256) fail(422, "Required image failed its integrity check. The previous release remains active.");
  return body;
}
function readBytes(row, blobs, mediaStore) {
  const local = verifiedBytes(row, blobs);
  if (local) return local;
  if (!mediaStore) fail(503, "The immutable media store is not configured.");
  return mediaStore.get(row, blobs[row.sha256]);
}
let processing = false;
async function processUpload(input, limits = {}) {
  if (!input || Object.keys(input).some(key => !["expectedRevision", "requestId", "assetId", "title", "description", "notes", "data"].includes(key))) fail(400, "Unsupported image upload fields.");
  if (input.requestId != null && !/^[a-f0-9-]{36}$/.test(input.requestId)) fail(400, "Invalid upload request identity.");
  for (const [field, max] of [["title", 160], ["description", 1000], ["notes", 2000]]) {
    if (typeof input[field] !== "string" || input[field].length > max || (field === "title" && !input[field].trim()) || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(input[field])) fail(422, `Provide a valid ${field} (up to ${max} characters).`);
  }
  if (typeof input.data !== "string" || input.data.length > MAX_AUDIO * 4 / 3 + 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(input.data)) fail(413, "Choose an image up to 3 MiB or PCM WAV audio up to 10 MiB.");
  const body = Buffer.from(input.data, "base64");
  if (body.toString("ascii",0,4) === "RIFF" && body.toString("ascii",8,12) === "WAVE") { if(body.length>(limits.audioUploadBytes||MAX_AUDIO)) fail(413,"This audio exceeds the configured upload limit."); return processAudio(body); }
  if (!body.length || body.length > (limits.imageUploadBytes||MAX_UPLOAD)) fail(413, "This image exceeds the configured upload limit (at most 3 MiB).");
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
function capacity(state, mediaStore = null) {
  const blobs = Object.values(state.assetBlobs || {});
  const storedBytes = blobs.reduce((n, value) => n + (typeof value === "string" ? Buffer.from(value, "base64").length : value.bytes || 0), 0);
  const versionCount = new Set([...(state.uploads || []).flatMap(asset => asset.versions), ...Object.values(state.releases || {}).flatMap(release => release.snapshot.assetVersions || [])].map(row => row.id)).size;
  const maxBytes = mediaStore?.maxBytes || MAX_STORED, maxVersions = mediaStore ? 5000 : 500;
  return { storedBytes, remainingBytes: Math.max(0, maxBytes - storedBytes), maxBytes, versionCount, remainingVersions: Math.max(0, maxVersions - versionCount), maxVersions,
    ...(mediaStore ? { provider: mediaStore.provider, usageSource: "References in authoring history; refresh storage usage for bucket totals" } : {}),
    encodedBytes: blobs.reduce((n, value) => n + (typeof value === "string" ? Buffer.byteLength(value) : 0), 0), metadataBytes: Buffer.byteLength(JSON.stringify(state.uploads || [])),
    statePayloadBytes: Buffer.byteLength(JSON.stringify(state, null, 2) + "\n"), uniqueBlobCount: blobs.length, maxUploadBytes: mediaStore?.uploadLimits?.imageUploadBytes || MAX_UPLOAD, maxAudioUploadBytes: mediaStore?.uploadLimits?.audioUploadBytes || MAX_AUDIO, maxImageBytes: MAX_IMAGE };
}
function priorUpload(state, input, actor) {
  const operation = input?.requestId && state.assetOperations?.[input.requestId];
  if (!operation) return null;
  if (operation.actorId !== actor || operation.hash !== uploadHash(input)) fail(409, "This upload request was already used for different input.");
  return state.uploads.flatMap(record => record.versions).find(row => row.id === operation.versionId);
}
function insert(state, input, processed, actorId, mediaStore = null) {
  state.uploads ||= []; state.assetBlobs ||= {};
  const previous = input.assetId && state.uploads.find(row => row.id === input.assetId);
  if (input.assetId && !previous) fail(404, "The logical asset does not exist.");
  if (previous?.archived) fail(422, "Restore this asset before adding a version.");
  const limits = capacity(state, mediaStore);
  if (!limits.remainingVersions) fail(422, "The retained media-version limit is reached. Existing references were retained.");
  const kind = processed.metadata.mediaType.startsWith("audio/") ? "audio" : "image";
  if (previous && !previous.id.startsWith(`${kind}-`)) fail(422, "A replacement must retain the asset's image or audio kind.");
  const record = previous || { id: `${kind}-${crypto.randomUUID()}`, versions: [], archived: false };
  const row = { id: `${kind}-version-${crypto.randomUUID()}`, assetId: record.id, version: record.versions.length + 1, ...processed.metadata };
  verifiedBytes(row, { [row.sha256]: processed.data });
  const total = Object.values(state.assetBlobs).reduce((n, value) => n + (typeof value === "string" ? Buffer.from(value, "base64").length : 0), 0);
  if (!mediaStore && !state.assetBlobs[row.sha256] && total + row.bytes > MAX_STORED) fail(422, "The retained upload package has reached its 6 MiB limit. No assets were removed. Configure remote immutable media for larger libraries.");
  if (mediaStore && !remoteMedia.validReference(processed.reference, row)) fail(503, "Remote upload readback was not confirmed.");
  Object.assign(record, { title: input.title.trim(), description: input.description, notes: input.notes, updatedBy: actorId });
  record.versions.push(row); if (!previous) state.uploads.push(record);
  state.assetBlobs[row.sha256] = processed.reference || processed.data;
  if (input.requestId) { state.assetOperations ||= {}; state.assetOperations[input.requestId] = { versionId: row.id, actorId, hash: uploadHash(input) }; }
  return row;
}
function attachVersions(snapshot, state) {
  const referenced = new Set();
  const visit = value => { if (typeof value === "string" && /^(image|audio)-version-/.test(value)) referenced.add(value); else if (value && typeof value === "object") Object.values(value).forEach(visit); };
  visit(snapshot.domains);
  if (!referenced.size) { delete snapshot.assetVersions; return; }
  const available = new Map((state.uploads || []).flatMap(asset => asset.versions.map(row => [row.id, row])));
  for (const release of Object.values(state.releases)) for (const row of release.snapshot.assetVersions || []) available.set(row.id, row);
  snapshot.assetVersions = [...referenced].sort().map(id => { const row = available.get(id); if (!row) fail(422, "Choose an uploaded immutable image version."); verifiedBytes(row, state.assetBlobs); return row; });
}
function publicPath(row) { return `/api/content-assets/${row.id}/${row.sha256}.${row.mediaType === "audio/wav" ? "wav" : "webp"}`; }
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
  for (const row of versions) { const body = verifiedBytes(row, state.assetBlobs); blobs[row.sha256] = body ? body.toString("base64") : state.assetBlobs[row.sha256]; }
  return { dependencies: versions.length ? require("./releaseAssetDependencies").verify() : null, schemaVersion: Object.values(blobs).some(value => typeof value !== "string") ? "gauntlet.asset-package.v2" : "gauntlet.asset-package.v1", sourceManifestVersion: require("./contentAssets").assetManifest.version, versions, blobs };
}
function validatePackage(pack, snapshot) {
  if (!pack && !snapshot.assetVersions?.length) return;
  if (!pack || !["gauntlet.asset-package.v1","gauntlet.asset-package.v2"].includes(pack.schemaVersion) || pack.sourceManifestVersion !== require("./contentAssets").assetManifest.version || !validateVersions(pack.versions)) fail(422, "The release media package is missing or incompatible.");
  require("./releaseAssetDependencies").validate(pack.dependencies);
  for (const row of pack.versions) verifiedBytes(row, pack.blobs);
  for (const row of snapshot.assetVersions || []) if (!pack.versions.some(entry => JSON.stringify(entry) === JSON.stringify(row))) fail(422, "The package does not contain the exact required image version.");
}
module.exports = { capacity, priorUpload, MAX_UPLOAD, MAX_STORED, MAX_AUDIO, VERSION, digest, validateVersions, verifiedBytes, readBytes, processUpload, insert, attachVersions, entries, publicPath, packageAssets, validatePackage };
