const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-avatar-test-"));
process.env.NODE_ENV = "test";
process.env.ACCOUNT_AUTH_SECRET = "profile-avatar-test-secret";
process.env.ACCOUNT_DATA_FILE = path.join(testRoot, "accounts.json");
process.env.ACCOUNT_AVATAR_DATA_DIR = path.join(testRoot, "avatars");

const { server, __test } = require("../index");

test.after(() => {
  server.close();
  fs.rmSync(testRoot, { recursive: true, force: true });
});

test("stores a private portrait and exposes only the versioned profile route", async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Portrait Player", password: "long-test-password" })
  });
  assert.equal(registerResponse.status, 200);
  const registration = await registerResponse.json();

  const pngHeader = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
  const portrait = Buffer.concat([pngHeader, Buffer.alloc(256, 0x47)]);
  const uploadResponse = await fetch(`${baseUrl}/api/account/avatar`, {
    method: "PUT",
    headers: { authorization: `Bearer ${registration.token}`, "content-type": "image/png" },
    body: portrait
  });
  assert.equal(uploadResponse.status, 200);
  const uploaded = await uploadResponse.json();
  const avatar = uploaded.account.profile.avatar;
  assert.match(avatar.revision, /^[a-f0-9]{20}$/);
  assert.equal(avatar.mimeType, "image/png");
  assert.equal(Object.hasOwn(avatar, "storageKey"), false);

  const portraitResponse = await fetch(`${baseUrl}${avatar.path}`);
  assert.equal(portraitResponse.status, 200);
  assert.equal(portraitResponse.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await portraitResponse.arrayBuffer()), portrait);

  const staleResponse = await fetch(`${baseUrl}${avatar.path.replace(avatar.revision, "00000000000000000000")}`);
  assert.equal(staleResponse.status, 404);
});

test("carries safe portrait metadata from the lobby into the match snapshot", () => {
  const room = __test.createRoom();
  room.lobby.gameMode = "basic";
  room.lobby.players[1] = {
    ...room.lobby.players[1],
    connected: true,
    accountId: "11111111-1111-4111-8111-111111111111",
    accountName: "Portrait One",
    profile: { avatar: { revision: "11111111111111111111", mimeType: "image/webp", path: "/api/profiles/one/avatar?v=1" } }
  };
  room.lobby.players[2] = {
    ...room.lobby.players[2],
    connected: true,
    accountId: "22222222-2222-4222-8222-222222222222",
    accountName: "Portrait Two",
    profile: { avatar: { revision: "22222222222222222222", mimeType: "image/webp", path: "/api/profiles/two/avatar?v=2" } }
  };
  __test.createGameFromLobby(room, { seed: "portrait-propagation" });
  assert.deepEqual(room.game.players[1].profile, room.lobby.players[1].profile);
  assert.deepEqual(room.game.players[2].profile, room.lobby.players[2].profile);
});

test("uses the correct Supabase admin headers for legacy and current secret keys", () => {
  assert.deepEqual(__test.supabaseAdminAuthHeaders("sb_secret_current"), {
    apikey: "sb_secret_current"
  });
  assert.deepEqual(__test.supabaseAdminAuthHeaders("legacy-service-role-jwt"), {
    apikey: "legacy-service-role-jwt",
    Authorization: "Bearer legacy-service-role-jwt"
  });
});

test("uses Supabase Storage's service-key header contract", () => {
  assert.deepEqual(__test.supabaseStorageAuthHeaders("sb_secret_current"), {
    apikey: "sb_secret_current",
    Authorization: "Bearer sb_secret_current"
  });
  assert.deepEqual(__test.supabaseStorageAuthHeaders("legacy-service-role-jwt"), {
    apikey: "legacy-service-role-jwt",
    Authorization: "Bearer legacy-service-role-jwt"
  });
});

test("uses Supabase Storage's raw-upload cache directive for portraits", () => {
  assert.deepEqual(__test.accountAvatarUploadHeaders("image/webp"), {
    "Content-Type": "image/webp",
    "Cache-Control": "max-age=31536000",
    "x-upsert": "false"
  });
});

test("keeps the account-record portrait fallback private and reconstructable", () => {
  const pngHeader = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
  const bytes = Buffer.concat([pngHeader, Buffer.alloc(256, 0x31)]);
  const avatar = {
    revision: "1234567890abcdef1234",
    mimeType: "image/png",
    byteSize: bytes.length,
    updatedAt: "2026-08-28T00:00:00.000Z"
  };
  const stored = __test.inlineAccountAvatarRecord(avatar, bytes);
  const stats = { gamesPlayed: 2, profile: { avatar: stored } };

  assert.deepEqual(__test.readInlineAccountAvatar(stats, avatar), bytes);
  assert.equal(Object.hasOwn(__test.publicAccountStats(stats).profile.avatar, "inlineData"), false);
  assert.equal(__test.publicAccountStats(stats).gamesPlayed, 2);
});
