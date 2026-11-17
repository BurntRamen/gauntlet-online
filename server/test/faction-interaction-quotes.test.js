const test = require("node:test");
const assert = require("node:assert/strict");

const { getFactionById, listFactions } = require("../gameContent");

test("every playable commander, city, and general has a rotating quote pool and distinct voice identity", () => {
  const factions = listFactions();
  assert.equal(factions.length, 23);

  const identityIds = new Set();
  for (const faction of factions) {
    for (const [role, feature] of [["commander", faction.commander], ["city", faction.city]]) {
      assert.ok(feature, `${faction.id} is missing its ${role}`);
      assert.ok(Array.isArray(feature.interactionQuotes), `${faction.id} ${role} needs a quote pool`);
      assert.ok(feature.interactionQuotes.length >= 3, `${faction.id} ${role} needs at least three quotes`);
      assert.equal(new Set(feature.interactionQuotes).size, feature.interactionQuotes.length, `${faction.id} ${role} repeats a quote`);
      assert.ok(feature.voiceStyle?.id, `${faction.id} ${role} needs a stable voice identity`);
      assert.ok(!identityIds.has(feature.voiceStyle.id), `${feature.voiceStyle.id} is shared by two entities`);
      identityIds.add(feature.voiceStyle.id);
    }

    const generals = faction.generals || [faction.general];
    for (const general of generals.filter(Boolean)) {
      assert.ok(general.interactionQuotes.length >= 3, `${faction.id} ${general.name} needs at least three quotes`);
      assert.equal(new Set(general.interactionQuotes).size, general.interactionQuotes.length, `${faction.id} ${general.name} repeats a quote`);
      assert.ok(general.voiceStyle?.id, `${faction.id} ${general.name} needs a stable voice identity`);
      assert.ok(!identityIds.has(general.voiceStyle.id), `${general.voiceStyle.id} is shared by two entities`);
      identityIds.add(general.voiceStyle.id);
      if (general.id) assert.equal(getFactionById(faction.id, general.id)?.general?.voiceStyle?.id, general.voiceStyle.id);
    }
  }

  assert.equal(identityIds.size, 73);
});

test("all five Mekan generals retain their own authored lines", () => {
  const mekan = getFactionById("mekan");
  assert.deepEqual(mekan.generals.map((general) => general.id), ["acama", "hui", "monti", "ahu", "temo"]);
  assert.equal(new Set(mekan.generals.flatMap((general) => general.interactionQuotes)).size, 15);
});
