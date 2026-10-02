const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const engine = require("../../shared/duel-rules");
const authored = require("../authoredContent");
const { createContentPublication } = require("../contentPublication");
const { createAdminPlaytests } = require("../adminPlaytest");
const old = require("./fixtures/content-v2/authored-baseline-v1.json");
const baseline = authored.createAuthoredBaseline({
  domains: { decks: old.domains.decks.map((row) => ({ ...row, definition: row.plan })) },
  game: { modes: old.domains.game }
});

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-playtest-resilience-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const publication = createContentPublication({ baseline, directory });
  publication.patch({ expectedRevision: 0, domain: "game", id: "shared-rules", field: "handSize", value: 5 }, "admin-one");
  const playtests = createAdminPlaytests({
    publication,
    chooseAi: () => null,
    createGame(resolved, selection) {
      const faction = resolved.factions[selection.factionId || "rumin"];
      if (!faction) throw Object.assign(new Error("Unknown faction."), { status: 422 });
      return authored.pinGameContent(engine.createMatch({
        seed: "resilience", gameMode: "factions", startingPriority: 1,
        config: resolved.manifest.gameConfig, factions: { 1: faction, 2: faction }
      }).state, resolved);
    }
  });
  const start = (actor = "admin-one", extra = {}) => playtests.start({ expectedRevision: publication.status().revision, ...extra }, actor).playtest;
  const act = (session, extra = {}, actor = "admin-one") => playtests.command({
    id: session.id, gameRevision: session.game.revision,
    command: { type: "passPriority", player: session.game.priority }, ...extra
  }, actor);
  return { publication, playtests, start, act };
}

test("failed replacement attempts preserve the operator's existing playtest", (t) => {
  const { publication, start, act } = fixture(t);
  let session = start();
  assert.throws(() => start("admin-one", { expectedRevision: -1 }), { status: 409 });
  session = act(session).playtest;
  assert.equal(session.acceptedCommands, 1);
  assert.throws(() => start("admin-one", { factionId: "unknown" }), { status: 422 });
  session = act(session).playtest;
  assert.equal(session.acceptedCommands, 2);
  assert.equal(publication.active().manifest.gameConfig.handSize, 8);
});

test("successful replacement retires only the same operator's previous session", (t) => {
  const { start, act } = fixture(t);
  const first = start(), other = start("admin-two"), replacement = start();
  assert.throws(() => act(first), { status: 404 });
  assert.throws(() => act(replacement, {}, "admin-two"), { status: 404 });
  assert.equal(act(other, {}, "admin-two").playtest.acceptedCommands, 1);
  assert.equal(act(replacement).playtest.acceptedCommands, 1);
});

test("rejected, stale and expired playtest commands never advance state or mark an untested draft", (t) => {
  let now = 100000;
  t.mock.method(Date, "now", () => now);
  const { publication, start, act } = fixture(t);
  const session = start();
  const before = publication.status();
  assert.throws(() => act(session, { command: { type: "unsupported", player: 1 } }), { status: 422 });
  assert.throws(() => act(session, { gameRevision: 99 }), { status: 409 });
  assert.throws(() => act(session, { command: { type: "passPriority", player: 1, __system: true } }), { status: 422 });
  assert.deepEqual(publication.status(), before);
  const accepted = act(session).playtest;
  assert.equal(accepted.game.revision, session.game.revision + 1);
  assert.throws(() => act(session), { status: 409 });
  const after = publication.status();
  now += 30 * 60 * 1000 + 1;
  assert.throws(() => act(accepted), { status: 404 });
  assert.deepEqual(publication.status(), after);
});

test("editing or discarding a draft invalidates prior playtest actions without publishing anything", (t) => {
  const { publication, start, act } = fixture(t);
  const initial = publication.active(), session = start();
  publication.patch({ expectedRevision: publication.status().revision, domain: "game", id: "shared-rules", field: "handSize", value: 6 }, "admin-two");
  assert.throws(() => act(session), { status: 409 });
  assert.equal(publication.status().draft.playtestedHash, null);
  const replacement = start();
  publication.discard({ expectedRevision: publication.status().revision });
  assert.throws(() => act(replacement), { status: 409 });
  assert.equal(publication.status().draft, null);
  assert.deepEqual(publication.active(), initial);
});
