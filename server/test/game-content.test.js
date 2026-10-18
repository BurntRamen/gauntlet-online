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
  NEUTRAL_COLLECTION_CARDS,
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
  assert.equal(Object.values(content.campaigns).flatMap((campaign) => campaign.chapters).length, 140);
  for (const factionId of ["mekan", "jali", "gracus", "indela", "voltari", "zynarth"]) {
    assert.equal(content.campaigns[factionId].chapters.length, 12, `${factionId}: campaign length`);
    assert.equal(content.campaigns[factionId].chapters.every((chapter) => chapter.dialogue.length >= 5 && chapter.endDialogue.length >= 5), true, `${factionId}: dialogue depth`);
  }
  const zynarth = content.factions.find((faction) => faction.id === "zynarth");
  assert.equal(zynarth.campaignPending, undefined);
  assert.equal(zynarth.campaignOnly, undefined);
  assert.equal(content.campaigns["astral-vanguard"].chapters.length, 12);
  assert.equal(content.campaigns["astral-vanguard"].coverImage, "/assets/gauntlet/factions/astral-vanguard/vanguard-outpost.webp");
  assert.equal(content.campaigns["astral-vanguard"].commanderName, "The World Between");
  assert.equal(content.campaigns["astral-vanguard"].chapters[0].title, "New Horizon");
  assert.equal(content.campaigns["astral-vanguard"].chapters.at(-1).title, "When the Stars Remember");
  assert.equal(content.worldLore.reath.transitModel.name, "The Timetwister Transit Model");
  assert.match(content.worldLore.reath.transitModel.principles[0], /Entanglement verifies and corrects/);
  assert.equal(content.factions.find((faction) => faction.id === "astral-vanguard").homeworld, "The Meridian Reach");
  assert.equal(content.factions.find((faction) => faction.id === "zynarth").homeworld, "K'lar");
  const indelaFaction = content.factions.find((faction) => faction.id === "indela");
  const indelaCampaign = content.campaigns.indela;
  assert.equal(indelaFaction.homeworld, "Varuna");
  assert.match(indelaFaction.origin, /beetle-wizard city of Kashi/);
  assert.match(indelaFaction.reathArrival, /only later sent a scholarly delegation from Varuna/);
  assert.equal(indelaCampaign.chapters[0].title, "The Founding Flame");
  assert.equal(indelaCampaign.chapters.at(-1).title, "The Knowledge That Endures");
  assert.match(indelaCampaign.chapters[0].story, /homeworld Varuna/);
  assert.match(indelaCampaign.chapters.at(-1).story, /Centuries later on Varuna/);
  assert.match(indelaCampaign.chapters.at(-1).endDialogue.join(" "), /campaign ends at home beneath Varuna/);
  const jaliFaction = content.factions.find((faction) => faction.id === "jali");
  const jaliCampaign = content.campaigns.jali;
  assert.equal(jaliFaction.homeworld, "Aozora");
  assert.match(jaliFaction.origin, /Celestial Archipelago/);
  assert.match(jaliFaction.reathArrival, /quantum-correlated with a Reath receiver/);
  assert.equal(jaliCampaign.commanderName, "The Shattered Heavens");
  assert.equal(jaliCampaign.chapters[0].title, "The Age of a Thousand Clouds");
  assert.equal(jaliCampaign.chapters.at(-1).title, "The Last Reflection");
  assert.match(jaliCampaign.chapters[0].story, /homeworld Aozora/);
  assert.match(jaliCampaign.chapters.at(-1).story, /Timetwister receiver on Reath/);
  assert.match(jaliCampaign.chapters.at(-1).endDialogue.join(" "), /Aozora remains our home. Reath is the convergence point/);
  assert.match(jaliCampaign.chapters[4].story, /young scholar Seimei-no-Mikoto/);
  assert.match(jaliCampaign.chapters[9].dialogue.join(" "), /We offer the freedom I forbid/);
  assert.match(jaliCampaign.chapters[10].endDialogue.join(" "), /Yamabuki relinquishes the empire/);
  const mekanFaction = content.factions.find((faction) => faction.id === "mekan");
  const mekanCampaign = content.campaigns.mekan;
  assert.equal(mekanFaction.homeworld, "Teyotl");
  assert.match(mekanFaction.origin, /San Mikal/);
  assert.match(mekanFaction.reathArrival, /consenting travelers/);
  assert.equal(mekanCampaign.chapters[0].title, "The Flower-Ringed Lake");
  assert.equal(mekanCampaign.chapters.at(-1).title, "The Procession to Reath");
  assert.match(mekanCampaign.chapters[0].story, /homeworld Teyotl/);
  assert.match(mekanCampaign.chapters.at(-1).story, /other homeworlds/);
  assert.match(mekanCampaign.chapters.at(-1).endDialogue.join(" "), /Teyotl is our origin. Reath is the convergence point/);
  const gracusFaction = content.factions.find((faction) => faction.id === "gracus");
  const gracusCampaign = content.campaigns.gracus;
  assert.equal(gracusFaction.homeworld, "Thalassa");
  assert.match(gracusFaction.origin, /marble island world Thalassa/);
  assert.match(gracusFaction.reathArrival, /voluntary Gracus delegation to Reath/);
  assert.equal(gracusCampaign.chapters[0].title, "The City of Questions");
  assert.equal(gracusCampaign.chapters.at(-1).title, "The World of Meeting");
  assert.match(gracusCampaign.chapters[0].story, /homeworld Thalassa/);
  assert.match(gracusCampaign.chapters.at(-1).story, /other homeworlds/);
  assert.match(gracusCampaign.chapters.at(-1).endDialogue.join(" "), /Reath is the convergence point/);
  const frumoFaction = content.factions.find((faction) => faction.id === "frumo");
  const frumoCampaign = content.campaigns.frumo;
  assert.equal(frumoFaction.homeworld, "Pelagos");
  assert.match(frumoFaction.origin, /underwater capital Ristus/);
  assert.match(frumoFaction.reathArrival, /restoring the Council of Captains.*voluntary expedition/);
  assert.match(frumoCampaign.pitch, /ocean homeworld Pelagos/);
  assert.match(frumoCampaign.chapters[0].story, /homeworld Pelagos/);
  assert.equal(frumoCampaign.chapters.every((chapter) => chapter.sceneStarter?.where && chapter.sceneStarter?.when && chapter.sceneStarter?.perspective), true);
  assert.match(frumoCampaign.chapters[5].story, /Robespier/);
  assert.match(frumoCampaign.chapters[9].story, /Pelagos's oceans/);
  assert.match(frumoCampaign.chapters.at(-1).endDialogue.join(" "), /Pelagos is our home.*Reath is where our tide meets/);
  assert.match(frumoCampaign.characters.polea.description, /saves the republic.*depend on him/);
  assert.match(frumoCampaign.characters.robespier.description, /vigilance into purity/);
  const sheenCampaign = content.campaigns.sheen;
  assert.equal(content.factions.find((faction) => faction.id === "sheen").homeworld, "Gao");
  assert.match(sheenCampaign.pitch, /forest moon Gao/);
  assert.match(sheenCampaign.chapters[0].story, /living homeworld Gao/);
  assert.equal(sheenCampaign.chapters.every((chapter) => chapter.sceneStarter?.where && chapter.sceneStarter?.when && chapter.sceneStarter?.perspective), true);
  assert.match(sheenCampaign.chapters.at(-1).story, /botanical science|living shelters|healing greenhouses/);
  assert.match(sheenCampaign.chapters.at(-1).endDialogue.join(" "), /Gao is our origin.*Reath is where our roots meet/);
  const voltariCampaign = content.campaigns.voltari;
  assert.equal(voltariCampaign.homeworld, "Voltara");
  assert.match(voltariCampaign.pitch, /human descendants/);
  assert.match(voltariCampaign.arrivalOnReath, /Voltara retained protected continuity records/);
  assert.equal(voltariCampaign.commanderName, "The Golden Conduit");
  assert.equal(voltariCampaign.chapters[0].title, "Children of the Tempest");
  assert.equal(voltariCampaign.chapters.at(-1).title, "The Storm Beyond Voltara");
  assert.match(voltariCampaign.chapters[1].story, /healing rather than war/);
  assert.match(voltariCampaign.chapters[5].story, /AION/);
  assert.match(voltariCampaign.chapters[7].endDialogue.join(" "), /Survival without freedom is not civilization/);
  assert.equal(voltariCampaign.chapters.every((chapter) => chapter.sceneStarter?.where && chapter.sceneStarter?.when && chapter.sceneStarter?.perspective), true);
  assert.match(voltariCampaign.chapters[9].story, /transferring surplus energy, repair capacity, and verified knowledge/);
  assert.match(voltariCampaign.chapters[9].dialogue.join(" "), /when does help become incorporation/);
  assert.match(voltariCampaign.chapters.at(-1).story, /compulsory optimization/);
  assert.match(voltariCampaign.chapters.at(-1).endDialogue.join(" "), /Voltara is our origin. Reath is the convergence point/);
  const zynarthCampaign = content.campaigns.zynarth;
  assert.equal(content.factions.find((faction) => faction.id === "zynarth").homeworld, "K'lar");
  assert.equal(zynarthCampaign.commanderName, "The Infinite Hive");
  assert.match(zynarthCampaign.chapters[0].story, /living homeworld K'lar/);
  assert.equal(zynarthCampaign.chapters.every((chapter) => chapter.sceneStarter?.where && chapter.sceneStarter?.when && chapter.sceneStarter?.perspective), true);
  assert.match(zynarthCampaign.chapters[8].story, /Timetwister stone.*Reath/);
  assert.match(zynarthCampaign.chapters[10].story, /distributed people/);
  assert.match(zynarthCampaign.chapters[10].endDialogue.join(" "), /tragic.*hopeful/);
  assert.match(zynarthCampaign.chapters.at(-1).endDialogue.join(" "), /K'lar is our origin. Reath is our convergence/);
  for (const chapter of content.campaigns["astral-vanguard"].chapters) {
    assert.ok(chapter.dialogue.length >= 5, `${chapter.id}: opening dialogue depth`);
    assert.ok(chapter.endDialogue.length >= 5, `${chapter.id}: closing dialogue depth`);
    assert.equal(typeof chapter.beforeBattle, "string", `${chapter.id}: briefing`);
    assert.equal(typeof chapter.afterBattle, "string", `${chapter.id}: debriefing`);
    assert.equal(typeof chapter.sceneStarter?.where, "string", `${chapter.id}: scene location`);
    assert.equal(typeof chapter.sceneStarter?.when, "string", `${chapter.id}: scene time`);
    assert.equal(typeof chapter.sceneStarter?.perspective, "string", `${chapter.id}: scene perspective`);
  }
  const cinematicChapters = Object.values(content.campaigns).flatMap((campaign) => campaign.chapters).filter((chapter) => chapter.cinematic);
  assert.equal(cinematicChapters.length, 12);
  for (const chapter of cinematicChapters) {
    assert.equal(typeof chapter.cinematic.title, "string", `${chapter.id}: cinematic title`);
    assert.match(chapter.cinematic.image, /^\/assets\/gauntlet\/.+\.(?:webp|png|svg)$/);
    assert.equal(fs.existsSync(path.join(__dirname, "..", "..", "client", "public", chapter.cinematic.image)), true, `${chapter.id}: cinematic image`);
  }
  assert.equal(content.campaigns.rumin.chapters.find((chapter) => chapter.id === "ides-of-rumie").cinematic.title, "The Ides of Rumie");
  assert.equal(content.campaigns.xendra.chapters.length, 8);
  for (const chapter of content.campaigns.xendra.chapters) {
    assert.equal(chapter.dialogueAudio.length, chapter.dialogue.length, `${chapter.id}: dialogue audio`);
    chapter.dialogueAudio.forEach((audioPath) => {
      assert.match(audioPath, /^\/assets\/gauntlet\/voices\/xendra-.+\.mp3$/);
      assert.equal(fs.existsSync(path.join(__dirname, "..", "..", "client", "public", audioPath)), true, audioPath);
    });
  }
  assert.equal(content.cards.length, COLLECTION_CARDS.length);
  assert.equal(content.collectorVariants.length, COLLECTOR_VARIANTS.length);
  assert.equal(content.deckRules.basePlayingDeckSize, 52);
  assert.equal(content.deckRules.basePlayingDeckSize, DECK_RULES.replacementSuits.length * DECK_RULES.playingDeckValues.length);
  assert.equal(content.deckRules.fixedReplacementSlots, true);
  for (const faction of content.factions) {
    assert.deepEqual(Object.keys(faction.commander.announcements).sort(), ["clicked", "critical", "denied", "selected", "wounded"]);
    assert.equal(Object.values(faction.commander.announcements).every((line) => typeof line === "string" && line.length > 10), true, faction.id);
    assert.equal(Array.isArray(faction.commander.voiceHints) && faction.commander.voiceHints.length >= 4, true, faction.id);
  }

  const rumin = content.factions.find((faction) => faction.id === "rumin");
  const sheen = content.factions.find((faction) => faction.id === "sheen");
  assert.equal(rumin.commander.announcements.selected, "Roads do not end. They arrive.");
  assert.equal(sheen.commander.announcements.selected, "We won a forest. Now we must make it a home.");
  for (const faction of content.factions) {
    for (const event of ["selected", "clicked", "wounded", "critical", "denied"]) {
      assert.match(faction.commander.announcementAudio[event], /\/assets\/gauntlet\/voices\/.+\.mp3$/);
      assert.equal(fs.existsSync(path.join(__dirname, "..", "..", "client", "public", faction.commander.announcementAudio[event])), true, `${faction.id}:${event}`);
    }
    assert.match(faction.general.clickedAudio, /\/assets\/gauntlet\/voices\/.+\.mp3$/);
    assert.equal(fs.existsSync(path.join(__dirname, "..", "..", "client", "public", faction.general.clickedAudio)), true, `${faction.id}:general`);
  }
  for (const faction of content.factions) {
    assert.equal(typeof faction.general.clickedAnnouncement, "string", faction.id);
    assert.equal(faction.city.clickedSound, "/assets/gauntlet/match/kits/gauntlet-core-v1/audio/ability_activate.wav", faction.id);
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
    assert.ok(chapter.dialogue.length >= 7, `${chapter.id}: opening dialogue depth`);
    assert.ok(chapter.endDialogue.length >= 7, `${chapter.id}: closing dialogue depth`);
    assert.equal(chapter.dialogueAudio.length, chapter.dialogue.length, `${chapter.id}: opening voice coverage`);
    assert.equal(chapter.endDialogueAudio.length, chapter.endDialogue.length, `${chapter.id}: closing voice coverage`);
    for (const audioPath of [...chapter.dialogueAudio, ...chapter.endDialogueAudio]) {
      assert.match(audioPath, /^\/assets\/gauntlet\/voices\/bizi-.+\.mp3$/);
      assert.equal(fs.existsSync(path.join(__dirname, "..", "..", "client", "public", audioPath)), true, audioPath);
    }
  }
});

test("maps every catalog constructed card into the shared deterministic rules", () => {
  const sharedRulesSource = ["index.js", "zynarth.js", "astralVanguard.js"]
    .map((file) => fs.readFileSync(path.join(__dirname, "..", "..", "shared", "duel-rules", file), "utf8"))
    .join("\n");
  const missing = COLLECTION_CARDS
    .map((card) => require("../../shared/duel-rules/effectRegistry").defaultCardEffect(card.id)?.id)
    .filter((effectId) => !effectId || !sharedRulesSource.includes(`"${effectId}"`));

  assert.equal(COLLECTION_CARDS.length, 144);
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
  for (const cards of [RUMIN_COLLECTION_CARDS, SHEEN_COLLECTION_CARDS, FRUMO_COLLECTION_CARDS, BIZI_COLLECTION_CARDS, ZYNARTH_COLLECTION_CARDS, ASTRAL_VANGUARD_COLLECTION_CARDS, INDELA_COLLECTION_CARDS, NEUTRAL_COLLECTION_CARDS]) {
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

  assert.equal(COLLECTION_CARDS.length, 144);
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
    assert.equal(initiativePack.cards.every((card) => card.factionId === "neutral" || initiative.factionIds.includes(card.factionId)), true);
    const beyondPack = __test.createDraftPack(1, beyond.factionIds);
    assert.equal(beyondPack.cards.every((card) => card.factionId === "neutral" || beyond.factionIds.includes(card.factionId)), true);
  }

  const room = __test.createDraftRoom({ setId: "reath-beyond" });
  room.lobby.players[1].connected = true;
  room.lobby.players[2].connected = true;
  __test.startDraft(room);
  const allCards = Object.values(room.draft.currentPacks).flatMap((pack) => pack.cards);
  assert.equal(allCards.every((card) => card.factionId === "neutral" || beyond.factionIds.includes(card.factionId)), true);
  assert.equal(__test.sanitizeDraftForViewer(room, 1).setId, "reath-beyond");
  const sealedRoom = __test.createDraftRoom({ setId: "reath-beyond", sealed: true });
  sealedRoom.lobby.players[1].connected = true;
  __test.openSealedPool(sealedRoom, 1);
  const sealedView = __test.sanitizeDraftForViewer(sealedRoom, 1);
  const sealedSpectator = __test.sanitizeDraftForViewer(sealedRoom, null);
  assert.equal(sealedView.sealed, true);
  assert.equal(sealedView.status, "building");
  assert.equal(sealedView.myPool.length, 48);
  assert.equal(sealedView.myPool.every((card) => card.factionId === "neutral" || beyond.factionIds.includes(card.factionId)), true);
  assert.equal(sealedSpectator.myPool.length, 0);
  assert.throws(() => __test.createDraftRoom({ setId: "legacies" }), /still in development/);
  assert.throws(() => __test.createDraftRoom({ setId: "legacies", sealed: true }), /still in development/);
  __test.rooms.delete(room.roomCode);
  __test.rooms.delete(sealedRoom.roomCode);
});
