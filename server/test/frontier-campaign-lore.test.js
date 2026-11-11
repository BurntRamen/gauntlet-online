"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  FRONTIER_FACTIONS,
  FRONTIER_CAMPAIGNS,
  FRONTIER_CAMPAIGN_CHARACTERS
} = require("../frontierCampaigns");

test("Mercaw campaign centers Gerrick and preserves political divisions inside the revolution", () => {
  assert.equal(FRONTIER_FACTIONS.mercaw.commander.name, "Gerrick Warclaw");
  assert.equal(FRONTIER_CAMPAIGNS.mercaw.length, 12);
  assert.ok(FRONTIER_CAMPAIGNS.mercaw.some((chapter) => /loyalist/i.test(`${chapter.story} ${chapter.sceneStarter.perspective} ${chapter.opponentName}`)));
  assert.ok(FRONTIER_CAMPAIGNS.mercaw.some((chapter) => /promis/i.test(`${chapter.story} ${chapter.sceneStarter.perspective}`)));
  assert.equal(FRONTIER_CAMPAIGN_CHARACTERS.mercaw.gerrick.role, "Commander of the Mercaw Revolution");
  assert.match(FRONTIER_CAMPAIGN_CHARACTERS.mercaw.mara.description, /without replacing Gerrick/i);
});
test("Ingles campaign is a generational chronicle rather than a single invented commander's story", () => {
  assert.equal(FRONTIER_CAMPAIGNS.ingles.length, 12);
  const perspectives = new Set(FRONTIER_CAMPAIGNS.ingles.map((chapter) => chapter.playableName));
  for (const figure of ["King Alfric the Learned", "Queen Elizara", "Queen Victoria Ashbourne", "Lord Arthur Wellington", "Elian Wren"]) {
    assert.ok(perspectives.has(figure), `${figure} should have a chapter perspective`);
  }
  assert.match(FRONTIER_FACTIONS.ingles.reathArrival, /meeting place/i);
  assert.doesNotMatch(FRONTIER_FACTIONS.ingles.origin, /Reath/i);
});

test("Crossroads factions have distinct origins, complete campaigns, and playable mechanics", () => {
  const expectations = {
    khevar: ["Neshara", "Judgment", /grain reserve/i],
    vardun: ["Skeldheim", "Oath", /challengeable oaths/i],
    qhantari: ["Ayara", "Relay", /landslide/i],
    sahravi: ["Taziri", "Commission", /three merchant houses/i]
  };
  for (const [factionId, [homeworld, mechanic, openingStory]] of Object.entries(expectations)) {
    const faction = FRONTIER_FACTIONS[factionId];
    const campaign = FRONTIER_CAMPAIGNS[factionId];
    assert.equal(faction.homeworld, homeworld);
    assert.equal(faction.mechanic.name, mechanic);
    assert.doesNotMatch(faction.origin, /Reath/i);
    assert.match(faction.reathArrival, /Reath/);
    assert.equal(campaign.length, 12);
    assert.match(campaign[0].story, openingStory);
    assert.match(campaign.at(-1).story, new RegExp(`homeworld ${homeworld}`));
    assert.ok(Object.keys(FRONTIER_CAMPAIGN_CHARACTERS[factionId]).length >= 4);
  }
});
