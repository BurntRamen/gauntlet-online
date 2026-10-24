"use strict";
const manifest = require("./contentAssetManifest.json");
const byReference = new Map([...manifest.entries, ...require("./presentationAssetManifest.json")].flatMap((row) => [[row.id, row], [row.source, row], [row.path, row]]));
let deliveryOrigin = process.env.RENDER_EXTERNAL_URL || "https://gauntlet-online.onrender.com";
function setDeliveryOrigin(value) { deliveryOrigin = value.replace(/\/$/, ""); }
function assetEntry(reference, versions = [], releaseId = "") {
  const row = versions.find(row => [row.id, require("./authoredAssets").publicPath(row), `${deliveryOrigin}${require("./authoredAssets").publicPath(row)}`, `/api/admin/authoring/assets/${row.id}`].includes(reference));
  return row ? { ...row, path: releaseId.startsWith("draft:") ? `/api/admin/authoring/assets/${row.id}` : `${deliveryOrigin}${require("./authoredAssets").publicPath(row)}` } : byReference.get(reference) || null;
}
function resolveAsset(reference, versions = [], releaseId = "") { return reference ? assetEntry(reference, versions, releaseId)?.path || (reference.startsWith("data:image/webp;base64,") ? reference : null) : reference; }
function validAssetReference(reference, media, versions = []) {
  if (reference === "" || (media === "audio" && reference === null)) return true;
  return !!assetEntry(reference, versions)?.mediaType?.startsWith(`${media}/`);
}
function resolveAssetFields(value, field = "", versions = [], releaseId = "") {
  const referenceField = ["art", "image", "cardImage", "coverImage", "dialogueAudio", "endDialogueAudio"].includes(field);
  if (typeof value === "string") return referenceField ? resolveAsset(value, versions, releaseId) : value;
  if (Array.isArray(value)) return value.map((child) => resolveAssetFields(child, field, versions, releaseId));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, resolveAssetFields(child, field === "announcementAudio" ? "dialogueAudio" : key, versions, releaseId)]));
  return value;
}
function cardPresentation(card, variant, sourceCard, sourceVariant, releaseId, versions = []) {
  const illustration = resolveAsset(variant?.art || manifest.illustrations[card.id], versions, releaseId);
  const bakedFaces = ["spades", "hearts", "diamonds", "clubs"].map((suit) => manifest.faces[`${card.id}:${suit}`]);
  const baked = bakedFaces.every(Boolean) && card.name === sourceCard?.name && card.text === sourceCard?.text
    && resolveAsset(variant?.art, versions, releaseId) === resolveAsset(sourceVariant?.art);
  const faces = Object.fromEntries(["spades", "hearts", "diamonds", "clubs"].map((suit) => [suit, baked ? resolveAsset(manifest.faces[`${card.id}:${suit}`]) : null]));
  return { releaseId, assetManifestVersion: manifest.version, illustration, faces, composed: !baked,
    illustrationAssetId: assetEntry(variant?.art || illustration, versions, releaseId)?.id || null, illustrationDigest: assetEntry(variant?.art || illustration, versions, releaseId)?.sha256 || null };
}
function ordinaryPresentation(card, factionId, releaseId) {
  const malformed = { "â™ ": "spades", "â™¥": "hearts", "â™¦": "diamonds", "â™£": "clubs" };
  const suit = ({ "♠": "spades", "♥": "hearts", "♦": "diamonds", "♣": "clubs", ...malformed })[card.suit] || card.suit;
  const rank = ({ 11: "j", 12: "q", 13: "k", 14: "a" })[card.value] || String(card.rank || card.value).toLowerCase();
  const reference = manifest.faces[`ordinary:${factionId}-${rank}-${suit}`] || manifest.faces[`ordinary:basic-${rank}-${suit}`];
  const entry = assetEntry(reference);
  return { releaseId, assetManifestVersion: manifest.version, face: entry?.path || null, faceAssetId: entry?.id || null, faceDigest: entry?.sha256 || null, composed: false };
}
module.exports = { assetManifest: manifest, assetEntry, resolveAsset, resolveAssetFields, validAssetReference, cardPresentation, ordinaryPresentation, setDeliveryOrigin, getDeliveryOrigin: () => deliveryOrigin };
