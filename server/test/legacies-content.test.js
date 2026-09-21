const test = require("node:test");
const assert = require("node:assert/strict");
const { getPublicGameContent, getFactionById } = require("../gameContent");

test("publishes playable Mekan and its five mutually exclusive General choices", () => {
  const content = getPublicGameContent();
  const legacies = content.upcomingSets.find((set) => set.id === "legacies");
  assert.equal(legacies.number, 2);
  const mekan = legacies.factions.find((faction) => faction.id === "mekan");
  assert.equal(mekan.status, "playable");
  assert.deepEqual(mekan.generals.map((general) => general.id), ["acama", "hui", "monti", "ahu", "temo"]);
  assert.equal(content.factions.some((faction) => faction.id === "mekan"), true);
  assert.equal(getFactionById("mekan").general.id, "monti");
  assert.equal(getFactionById("mekan", "hui").general.id, "hui");
  assert.equal(getFactionById("mekan", "forged"), null);
});
