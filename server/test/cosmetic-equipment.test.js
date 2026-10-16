const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), os = require("node:os"), crypto = require("node:crypto");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-equipment-"));
const accounts = ["simply", "Burnt Ramen", "Owner", "Other"].map((name, n) => ({ id: `${String(n + 1).repeat(8)}-${String(n + 1).repeat(4)}-4aaa-8aaa-${String(n + 1).repeat(12)}`, name, createdAt: "2026-01-01T00:00:00.000Z", stats: { economy: { gold: 50 } } }));
Object.assign(process.env, { NODE_ENV: "test", GAUNTLET_CONTENT_PROVIDER: "file", GAUNTLET_GOLD_MIGRATION: "legacy-opening-v1", ACCOUNT_DATA_FILE: path.join(root, "accounts.json"), MATCH_DATA_FILE: path.join(root, "matches.json"), GAUNTLET_CONTENT_DATA_DIR: path.join(root, "content"), GAUNTLET_ECONOMY_DATA_DIR: path.join(root, "economy"), ACCOUNT_AUTH_SECRET: "equipment-isolated-secret", ROOM_STATE_RECOVERY_ENABLED: "false", GAUNTLET_ADMIN_SIMPLY_ACCOUNT_ID: accounts[0].id, GAUNTLET_ADMIN_BURNT_RAMEN_ACCOUNT_ID: accounts[1].id });
for (const key of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "GAUNTLET_PARA_DATA_DIR"]) delete process.env[key];
fs.writeFileSync(process.env.ACCOUNT_DATA_FILE, JSON.stringify({ accounts }));
const { server, __test } = require("../index"), pub = __test.contentPublication, ledger = __test.goldEconomy, para = require("../paraLeague"), equipment = require("../cosmeticEquipment");
const { assetManifest } = require("../contentAssets"), { TITLE } = require("../digitalDelivery");
let origin;
test.before(async () => { await new Promise(r => server.listen(0, "127.0.0.1", r)); origin = `http://127.0.0.1:${server.address().port}`; });
test.after(async () => { await new Promise(r => server.close(r)); ledger.close(); fs.rmSync(root, { recursive: true, force: true }); });
async function api(route, body, who = 0) {
  const r = await fetch(origin + route, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", Connection: "close", ...(who === null ? {} : { Authorization: `Bearer ${__test.issueAccountSession(accounts[who]).token}` }) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: r.status, data: await r.json() };
}
async function author(action, body = {}) { const r = await api(`/api/admin/authoring/${action}`, { expectedRevision: pub.status().revision, ...body }); assert.equal(r.status, 200, JSON.stringify(r.data)); return r.data; }
const row = (domain, value) => author("para-draft", { operation: "create", domain, id: value.id, value: { ...para.newDefinition(domain), ...value } });
const me = async () => (await api("/api/auth/me", null, 2)).data.account;
test("Admin cosmetic bundle → owned equipment → real profile, deck and match projection → retirement/restart/refund", async () => {
  const images = assetManifest.entries.filter(a => a.mediaType.startsWith("image/")), sound = assetManifest.entries.find(a => a.mediaType.startsWith("audio/"));
  const terms = [["card-back", images[0].id], ["deck-box", images[1].id], ["faction-banner", images[2].id], ["profile-music", sound.id], ["profile-title", TITLE]];
  for (const [category, asset] of terms) await row("entitlements", { id: `style-${category}`, name: `Owned ${category}`, category, asset, provenance: "commercial", rightsReference: "Isolated first party test assets", fulfillment: "available" });
  await row("products", { id: "style-bundle", name: "Profile collection", category: "bundle", status: "active", pricing: "gold", goldPrice: 10, entitlements: terms.map(([c]) => `style-${c}`), startsAt: "2020-01-01T00:00:00.000Z", endsAt: "2099-01-01T00:00:00.000Z" });
  await author("preview"); await author("publish", { label: "Actual cosmetic destinations" });
  assert.equal((await api("/api/economy/equip", { slot: "title", entitlementId: "forged" }, null)).status, 401);
  assert.equal((await api("/api/economy/equip", { slot: "title", entitlementId: "forged" }, 2)).status, 403);
  const quote = ledger.quote(accounts[2], { key: crypto.randomUUID(), productId: "style-bundle" });
  const buy = await api("/api/economy/purchase", { key: crypto.randomUUID(), quoteId: quote.id }, 2); assert.equal(buy.status, 200, JSON.stringify(buy.data));
  const grants = ledger.accountGrants(accounts[2].id);
  for (const grant of grants) {
    const slot = equipment.SLOTS[grant.term.category];
    assert.equal((await api("/api/economy/equip", { slot, entitlementId: grant.id }, 3)).status, 403);
    const result = await api("/api/economy/equip", { slot, entitlementId: grant.id }, 2); assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.equal(result.data.account.profile.equipment[slot].name, grant.term.name);
  }
  const wrong = await api("/api/economy/equip", { slot: "music", entitlementId: grants[0].id }, 2); assert.equal(wrong.status, 403);
  const save = await api("/api/collection/save-constructed-deck", { name: "Equipped box", factionId: "rumin", cardQuantities: {} }, 2);
  assert.equal(save.status, 200, JSON.stringify(save.data));
  const before = await me(); assert.equal(before.economy.gold, 40); assert.equal(Object.keys(before.profile.equipment).length, 5);
  assert.deepEqual(before.stats.deckLibrary.decks[0].appearance, before.profile.equipment.deckBox);
  assert.ok(!before.stats.equipment); assert.equal(Object.keys(before.collection.gameplayEntitlements).length, Object.keys((await api("/api/auth/me", null, 3)).data.account.collection.gameplayEntitlements).length);
  const account = JSON.parse(fs.readFileSync(process.env.ACCOUNT_DATA_FILE)).accounts[2];
  const profile = __test.buildPublicPlayerProfile(account);
  assert.equal(profile.identity.selectedTitleName, "Owned profile-title"); assert.equal(profile.equipment.music.url, sound.path);
  assert.ok(!JSON.stringify(profile).includes(grants[0].id), "public presentation excludes private grant identity");
  const room = { roomCode: "EQUIP", lobby: { gameMode: "factions", players: { 1: { accountId: accounts[2].id, factionId: "rumin", profile: before.profile }, 2: { factionId: "sheen" } } } };
  __test.createGameFromLobby(room, { seed: "equipment-real-match" });
  assert.deepEqual(room.game.players[1].profile.equipment, before.profile.equipment);
  const captured = JSON.stringify(room.game);
  await author("para-draft", { operation: "archive", domain: "products", id: "style-bundle" }); await author("preview"); await author("publish", { label: "Retire cosmetics without revoking ownership" });
  assert.deepEqual((await me()).profile.equipment, before.profile.equipment);
  const child = require("node:child_process").spawnSync(process.execPath, ["-e", `const {server,__test}=require('./server/index');const a=require('./server/accountStore').read(process.env.ACCOUNT_DATA_FILE).accounts[2];const p=__test.buildPublicPlayerProfile(a);process.stdout.write('EQUIPMENT='+JSON.stringify(p.equipment)+'\\n');__test.goldEconomy.close();server.close();`], { cwd: path.resolve(__dirname, "../.."), env: process.env, encoding: "utf8", windowsHide: true, timeout: 15000 });
  assert.equal(child.status, 0, child.stderr); assert.deepEqual(JSON.parse(child.stdout.split("\n").find(l => l.startsWith("EQUIPMENT=")).slice(10)), before.profile.equipment);
  const refund = await api("/api/admin/economy/operate", { operation: "refund", purchaseId: grants[0].purchaseId, reason: "Refund isolated cosmetic collection", key: crypto.randomUUID() }, 1); assert.equal(refund.status, 200, JSON.stringify(refund.data));
  assert.deepEqual((await me()).profile.equipment, {}); assert.equal((await me()).economy.gold, 50);
  assert.equal(JSON.stringify(room.game), captured, "captured matches survive refund unchanged");
  const later = { roomCode: "EQUIP-LATER", lobby: structuredClone(room.lobby) }; __test.createGameFromLobby(later, { seed: "later" });
  assert.deepEqual(later.game.players[1].profile.equipment, {}, "a stale lobby cannot carry revoked appearance into a new match");
  assert.equal((await api("/api/economy/equip", { slot: "cardBack", entitlementId: grants[0].id }, 2)).status, 403);
  const reset = await api("/api/economy/equip", { slot: "cardBack", entitlementId: "default" }, 2); assert.equal(reset.status, 200);
});
test("expiry, category mismatch and changed asset metadata cannot present unowned equipment", () => {
  const grant = ledger.accountGrants(accounts[2].id)[0], active = { ...grant, state: "active" }, account = { stats: { equipment: { cardBack: grant.id } } };
  assert.ok(equipment.selected(account, [active]).cardBack);
  for (const invalid of [{ ...active, state: "expired" }, { ...active, state: "revoked" }, { ...active, term: { ...active.term, category: "deck-box" } }, { ...active, term: { ...active.term, delivery: { ...active.term.delivery, sha256: "changed" } } }]) assert.deepEqual(equipment.selected(account, [invalid]), {});
});

test("legacy progression and saved recipes cannot re-equip a back after its last ownership contribution is removed", () => {
  const stats = { progression: { cosmetics: { unlockedCardBacks: ["classic", "campaignMap"], selectedCardBack: "campaignMap" } } };
  __test.saveConstructedDeckToLibrary(stats, { name: "Back ownership", factionId: "rumin", cardQuantities: {}, cardBackId: "campaignMap" });
  assert.equal(__test.getSavedConstructedDeck(stats).cardBackId, "campaignMap");
  stats.progression.cosmetics.unlockedCardBacks = ["classic"];
  assert.equal(__test.getSavedConstructedDeck(stats).cardBackId, null);
  assert.equal(__test.buildPublicPlayerProfile({ id: "legacy", stats }).identity.selectedCardBack, "classic");
  assert.equal(stats.deckLibrary.decks[0].versions[0].cardBackId, "campaignMap", "historical saved reference remains unchanged");
});

test("real timed ledger grants expire at their boundary; shared art has independent equipment destinations", () => {
  const config = para.emptyConfig(), image = assetManifest.entries.find(a => a.mediaType.startsWith("image/"));
  for (const category of ["card-back", "deck-box"]) config.entitlements.push({ ...para.newDefinition("entitlements"), id: category, name: category, category, asset: image.id, duration: "days", durationDays: 1, provenance: "commercial", fulfillment: "available", rightsReference: "Isolated first party fixture" });
  config.products.push({ ...para.newDefinition("products"), id: "timed", name: "Timed art", category: "bundle", status: "active", pricing: "free", entitlements: ["card-back", "deck-box"], startsAt: "2020-01-01T00:00:00.000Z", endsAt: "2099-01-01T00:00:00.000Z" });
  let at = "2026-10-01T00:00:00.000Z";
  const store = require("../goldEconomy").createGoldEconomy({ filename: path.join(root, "timed.sqlite"), publication: { published: () => ({ id: "timed-release", snapshot: { paraLeague: config } }) }, now: () => at });
  try {
    const buyer = { id: "timed-player", stats: {} }, q = store.quote(buyer, { key: crypto.randomUUID(), productId: "timed" });
    const purchase = store.purchase(buyer, { key: crypto.randomUUID(), quoteId: q.id }); assert.equal(purchase.entitlementIds.length, 2);
    buyer.stats.equipment = { cardBack: purchase.entitlementIds[0], deckBox: purchase.entitlementIds[1] };
    const owned = equipment.selected(buyer, store.accountGrants(buyer.id)); assert.equal(Object.keys(owned).length, 2);
    at = "2026-10-01T23:59:59.999Z"; assert.deepEqual(equipment.selected(buyer, store.accountGrants(buyer.id)), owned);
    at = "2026-10-02T00:00:00.000Z"; assert.deepEqual(equipment.selected(buyer, store.accountGrants(buyer.id)), {});
    assert.deepEqual(equipment.revalidate(owned, store.accountGrants(buyer.id)), {});
  } finally { store.close(); }
});
