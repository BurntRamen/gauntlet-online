"use strict";

// Read-only projections. These adapters never author content or run game commands.
const crypto = require("node:crypto");
const fs = require("node:fs");
const content = require("./gameContent");
const duel = require("../shared/duel-rules");
const { publicMatchSummary, publicMatchRecord, MATCH_RECORD_VERSION } = require("./matchRecords");
const { canonicalJson, MATCH_ARCHIVE_INDEX_VERSION, MATCH_ARCHIVE_OBJECT_VERSION } = require("./matchArchive");
const { LEAGUE_EVIDENCE_VERSION, PUBLIC_REPLAY_FRAME_VERSION } = require("./matchReplay");
const { MATCH_JOURNAL_VERSION, recordFromJournalRow } = require("./matchPersistence");
const { ROOM_STATE_SCHEMA_VERSION } = require("./roomStateStore");
const { MATCH_COMPLETION_ENVELOPE_VERSION } = require("./matchCompletion");

const SOURCE = "server/gameContent.js";
const clone = (value) => JSON.parse(JSON.stringify(value));
const pick = (value, fields) => Object.fromEntries(fields.filter((key) => value?.[key] !== undefined).map((key) => [key, clone(value[key])]));
const scalarMap = (value) => Object.fromEntries(Object.entries(value || {}).filter(([, item]) => ["string", "number", "boolean"].includes(typeof item)));
const stringList = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];

function readLocalRows(filename, key) {
  if (!fs.existsSync(filename)) return [];
  const data = JSON.parse(fs.readFileSync(filename, "utf8"));
  if (!Array.isArray(data[key])) throw new Error("Invalid local store.");
  return data[key];
}

function pageOptions(query = {}) {
  const number = (value, fallback, max) => value == null ? fallback : /^\d+$/.test(String(value)) ? Math.min(Number(value), max) : NaN;
  const offset = number(query.offset, 0, 1000000);
  const limit = number(query.limit, 25, 100);
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(limit) || limit < 1) {
    const error = new Error("Use a nonnegative offset and a limit from 1 to 100.");
    error.status = 400;
    throw error;
  }
  return { offset, limit };
}

function buildCatalog(runtime, resolved = null) {
  const manifest = resolved?.manifest || content.getPublicGameContent();
  const allFactions = Object.values(resolved?.factions || content.factionsData);
  const object = (id, name, definition, source = SOURCE, storage = "source-controlled", note = "Requires a reviewed source change and deployment.") => ({ id, name, source, storage, editable: false, note, definition: clone(definition) });
  const campaigns = Object.entries(manifest.campaigns).map(([id, campaign]) => object(id, `${campaign.factionName} campaign`, campaign));
  const encounters = campaigns.flatMap((campaign) => campaign.definition.chapters.map((chapter, index) => object(chapter.id, chapter.title, {
    ...chapter, factionId: campaign.id, chapterNumber: index + 1,
    runtime: runtime.encounter(campaign.id, chapter, index)
  }, `${SOURCE} + server/index.js:getCampaignDifficulty/getCampaignBossAbility`, "source + runtime-derived", "Story is structured content; difficulty, boss powers and deck additions are calculated by server code.")));
  const characters = [];
  for (const faction of allFactions) {
    for (const role of ["commander", "general", "city"]) {
      if (faction[role]) characters.push(object(`${faction.id}:${role}`, faction[role].name, { factionId: faction.id, role, ...faction[role] }));
    }
  }
  for (const campaign of campaigns) {
    for (const [name, description] of Object.entries(campaign.definition.characters || {})) {
      characters.push(object(`${campaign.id}:character:${name}`, name, { factionId: campaign.id, description }));
    }
  }
  for (const encounter of encounters) {
    characters.push(object(`${encounter.id}:opponent`, encounter.definition.opponentName || encounter.name, {
      factionId: encounter.definition.factionId, encounterId: encounter.id,
      role: "campaign opponent", ability: encounter.definition.runtime.bossAbility
    }, encounter.source, "source + runtime-derived"));
  }
  characters.push(object("training-ai", manifest.trainingOpponent?.name || "Training AI", { role: "automated opponent", opponentKind: "training-ai", behavior: "Move selection and scheduling remain engine-controlled; display name is authored." }, "server/index.js:chooseSemanticTrainingAiCommand/applySemanticAutomatedCommand", "hard-coded"));
  const decks = [object("standard", "Standard playing deck", manifest.deckRules, `${SOURCE}:DECK_RULES + server/index.js:createGameFromLobby`, "runtime-generated", "52 value/suit slots; constructed and draft cards replace slots. Saved player deck versions are shown under Players.")];
  for (const encounter of encounters) {
    decks.push(object(`${encounter.id}:decks`, `${encounter.name} — encounter decks`, encounter.definition.runtime.deckPlan,
      "server/encounterDefinitions.json + published encounter setup", "runtime-generated", "Card IDs are derived from the current plan. Suits, shuffle and actual match deck identities are assigned at runtime."));
  }
  const domains = {
    campaigns, encounters,
    factions: allFactions.map((faction) => object(faction.id, faction.name, { ...faction, availability: faction.campaignOnly ? "campaign only; excluded from normal faction selection" : "normal faction selection and campaigns" })),
    cards: manifest.cards.map((card) => object(card.id, card.name, card)),
    decks, characters
  };
  const modes = [
    ["basic", "Basic duel", "Shared duel engine; no faction powers."],
    ["factions", "Faction duel", "Shared duel engine with faction and constructed-card powers."],
    ["draft", "Draft", "Server draft and deck assembly; duel rules for the match."],
    ["freeForAll", "Free for all", "Separate server multiplayer rules path."],
    ["campaign", "Campaign", "Faction room with scripted boss, chapter gates and completion rewards."],
    ["draftLeague", "Draft league", "Server queue and progression wrapping draft matches."],
    ["ranked", "Ranked", "Faction duels; best-of-one or best-of-three with season scoring."],
    ["practice", "Practice vs AI", "Server automated opponent for Basic or Factions."]
  ].map(([id, name, boundary]) => ({ id, name, boundary, availability: "implemented", source: "server/index.js socket handlers", note: "Code-defined entry point; no operator enable/disable flag." }));
  let validation;
  try { content.validateGameContent(); validation = { valid: true, message: "Current loaded content passes validateGameContent()." }; }
  catch (error) { validation = { valid: false, message: error.message }; }
  return {
    schemaVersion: "gauntlet.admin-catalog.v1", generatedAt: new Date().toISOString(),
    versions: { content: manifest.contentVersion, registryRules: manifest.rulesVersion, manifestSchema: manifest.schemaVersion, engineRules: duel.RULES_VERSION, engineCards: duel.CARD_CONTENT_VERSION },
    counts: Object.fromEntries(Object.entries(domains).map(([key, rows]) => [key, rows.length])),
    domains, validation,
    game: {
      modes,
      startingState: { startingLife: duel.STARTING_LIFE, handSize: duel.HAND_SIZE, source: "shared/duel-rules/index.js (also consumed by server/index.js)", note: "Campaign boss life is overridden per encounter. Lane count and multiplayer setup remain in server/index.js." },
      deckRules: manifest.deckRules,
      abilities: { factionCommands: duel.FACTION_ABILITY_INTENTS, constructedChoices: duel.CONSTRUCTED_CHOICE_INTENTS },
      abilitySource: "shared/duel-rules/index.js; passive effects dispatch through the finite effect registry. This list describes explicit choices, not every passive effect.",
      engineBoundary: "Socket.IO validates identity and commands in server/index.js. Shared duel rules apply supported two-player commands. Campaign scripts, automated turns, free-for-all, room creation and completion remain server-owned. The browser renders perspective projections; local practice also uses shared duel rules.",
      enablement: "The registry has no global draft/published or enabled/disabled fields. XenDra is campaignOnly and excluded from normal faction selection; the other four factions are selectable. Campaign chapters unlock from account progression. Individual card behavior is implemented in code.",
      season: runtime.season()
    },
    publishing: {
      source: SOURCE, model: "source-controlled", activeContentVersion: manifest.contentVersion,
      snapshot: { kind: "gauntlet.content-snapshot.v1", sha256: crypto.createHash("sha256").update(canonicalJson(manifest)).digest("hex"), manifest },
      note: "This fingerprint identifies the loaded public registry only. It is not a release ID, engine hash, or proof of what a remote deployment serves.",
      stages: [
        { name: "Draft", status: "Source branch", detail: "No stored admin draft. The loaded registry is the active content; this read-only snapshot is a future validation seam." },
        { name: "Validate", status: validation.valid ? "Registry valid" : "Registry failed", detail: "Startup validation plus rule, server, client and build checks. No arbitrary draft validator yet." },
        { name: "Preview / playtest", status: "Local development", detail: "Run the branch against isolated local accounts and match storage. No admin preview environment is provisioned." },
        { name: "Publish", status: "Reviewed deployment", detail: "Increment content/rules versions as appropriate; deploy server to Render and client to Vercel. Admin has no publish action." },
        { name: "Rollback", status: "Source/deployment rollback", detail: "Redeploy a reviewed prior revision; preserve immutable match evidence and its recorded versions. No release catalog or admin rollback action exists." }
      ]
    },
    sources: [
      { domain: "Structured content", source: SOURCE, boundary: "Server validates on load, exposes /api/game-content; browser loads this manifest." },
      { domain: "Engine", source: "shared/duel-rules/index.js + server/index.js", boundary: "Hard-coded rules and orchestration; shared effect and encounter contracts govern authored mechanics." },
      { domain: "Accounts / progression / decks", source: "gauntlet_accounts.stats or local account JSON", boundary: "Custom signed account sessions; completion receipts apply progression. Operator reads never write repairs." },
      { domain: "Matches / evidence", source: "matchArchive.js + matchPersistence.js + matchRecords.js", boundary: "Canonical v2 records, audit events, league evidence and public replay frames. Browser IndexedDB history is not globally enumerable by this server." },
      { domain: "Assets", source: "client/public/assets/gauntlet + client/src/contentArt.js, cardArt.js, customCardArt.json, babylon/presentationKit.js", boundary: "Client build owns art/audio and presentation mappings; registry contains asset references. Server deployment may not contain client files, so asset reachability is not claimed." },
      { domain: "Publishing", source: "Git + .github/workflows/pull-request.yml + README.md", boundary: "Separate Render server and Vercel client deployments; no runtime CMS or release database." }
    ]
  };
}

function projectPlayer(account, runtime, source) {
  // Normalization includes legacy deck migration in memory: isolate it from the live account.
  const stats = clone(account.stats || {});
  const progression = runtime.progression(stats);
  const collection = runtime.collection(stats);
  const library = runtime.decks(stats, account.id);
  return {
    id: account.id, name: account.name, createdAt: account.createdAt || null, lastSeenAt: account.lastSeenAt || null, source,
    results: pick(stats, ["gamesPlayed", "gamesWon", "gamesLost", "gamesDrawn", "rankedGamesPlayed", "rankedGamesWon", "rankedGamesLost", "rankedGamesDrawn"]),
    campaigns: Object.entries(content.campaignChapters).map(([factionId, chapters]) => {
      const completed = stringList(progression.campaign?.[factionId]);
      return { factionId, completedChapterIds: completed, totalChapters: chapters.length,
        unlockedChapterIds: chapters.filter((chapter, index) => index === 0 || completed.includes(chapters[index - 1].id)).map((chapter) => chapter.id) };
    }),
    unlocks: { gameplayEntitlements: scalarMap(collection.gameplayEntitlements), collectorVariants: scalarMap(collection.collectorVariants), packCredits: collection.packCredits,
      titles: stringList(progression.cosmetics?.unlockedTitles), cardBacks: stringList(progression.cosmetics?.unlockedCardBacks), factionBadges: stringList(progression.cosmetics?.unlockedFactionBadges),
      achievementIds: Object.keys(progression.achievements || {}) },
    matchReferences: (progression.matchHistory || []).map((entry) => pick(entry, ["matchId", "recordVersion", "completedAt", "deckVersionId"])),
    decks: (library.decks || []).map((deck) => ({
      ...pick(deck, ["id", "name", "factionId", "format", "draftType", "archived", "currentVersionId", "createdAt", "updatedAt"]),
      versions: (deck.versions || []).map((version) => ({ ...pick(version, ["id", "createdAt", "gameplayConfigurationHash"]),
        cardQuantities: scalarMap(version.gameplayCardQuantities || version.cardQuantities),
        cards: (version.cards || []).map((card) => pick(card, ["id", "gameplayCardId", "name", "value", "suit", "factionId"])) }))
    }))
  };
}

function createAdminData(deps) {
  const catalog = async () => {
    const data = buildCatalog(deps.runtime, deps.publication?.active());
    if (deps.publication) {
      const state = await deps.publication.status();
      data.versions.authoredSchema = state.live.schemaVersion;
      data.game.modes = data.game.modes.map((mode) => ({ ...mode, ...state.live.domains.game.find((entry) => entry.id === mode.id) }));
      data.game.enablement = "Mode presentation uses published content. Mode enablement, rules, deck slots, rewards and progression gates remain engine-controlled.";
      data.publishing = { ...data.publishing, model: "validated immutable releases", activeContentVersion: state.activeReleaseId,
        storage: state.storage, writable: state.writable, hasDraft: !!state.draft, revision: state.revision, pending: state.pending || null,
        note: "The public manifest below is resolved from the active authored release. Content and Game share a separately stored draft; Publishing validates, previews, promotes and restores immutable snapshots.",
        stages: [
          { name: "Draft", status: state.draft ? "Shared draft saved" : "Live", detail: "Structured fields across eight domains; live content is isolated." },
          { name: "Validate", status: state.validation.valid ? "Valid" : "Errors", detail: "Runtime schema, references, bounds and engine compatibility are checked before every publication." },
          { name: "Preview", status: state.draft?.previewedHash ? "Prepared" : "Required", detail: "Presentation preview plus isolated real-engine playtest; mechanical changes require both exact-draft receipts." },
          { name: "Publish", status: state.pending?.phase || (state.writable ? "Available" : "Connection required"), detail: state.provider === "github" ? "Save the release through a checked GitHub pull request; activate it when production deploys." : "Atomically store the immutable snapshot and activate its content hash ID for future games." },
          { name: "Rollback", status: "Release history", detail: "Reactivate a compatible prior release; running games and historical evidence remain unchanged." }
        ] };
    }
    return data;
  };
  const accountSource = () => deps.useSupabase() ? "gauntlet_accounts.stats (Supabase)" : "account JSON (local)";

  async function players(query = {}) {
    const { offset, limit } = pageOptions(query);
    let accounts;
    if (deps.useSupabase()) {
      const rows = await deps.request(`gauntlet_accounts?select=id,name,created_at,last_seen_at,stats&order=id.asc&offset=${offset}&limit=${limit + 1}`);
      if (!Array.isArray(rows)) throw new Error("Invalid account response.");
      accounts = rows.map((row) => ({ id: row.id, name: row.name, createdAt: row.created_at, lastSeenAt: row.last_seen_at, stats: row.stats }));
    } else {
      accounts = readLocalRows(deps.accountFile, "accounts").sort((a, b) => String(a.id).localeCompare(String(b.id))).slice(offset, offset + limit + 1);
    }
    return { source: accountSource(), offset, limit, hasMore: accounts.length > limit, players: accounts.slice(0, limit).map((account) => projectPlayer(account, deps.runtime, accountSource())) };
  }

  async function storedMatches(limit) {
    const mode = await deps.persistence.getMode();
    if (mode === "local" || mode === "account-only") return { mode, records: readLocalRows(deps.matchFile, "matches").sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt))).slice(0, limit) };
    const query = mode === "preferred"
      ? `gauntlet_match_records?select=record&order=completed_at.desc,id.asc&limit=${limit}`
      : `gauntlet_faction_stats?id=like.match%3A*&select=data&order=updated_at.desc,id.asc&limit=${limit}`;
    const rows = await deps.request(query);
    if (!Array.isArray(rows)) throw new Error("Invalid match response.");
    return { mode, records: mode === "preferred" ? rows.map((row) => row.record).filter(Boolean) : rows.map((row) => recordFromJournalRow(row)).filter(Boolean) };
  }

  async function matches() {
    // Existing archive API is bounded, not cursor-paginated. Label this scope honestly.
    const limit = 100;
    const [stored, archived] = await Promise.allSettled([storedMatches(limit), deps.archive.list({ limit })]);
    const issues = [];
    const records = new Map();
    if (stored.status === "fulfilled") stored.value.records.filter((record) => !record.completion || record.completion.status === "finalized").forEach((record) => records.set(record.matchId, { record, source: stored.value.mode, integrity: "not-verified" }));
    else issues.push("Match record storage could not be read.");
    if (archived.status === "fulfilled") {
      const verified = await Promise.allSettled(archived.value.map((entry) => deps.archive.findById(entry.matchId)));
      verified.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value) {
          const { record, index: archiveIndex } = result.value;
          records.set(record.matchId, { record, source: "canonical archive", integrity: "verified", sha256: archiveIndex.sha256 });
        } else {
          // A failed canonical verification must never be hidden behind an unverified fallback.
          records.delete(archived.value[index].matchId);
          issues.push(`Archive evidence unavailable or invalid for ${archived.value[index].matchId}.`);
        }
      });
    } else issues.push("Match archive index could not be read.");
    if (!deps.archive.status().available) issues.push("Optional canonical archive is unavailable; storage records may still be available.");
    return { scope: "Up to 100 recent records from each server store, merged by match ID. Search is limited to this window; exact ID lookup can find older records. Browser-only Match Libraries are not included.",
      issues, matches: [...records.values()].sort((a, b) => String(b.record.completedAt).localeCompare(String(a.record.completedAt))).map(({ record, ...provenance }) => ({ ...publicMatchSummary(record), provenance })) };
  }

  async function match(matchId) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matchId)) {
      const error = new Error("Invalid match ID."); error.status = 400; throw error;
    }
    // Use the same archive verifier and public record projector as existing match routes.
    const archived = await deps.archive.findById(matchId);
    const record = archived?.record || await deps.persistence.findById(matchId);
    if (!record || (record.completion && record.completion.status !== "finalized")) {
      const error = new Error("Completed match not found."); error.status = 404; throw error;
    }
    let status = null;
    try { status = deps.publication ? await deps.publication.status() : null; } catch { /* Recorded evidence remains readable when current authoring is unavailable. */ }
    const projected = publicMatchRecord(record);
    return { match: projected, design: require("./adminMatchDesign").projectMatchDesign(projected, status?.live, status?.draft?.snapshot), provenance: { source: archived ? "canonical archive" : deps.persistence.status().mode,
      integrity: archived ? "verified" : "not-verified", sha256: archived?.index.sha256 || null,
      note: "Existing public evidence projection. Private hands, room snapshots and reconnect credentials are not read. No events or provenance are rewritten." } };
  }

  async function system() {
    const checkedAt = new Date().toISOString();
    const checks = await Promise.allSettled([players({ limit: "1" }), storedMatches(1), deps.archive.probe()]);
    const persistence = deps.persistence.status();
    const archive = deps.archive.status();
    const current = await catalog();
    return {
      checkedAt, environment: deps.environment || "unspecified", applicationVersion: require("./package.json").version,
      backendCommit: deps.backendCommit || null,
      adminAccess: { model: "Two authenticated account IDs", configuredAccounts: deps.adminAccountCount, expectedAccounts: 2 },
      versions: { ...current.versions, record: MATCH_RECORD_VERSION, leagueEvidence: LEAGUE_EVIDENCE_VERSION, publicReplayFrame: PUBLIC_REPLAY_FRAME_VERSION,
        archiveIndex: MATCH_ARCHIVE_INDEX_VERSION, archiveObject: MATCH_ARCHIVE_OBJECT_VERSION, matchJournal: MATCH_JOURNAL_VERSION,
        roomState: ROOM_STATE_SCHEMA_VERSION, completion: MATCH_COMPLETION_ENVELOPE_VERSION, engineSnapshot: duel.SCHEMA_VERSION,
        engineCommand: duel.COMMAND_SCHEMA_VERSION, engineEvent: duel.EVENT_SCHEMA_VERSION, deckLibrary: deps.deckSchemaVersion },
      storage: {
        accounts: { source: accountSource(), status: checks[0].status === "fulfilled" ? "read succeeded" : "unavailable" },
        matches: { mode: persistence.mode, status: checks[1].status === "fulfilled" ? "read succeeded" : "unavailable", capabilities: persistence.capabilities },
        archive: { mode: archive.mode || null, status: checks[2].status === "fulfilled" && archive.available ? "available" : "unavailable", durable: !!archive.durable },
        rooms: { enabled: deps.roomRecovery, source: "Private local room snapshots", note: "Never exposed through admin." },
        content: { source: current.publishing.storage || "Configured content provider", status: deps.publication ? "read succeeded" : "source baseline only", writable: !!current.publishing.writable, activeRelease: current.versions.content }
      },
      validation: current.validation, sources: current.sources,
      issues: [
        ...(deps.adminAccountCount < 2 ? ["One admin identity is not configured. The unresolved account is denied access until its stable ID is pinned."] : []),
        ...(deps.publication && !current.publishing.writable ? [current.publishing.pending ? "A content publication is awaiting checks or deployment." : "Production authoring is disabled: connect the configured content provider."] : []),
        ...checks.flatMap((check, index) => check.status === "rejected" ? [`${["Account read", "Match storage probe", "Archive probe"][index]} failed. Details remain in server logs.`] : []),
        ...(!archive.available ? ["Canonical archive is unavailable. This does not prove that all match records are unavailable."] : []),
        ...(persistence.mode === "account-only" ? ["Account-only persistence: full match evidence is not guaranteed after process replacement."] : []),
        ...(!current.validation.valid ? [current.validation.message] : [])
      ],
      boundaries: ["Package version is not a deployed release identifier. Commit is shown only if supplied by deployment.", "Authored release IDs identify presentation and mechanical snapshots. Rules, card effects, faction effects, encounter setup and asset manifest versions are pinned separately.", "Account and match reads are fresh; persistence mode and archive availability use existing cached capability probes. This does not verify every database table, storage object, browser asset or remote frontend deployment. Archive hashes are verified during record inspection."]
    };
  }
  return { catalog, players, matches, match, system };
}

function registerAdminRoutes(app, { authorize, data }) {
  for (const [route, read] of [
    ["catalog", () => data.catalog()], ["players", (req) => data.players(req.query)],
    ["matches", () => data.matches()], ["matches/:matchId", (req) => data.match(req.params.matchId)], ["system", () => data.system()]
  ]) {
    app.get(`/api/admin/${route}`, async (req, res) => {
      res.set("Cache-Control", "private, no-store");
      if (!authorize(req, res)) return;
      try { res.json(await read(req)); }
      catch (error) {
        const status = [400, 404].includes(error.status) ? error.status : 503;
        res.status(status).json({ error: status === 503 ? "This admin data source is unavailable. Retry or inspect System status." : error.message });
      }
    });
  }
}

module.exports = { buildCatalog, createAdminData, pageOptions, projectPlayer, registerAdminRoutes };
