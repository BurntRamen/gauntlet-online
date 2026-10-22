"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const { assetEntry, assetManifest } = require("./contentAssets");
const PUBLIC = path.resolve(__dirname, "../client/public");
const ANALYSIS = "service:match-analysis-v1";
const TITLE = "service:profile-title-v1";
const music = new Set(["profile-music", "faction-soundtrack"]);
const images = new Set(["collector-treatment", "card-back", "deck-box", "faction-banner"]);
const publications = new Set(["digital-publication", "digital-edition"]);
const ownershipKey = term => `${require("./cosmeticEquipment").SLOTS[term.category] || "content"}:${term.delivery.id}`;
function resolveDelivery(term, verify = true) {
  if (term.category === "profile-title" && term.asset === TITLE && typeof term.name === "string" && term.name.trim() && term.name.length <= 160) return { id: `${TITLE}:${term.id}`, name: term.name, kind: "title", sha256: crypto.createHash("sha256").update(JSON.stringify([TITLE, term.id, term.name])).digest("hex") };
  if (term.category === "analytics" && term.asset === ANALYSIS) return { id: ANALYSIS, name: "Personal match analysis", mediaType: "application/vnd.gauntlet.analysis", kind: "analysis", sha256: crypto.createHash("sha256").update(matchAnalysis.toString()).digest("hex") };
  const entry = assetEntry(term.asset);
  if (!entry || !(music.has(term.category) && entry.mediaType.startsWith("audio/") || images.has(term.category) && entry.mediaType.startsWith("image/") || publications.has(term.category) && ["application/pdf", "text/plain"].includes(entry.mediaType))) throw new Error("This content or service has no implemented delivery provider.");
  const filename = path.resolve(PUBLIC, `.${entry.path}`);
  if (!filename.startsWith(PUBLIC + path.sep)) throw new Error("Invalid delivery path.");
  if (verify && (!fs.existsSync(filename) || crypto.createHash("sha256").update(fs.readFileSync(filename)).digest("hex") !== entry.sha256)) throw new Error("Delivery asset missing or changed; availability is suspended.");
  return { id: entry.id, name: entry.source, mediaType: entry.mediaType, kind: music.has(term.category) ? "audio" : images.has(term.category) ? "image" : "publication", sha256: entry.sha256, filename };
}
function deliveryOptions() { return [{ id: ANALYSIS, source: "Personal match analysis · live account evidence", mediaType: "application/vnd.gauntlet.analysis" }, { id: TITLE, source: "Profile title · use this entitlement's name", mediaType: "application/vnd.gauntlet.title" }, ...assetManifest.entries]; }
function matchAnalysis(records, accountId) {
  const rows = records.filter((r) => r.completion?.status === "finalized" && r.participants?.some((p) => p.accountId === accountId));
  const factions = new Map(), months = new Map(), modes = new Map();
  for (const r of rows) {
    const p = r.participants.find((p) => p.accountId === accountId);
    for (const [map, key] of [[factions, p.faction?.name || "Classic"], [months, r.completedAt.slice(0, 7)], [modes, r.para ? "Official Para" : r.campaign ? "Campaign" : r.draft ? "Draft" : r.ranked ? "Ranked" : r.mode]]) {
      const a = map.get(key) || { count: 0, win: 0, loss: 0, draw: 0, turns: 0, damage: 0 };
      a.count++; if (Object.hasOwn(a, p.result)) a[p.result]++; a.turns += r.turnCount || 0; a.damage += r.combatStats?.byPlayer?.[String(p.playerNum)]?.damageDealt || 0; map.set(key, a);
    }
  }
  const table = (title, map) => ({ title, columns: ["Group", "Matches", "Wins", "Losses", "Draws", "Win rate", "Mean turns", "Damage dealt"], rows: [...map].sort(([a], [b]) => a.localeCompare(b)).map(([key, a]) => [key, a.count, a.win, a.loss, a.draw, a.win + a.loss ? `${Math.round(a.win * 100 / (a.win + a.loss))}%` : "—", (a.turns / a.count).toFixed(1), a.damage]) });
  return { title: "Personal match analysis", summary: `${rows.length} finalized matches in the latest 100-record window. Win rate excludes draws and abandoned matches. Means include all listed matches. Basic history and replay remain free.`, tables: [table("Faction comparison", factions), table("Monthly activity", months), table("Mode comparison", modes), { title: "Source matches", columns: ["Match", "Completed", "Mode"], rows: rows.map((r) => [r.matchId, r.completedAt, r.mode]) }] };
}
module.exports = { ANALYSIS, TITLE, resolveDelivery, deliveryOptions, matchAnalysis, ownershipKey };
