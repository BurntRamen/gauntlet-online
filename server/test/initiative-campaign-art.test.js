"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { createHash } = require("node:crypto");
const path = require("node:path");
const { getPublicGameContent } = require("../gameContent");
const { applyInitiativeCampaignArt } = require("../../shared/duel-rules/resolveInitiativeArt");
const art = require("../../client/public/assets/gauntlet/campaigns/initiative-art-v2.json");

test("every Initiative mission has a distinct, decodable WebP container and its own scene in the briefing", () => {
  const source = getPublicGameContent().campaigns;
  const campaigns = applyInitiativeCampaignArt(source, art);
  const publicDir = path.resolve(__dirname, "../../client/public");
  const digests = new Set();
  for (const [id, faction] of Object.entries(art)) {
    const chapters = campaigns[id].chapters;
    assert.equal(chapters.length, 12);
    for (const chapter of chapters) {
      assert.equal(chapter.image, faction.chapters[chapter.id].image);
      if (chapter.cinematic) assert.equal(chapter.cinematic.image, chapter.image);
      const file = readFileSync(path.join(publicDir, chapter.image));
      assert.equal(file.toString("ascii", 0, 4), "RIFF");
      assert.equal(file.toString("ascii", 8, 12), "WEBP");
      digests.add(createHash("sha256").update(file).digest("hex"));
    }
  }
  assert.equal(digests.size, 48);
  assert.deepEqual(applyInitiativeCampaignArt(campaigns, art), campaigns);
});

test("older published references are upgraded while later authored images and other campaigns retain their artwork", () => {
  const scene = art.rumin.chapters["ides-of-rumie"];
  const old = scene.replaces[1];
  const custom = "/assets/custom/ides.webp";
  const other = { chapters: [{ id: "ides-of-rumie", image: old }] };
  const campaigns = { rumin: { coverImage: "custom-cover", chapters: [
    { id: "ides-of-rumie", image: old + "?v=abc", cinematic: { image: old, title: "Ides" } },
    { id: "ides-of-rumie", image: custom, cinematic: { image: old } },
    { id: "ides-of-rumie", image: old, cinematic: { image: custom } },
    { id: "extra", image: "extra.webp" }
  ] }, other };
  const result = applyInitiativeCampaignArt(campaigns, art);
  assert.equal(result.rumin.coverImage, "custom-cover");
  assert.deepEqual(result.rumin.chapters[0].cinematic, { image: scene.image, title: "Ides" });
  assert.equal(result.rumin.chapters[0].image, scene.image);
  assert.equal(result.rumin.chapters[1].image, custom);
  assert.equal(result.rumin.chapters[1].cinematic.image, custom);
  assert.equal(result.rumin.chapters[2].cinematic.image, custom);
  assert.equal(result.rumin.chapters[3], campaigns.rumin.chapters[3]);
  assert.equal(result.other, other);
  assert.equal(campaigns.rumin.chapters[0].cinematic.image, old);
});

test("Bizi refresh upgrades both original and first-release assignments without replacing the protected opening", () => {
  const previous = require("../../client/public/assets/gauntlet/campaigns/initiative-art-v1.json");
  const baseline = getPublicGameContent().campaigns;
  const firstRelease = applyInitiativeCampaignArt(baseline, previous);
  const refreshed = applyInitiativeCampaignArt(firstRelease, art);
  const chapters = refreshed.bizi.chapters;
  assert.equal(chapters[0].image, firstRelease.bizi.chapters[0].image);
  assert.equal(chapters.filter((chapter, i) => chapter.image !== firstRelease.bizi.chapters[i].image).length, 11);
  for (const { id, image } of chapters) assert.equal(image, art.bizi.chapters[id].image);
  for (const id of ["rumin", "sheen", "frumo"]) assert.deepEqual(refreshed[id], firstRelease[id]);
});
