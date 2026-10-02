"use strict";
const legacyBaseline = require("./legacyAuthoredBaseline.v1.json");
const { canonicalJson } = require("./matchArchive");
const editable = {
  campaigns: ["commanderName", "pitch", "coverImage"],
  encounters: ["title", "story", "playableName", "beforeBattle", "afterBattle", "image", "dialogue", "endDialogue", "dialogueAudio", "endDialogueAudio"],
  factions: ["name", "cardImage"], cards: ["name", "text"], decks: ["name", "description"], assets: ["art"], game: ["name", "description"]
};
function oldFields(domain, row) {
  if (domain !== "characters") return editable[domain] || [];
  return row.kind === "engine" ? [] : row.kind === "narrative" ? ["description"] : row.kind === "opponent" ? ["name"] : ["name", "image"];
}
function migrateV1(snapshot, baseline) {
  if (snapshot?.schemaVersion !== "gauntlet.authored-content.v1") throw new Error("Unsupported migration source.");
  const projected = JSON.parse(JSON.stringify(snapshot));
  for (const [domain, rows] of Object.entries(legacyBaseline.domains)) {
    if (!Array.isArray(projected.domains?.[domain]) || projected.domains[domain].length !== rows.length) throw new Error("Legacy content identities changed.");
    rows.forEach((original, index) => {
      const row = projected.domains[domain][index];
      if (row.id !== original.id) throw new Error("Legacy content identities changed.");
      for (const field of oldFields(domain, original)) row[field] = original[field];
    });
  }
  if (canonicalJson(projected) !== canonicalJson(legacyBaseline)) throw new Error("Legacy engine contract is incompatible; migration refused.");
  const migrated = JSON.parse(JSON.stringify(baseline));
  for (const [domain, rows] of Object.entries(snapshot.domains)) for (const row of rows) {
    const target = migrated.domains[domain].find((entry) => entry.id === row.id);
    const original = legacyBaseline.domains[domain].find((entry) => entry.id === row.id);
    for (const field of oldFields(domain, row)) {
      // Carry authored changes forward without undoing newer source defaults.
      if (canonicalJson(row[field]) !== canonicalJson(original[field])) target[field] = JSON.parse(JSON.stringify(row[field]));
    }
  }
  return migrated;
}
module.exports = { migrateV1 };
