const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path"), crypto = require("node:crypto"), sharp = require("sharp");
const { createContentPublication } = require("../contentPublication");
const { createAuthoredBaseline, clone, pinGameContent } = require("../authoredContent");
const images = require("../authoredAssets");
const { createGitHubContentPublication } = require("../githubContentPublication");
const old = require("./fixtures/content-v2/authored-baseline-v1.json");
const baseline = createAuthoredBaseline({ domains: { decks: old.domains.decks }, game: { modes: old.domains.game } });
const cardId = "rumin-coin-scale-spear";
const fixtureImage = async (color = "#bb4422") => (await sharp({ create: { width: 96, height: 128, channels: 3, background: color } }).png().toBuffer()).toString("base64");
const upload = async (store, extra = {}) => store.uploadAsset({ expectedRevision: store.status().revision, title: "Private title", description: "Artwork description", notes: "Source notes are private", data: await fixtureImage(), ...extra }, "admin");
const patch = (store, id) => store.patch({ expectedRevision: store.status().revision, domain: "assets", id: `${cardId}:standard`, field: "art", value: id }, "admin");
function publish(store, label) { store.preview({ expectedRevision: store.status().revision }); return store.publish({ expectedRevision: store.status().revision, label }, "admin"); }
function captured(resolved) {
  const engine = require("../../shared/duel-rules");
  const initial = pinGameContent(engine.createMatch({ matchId: "asset-match", seed: "asset-match", gameMode: "factions", factions: { 1: resolved.factions.rumin, 2: resolved.factions.sheen } }).state, resolved);
  const game = require("../adminTestScenarios").applyScenario(initial, resolved, { version: 1, turn: 1, priority: 1, players: { 1: { factionId: "rumin", hand: [{ value: 4, suit: "diamonds", cardId }] }, 2: { factionId: "sheen" } } }, "asset-match").game;
  return { game, card: game.players[1].hand.find(c => c.gameplayCardId === cardId) };
}
test("actual upload bytes, exact draft, R1/R2 matches, retained replay, rollback and disk restart", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-images-"));
  try {
    let store = createContentPublication({ baseline, directory });
    const a = (await upload(store)).uploaded; assert.equal(a.version, 1);
    assert.notEqual(a.sha256, a.originalSha256, "decoded/normalized bytes have their own immutable integrity");
    assert.equal(store.status().draft, null); assert.throws(() => store.publicAsset(a.id, a.sha256), { status: 404 });
    patch(store, a.id);
    const savedRevision = store.status().revision, draft = store.playtestContent(savedRevision), draftMatch = captured(draft.resolved);
    assert.equal(draftMatch.card.presentation.illustrationAssetId, a.id);
    assert.equal(images.digest(Buffer.from(store.privateAsset(a.id).data, "base64")), a.sha256);
    let r1 = publish(store, "A release").activeReleaseId;
    const first = captured(store.active()); assert.equal(first.card.presentation.illustrationAssetId, a.id);
    const publicBoard = require("../adminTestScenarios").applyScenario(first.game, store.active(), { version: 1, turn: 1, priority: 1, players: { 1: { factionId: "rumin", hand: [{ value: 2, suit: "spades" }, { value: 14, suit: "hearts" }], support: [{ cardId, value: 4, suit: "diamonds" }, null, null] }, 2: { factionId: "sheen" } } }, "replay-art").game;
    const executed = require("../../shared/duel-rules").applyCommand(publicBoard, { type: "declareHandAttack", player: 1, cardId: publicBoard.players[1].hand[0].id, paymentCardIds: [publicBoard.players[1].hand[1].id], armWeaponCardIds: [publicBoard.lanes[0].support[1].id] });
    assert.equal(executed.accepted, true);
    const replay = require("../../shared/match-history/replay").buildPublicReplaySnapshot(executed.state);
    const b = (await upload(store, { assetId: a.assetId, data: await fixtureImage("#2266bb") })).uploaded;
    assert.equal(b.version, 2); assert.equal(b.assetId, a.assetId); assert.notEqual(b.sha256, a.sha256);
    assert.equal(store.active().manifest.cards.find(c => c.id === cardId).presentation.illustrationAssetId, a.id);
    patch(store, b.id); assert.equal(store.active().releaseId, r1);
    const r2 = publish(store, "B release").activeReleaseId;
    assert.equal(captured(store.active()).card.presentation.illustrationAssetId, b.id);
    const rooms = require("../roomStateStore").createRoomStateStore(path.join(directory, "rooms.json"));
    rooms.saveRooms([{ roomCode: "IMAGES", lobby: { players: { 1: { factionId: "rumin" }, 2: { factionId: "sheen" } } }, game: first.game }]);
    const reconnected = require("../roomStateStore").createRoomStateStore(path.join(directory, "rooms.json")).loadRooms()[0].game;
    assert.equal(reconnected.players[1].hand[0].presentation.illustrationAssetId, a.id);
    assert.equal(replay.handAttacks[0].attachedCards[0].presentation.illustrationAssetId, a.id);
    store.rollback({ expectedRevision: store.status().revision, releaseId: r1 }, "admin");
    assert.equal(captured(store.active()).card.presentation.illustrationAssetId, a.id);
    assert.equal(images.digest(store.publicAsset(b.id, b.sha256).body), b.sha256);
    store.archiveAsset({ expectedRevision: store.status().revision, assetId: a.assetId, archived: true });
    assert.equal(store.status().assetLibrary.find(row => row.id === b.id).archived, true);
    store = createContentPublication({ baseline, directory });
    assert.equal(store.active().releaseId, r1); assert.equal(images.digest(store.publicAsset(a.id, a.sha256).body), a.sha256);
    assert.equal(images.digest(store.publicAsset(b.id, b.sha256).body), b.sha256);
    const state = store.exportState(), assetPackage = images.packageAssets(state, state.releases[r1].snapshot);
    const packaged = { schemaVersion: "gauntlet.repository-release.v1", ...state.releases[r1], assetPackage };
    const standalone = createGitHubContentPublication({ baseline, token: "", deployedRelease: JSON.parse(JSON.stringify(packaged)), releaseFile: path.join(directory, "missing.json") });
    assert.equal(images.digest(standalone.publicAsset(a.id, a.sha256).body), a.sha256);
    assert.equal(images.digest(standalone.publicAsset(b.id, b.sha256).body), b.sha256, "retained R2 bytes are in the rollback package");
    assert.equal(state.releases[r2].snapshot.assetVersions[0].id, b.id);
    assert.ok(!JSON.stringify(packaged).includes("Source notes are private"));
    console.log(JSON.stringify({ uploadedA: a.bytes, uploadedB: b.bytes, packageBytes: Buffer.byteLength(JSON.stringify(packaged)), dependencies: assetPackage.dependencies.count }));
  } finally { assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep)); fs.rmSync(directory, { recursive: true, force: true }); }
});
test("decoding, size, format, animation, unknown fields and metadata fail closed", async () => {
  const store = createContentPublication({ baseline, memory: true });
  for (const data of [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>').toString("base64"), Buffer.from("<html>test</html>").toString("base64"), (await fixtureImage()).slice(0, 50), "YQ==", "!invalid", Buffer.alloc(images.MAX_UPLOAD + 1).toString("base64")]) await assert.rejects(upload(store, { data }), error => [413, 422].includes(error.status));
  await assert.rejects(upload(store, { filename: "../../escape.png" }), { status: 400 });
  await assert.rejects(upload(store, { title: "" }), { status: 422 });
  const oversized = await sharp({ create: { width: 4097, height: 20, channels: 3, background: "red" } }).png().toBuffer();
  await assert.rejects(upload(store, { data: oversized.toString("base64") }), { status: 422 });
  const animation = await sharp(Buffer.concat([Buffer.alloc(32 * 32 * 3, 120), Buffer.alloc(32 * 32 * 3, 20)]), { raw: { width: 32, height: 64, channels: 3, pageHeight: 32 } }).webp({ delay: [100, 100], loop: 0 }).toBuffer();
  assert.equal((await sharp(animation).metadata()).pages, 2);
  await assert.rejects(upload(store, { data: animation.toString("base64") }), { status: 422 });
  assert.equal(store.status().revision, 0);
});
test("idempotent retries, deduplicated bytes with separate identities, archive and optimistic revisions", async () => {
  const store = createContentPublication({ baseline, memory: true }), data = await fixtureImage(), requestId = crypto.randomUUID();
  const input = { expectedRevision: 0, requestId, title: "A", description: "", notes: "", data };
  const a = await store.uploadAsset(input, "admin"), repeated = await store.uploadAsset(input, "admin");
  assert.deepEqual(repeated.uploaded, a.uploaded); assert.equal(repeated.revision, a.revision);
  await assert.rejects(store.uploadAsset({ ...input, title: "Different" }, "admin"), { status: 409 });
  const b = (await upload(store, { data })).uploaded;
  assert.notEqual(a.uploaded.assetId, b.assetId); assert.equal(a.uploaded.sha256, b.sha256);
  assert.equal(Object.keys(store.exportState().assetBlobs).length, 1);
  await assert.rejects(upload(store, { expectedRevision: 0 }), { status: 409 });
  patch(store, b.id); store.preview({ expectedRevision: store.status().revision }); const stale = store.status().revision;
  store.archiveAsset({ expectedRevision: stale, assetId: b.assetId, archived: true });
  assert.throws(() => store.publish({ expectedRevision: stale, label: "Stale" }), { status: 409 });
  publish(store, "Archived reference remains valid"); assert.equal(store.publicAsset(b.id, b.sha256).body.length, b.bytes);
});
test("missing/corrupt bytes and interrupted activation leave the former release active", async () => {
  const store = createContentPublication({ baseline, memory: true }), a = (await upload(store)).uploaded;
  patch(store, a.id); store.preview({ expectedRevision: store.status().revision });
  const before = store.exportState();
  for (const replacement of [null, Buffer.from("corrupt").toString("base64")]) {
    const state = clone(before); if (replacement) state.assetBlobs[a.sha256] = replacement; else delete state.assetBlobs[a.sha256];
    const broken = createContentPublication({ baseline, memory: true, initialState: state });
    assert.equal(broken.status().validation.valid, false);
    assert.throws(() => broken.publish({ expectedRevision: state.revision, label: "Broken" }), { status: 422 });
    assert.equal(broken.active().releaseId, before.activeReleaseId);
  }
  const pack = images.packageAssets(before, before.draft.snapshot); delete pack.blobs[a.sha256];
  assert.throws(() => images.validatePackage(pack, before.draft.snapshot), { status: 422 });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-atomic-image-"));
  try {
    fs.writeFileSync(path.join(dir, "content-state.json"), JSON.stringify(before));
    const disk = createContentPublication({ baseline, directory: dir });
    const rename = fs.renameSync; fs.renameSync = () => { throw new Error("interrupted atomic commit"); };
    try { assert.throws(() => disk.publish({ expectedRevision: before.revision, label: "Interrupted" }), /interrupted/); } finally { fs.renameSync = rename; }
    assert.equal(createContentPublication({ baseline, directory: dir }).active().releaseId, before.activeReleaseId);
    assert.equal(disk.status().draft.snapshot.assetVersions[0].id, a.id);
  } finally { assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep)); fs.rmSync(dir, { recursive: true, force: true }); }
});
