"use strict";

const { fieldsFor, hash } = require("./authoredContent");
const { cardAuthoringDefinitions } = require("./adminCardAuthoring");
const labels = { campaigns: "Campaigns", encounters: "Encounters", cards: "Cards", factions: "Factions", characters: "Characters", decks: "Deck templates", game: "Website prose" };
const normalize = value => String(value || "").normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const label = row => row.name || row.title || row.commanderName || row.id;
const menus = [
  ...["Overview", "Design", "Players", "Matches", "Publishing", "System"].map(area => ({ label: area, detail: ({ Design: "Content workshops and game rules", Players: "Player profiles and metadata", Matches: "Match history and replay", Publishing: "Review changes, publish and rollback", System: "Diagnostics and connections" })[area] || "Administration", target: { area } })),
  ...[["encounters", "Encounters", "Stories, dialogue, setup and artwork"], ["cards", "Cards", "Names, rules wording, effects and artwork"], ["card-effects", "Engine / Rules", "Mechanics, faction effects and shared settings"], ["modes", "Website prose", "Editable website copy, page headings and mode descriptions"], ["campaigns", "Campaigns", "Campaign headings and introductions"], ["characters", "Characters", "Names, biographies and portraits"], ["factions", "Factions", "Faction names and artwork"], ["decks", "Deck templates", "Template names and descriptions"], ["assets", "Collector artwork", "Images, assets and collector card versions"]].map(([domain, name, detail]) => ({ label: name, detail, target: { area: "Design", domain } }))
].map(row => ({ ...row, kind: "menu", key: `menu:${row.label}` }));

function validateSearchQuery({ q = "", kind = "all", offset = "0" } = {}) {
  if (typeof q !== "string" || q.length > 160 || !["all", "menus", "prose"].includes(kind) || !/^\d{1,5}$/.test(String(offset))) throw Object.assign(new Error("Use a search of at most 160 characters and a valid category."), { status: 400 });
}

function searchAdmin(status, { q = "", kind = "all", offset = "0" } = {}) {
  validateSearchQuery({ q, kind, offset });
  const terms = normalize(q).split(" ").filter(Boolean), snapshot = status?.draft?.snapshot || status?.live;
  const rows = kind === "prose" ? [] : [...menus];
  if (snapshot && kind !== "menus") {
    for (const [domain, objects] of Object.entries(snapshot.domains)) for (const row of objects) {
      for (const [field, spec] of Object.entries(fieldsFor(domain, row))) {
        if (!["text", "lines"].includes(spec.type)) continue;
        const value = row[field] ?? spec.defaultValue ?? "";
        const text = Array.isArray(value) ? value.join("\n") : String(value);
        rows.push({ key: `${domain}:${row.id}:${field}`, kind: "prose", label: label(row), detail: `${labels[domain] || domain} · ${spec.label}`, text,
          target: { area: "Design", domain: domain === "game" ? "modes" : domain, id: row.id, field,
            section: domain === "encounters" ? "story" : domain === "cards" ? "identity" : null } });
      }
    }
    if (kind === "all") for (const effect of cardAuthoringDefinitions()) rows.push({ key: `effect:${effect.id}`, kind: "reference", label: effect.label, detail: "Card effect · read-only registry", text: effect.description, target: { area: "Design", domain: "card-effects", id: effect.id } });
  }
  const results = rows.map((row, index) => {
    const name = normalize(row.label), body = normalize([row.label, row.detail, row.target.id, row.text].join(" "));
    return { row, index, matches: terms.every(term => body.includes(term)), rank: !terms.length ? 0 : name === normalize(q) ? 0 : terms.every(term => name.includes(term)) ? 1 : row.kind === "menu" ? 2 : 3 };
  }).filter(row => row.matches).sort((a, b) => a.rank - b.rank || a.index - b.index);
  const start = Math.min(Number(offset), results.length), limit = 24;
  return { source: status?.draft ? "draft" : "live", hash: snapshot ? hash(snapshot) : null, revision: status?.revision ?? null, liveOnly: !!status?.liveOnly, total: results.length, offset: start,
    results: results.slice(start, start + limit).map(({ row }) => {
      const { text = "", ...result } = row;
      const index = terms.length ? text.toLowerCase().indexOf(terms[0]) : 0;
      const from = Math.max(0, index - 45);
      return { ...result, snippet: `${from ? "…" : ""}${text.slice(from, from + 180)}${text.length > from + 180 ? "…" : ""}` };
    }) };
}
module.exports = { searchAdmin, validateSearchQuery };
