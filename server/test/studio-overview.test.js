const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-studio-"));
process.env.ACCOUNT_DATA_FILE = path.join(tempRoot, "accounts.json");
process.env.MATCH_DATA_FILE = path.join(tempRoot, "matches.json");
process.env.FACTION_STATS_DATA_FILE = path.join(tempRoot, "factions.json");
process.env.ROOM_STATE_RECOVERY_ENABLED = "false";
process.env.OWNER_STATS_TOKEN = "studio-owner-token";

const accountId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const matchId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
fs.writeFileSync(process.env.ACCOUNT_DATA_FILE, JSON.stringify({
  accounts: [{
    id: accountId,
    name: "Studio Alpha",
    createdAt: "2026-08-07T12:00:00.000Z",
    lastSeenAt: "2026-08-07T12:30:00.000Z",
    stats: {
      progression: { matchHistory: [{ matchId, recordVersion: 2, completedAt: "2026-08-07T12:20:00.000Z", deckVersionId: null }] },
      collection: {
        collectorIssuanceReceipts: {
          "entitlement-1": {
            entitlementId: "entitlement-1",
            accountId,
            productId: "rumin-foundation-physical-box",
            productType: "physical-collector-entitlement",
            issuanceSource: "owner-manual-fulfillment",
            issuedAt: "2026-08-07T12:10:00.000Z",
            externalReferenceHash: "safe-hash"
          }
        },
        collectorRedemptionReceipts: {
          "entitlement-1": {
            entitlementId: "entitlement-1",
            productId: "rumin-foundation-physical-box",
            productType: "physical-collector-entitlement",
            redeemedAt: "2026-08-07T12:15:00.000Z",
            grantedVariantIds: [],
            issuanceSource: "owner-manual-fulfillment",
            externalReferenceHash: "safe-hash"
          }
        }
      }
    }
  }]
}));

const { server, __test } = require("../index");

test.after(() => {
  server.close();
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

async function request(port, pathname, options = {}) {
  return fetch(`http://127.0.0.1:${port}${pathname}`, options);
}

test("Studio requires a short-lived owner session and returns only safe operational projections", async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  __test.rooms.set("STUDIO", {
    roomCode: "STUDIO",
    ranked: false,
    lifecycle: { status: "active", createdAt: "2026-08-07T12:00:00.000Z" },
    lobby: { gameMode: "basic", spectators: [{ socketId: "private-socket" }], players: {} },
    game: {
      matchId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      gameMode: "basic",
      phase: "priority",
      turn: 2,
      players: {
        1: { accountName: "Studio Alpha", connected: true, hand: [{ id: "private-hand-card" }], deck: [{ id: "private-deck-card" }], reconnectToken: "private-reconnect" },
        2: { guestName: "Studio Guest", connected: true, hand: [], deck: [] }
      }
    }
  });

  assert.equal((await request(port, "/api/admin/overview")).status, 403);
  const denied = await request(port, "/api/admin/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ownerToken: "wrong" })
  });
  assert.equal(denied.status, 403);

  const authorized = await request(port, "/api/admin/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ownerToken: process.env.OWNER_STATS_TOKEN })
  });
  const session = await authorized.json();
  assert.equal(authorized.status, 200);
  assert.ok(session.sessionToken);

  const response = await request(port, "/api/admin/overview", { headers: { "x-owner-session": session.sessionToken } });
  const overview = await response.json();
  assert.equal(response.status, 200);
  assert.equal(overview.system.backendReachable, true);
  assert.equal(overview.activePlay.rooms[0].players[0].displayName, "Studio Alpha");
  assert.equal(overview.matches.unavailableReferenceCount, 1);
  assert.equal(overview.collector.issuedCount, 1);
  assert.equal(overview.collector.redeemedCount, 1);

  const serialized = JSON.stringify(overview);
  for (const forbidden of ["private-hand-card", "private-deck-card", "private-reconnect", "private-socket", process.env.OWNER_STATS_TOKEN, session.sessionToken]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
  assert.equal((await request(port, "/api/admin/overview", { headers: { "x-owner-session": `${session.sessionToken}tampered` } })).status, 403);
});
