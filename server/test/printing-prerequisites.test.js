const test = require("node:test"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const images = require("../authoredAssets");

test("patched proxy trust rejects the advisory's overbroad IPv4-mapped subnet", () => {
  const proxy = require("proxy-addr");
  assert.equal(proxy.compile(["::ffff:10.0.0.0/8"])("203.0.113.7"), false);
  assert.equal(proxy.compile(["10.0.0.0/8"])("10.2.3.4"), true);
  assert.equal(proxy.compile(["10.0.0.0/8"])("203.0.113.7"), false);
});

test("capacity counts unique retained bytes and versions separately; reuse does not charge bytes twice", async () => {
  const sharp = require("sharp");
  const data = (await sharp({ create: { width: 32, height: 32, channels: 3, background: "red" } }).png().toBuffer()).toString("base64");
  const input = { title: "Capacity", description: "", notes: "", data };
  const processed = await images.processUpload(input), state = { releases: {}, uploads: [], assetBlobs: {} };
  const a = images.insert(state, input, processed, "admin");
  const b = images.insert(state, input, processed, "admin");
  state.releases.r1 = { snapshot: { assetVersions: [a, b] } };
  state.releases.r2 = { snapshot: { assetVersions: [a] } };
  let usage = images.capacity(state);
  assert.equal(usage.storedBytes, a.bytes); assert.equal(usage.versionCount, 2); assert.equal(usage.uniqueBlobCount, 1);
  assert.equal(usage.remainingBytes, images.MAX_STORED - a.bytes);
  assert.ok(usage.encodedBytes > usage.storedBytes); assert.ok(usage.metadataBytes > 0);
  state.uploads[0].archived = true;
  assert.equal(images.capacity(state).storedBytes, usage.storedBytes);
  // Trusted-store fixture fills the remaining byte allowance without altering
  // referenced versions. Ingress still performs real decoding above.
  state.assetBlobs.capacityFixture = Buffer.alloc(images.MAX_STORED - a.bytes).toString("base64");
  const other = await images.processUpload({ ...input, data: (await sharp({ create: { width: 32, height: 32, channels: 3, background: "blue" } }).png().toBuffer()).toString("base64") });
  assert.throws(() => images.insert(state, input, other, "admin"), /6 MiB/);
  images.insert(state, input, processed, "admin");
  assert.equal(images.capacity(state).storedBytes, images.MAX_STORED);
  state.uploads = [{ versions: Array.from({ length: 500 }, (_, index) => ({ ...a, id: `image-version-${crypto.randomUUID()}`, version: index + 1 })) }];
  state.releases = {};
  assert.throws(() => images.insert(state, input, processed, "admin"), /500 retained image versions/);
});
