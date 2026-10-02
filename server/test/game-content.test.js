const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  ASTRAL_VANGUARD_COLLECTION_CARDS,
  BIZI_COLLECTION_CARDS,
  COLLECTION_CARDS,
  COLLECTOR_VARIANTS,
  CONTENT_VERSION,
  DECK_RULES,
  DRAFT_SETS,
  FRUMO_COLLECTION_CARDS,
  INDELA_COLLECTION_CARDS,
  RUMIN_COLLECTION_CARDS,
  RULES_VERSION,
  SHEEN_COLLECTION_CARDS,
  ZYNARTH_COLLECTION_CARDS,
  getPublicGameContent,
  validateGameContent
} = require("../gameContent");
const { FACTIONS } = require("../game/factions");
const { createMatch } = require("../../shared/duel-rules");
const { server, __test } = require("../index");

test.after(() => server.close());

test("validates the authoritative versioned game content registry", () => {
  assert.equal(validateGameContent(), true);
  const content = getPublicGameContent();

  assert.equal(content.schemaVersion, 2);
  assert.equal(content.contentVersion, CONTENT_VERSION);
  assert.equal(content.rulesVersion, RULES_VERSION);
  assert.equal(content.factions.length, 10);
  assert.equal(Object.values(content.campaigns).flatMap((campaign) => campaign.chapters).length, 56);
  assert.equal(content.campaigns.xendra.chapters.length, 8);
  assert.equal(content.cards.length, COLLECTION_CARDS.length);
  assert.equal(content.collectorVariants.length, COLLECTOR_VARIANTS.length);
  assert.equal(content.deckRules.basePlayingDeckSize, 52);
  assert.equal(content.deckRules.basePlayingDeckSize, DECK_RULES.replacementSuits.length * DECK_RULES.playingDeckValues.length);
  assert.equal(content.deckRules.fixedReplacementSlots, true);
  for (const faction of content.factions) {
    assert.deepEqual(Object.keys(faction.commander.announcements).sort(), ["clicked", "critical", "denied", "selected", "wounded"]);
    assert.equal(Object.values(faction.commander.announcements).every((line) => typeof line === "string" && line.length > 10), true, faction.id);
  }
});

test("gives every playable faction a complete standard 52-card deck", () => {
  const factions = getPublicGameContent().factions;
  for (const faction of factions) {
    const match = createMatch({ gameMode: "factions", seed: `deck-${faction.id}`, factions: { 1: faction, 2: faction } }).state;
    assert.equal(match.players[1].hand.length + match.players[1].deck.length, 52, faction.id);
    assert.equal(new Set([...match.players[1].hand, ...match.players[1].deck].map((card) => `${card.rank}:${card.suit}`)).size, 52, faction.id);
  }
});

test("keeps the legacy faction adapter on the canonical registry", () => {
  const publicFactions = getPublicGameContent().factions;
  assert.deepEqual(Object.values(FACTIONS), publicFactions);
});

test("publishes canonical Rumin card and campaign illustrations", () => {
  const content = getPublicGameContent();
  const ruminCardIds = new Set(RUMIN_COLLECTION_CARDS.map((card) => card.id));
  const variants = content.collectorVariants.filter((variant) => ruminCardIds.has(variant.gameplayCardId));
  assert.equal(variants.length, 36);

  for (const card of RUMIN_COLLECTION_CARDS) {
    const cardVariants = variants.filter((variant) => variant.gameplayCardId === card.id);
    assert.equal(cardVariants.length, 2);
    assert.equal(new Set(cardVariants.map((variant) => variant.art)).size, 1);
    assert.match(cardVariants[0].art, /^\/assets\/gauntlet\/constructed\/rumin\/.+\.webp$/);
    assert.equal(fs.existsSync(path.join(__dirname, "..", "..", "client", "public", cardVariants[0].art)), true);
  }

  assert.match(content.campaigns.rumin.coverImage, /^\/assets\/gauntlet\/campaigns\/rumin\/.+\.webp$/);
  assert.equal(content.campaigns.rumin.chapters.length, 12);
  for (const chapter of content.campaigns.rumin.chapters) {
    assert.match(chapter.image, /^\/assets\/gauntlet\/campaigns\/rumin\/.+\.webp$/);
    assert.equal(fs.existsSync(path.join(__dirname, "..", "..", "client", "public", chapter.image)), true);
  }
});

test("publishes the integrated Bizi identity, constructed-card, and campaign art", () => {
  const content = getPublicGameContent();
  const biziCardIds = new Set(BIZI_COLLECTION_CARDS.map((card) => card.id));
  const variants = content.collectorVariants.filter((variant) => biziCardIds.has(variant.gameplayCardId));
  assert.equal(variants.length, 36);

  for (const card of BIZI_COLLECTION_CARDS) {
    const cardVariants = variants.filter((variant) => variant.gameplayCardId === card.id);
    assert.equal(cardVariants.length, 2);
    assert.equal(new Set(cardVariants.map((variant) => variant.art)).size, 1);
    assert.match(cardVariants[0].art, /^\/assets\/gauntlet\/constructed\/bizi\/.+\.webp$/);
    assert.equal(fs.existsSync(path.join(__dirname, "..", "..", "client", "public", cardVariants[0].art)), true);
  }

  const bizi = content.factions.find((faction) => faction.id === "bizi");
  for (const image of [bizi.cardImage, bizi.commander.image, bizi.general.image, bizi.city.image]) {
    assert.match(image, /^\/assets\/gauntlet\/factions\/bizi\/.+\.webp$/);
    assert.equal(fs.existsSync(path.join(__dirname, "..", "..", "client", "public", image)), true);
  }

  assert.match(content.campaigns.bizi.coverImage, /^\/assets\/gauntlet\/campaigns\/bizi\/.+\.webp$/);
  assert.equal(content.campaigns.bizi.chapters.length, 12);
  for (const chapter of content.campaigns.bizi.chapters) {
    assert.match(chapter.image, /^\/assets\/gauntlet\/campaigns\/bizi\/.+\.webp$/);
    assert.equal(fs.existsSync(path.join(__dirname, "..", "..", "client", "public", chapter.image)), true);
  }
});

test("maps every catalog constructed card into the shared deterministic rules", () => {
  const sharedRulesSource = ["index.js", "zynarth.js", "astralVanguard.js"]
    .map((file) => fs.readFileSync(path.join(__dirname, "..", "..", "shared", "duel-rules", file), "utf8"))
    .join("\n");
  const missing = COLLECTION_CARDS
    .map((card) => require("../../shared/duel-rules/effectRegistry").defaultCardEffect(card.id)?.id)
    .filter((effectId) => !effectId || !sharedRulesSource.includes(`"${effectId}"`));

  assert.equal(COLLECTION_CARDS.length, 126);
  assert.deepEqual(missing, []);
});

test("uses ten Servitors and eight faction support cards for each Initiative faction", () => {
  for (const [cards, expectedType] of [
    [RUMIN_COLLECTION_CARDS, "armament"],
    [SHEEN_COLLECTION_CARDS, "shelter"],
    [FRUMO_COLLECTION_CARDS, "ambush"],
    [BIZI_COLLECTION_CARDS, "contraption"],
    [ZYNARTH_COLLECTION_CARDS, "biomorph"],
    [ASTRAL_VANGUARD_COLLECTION_CARDS, "operation"],
    [INDELA_COLLECTION_CARDS, "arcana"]
  ]) {
    assert.equal(cards.length, 18);
    assert.equal(cards.filter((card) => card.type === "servitor").length, 10);
    assert.equal(cards.filter((card) => card.type === expectedType).length, 8);
    assert.deepEqual([...new Set(cards.map((card) => card.type))].sort(), [expectedType, "servitor"].sort());
  }
});

test("assigns every constructed card one unique, balanced rank-and-suit slot", () => {
  for (const cards of [RUMIN_COLLECTION_CARDS, SHEEN_COLLECTION_CARDS, FRUMO_COLLECTION_CARDS, BIZI_COLLECTION_CARDS, ZYNARTH_COLLECTION_CARDS, ASTRAL_VANGUARD_COLLECTION_CARDS, INDELA_COLLECTION_CARDS]) {
    const slots = cards.map((card) => `${card.value}:${card.suit}`);
    assert.equal(new Set(slots).size, cards.length);
    assert.equal(cards.every((card) => ["spades", "hearts", "diamonds", "clubs"].includes(card.suit)), true);
    assert.equal(cards.every((card) => card.replacementSuit === card.suit), true);
    const suitCounts = Object.fromEntries(["spades", "hearts", "diamonds", "clubs"].map((suit) => [
      suit,
      cards.filter((card) => card.suit === suit).length
    ]));
    assert.equal(Math.max(...Object.values(suitCounts)) - Math.min(...Object.values(suitCounts)) <= 1, true);
    assert.equal(new Set(cards.filter((card) => card.type === "servitor").map((card) => card.suit)).size, 4);
    assert.equal(new Set(cards.filter((card) => card.type !== "servitor").map((card) => card.suit)).size, 4);
  }
});

test("requires card-specific constructed behavior coverage for the full catalog", () => {
  const behaviorSources = [
    path.join(__dirname, "..", "..", "shared", "duel-rules", "index.js"),
    path.join(__dirname, "..", "gameContent.js")
  ].map((sourcePath) => fs.readFileSync(sourcePath, "utf8")).join("\n");
  const missing = COLLECTION_CARDS
    .map((card) => card.id)
    .filter((cardId) => !behaviorSources.includes(`"${cardId}"`));

  assert.equal(COLLECTION_CARDS.length, 126);
  assert.deepEqual(missing, []);
});

test("keeps an explicit deterministic rules test for every constructed card", () => {
  const behaviorTests = [
    path.join(__dirname, "..", "..", "client", "src", "babylon", "basicGauntletRules.test.js"),
    path.join(__dirname, "..", "..", "client", "src", "babylon", "matchAdapters.test.js")
  ].map((sourcePath) => fs.readFileSync(sourcePath, "utf8")).join("\n");
  const missing = COLLECTION_CARDS
    .map((card) => card.id)
    .filter((cardId) => !behaviorTests.includes(`"${cardId}"`));

  assert.deepEqual(missing, []);
});

test("does not publish constructed effects that require illegal multi-card blocks", () => {
  for (const card of COLLECTION_CARDS) {
    assert.doesNotMatch(card.text, /block with two or more cards/i, card.id);
  }
});

test("serves the validated public content manifest", async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/game-content`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.match(body.content.contentVersion, /^gauntlet-content-[a-f0-9]{64}$/);
  assert.equal(body.content.rulesVersion, RULES_VERSION);
  assert.equal(body.content.campaigns.rumin.chapters.length, 12);
});

test("draft projection keeps a player's pack private and never publishes bot picks", () => {
  const card = getPublicGameContent().cards.find((entry) => entry.factionId === "zynarth");
  const roomState = {
    roomCode: "PRIVATE",
    lobby: { players: { 1: { accountName: "Drafter", connected: true } }, spectators: [] },
    draft: {
      status: "drafting", league: false, botDraft: true, maxPlayers: 8, packsPerPlayer: 3, packSize: 8,
      activePlayers: [1], round: 1, pickNumber: 1, direction: "left", baseDeck: { cardCount: 52 },
      currentPacks: { 1: { cards: [{ ...card, draftCopyId: "private-card" }] } },
      draftedPools: { 1: [] }, deckAdditions: { 1: [] }, botPickLog: ["Bot picked a mythic card."]
    }
  };
  const viewer = __test.sanitizeDraftForViewer(roomState, 1);
  const spectator = __test.sanitizeDraftForViewer(roomState, null);
  assert.equal(Object.hasOwn(viewer, "botPickLog"), false);
  assert.equal(Object.hasOwn(spectator, "botPickLog"), false);
  assert.equal(viewer.myCurrentPack.cards[0].id, card.id);
  assert.equal(spectator.myCurrentPack, null);
});

test("draft sets publish their factions and packs stay inside the selected set", () => {
  const content = getPublicGameContent();
  assert.deepEqual(content.draftSets, DRAFT_SETS);

  const initiative = DRAFT_SETS.find((set) => set.id === "initiative");
  const beyond = DRAFT_SETS.find((set) => set.id === "reath-beyond");
  for (let run = 0; run < 20; run += 1) {
    const initiativePack = __test.createDraftPack(1, initiative.factionIds);
    assert.equal(initiativePack.cards.every((card) => initiative.factionIds.includes(card.factionId)), true);
    const beyondPack = __test.createDraftPack(1, beyond.factionIds);
    assert.equal(beyondPack.cards.every((card) => beyond.factionIds.includes(card.factionId)), true);
  }

  const room = __test.createDraftRoom({ setId: "reath-beyond" });
  room.lobby.players[1].connected = true;
  room.lobby.players[2].connected = true;
  __test.startDraft(room);
  const allCards = Object.values(room.draft.currentPacks).flatMap((pack) => pack.cards);
  assert.equal(allCards.every((card) => beyond.factionIds.includes(card.factionId)), true);
  assert.equal(__test.sanitizeDraftForViewer(room, 1).setId, "reath-beyond");
  assert.throws(() => __test.createDraftRoom({ setId: "legacies" }), /still in development/);
  __test.rooms.delete(room.roomCode);
});
