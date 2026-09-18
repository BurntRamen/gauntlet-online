const test = require("node:test");
const assert = require("node:assert/strict");
const { getPublicGameContent, getFactionById } = require("../gameContent");

test("publishes the Mekan draft without admitting an unfinished faction to live games", () => {
  const content = getPublicGameContent();
  const legacies = content.upcomingSets.find((set) => set.id === "legacies");
  assert.equal(legacies.number, 2);
  const mekan = legacies.factions.find((faction) => faction.id === "mekan");
  assert.equal(mekan.status, "preview");
  assert.deepEqual(mekan.generals.map((general) => general.id), ["acama", "hui", "monti", "ahu", "temo"]);
  assert.equal(content.factions.some((faction) => faction.id === "mekan"), false);
  assert.equal(getFactionById("mekan"), null);
});
