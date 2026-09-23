const test = require("node:test");
const assert = require("node:assert/strict");
const { createMatch, applyCommand, createCommandEnvelope } = require("../../shared/duel-rules");
const { captureLeagueEvidence } = require("../matchRecords");
const { buildReplayTimeline, buildMatchTranscript, formatMatchTranscript, sanitizeLeagueCommand } = require("../../shared/match-history");

function historyFixture() {
  let game = createMatch({ seed: "transcript", matchId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", gameMode: "basic" }).state;
  captureLeagueEvidence(game, { command: { type: "matchStarted" }, commandId: "start" });
  const initial = structuredClone(game);
  let serial = 0;
  function play(command) {
    const beforeGame = game;
    const actor = command.player;
    const envelope = createCommandEnvelope(game, actor, command, `command-${++serial}`);
    const applied = applyCommand(game, envelope);
    assert.equal(applied.accepted, true, applied.rejectionReason);
    game = applied.state;
    captureLeagueEvidence(game, { beforeGame, command, commandId: envelope.commandId, actorPlayerNum: actor, events: applied.animationEvents });
    return applied;
  }
  play({ type: "passPriority", player: game.priority });
  play({ type: "passPriority", player: game.priority });
  for (let n = 0; n < 6 && game.phase === "end"; n++) play({ type: "skipPlacement", player: game.endPlacementStep === 0 ? game.endPlacementFirstPlayer : 3 - game.endPlacementFirstPlayer, laneIndex: game.endPlacementLaneIndex });
  play({ type: "concede", player: game.priority });
  const record = { recordVersion: 2, matchId: game.matchId, mode: "basic", ranked: false,
    startedAt: "2026-09-22T12:00:00Z", completedAt: "2026-09-22T12:05:00Z", completionReason: "concession",
    rulesVersion: game.rulesVersion, contentVersion: game.cardContentVersion, winnerPlayerNum: game.winner,
    participants: [1, 2].map((n) => ({ playerNum: n, displayName: `Player ${n}`, finalLife: game.players[n].life,
      result: game.winner === n ? "win" : "loss", faction: { id: "basic", name: "Basic" }, deck: { format: "standard", deckVersionId: "test" } })),
    leagueEvidence: game.serverLeagueEvidence, publicReplayFrames: game.serverPublicReplayFrames };
  return { initial, record };
}

test("transcript preserves turn boundaries, exact public totals, hidden identities and text parity", () => {
  const { initial, record } = historyFixture();
  const replay = buildReplayTimeline(record);
  const transcript = buildMatchTranscript(replay);
  const text = formatMatchTranscript(transcript);
  assert.match(text, /Format: standard/);
  assert.match(text, /life 42 · hand 8 \(identities obscured\) · deck 44/);
  assert.match(text, /Result: Player \d wins/);
  assert.match(text, /TURN 2/);
  const transition = transcript.actions.find((action) => action.events.some((entry) => entry.type === "turn.started"));
  assert.equal(transition.turn, 1);
  assert.equal(transition.events.find((entry) => entry.type === "turn.started").turn, 2);
  for (const player of Object.values(initial.players)) for (const card of [...player.hand, ...player.deck]) assert.ok(!text.includes(card.id), card.id);
  for (const action of transcript.actions) for (const event of action.events) assert.ok(text.includes(`#${event.sequence} · Turn ${event.turn}`));
});

test("event-only historical transcripts say what was not recorded", () => {
  const { record } = historyFixture();
  record.publicReplayFrames = [];
  const text = formatMatchTranscript(buildMatchTranscript(buildReplayTimeline(record)));
  assert.match(text, /State not recorded for this moment/);
  assert.match(text, /Before command/);
});

test("public command capture hides private placement and private ability targets", () => {
  assert.equal(JSON.stringify(sanitizeLeagueCommand({ type: "placeFacedown", cardId: "secret-card" })).includes("secret-card"), false);
  assert.deepEqual(sanitizeLeagueCommand({ type: "useFactionAbility", abilityId: "mekan:monti:secret-card" }), { type: "useFactionAbility", abilityId: "mekan:monti" });
  const game = createMatch({ seed: "privacy", matchId: "privacy" }).state;
  const entries = captureLeagueEvidence(game, { command: { type: "placeFacedown", cardId: "secret-card" }, events: [
    { type: "laneEntry.resolved", source: "secret-card", player: 1 },
    { type: "card.buffApplied", cardId: "secret-card", amount: 1, player: 1 }
  ] });
  assert.ok(!JSON.stringify(entries).includes("secret-card"));
});
