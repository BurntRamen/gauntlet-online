const test = require("node:test");
const assert = require("node:assert/strict");

const { server, __test } = require("../index");

const { buildPublicPlayerProfile } = __test;

test.after(() => server.close());

test("builds a public competitive profile without private account data", () => {
  const account = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Alpha",
    passwordHash: "private-hash",
    createdAt: "2026-07-01T12:00:00.000Z",
    lastSeenAt: "2026-07-15T12:00:00.000Z",
    stats: {
      gamesWon: 4,
      gamesLost: 2,
      rankedGamesWon: 3,
      rankedGamesLost: 1,
      progression: {
        achievements: {
          first: { id: "first", name: "First Win", description: "Win once.", unlockedAt: "2026-07-02T12:00:00.000Z" }
        },
        cosmetics: { selectedTitle: "veteran", selectedFactionBadge: "rumin", selectedCardBack: "classic" },
        matchHistory: [{
          matchId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          recordVersion: 1,
          completedAt: "2026-07-15T11:00:00.000Z",
          result: "loss",
          factionId: "wrong-faction",
          opponentName: "Wrong Opponent",
          finalLife: 0
        }]
      },
      deckLibrary: {
        schemaVersion: 1,
        activeConstructedDeckId: "deck-1",
        activeDraftDeckIds: { player: null, bot: null },
        decks: [{
          id: "deck-1",
          ownerId: "11111111-1111-4111-8111-111111111111",
          name: "Gold Guard",
          factionId: "rumin",
          factionName: "Rumin",
          format: "constructed",
          source: "constructed-editor",
          featured: true,
          archived: false,
          currentVersionId: "version-1",
          createdAt: "2026-07-03T12:00:00.000Z",
          updatedAt: "2026-07-04T12:00:00.000Z",
          versions: [{ id: "version-1", source: "constructed-editor", cardQuantities: { privateCard: 1 } }],
          record: { wins: 1, losses: 0, draws: 0, recentMatchIds: ["match-1"] }
        }]
      }
    }
  };
  const match = {
    recordVersion: 2,
    matchId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    mode: "factions",
    ranked: true,
    completedAt: "2026-07-15T11:00:00.000Z",
    winner: 1,
    reason: "life-total",
    turnCount: 9,
    participants: [{
      playerNum: 1,
      accountId: account.id,
      displayName: "Alpha",
      faction: { id: "rumin", name: "Rumin" },
      result: "win",
      finalLife: 5,
      deck: { deckId: "deck-1", deckVersionId: "version-1" }
    }],
    combatStats: { byPlayer: { 1: { damageDealt: 8, damagePrevented: 3 } } },
    notableMoments: { largestAttack: { playerNum: 1, value: 12 } },
    auditEvents: []
  };

  const profile = buildPublicPlayerProfile(account, [match]);
  const serialized = JSON.stringify(profile);
  assert.equal(profile.competitiveRecord.ranked.winRate, 75);
  assert.equal(profile.factionRecords[0].wins, 1);
  assert.equal(profile.featuredDecks[0].currentVersionId, "version-1");
  assert.equal(profile.notableStats.largestAttack.value, 12);
  assert.equal(profile.recentMatches[0].perspective.outcome, "win");
  assert.equal(profile.recentMatches[0].perspective.player.faction.id, "rumin");
  assert.equal(profile.recentMatches[0].perspective.player.finalLife, 5);
  assert.deepEqual(profile.unavailableMatchReferences, []);
  assert.equal(serialized.includes("private-hash"), false);
  assert.equal(serialized.includes("privateCard"), false);
  assert.equal(serialized.includes("wrong-faction"), false);
  assert.equal(serialized.includes("Wrong Opponent"), false);
});
