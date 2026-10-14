const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { io } = require("socket.io-client");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "para-game-integration-"));
const accounts = ["simply", "Burnt Ramen", "Entrant", "Opponent"].map((name, i) => ({ id: `${String(i + 1).repeat(8)}-${String(i + 1).repeat(4)}-4aaa-8aaa-${String(i + 1).repeat(12)}`, name, stats: {} }));
Object.assign(process.env, { ACCOUNT_DATA_FILE: path.join(root, "accounts.json"), MATCH_DATA_FILE: path.join(root, "matches.json"), MATCH_ARCHIVE_DATA_DIR: path.join(root, "archive"), FACTION_STATS_DATA_FILE: path.join(root, "factions.json"), ROOM_STATE_DATA_FILE: path.join(root, "rooms.json"), GAUNTLET_CONTENT_DATA_DIR: path.join(root, "content"), GAUNTLET_PARA_DATA_DIR: path.join(root, "para"), ROOM_STATE_RECOVERY_ENABLED: "true", ACCOUNT_AUTH_SECRET: "isolated-para-integration-secret", GAUNTLET_ADMIN_SIMPLY_ACCOUNT_ID: accounts[0].id, GAUNTLET_ADMIN_BURNT_RAMEN_ACCOUNT_ID: accounts[1].id });
delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.SUPABASE_SECRET_KEY;
fs.writeFileSync(process.env.ACCOUNT_DATA_FILE, JSON.stringify({ accounts }));
const { server, __test } = require("../index");
let origin;
const tokens = accounts.map((a) => __test.issueAccountSession(a).token);
const sockets = [];
test.before(async () => { await new Promise((r) => server.listen(0, "127.0.0.1", r)); origin = `http://127.0.0.1:${server.address().port}`; });
test.after(async () => { sockets.forEach((s) => s.disconnect()); await new Promise((r) => server.close(r)); for (const room of [...__test.rooms.values()]) __test.deleteRoom(room.roomCode); __test.paraRuntime.close(); fs.rmSync(root, { recursive: true, force: true }); });
async function api(url, input, index = 0) {
  const response = await fetch(origin + url, { method: input ? "POST" : "GET", headers: { "Content-Type": "application/json", ...(index === null ? {} : { Authorization: `Bearer ${tokens[index]}` }) }, ...(input ? { body: JSON.stringify(input) } : {}) });
  return { status: response.status, data: await response.json() };
}
const author = async (route, input = {}) => { const { data } = await api("/api/admin/authoring"); const result = await api(`/api/admin/authoring/${route}`, { expectedRevision: data.revision, ...input }); assert.equal(result.status, 200, JSON.stringify(result.data)); return result.data; };
const wait = async (read, predicate) => { for (let i = 0; i < 150; i++) { const value = await read(); if (predicate(value)) return value; await new Promise((r) => setTimeout(r, 20)); } throw new Error("Timed out awaiting authoritative result"); };

test("unsupported publication providers and unconfigured runtime fail closed with truthful status", async () => {
  const { createContentPublication } = require("../contentPublication");
  const { createParaRuntime } = require("../paraRuntime");
  const baseline = (await api("/api/admin/authoring")).data.live;
  const directory = path.join(root, "unsupported-provider");
  const publication = createContentPublication({ baseline, directory, provider: "github" });
  assert.equal(publication.status().writable, false);
  assert.equal(publication.status().publication.deployment, "unsupported-provider");
  assert.equal(publication.status().publication.github, "unavailable");
  assert.throws(() => publication.paraDraft({ expectedRevision: 0, operation: "seed" }, accounts[0].id), /No GitHub or deployment adapter/);
  assert.equal(fs.existsSync(directory), false);
  const disabled = createParaRuntime({ publication });
  assert.equal(disabled.enabled, false);
  assert.match(disabled.status().reason, /GAUNTLET_PARA_DATA_DIR/);
  assert.equal(disabled.settle({}), null);
});

test("published Admin events run through real human sockets, canonical finalization, SQLite Prestige and Admin evidence", async () => {
  for (const url of ["/api/admin/para", "/api/admin/para/operation"]) {
    assert.equal((await api(url, url.endsWith("operation") ? {} : null, null)).status, 401);
    assert.equal((await api(url, url.endsWith("operation") ? {} : null, 2)).status, 403);
  }
  const originalAccounts = fs.readFileSync(process.env.ACCOUNT_DATA_FILE);
  let state = await author("para-draft", { operation: "seed" });
  const season = { ...state.draft.snapshot.paraLeague.seasons[0], status: "active", startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2099-01-01T00:00:00.000Z", invitationalThreshold: 12, perfectQualifierQualifies: false };
  await author("para-draft", { operation: "update", domain: "seasons", id: season.id, value: season });
  const event = { ...state.draft.snapshot.paraLeague.events[1], status: "scheduled", startsAt: season.startsAt, endsAt: season.endsAt, registrationOpensAt: season.startsAt, registrationClosesAt: season.endsAt, prestige: [12, 14, 16, 18, 20, 30] };
  await author("para-draft", { operation: "update", domain: "events", id: event.id, value: event });
  await author("preview"); state = await author("publish", { label: "Real official Classic Trial" });
  const pinnedId = state.activeReleaseId;
  const enroll = (index) => api("/api/para/enroll", { eventId: event.id, acceptedRules: pinnedId, eligibilityConfirmed: true }, index);
  const a = (await enroll(2)).data, b = (await enroll(3)).data;
  assert.equal((await api("/api/para", null, 2)).data.seasons[0].invitationalEligible, false);
  const latest = [];
  for (let i = 0; i < 2; i++) { const socket = io(origin, { transports: ["websocket"], forceNew: true }); sockets.push(socket); socket.on("state", (s) => { latest[i] = s; }); await new Promise((r) => socket.on("connect", r)); }
  for (let i = 0; i < 2; i++) {
    latest.length = 0;
    const queued = await new Promise((r) => sockets[0].emit("joinParaQueue", { authToken: tokens[2], attemptId: a.id }, r)); assert.equal(queued.inQueue, true, JSON.stringify(queued));
    const paired = await new Promise((r) => sockets[1].emit("joinParaQueue", { authToken: tokens[3], attemptId: b.id }, r)); assert.ok(!paired.error, JSON.stringify(paired));
    await wait(() => latest, (s) => s.length === 2 && s[0]?.phase === "priority" && s[1]?.phase === "priority");
    const matchId = latest[0].matchId;
    const result = await new Promise((r) => sockets[0].emit("concedeGame", r)); assert.notEqual(result?.accepted, false, JSON.stringify(result));
    await wait(() => api("/api/admin/para"), (r) => r.data.receipts?.some((receipt) => receipt.id === matchId));
    const record = JSON.parse(fs.readFileSync(process.env.MATCH_DATA_FILE, "utf8")).matches.find((r) => r.matchId === matchId);
    assert.equal(record.completion.status, "finalized"); assert.equal(record.contentVersion, pinnedId); assert.equal(record.para.eventId, event.id);
    __test.paraRuntime.settle(record); // Retry canonical completion, not a client reward claim.
    sockets.forEach((s) => s.emit("leaveRoom"));
    await wait(() => [...__test.rooms.values()], (rooms) => rooms.every((room) => Object.values(room.lobby.players).every((p) => !p.socket)));
  }
  const view = (await api("/api/para", null, 2)).data;
  assert.equal(view.awards.length, 1); assert.equal(view.awards[0].amount, 12); assert.equal(view.awards[0].evidence.length, 2);
  assert.equal(view.seasons[0].invitationalEligible, true);
  const profile = (await api(`/api/profiles/${accounts[2].id}`, null, null)).data.profile;
  assert.deepEqual(profile.para, { automaticMembership: true, lifetimePrestige: 12, summary: "Para member · 12 lifetime Prestige · Official runs completed: 1" });
  assert.equal(profile.competitiveRecord.ranked.gamesPlayed, 0);
  assert.equal((await enroll(2)).status, 409);
  await author("para-draft", { operation: "update", domain: "events", id: event.id, value: { ...event, prestige: [99, 99, 99, 99, 99, 99] } });
  await author("preview"); await author("publish", { label: "Changed future proposal" });
  const unchanged = (await api("/api/para", null, 2)).data;
  assert.deepEqual(unchanged.awards, view.awards); assert.equal(unchanged.events[0].definitionMismatch, true);
  assert.deepEqual(fs.readFileSync(process.env.ACCOUNT_DATA_FILE), originalAccounts);
  const evidence = (await api("/api/admin/para", null, 1)).data;
  assert.equal(evidence.awards[0].releaseId, pinnedId); assert.equal(evidence.failures.length, 0);
});

test("official faction decks use the equal published pool; forged cards and duplicate slots fail, disconnects retain the attempt", async () => {
  let { data: state } = await api("/api/admin/authoring");
  const season = { ...state.live.paraLeague.seasons[0], id: "faction-season", formats: ["faction-constructed"] };
  await author("para-draft", { operation: "create", domain: "seasons", id: season.id, value: season });
  const event = { ...state.live.paraLeague.events[0], id: "faction-event", seasonId: season.id, status: "scheduled", startsAt: season.startsAt, endsAt: season.endsAt, registrationOpensAt: season.startsAt, registrationClosesAt: season.endsAt };
  await author("para-draft", { operation: "create", domain: "events", id: event.id, value: event });
  await author("preview"); state = await author("publish", { label: "Equal faction pool" });
  const a = (await api("/api/para/enroll", { eventId: event.id, acceptedRules: state.activeReleaseId, eligibilityConfirmed: true }, 2)).data;
  const b = (await api("/api/para/enroll", { eventId: event.id, acceptedRules: state.activeReleaseId, eligibilityConfirmed: true }, 3)).data;
  const pool = (await api("/api/para/pool", { eventId: event.id }, 2)).data.cards;
  const card = pool.find((c) => c.factionId === "rumin");
  const campaignOnly = await new Promise((r) => sockets[0].emit("joinParaQueue", { authToken: tokens[2], attemptId: a.id, factionId: "xendra", cards: [] }, r));
  assert.match(campaignOnly.error, /legal faction/);
  const join = (socket, token, attemptId, cards) => new Promise((r) => socket.emit("joinParaQueue", { authToken: token, attemptId, factionId: "rumin", cards }, r));
  assert.match((await join(sockets[0], tokens[2], a.id, [{ id: "forged", suit: "hearts" }])).error, /equal official pool/);
  const cards = [{ id: card.id, suit: "hearts" }];
  assert.match((await join(sockets[0], tokens[2], a.id, [...cards, ...cards])).error, /Only one card/);
  assert.equal((await join(sockets[0], tokens[2], a.id, cards)).inQueue, true);
  assert.ok(!(await join(sockets[1], tokens[3], b.id, cards)).error);
  const room = [...__test.rooms.values()].find((r) => r.para?.eventId === event.id);
  assert.equal(room.game.gameMode, "factions"); assert.equal(room.game.contentVersion, state.activeReleaseId);
  assert.deepEqual(room.lobby.players[1].savedConstructedDeck.cards.map((c) => c.id), [card.id]);
  assert.equal((await new Promise((r) => sockets[0].emit("requestUndo", r))).accepted, false);
  sockets[0].disconnect();
  await wait(() => room, (r) => Object.values(r.lobby.players).some((p) => !p.socket));
  await new Promise((r) => setTimeout(r, 1100));
  await __test.sweepRoomLifecycle({ now: Date.now(), config: { reconnectGraceMs: 1000, lobbyTtlMs: 3600000, completedTtlMs: 3600000 } });
  const record = JSON.parse(fs.readFileSync(process.env.MATCH_DATA_FILE, "utf8")).matches.find((r) => r.matchId === room.game.matchId);
  assert.equal(record.completionReason, "disconnect_forfeit");
  const attempt = (await api("/api/para", null, 2)).data.events.find((e) => e.id === event.id).attempts[0];
  assert.equal(attempt.id, a.id); assert.equal(attempt.losses, 1); assert.equal(attempt.played, 1);
});
