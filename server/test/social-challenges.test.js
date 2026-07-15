const test = require("node:test");
const assert = require("node:assert/strict");

const { server, __test } = require("../index");

const {
  addFriendChallenge,
  canOfferRematch,
  normalizeFriendChallenges,
  setFriendChallengeStatus
} = __test;

test.after(() => server.close());

function challenge(overrides = {}) {
  return {
    id: "challenge-1",
    fromId: "account-1",
    fromName: "Ari",
    toId: "account-2",
    toName: "Bo",
    roomCode: "ABC123",
    mode: "factions",
    bestOf: 1,
    status: "pending",
    createdAt: "2026-07-15T20:00:00.000Z",
    expiresAt: "2026-07-15T20:15:00.000Z",
    respondedAt: null,
    ...overrides
  };
}

test("stores one invitation and records its response", () => {
  const stats = {};
  addFriendChallenge(stats, challenge());
  addFriendChallenge(stats, challenge());

  assert.equal(stats.friendChallenges.length, 1);
  const updated = setFriendChallengeStatus(stats, "challenge-1", "accepted", "2026-07-15T20:05:00.000Z");
  assert.equal(updated.status, "accepted");
  assert.equal(updated.respondedAt, "2026-07-15T20:05:00.000Z");
});

test("expires pending invitations without removing their audit trail", () => {
  const stats = { friendChallenges: [challenge()] };
  const challenges = normalizeFriendChallenges(stats, Date.parse("2026-07-15T20:16:00.000Z"));

  assert.equal(challenges.length, 1);
  assert.equal(challenges[0].status, "expired");
});

test("offers rematches only for completed human duels", () => {
  const room = {
    lobby: {
      gameMode: "factions",
      players: {
        1: { accountName: "Ari", isAI: false },
        2: { accountName: "Bo", isAI: false }
      }
    },
    game: { phase: "gameOver", winner: 1 }
  };

  assert.equal(canOfferRematch(room), true);
  assert.equal(canOfferRematch({ ...room, draft: {} }), false);
  assert.equal(canOfferRematch({ ...room, lobby: { ...room.lobby, campaign: {} } }), false);
  assert.equal(canOfferRematch({ ...room, lobby: { ...room.lobby, players: { ...room.lobby.players, 2: { accountName: "Training AI", isAI: true } } } }), false);
});
