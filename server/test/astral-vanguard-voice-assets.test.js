"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { campaignChapters } = require("../gameContent");

test("every Astral Vanguard chapter has checked-in authored dialogue tracks", () => {
  const chapters = campaignChapters["astral-vanguard"];
  assert.equal(chapters.length, 12);
  for (const chapter of chapters) {
    for (const key of ["dialogueTrack", "endDialogueTrack"]) {
      assert.match(chapter[key], /^\/assets\/gauntlet\/voices\/astral-vanguard\/.+\.mp3$/);
      const localPath = path.join(__dirname, "..", "..", "client", "public", chapter[key].replace(/^\//, ""));
      assert.equal(fs.existsSync(localPath), true, `${chapter.id} ${key} must exist`);
      assert.ok(fs.statSync(localPath).size > 250_000, `${chapter.id} ${key} must contain a full recording`);
    }
  }
});
