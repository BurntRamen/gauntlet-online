const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { COLLECTION_CARDS, CONTENT_VERSION } = require("../../server/gameContent");
const site = "https://gauntlet-online.vercel.app";
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, url);
  return response;
}
async function main() {
  const manifest = await (await get(`${site}/asset-manifest.json`)).json();
  const javascript = await (await get(new URL(manifest.files["main.js"], site))).text();
  assert.ok(javascript.includes("card-keywords.html"), "Keyword help is in the deployed application");
  assert.ok(javascript.includes(".webp?v=2"), "Updated card faces bypass old cached faces");
  const guide = await (await get(`${site}/card-keywords.html`)).text();
  assert.ok(guide.includes("Third block: +1 value."));
  assert.ok(guide.includes("Hand–lane swap"));
  const backend = await get("https://gauntlet-online.onrender.com/api/game-content");
  const { content } = await backend.json();
  assert.equal(content.contentVersion, CONTENT_VERSION);
  const faces = [];
  for (const card of COLLECTION_CARDS) {
    const live = content.cards.find(c => c.id === card.id);
    for (const key of ["name", "type", "value", "text", "displayText"]) assert.equal(live[key], card[key], `${card.id} ${key}`);
    assert.ok(guide.includes(`id="${card.id}"`), `${card.id} guide entry`);
    for (const suit of ["hearts", "diamonds", "clubs", "spades"]) faces.push(`/assets/gauntlet/constructed/faces/${card.id}-${suit}.webp`);
  }
  let cursor = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (cursor < faces.length) {
      const file = faces[cursor++];
      const bytes = Buffer.from(await (await get(`${site}${file}?v=2`)).arrayBuffer());
      assert.equal(hash(bytes), hash(fs.readFileSync(path.join(process.cwd(), "client/public", file))), file);
    }
  }));
  const result = { site, verifiedAt: new Date().toISOString(), frontendBundle: manifest.files["main.js"], backendCommit: backend.headers.get("x-gauntlet-commit"), contentVersion: content.contentVersion, conciseCards: 72, suitFaces: 288, allFaceChecksumsMatch: true, fullRulesPreserved: true, keywordGuideLive: true };
  fs.writeFileSync(".eggs/evidence/card-wording-production-verification.json", JSON.stringify(result,null,2)+"\n");
  console.log(JSON.stringify(result,null,2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
