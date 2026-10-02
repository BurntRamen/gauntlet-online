"use strict";
const manifest = require("./contentAssetManifest.json");
const byReference = new Map(manifest.entries.flatMap((row) => [[row.id, row], [row.source, row], [row.path, row]]));
function assetEntry(reference) { return byReference.get(reference) || null; }
function resolveAsset(reference) { return reference ? assetEntry(reference)?.path || null : reference; }
function validAssetReference(reference, media) {
  if (reference === "" || (media === "audio" && reference === null)) return true;
  return !!assetEntry(reference)?.mediaType?.startsWith(`${media}/`);
}
function resolveAssetFields(value, field = "") {
  const referenceField = ["art", "image", "cardImage", "coverImage", "dialogueAudio", "endDialogueAudio"].includes(field);
  if (typeof value === "string") return referenceField ? resolveAsset(value) : value;
  if (Array.isArray(value)) return value.map((child) => resolveAssetFields(child, field));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, resolveAssetFields(child, field === "announcementAudio" ? "dialogueAudio" : key)]));
  return value;
}
function cardPresentation(card, variant, sourceCard, sourceVariant, releaseId) {
  const illustration = resolveAsset(variant?.art || manifest.illustrations[card.id]);
  const baked = card.name === sourceCard?.name && card.text === sourceCard?.text
    && resolveAsset(variant?.art) === resolveAsset(sourceVariant?.art);
  const faces = Object.fromEntries(["spades", "hearts", "diamonds", "clubs"].map((suit) => [suit, baked ? resolveAsset(manifest.faces[`${card.id}:${suit}`]) : null]));
  return { releaseId, assetManifestVersion: manifest.version, illustration, faces, composed: !baked,
    illustrationAssetId: assetEntry(illustration)?.id || null, illustrationDigest: assetEntry(illustration)?.sha256 || null };
}
function ordinaryPresentation(card, factionId, releaseId) {
  const malformed = { "â™ ": "spades", "â™¥": "hearts", "â™¦": "diamonds", "â™£": "clubs" };
  const suit = ({ "♠": "spades", "♥": "hearts", "♦": "diamonds", "♣": "clubs", ...malformed })[card.suit] || card.suit;
  const rank = ({ 11: "j", 12: "q", 13: "k", 14: "a" })[card.value] || String(card.rank || card.value).toLowerCase();
  const reference = manifest.faces[`ordinary:${factionId}-${rank}-${suit}`] || manifest.faces[`ordinary:basic-${rank}-${suit}`];
  const entry = assetEntry(reference);
  return { releaseId, assetManifestVersion: manifest.version, face: entry?.path || null, faceAssetId: entry?.id || null, faceDigest: entry?.sha256 || null, composed: false };
}
module.exports = { assetManifest: manifest, assetEntry, resolveAsset, resolveAssetFields, validAssetReference, cardPresentation, ordinaryPresentation };
