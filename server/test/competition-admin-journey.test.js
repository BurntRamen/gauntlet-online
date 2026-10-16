const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { io } = require("socket.io-client");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-managed-competition-"));
const accounts = ["simply", "Burnt Ramen", "Entrant", "Opponent"].map((name, i) => ({ id: `${String(i + 1).repeat(8)}-${String(i + 1).repeat(4)}-4aaa-8aaa-${String(i + 1).repeat(12)}`, name, stats: { rankedGamesPlayed: 100, rankedGamesWon: 50, rankedGamesLost: 50 } }));
Object.assign(process.env, { NODE_ENV: "test", GAUNTLET_CONTENT_PROVIDER: "file", ACCOUNT_AUTH_SECRET: "isolated-managed-competition", ACCOUNT_DATA_FILE: path.join(root, "accounts.json"), MATCH_DATA_FILE: path.join(root, "matches.json"), MATCH_ARCHIVE_DATA_DIR: path.join(root, "archive"), FACTION_STATS_DATA_FILE: path.join(root, "factions.json"), ROOM_STATE_DATA_FILE: path.join(root, "rooms.json"), GAUNTLET_CONTENT_DATA_DIR: path.join(root, "content"), ROOM_STATE_RECOVERY_ENABLED: "true", GAUNTLET_ADMIN_SIMPLY_ACCOUNT_ID: accounts[0].id, GAUNTLET_ADMIN_BURNT_RAMEN_ACCOUNT_ID: accounts[1].id });
for (const key of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "GAUNTLET_ECONOMY_DATA_DIR", "GAUNTLET_PARA_DATA_DIR"]) delete process.env[key];
fs.writeFileSync(process.env.ACCOUNT_DATA_FILE, JSON.stringify({ accounts }));
const { server, __test } = require("../index"), pub = __test.contentPublication;
const tokens = accounts.map(a => __test.issueAccountSession(a).token), sockets = [];
let origin;
test.before(async () => { await new Promise(r => server.listen(0, "127.0.0.1", r)); origin = `http://127.0.0.1:${server.address().port}`; });
test.after(async () => { sockets.forEach(s => s.disconnect()); for (const room of [...__test.rooms.values()]) __test.deleteRoom(room.roomCode); server.closeAllConnections(); await new Promise(r => server.close(r)); assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep)); fs.rmSync(root, { recursive: true, force: true }); });
async function api(route, input, who = 0) {
  const r = await fetch(origin + route, { method: input ? "POST" : "GET", headers: { Connection: "close", "Content-Type": "application/json", ...(who === null ? {} : { Authorization: `Bearer ${tokens[who]}` }) }, ...(input ? { body: JSON.stringify(input) } : {}) });
  return { status: r.status, data: await r.json() };
}
async function author(action, input = {}, who = 0) { const r = await api(`/api/admin/authoring/${action}`, { expectedRevision: pub.status().revision, ...input }, who); assert.equal(r.status, 200, JSON.stringify(r.data)); return r.data; }
const draft = input => author("competition-draft", input);
const publish = async label => { await author("preview"); return author("publish", { label }); };
async function wait(read, predicate) { for (let n = 0; n < 250; n++) { const value = await read(); if (predicate(value)) return value; await new Promise(r => setTimeout(r, 20)); } throw new Error("Authoritative completion did not arrive"); }
async function play(eventId) {
  const latest = [], lobbies = [];
  for (let i = 0; i < 2; i++) { const socket = io(origin, { forceNew: true, transports: ["websocket"] }); sockets.push(socket); socket.on("state", s => { latest[i] = s; }); socket.on("lobbyState", s => { lobbies[i] = s; }); await new Promise(r => socket.on("connect", r)); }
  const peers = sockets.slice(-2);
  for (let i = 0; i < 2; i++) peers[i].emit(eventId ? "joinEventMatchmaking" : "joinMatchmaking", { authToken: tokens[i + 2], eventId, gameMode: "basic" });
  await wait(() => lobbies, l => l[0]?.players && l[1]?.players);
  peers[0].emit("startGame"); peers[1].emit("startGame");
  await wait(() => latest, s => s[0]?.phase === "priority" && s[1]?.phase === "priority");
  const matchId = latest[0].matchId;
  await new Promise(r => peers[0].emit("concedeGame", r));
  const records = await wait(() => fs.existsSync(process.env.MATCH_DATA_FILE) ? JSON.parse(fs.readFileSync(process.env.MATCH_DATA_FILE)).matches : [], rows => rows.some(r => r.matchId === matchId && r.completion?.status === "finalized"));
  peers.forEach(s => s.emit("leaveRoom"));
  await wait(() => [...__test.rooms.values()], rooms => rooms.every(room => Object.values(room.lobby.players).every(p => !p.socket)));
  peers.forEach(s => s.disconnect());
  return records.find(r => r.matchId === matchId);
}
test("both operators author, publish and run Ranked/legacy competitions through real sockets and canonical receipts", async () => {
  for (const who of [null, 2]) {
    assert.equal((await api("/api/admin/authoring/competition-draft", {}, who)).status, who === null ? 401 : 403);
    assert.equal((await api("/api/admin/competition", null, who)).status, who === null ? 401 : 403);
  }
  const initial = pub.status().activeReleaseId;
  let state = await author("competition-draft", { operation: "create", domain: "ranked" }, 1);
  const season = { ...state.draft.snapshot.competition.ranked[0], name: "Managed season", status: "scheduled", startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2099-01-01T00:00:00.000Z", winPoints: 7, drawPoints: 2 };
  await draft({ operation: "update", domain: "ranked", id: season.id, value: season });
  state = await draft({ operation: "duplicate", domain: "events", sourceId: "classic-trial" });
  const event = { ...state.draft.snapshot.competition.events[0], name: "Managed Classic", status: "scheduled", startsAt: season.startsAt, endsAt: season.endsAt, entryClosesAt: season.endsAt, winTarget: 1, lossLimit: 1, rewards: [{ wins: 1, gold: 123, boosterCredits: 2, cardStyleId: "rumin-vault-shield-bearer:collector-foil" }] };
  await draft({ operation: "update", domain: "events", id: event.id, value: event });
  const stale = await api("/api/admin/authoring/competition-draft", { expectedRevision: 0, operation: "create", domain: "events" }); assert.equal(stale.status, 409);
  assert.equal((await api("/api/events", null, null)).data.events.some(e => e.id === event.id), false);
  state = await publish("Managed season and event");
  assert.equal((await api("/api/events", null, null)).data.events.find(e => e.id === event.id).rewardTiers[0].gold, 123);
  const ranked = await play(); assert.equal(ranked.season.seasonId, season.id); assert.equal(ranked.season.scoring.win, 7);
  let view = (await api("/api/admin/competition", null, 1)).data;
  assert.equal(view.seasons.find(s => s.definition.seasonId === season.id).standings[0].points, 7);
  for (const who of [2, 3]) assert.equal((await api(`/api/events/${event.id}/join`, {}, who)).status, 200);
  const result = await play(event.id); assert.equal(result.event.definition.rewardTiers[0].gold, 123);
  view = (await api("/api/admin/competition")).data;
  assert.equal(view.runs.filter(r => r.eventId === event.id && r.status === "complete").length, 2);
  assert.equal(view.runs.find(r => r.accountId === accounts[3].id).definition.rewardTiers[0].gold, 123);
  assert.equal((await api(`/api/events/${event.id}/join`, {}, 2)).status, 400);
  const before = fs.readFileSync(process.env.ACCOUNT_DATA_FILE, "utf8");
  const winner = JSON.parse(before).accounts.find(account => account.id === accounts[3].id);
  assert.equal(winner.stats.collection.collectorVariants["rumin-vault-shield-bearer:collector-foil"], 1);
  assert.equal(result.event.definition.rewardTiers[0].cardStyleId, "rumin-vault-shield-bearer:collector-foil");
  await __test.recordFinalGameStats([...__test.rooms.values()].find(r => r.game?.matchId === result.matchId));
  assert.equal(fs.readFileSync(process.env.ACCOUNT_DATA_FILE, "utf8"), before);
  state = await draft({ operation: "update", domain: "ranked", id: season.id, value: { ...season, winPoints: 100 } });
  assert.equal(state.validation.valid, false); assert.match(state.validation.errors.at(-1).message, /pinned/);
  assert.equal((await api("/api/admin/authoring/preview", { expectedRevision: state.revision })).status, 422);
  await author("discard");
  assert.equal((await api("/api/admin/authoring/rollback", { expectedRevision: pub.status().revision, releaseId: initial })).status, 422);
  await draft({ operation: "update", domain: "events", id: event.id, value: { ...event, status: "archived", reason: "Retire after test event" } });
  await publish("Retire managed event");
  assert.equal((await api("/api/events", null, null)).data.events.find(e => e.id === event.id).availability.canEnter, false);
  const reopened = require("../contentPublication").createContentPublication({ baseline: pub.exportState().releases[initial].snapshot, directory: process.env.GAUNTLET_CONTENT_DATA_DIR });
  assert.equal(reopened.active().manifest.competition.events[0].status, "archived");
  assert.equal((await api("/api/admin/competition")).data.seasons.find(s => s.definition.seasonId === season.id).standings[0].points, 7);
});
