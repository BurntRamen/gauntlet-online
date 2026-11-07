const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path"), http = require("node:http");
const { fork } = require("node:child_process"), { once } = require("node:events");
const { io } = require("socket.io-client"), { PGlite } = require("@electric-sql/pglite");

function event(socket, name, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(name, receive); reject(new Error(`Timeout: ${name}`)); }, 20000);
    function receive(value) { if (!predicate(value)) return; clearTimeout(timer); socket.off(name, receive); resolve(value); }
    socket.on(name, receive);
  });
}

test("acknowledged game and draft survive an ungraceful process replacement with a fresh filesystem", { timeout: 90000 }, async t => {
  const db = new PGlite(), dirs = [], children = [], sockets = [];
  let failWrites = false, holdCommit = null;
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await db.exec(fs.readFileSync(path.join(__dirname, "../../supabase/migrations/20261029211614_authoritative_runtime_state.sql"), "utf8"));
  const api = http.createServer(async (req, res) => {
    try {
      let result;
      if (req.url.startsWith("/rest/v1/gauntlet_runtime_states?")) result = (await db.query("select revision::int,contract,state,updated_at from public.gauntlet_runtime_states where id='active-rooms'")).rows;
      else if (req.url === "/rest/v1/rpc/commit_gauntlet_runtime") {
        let text = ""; for await (const chunk of req) text += chunk;
        if (failWrites) throw new Error("isolated database outage");
        if (holdCommit) await holdCommit;
        const p = JSON.parse(text);
        result = (await db.query("select public.commit_gauntlet_runtime($1,$2,$3,$4,$5) result", [p.p_id,p.p_expected_revision,p.p_request_id,p.p_contract,p.p_state])).rows[0].result;
      } else { res.writeHead(404); res.end(JSON.stringify({ message: "Unused test API" })); return; }
      res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(result));
    } catch (error) { res.writeHead(503); res.end(JSON.stringify({ message: error.message, code: error.code })); }
  });
  await new Promise(resolve => api.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    sockets.forEach(socket => socket.disconnect());
    for (const child of children) if (child.exitCode == null && child.signalCode == null) { const closed = once(child, "exit"); child.kill("SIGKILL"); await closed; }
    await new Promise(resolve => api.close(resolve)); await db.close();
    for (const dir of dirs) { assert.equal(path.dirname(dir), os.tmpdir()); assert.ok(path.basename(dir).startsWith("gauntlet-remote-")); fs.rmSync(dir, { recursive: true, force: true }); }
  });
  async function start() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-remote-")); dirs.push(dir);
    const env = { ...process.env, NODE_ENV: "test", GAUNTLET_ROOM_STATE_PROVIDER: "supabase", SUPABASE_URL: `http://127.0.0.1:${api.address().port}`, SUPABASE_SERVICE_ROLE_KEY: "isolated-fixture", SUPABASE_SECRET_KEY: "", GAUNTLET_CONTENT_PROVIDER: "file", GAUNTLET_PRIVATE_AUTHORING_PROVIDER: "", GAUNTLET_RUNTIME_BACKUPS: "", GAUNTLET_RUNTIME_DATA_DIR: "", GAUNTLET_REQUIRE_DURABLE_STORAGE: "false", GAUNTLET_ECONOMY_DATA_DIR: "", GAUNTLET_PARA_DATA_DIR: "", ACCOUNT_AUTH_SECRET: "isolated-remote-room-test-secret" };
    for (const [key, file] of Object.entries({ ACCOUNT_DATA_FILE: "accounts.json", MATCH_DATA_FILE: "matches.json", ROOM_STATE_DATA_FILE: "rooms.json", FACTION_STATS_DATA_FILE: "factions.json", GAUNTLET_CONTENT_DATA_DIR: "content" })) env[key] = path.join(dir, file);
    const child = fork(path.join(__dirname, "fixtures/remote-room-process.cjs"), [], { env, stdio: ["ignore", "pipe", "pipe", "ipc"] }); children.push(child);
    let logs = ""; child.stderr.on("data", data => { logs += data; }); child.stdout.resume();
    const [message] = await Promise.race([once(child, "message"), once(child, "exit").then(() => { throw new Error(logs); })]);
    if (message.error) throw new Error(message.error);
    return { child, url: `http://127.0.0.1:${message.port}` };
  }
  async function connect(url) {
    const socket = io(url, { autoConnect: false, reconnection: false, transports: ["websocket"] }); sockets.push(socket);
    const connected = event(socket, "connect"); socket.connect(); await connected; return socket;
  }
  const first = await start(), player = await connect(first.url), drafter = await connect(first.url);
  let release; holdCommit = new Promise(resolve => { release = resolve; });
  let sawAssignment = false; player.once("assign", () => { sawAssignment = true; });
  const assigned = event(player, "assign"), stateEvent = event(player, "state");
  player.emit("createAiTutorialRoom", { guestName: "Recovery Player", mode: "basic" });
  await new Promise(resolve => setTimeout(resolve, 250)); assert.equal(sawAssignment, false, "No room identity or state escapes before commit");
  release(); holdCommit = null;
  const seat = await assigned; await stateEvent;
  const draftSeatPromise = event(drafter, "assign"), draftPromise = event(drafter, "draftState");
  assert.equal((await drafter.timeout(20000).emitWithAck("createBotDraftRoom", { guestName: "Recovery Drafter" })).ok, true);
  const draftSeat = await draftSeatPromise; let draft = await draftPromise;
  const picked = event(drafter, "draftState", value => value.myPool.length === 1);
  assert.equal((await drafter.timeout(20000).emitWithAck("draftPick", { cardCopyId: draft.myCurrentPack.cards[0].draftCopyId })).ok, true);
  draft = await picked;
  const committed = (await db.query("select state from public.gauntlet_runtime_states where id='active-rooms'")).rows[0].state;
  const gameBefore = committed.rooms.find(room => room.roomCode === seat.roomCode).game;
  const exited = once(first.child, "exit"); first.child.kill("SIGKILL"); await exited;
  const second = await start(), returned = await connect(second.url), draftReturned = await connect(second.url);
  const recoveredGame = event(returned, "state"); returned.emit("reconnectToRoom", seat);
  const game = await recoveredGame;
  assert.equal(game.matchId, gameBefore.matchId); assert.equal(game.turn, gameBefore.turn);
  assert.deepEqual(game.players[1].hand, gameBefore.players[1].hand);
  assert.deepEqual(game.players[2].hand, [], "Recovery projection never exposes the opponent hand");
  const recoveredDraft = event(draftReturned, "draftState"); draftReturned.emit("reconnectToRoom", draftSeat);
  const restored = await recoveredDraft;
  assert.deepEqual(restored.myPool, draft.myPool); assert.deepEqual(restored.myCurrentPack, draft.myCurrentPack);
  failWrites = true;
  const denied = await draftReturned.timeout(20000).emitWithAck("draftPick", { cardCopyId: restored.myCurrentPack.cards[0].draftCopyId });
  assert.equal(denied.ok, false); assert.equal(denied.rejection.code, "RUNTIME_UNAVAILABLE");
  const persisted = (await db.query("select state from public.gauntlet_runtime_states where id='active-rooms'")).rows[0].state;
  assert.equal(persisted.rooms.find(room => room.roomCode === draftSeat.roomCode).draft.draftedPools[1].length, 1);
});
