"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { campaignChapters } = require("../gameContent");

test("every Astral Vanguard chapter has checked-in per-line authored dialogue", () => {
  const chapters = campaignChapters["astral-vanguard"];
  assert.equal(chapters.length, 12);
  for (const chapter of chapters) {
    assert.equal(chapter.dialogueTrack, null);
    assert.equal(chapter.endDialogueTrack, null);
    for (const [linesKey, audioKey] of [["dialogue", "dialogueAudio"], ["endDialogue", "endDialogueAudio"]]) {
      assert.equal(chapter[audioKey].length, chapter[linesKey].length, `${chapter.id} ${audioKey} must cover every line`);
      for (const source of chapter[audioKey]) {
        assert.match(source, /^\/assets\/gauntlet\/voices\/astral-vanguard-ch\d{2}-.+\.mp3$/);
        const localPath = path.join(__dirname, "..", "..", "client", "public", source.replace(/^\//, ""));
        assert.equal(fs.existsSync(localPath), true, `${source} must exist`);
        assert.ok(fs.statSync(localPath).size > 2_000, `${source} must contain recorded speech`);
      }
    }
  }
});
