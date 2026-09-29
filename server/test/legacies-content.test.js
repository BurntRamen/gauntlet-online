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

test("publishes playable Jali with the shared Watane, Basho, and Katana identity", () => {
  const content = getPublicGameContent();
  const jali = content.upcomingSets.find((set) => set.id === "legacies").factions.find((faction) => faction.id === "jali");
  assert.equal(jali.status, "playable");
  assert.equal(jali.commander.name, "Watane");
  assert.equal(jali.city.name, "Katana, Floating City");
  assert.deepEqual(jali.generals.map((general) => general.id), ["basho"]);
  assert.equal(content.factions.some((faction) => faction.id === "jali"), true);
  assert.equal(getFactionById("jali", "basho").general.id, "basho");
  assert.equal(getFactionById("jali", "forged"), null);
});

test("publishes playable Gracus and Indela with their shared draft leaders", () => {
  const content = getPublicGameContent();
  const legacies = content.upcomingSets.find((set) => set.id === "legacies");
  const gracus = legacies.factions.find((faction) => faction.id === "gracus");
  const indela = legacies.factions.find((faction) => faction.id === "indela");
  assert.equal(gracus.status, "playable");
  assert.equal(gracus.commander.name, "Epicura, Voice of the Arena");
  assert.equal(gracus.city.name, "Athun, Coastline of Giants");
  assert.deepEqual(gracus.generals.map((general) => general.id), ["platus"]);
  assert.equal(getFactionById("gracus", "platus").general.id, "platus");
  assert.equal(indela.status, "playable");
  assert.equal(indela.commander.name, "Katel, Magus Operandi");
  assert.equal(indela.city.name, "Kashi, Academy of Omens");
  assert.deepEqual(indela.generals.map((general) => general.id), ["ramar"]);
  assert.equal(getFactionById("indela", "ramar").general.id, "ramar");
});
