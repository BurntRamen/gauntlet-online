const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-design-harness-"));
const accounts = [
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "simply", stats: {} },
  { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Burnt Ramen", stats: {} },
  { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", name: "simply", stats: {} }
];
Object.assign(process.env, { ACCOUNT_DATA_FILE: path.join(directory, "accounts.json"), MATCH_DATA_FILE: path.join(directory, "matches.json"),
  GAUNTLET_CONTENT_DATA_DIR: path.join(directory, "content"), GAUNTLET_CONTENT_PROVIDER: "file", ROOM_STATE_RECOVERY_ENABLED: "false",
  ACCOUNT_AUTH_SECRET: "private-harness-test-secret", GAUNTLET_ADMIN_SIMPLY_ACCOUNT_ID: accounts[0].id, GAUNTLET_ADMIN_BURNT_RAMEN_ACCOUNT_ID: accounts[1].id });
delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.SUPABASE_SECRET_KEY;
fs.writeFileSync(process.env.ACCOUNT_DATA_FILE, JSON.stringify({ accounts }));
fs.writeFileSync(process.env.MATCH_DATA_FILE, JSON.stringify({ matches: [] }));
const { server, __test } = require("../index");
let origin;
test.before(async () => { await new Promise(resolve => server.listen(0, "127.0.0.1", resolve)); origin = `http://127.0.0.1:${server.address().port}`; });
test.after(async () => { await new Promise(resolve => server.close(resolve)); fs.rmSync(directory, { recursive: true, force: true }); });
async function call(route, body, account = accounts[0]) {
  const response = await fetch(`${origin}/api/admin/authoring/playtest${route}`, { method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", ...(account ? { Authorization: `Bearer ${__test.issueAccountSession(account).token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, cache: response.headers.get("cache-control"), body: await response.json() };
}
test("both allowlisted accounts can read scenario bounds; all others are denied new test routes", async () => {
  for (const [route, body] of [["/scenario-spec"], ["/preview-command", {}], ["", { source: "live" }]]) {
    assert.equal((await call(route, body, null)).status, 401);
    assert.equal((await call(route, body, accounts[2])).status, 403);
  }
  for (const account of accounts.slice(0, 2)) {
    const response = await call("/scenario-spec", undefined, account);
    assert.equal(response.status, 200); assert.match(response.cache, /no-store/);
    assert.equal(response.body.scenarioSpec.life.max, 100); assert.equal(response.body.scenarioSpec.laneCount, 3);
  }
});

test("live custom HTTP sessions preview actual effects and execute without altering accounts, rooms, history or publication", async () => {
  const before = { accounts: fs.readFileSync(process.env.ACCOUNT_DATA_FILE), matches: fs.readFileSync(process.env.MATCH_DATA_FILE),
    publication: __test.contentPublication.exportState(), rooms: __test.rooms.size };
  const spear = __test.contentPublication.active().manifest.cards.find(card => card.id === "rumin-coin-scale-spear");
  const scenario = { version: 1, turn: 2, priority: 1, players: { 1: { factionId: "rumin", life: 31,
    hand: [{ value: 2, suit: "spades" }, { value: 14, suit: "hearts" }], support: [{ value: spear.value, suit: "clubs", cardId: spear.id }, null, null] },
    2: { factionId: "jali", life: 24, revenants: 3, hand: [{ value: 3, suit: "spades" }, { value: 14, suit: "hearts" }] } } };
  const started = await call("", { source: "live", subject: { kind: "card", id: spear.id }, scenario });
  assert.equal(started.status, 200, JSON.stringify(started.body));
  let session = started.body.playtest;
  assert.equal(session.game.players[1].faction.id, "rumin"); assert.equal(session.game.players[2].faction.id, "jali");
  assert.equal(session.game.players[2].revenants, 3); assert.equal(session.game.players[1].life, 31);
  assert.equal(session.game.players[1].hand.length + session.game.players[1].deck.length + 1, 52);
  const action = session.legalActions.find(action => action.type === "declareHandAttack");
  const arm = action.optionalEffects.find(option => option.id === "arm-rumin-weapons");
  assert.equal(arm.commandField, "armWeaponCardIds");
  const command = { type: action.type, player: action.player, ...action.confirmationPayload.fixed,
    paymentCardIds: action.payment.eligibleCardIds, [arm.commandField]: arm.cardIds.slice(0, 1) };
  const body = { id: session.id, gameRevision: session.game.revision, command };
  assert.equal((await call("/preview-command", body, accounts[1])).status, 404);
  const preview = await call("/preview-command", body);
  assert.equal(preview.status, 200, JSON.stringify(preview.body)); assert.equal(preview.body.preview.accepted, true);
  assert.ok(preview.body.preview.payment); assert.ok(preview.body.preview.events.some(event => event.type === "attack.declared"));
  assert.deepEqual(__test.contentPublication.exportState(), before.publication);
  const executed = await call("/command", body);
  assert.equal(executed.status, 200, JSON.stringify(executed.body)); session = executed.body.playtest;
  assert.equal(session.acceptedCommands, 1); assert.equal(executed.body.authoring, undefined);
  assert.equal(session.lastCommand.kind, "executed");
  assert.deepEqual(session.lastCommand.events, preview.body.preview.events);
  assert.equal((await call("/preview-command", body)).status, 409);
  assert.equal(__test.rooms.size, before.rooms);
  assert.deepEqual(fs.readFileSync(process.env.ACCOUNT_DATA_FILE), before.accounts);
  assert.deepEqual(fs.readFileSync(process.env.MATCH_DATA_FILE), before.matches);
  assert.deepEqual(__test.contentPublication.exportState(), before.publication);
  assert.equal(fs.existsSync(process.env.GAUNTLET_CONTENT_DATA_DIR), false);
});

test("HTTP selected cards reach hand for newer factions and the second administrator has an independent session", async () => {
  const cards = __test.contentPublication.active().manifest.cards;
  for (const [index, factionId] of ["indela", "zynarth", "astral-vanguard"].entries()) {
    const card = cards.find(card => card.factionId === factionId), account = accounts[index % 2];
    const response = await call("", { source: "live", subject: { kind: "card-effect", id: card.effect.id, cardId: card.id } }, account);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.ok(response.body.playtest.game.players[1].hand.some(entry => entry.definitionId === card.id));
    assert.equal(response.body.playtest.subject.id, card.effect.id);
  }
});
