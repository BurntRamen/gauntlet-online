import {
  LocalMatchConflictError,
  createLocalMatchLibrary,
  createLocalMatchRecorder,
  createMemoryMatchBackend,
  downloadCanonicalMatch,
  inspectMatchJson,
  mergeMatchHistory,
  saveCompletedMatchFromServer
} from "./matchHistory";

const {
  applyCommand,
  createCommandEnvelope,
  createMatch
} = require("@gauntlet/duel-rules");

const MATCH_ID = "11111111-1111-4111-8111-111111111111";

function localArtifact() {
  const startedAt = "2026-08-09T12:00:00.000Z";
  const completedAt = "2026-08-09T12:01:00.000Z";
  const game = createMatch({
    seed: "portable-local-test",
    matchId: MATCH_ID,
    gameMode: "factions",
    playerNames: { 1: "Local Alpha", 2: "Local Beta" },
    factions: { 1: { id: "rumin", name: "Rumin" }, 2: { id: "sheen", name: "Sheen" } }
  }).state;
  const recorder = createLocalMatchRecorder({ initialGame: game, playerNames: { 1: "Local Alpha", 2: "Local Beta" }, startedAt });
  const actor = game.priority;
  const envelope = createCommandEnvelope(game, actor, { type: "concede", player: actor }, `${MATCH_ID}:concede`);
  const result = applyCommand(game, envelope);
  expect(result.accepted).toBe(true);
  recorder.recordAccepted(result.state, envelope);
  return recorder.buildRecord(result.state, completedAt);
}

test("local completion produces the same validated record-v2 JSON and client replay contract", () => {
  const artifact = localArtifact();
  const inspection = inspectMatchJson(artifact.json);
  expect(inspection.artifact.record.recordVersion).toBe(2);
  expect(inspection.artifact.sha256).toBe(artifact.sha256);
  expect(inspection.replay.availability).toMatchObject({ available: true, mode: "public-state-frames" });
  expect(inspection.preview.evidenceCount).toBeGreaterThan(0);
  expect(inspection.preview.replayFrameCount).toBeGreaterThan(0);
});

test("local library persists canonical JSON idempotently and rejects same-ID hash conflicts", async () => {
  const library = createLocalMatchLibrary({ backend: createMemoryMatchBackend() });
  const artifact = localArtifact();
  const first = await library.save(artifact.json, { source: "local-completion" });
  const duplicate = await library.save(artifact.json, { source: "manual-import" });
  expect(first.status).toBe("saved");
  expect(duplicate.status).toBe("already-saved");
  expect((await library.list())[0].canonicalJson).toBe(artifact.json);

  const changed = JSON.parse(artifact.json);
  changed.turnCount += 1;
  await expect(library.save(changed)).rejects.toBeInstanceOf(LocalMatchConflictError);
  expect((await library.get(MATCH_ID)).sha256).toBe(artifact.sha256);
});

test("import fails closed for malformed JSON, unsupported versions, privacy leaks, and frame checksum changes", () => {
  const artifact = localArtifact();
  expect(() => inspectMatchJson("not-json")).toThrow(expect.objectContaining({ code: "INVALID_JSON" }));

  const unsupported = JSON.parse(artifact.json);
  unsupported.recordVersion = 3;
  expect(() => inspectMatchJson(unsupported)).toThrow(expect.objectContaining({ code: "UNSUPPORTED_RECORD_VERSION" }));

  const privateRecord = JSON.parse(artifact.json);
  privateRecord.sessionToken = "secret";
  expect(() => inspectMatchJson(privateRecord)).toThrow(expect.objectContaining({ code: "PRIVATE_ARCHIVE_FIELD" }));

  const corruptFrame = JSON.parse(artifact.json);
  corruptFrame.publicReplayFrames[0].publicState.turn += 1;
  expect(() => inspectMatchJson(corruptFrame)).toThrow(expect.objectContaining({ code: "FRAME_CHECKSUM_MISMATCH" }));
});

test("account references merge with local full records without attaching imports to account state", async () => {
  const artifact = localArtifact();
  const library = createLocalMatchLibrary({ backend: createMemoryMatchBackend() });
  const account = { id: "99999999-9999-4999-8999-999999999999", wins: 4 };
  await library.save(artifact.json, { source: "manual-import" });
  const merged = mergeMatchHistory({
    matches: [],
    unavailableMatchReferences: [{ matchId: MATCH_ID, recordVersion: 2, completedAt: artifact.record.completedAt }]
  }, await library.list(), account.id);
  expect(merged.matches).toHaveLength(1);
  expect(merged.matches[0].local.saved).toBe(true);
  expect(merged.unavailableMatchReferences).toHaveLength(0);
  expect(account).toEqual({ id: "99999999-9999-4999-8999-999999999999", wins: 4 });
});

test("live completion downloads authorized canonical JSON into the same local library", async () => {
  const artifact = localArtifact();
  const library = createLocalMatchLibrary({ backend: createMemoryMatchBackend() });
  const fetchImpl = jest.fn().mockResolvedValue({ ok: true, text: async () => artifact.json });
  const result = await saveCompletedMatchFromServer({
    serverUrl: "https://api.gauntlet.test",
    matchId: MATCH_ID,
    authToken: "session-token",
    library,
    fetchImpl
  });
  expect(result.status).toBe("saved");
  expect(fetchImpl).toHaveBeenCalledWith(`https://api.gauntlet.test/api/matches/${MATCH_ID}/archive`, {
    headers: { Authorization: "Bearer session-token" }
  });
  expect((await library.get(MATCH_ID)).canonicalJson).toBe(artifact.json);
});

test("JSON export uses the exact stored canonical bytes and portable filename", async () => {
  const artifact = localArtifact();
  const link = { click: jest.fn(), remove: jest.fn() };
  const documentImpl = { createElement: jest.fn(() => link), body: { appendChild: jest.fn() } };
  let exportedBlob;
  const urlImpl = {
    createObjectURL: jest.fn((blob) => { exportedBlob = blob; return "blob:match"; }),
    revokeObjectURL: jest.fn()
  };
  downloadCanonicalMatch({ matchId: MATCH_ID, canonicalJson: artifact.json }, documentImpl, urlImpl);
  expect(link.download).toBe(`gauntlet-match-${MATCH_ID}.json`);
  expect(link.click).toHaveBeenCalled();
  expect(exportedBlob.size).toBe(artifact.byteSize);
});
