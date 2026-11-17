"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { campaignChapters } = require("../server/gameContent");

const TARGETS = [
  "rumin", "sheen", "astral-vanguard", "mekan", "jali", "gracus", "indela", "voltari", "morphlings",
  "ingles", "mercaw", "mtano", "russo", "khevar", "vardun", "qhantari", "sahravi", "intari", "thalassari"
];

const IDENTITIES = {
  rumin: "disciplined reptilian legionaries with dry chest resonance, deliberate martial breath, and civic authority rather than a monster growl",
  sheen: "plantlike people with warm woody resonance, soft leaf-and-reed texture, patient pauses, and emotion that grows organically rather than sounding human in costume",
  "astral-vanguard": "natural human expedition personnel: grounded, varied, intimate under pressure, and never processed like robots or generic military radio",
  mekan: "warm ceremonial voices shaped by brass, breath, drums, laughter, and grief; festive without caricature and solemn without losing color",
  jali: "celestial island warriors whose precise speech carries wind, lacquer, memory, and restrained spirit resonance without imitating any real-world accent",
  gracus: "stone-bodied philosophers with mineral depth, clean intellectual diction, and faint resonant overtones that never become a gravelly monster cliché",
  indela: "elemental scholar-mages with lucid, curious delivery and subtle warmth-or-frost texture tied to temperament rather than a real-world accent",
  voltari: "human-descended posthumans with calm precision, layered harmonic undertones, and retained breath and feeling; optimized but explicitly not robotic",
  morphlings: "former human Vanguard subjects whose voices preserve recognizable personality through painful organic changes, asymmetrical breath, and resilient warmth rather than horror snarls",
  ingles: "formal avian islanders with crisp public diction, feather-light breath, institutional confidence, and private moral hesitation without a copied historical accent",
  mercaw: "independent avian frontier voices with quick alert cadence, open air in the tone, practical humor, and coalition energy rather than a bird squawk",
  mtano: "elephant-like people with deep chest and sinus resonance, measured memory-rich cadence, gentle power, and no animal imitation",
  russo: "bear-like winter survivors with broad warm resonance, economical speech, communal steadiness, and no copied national accent",
  khevar: "jackal-like river judges with dry ceremonial resonance, exact diction, audible patience, and a public-court gravity free of cultural caricature",
  vardun: "wolf-like fjord clans with wind-carved resonance, saga rhythm, candid emotion, and no copied Scandinavian accent or animal growl",
  qhantari: "high-mountain relay keepers with bright carrying tone, efficient breath, careful listening, and the cadence of messages checked at every station",
  sahravi: "gazelle-like caravan scholars with graceful alertness, lucid contractual diction, warm social intelligence, and no copied regional accent",
  intari: "condor-like mountain builders with spacious breath, solar warmth, collective ceremonial weight, and no imitation of a real-world Indigenous accent",
  thalassari: "amphibious maritime traders with fluid resonance, controlled diplomatic color, subtle tide-like phrasing, and no wet monster effects"
};

function parseSpeaker(line) {
  return String(line).slice(0, String(line).indexOf(":"));
}

function vote(votes, speaker, role, weight = 1) {
  if (!speaker) return;
  votes[speaker] ||= { narrator: 0, protagonist: 0, ally: 0, antagonist: 0 };
  votes[speaker][role] += weight;
}

function speakerRoles(chapters) {
  const votes = {};
  for (const chapter of chapters) {
    const before = chapter.dialogue || [];
    const after = chapter.endDialogue || [];
    before.forEach((line, index) => {
      const speaker = parseSpeaker(line);
      if (/^(Narrator|Epilogue)$/i.test(speaker)) vote(votes, speaker, "narrator", 9);
      else vote(votes, speaker, index === 2 ? "antagonist" : index === 3 ? "ally" : "protagonist", index === 1 || index === 4 ? 3 : 1);
    });
    after.forEach((line, index) => {
      const speaker = parseSpeaker(line);
      if (/^(Narrator|Epilogue)$/i.test(speaker)) vote(votes, speaker, "narrator", 9);
      else vote(votes, speaker, index === 1 ? "antagonist" : index === 2 ? "ally" : "protagonist", index <= 3 ? 2 : 1);
    });
  }
  return Object.fromEntries(Object.entries(votes).map(([speaker, scores]) => {
    const role = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
    return [speaker, role];
  }));
}

function voiceDefinitions(factionId) {
  const identity = IDENTITIES[factionId];
  return {
    narrator: {
      name: `${factionId} Chronicle Narrator`,
      description: `An original fictional narrator for a campaign about ${identity}. Grounded low-mid register, vivid but restrained storytelling, excellent clarity, and no imitation of a real performer.`,
      previewText: "History does not enter a battlefield alone. It arrives through the people who remember what every victory cost, what every silence concealed, and what the survivors still refuse to surrender."
    },
    protagonist: {
      name: `${factionId} Campaign Protagonist`,
      description: `An original lead character voice from a people described as ${identity}. Decisive, emotionally specific, naturally paced, never a stock hero, and never an imitation of a real performer.`,
      previewText: "We are not here to repeat the answer we inherited. We are here to discover what it asks of us now, and to leave the people beside us enough freedom to answer differently tomorrow."
    },
    ally: {
      name: `${factionId} Campaign Counselor`,
      description: `An original ally and counselor voice from a people described as ${identity}. Observant, humane, distinct from the protagonist, capable of disagreement without losing warmth, and never an imitation of a real performer.`,
      previewText: "The fastest answer can still leave the wrong person carrying its weight. Listen once more before we move, because the voice at the edge of the council may be the one that survives our decision."
    },
    antagonist: {
      name: `${factionId} Campaign Opposition`,
      description: `An original opposing voice suited to a campaign about ${identity}. Intelligible, persuasive, unsettling through conviction rather than shouting, distinct from the other roles, and never an imitation of a real performer.`,
      previewText: "You call your hesitation wisdom because you have not yet paid the price of waiting. When the hour closes around you, conviction will be the only mercy your frightened people understand."
    }
  };
}

function buildManifest(factionId) {
  const chapters = campaignChapters[factionId];
  if (!chapters?.length) throw new Error(`Missing campaign: ${factionId}`);
  return {
    schemaVersion: 1,
    factionId,
    voiceDesignModelId: "eleven_multilingual_ttv_v2",
    speechModelId: "eleven_multilingual_v2",
    outputFormat: "mp3_44100_128",
    stagingDirectory: `artifacts/elevenlabs-campaign-voices/${factionId}-refined`,
    publicDirectory: "client/public/assets/gauntlet/voices",
    provenanceDirectory: `docs/generated-assets/elevenlabs-campaign-voices/${factionId}-refined`,
    contentRegistry: `server/campaignVoiceAssets/${factionId}.json`,
    voices: voiceDefinitions(factionId),
    speakerVoices: speakerRoles(chapters)
  };
}

function main() {
  const root = path.resolve(__dirname, "..");
  for (const factionId of TARGETS) {
    const output = path.join(root, "scripts", `elevenlabs-${factionId}-campaign-refined.json`);
    fs.writeFileSync(output, `${JSON.stringify(buildManifest(factionId), null, 2)}\n`);
    console.log(path.relative(root, output));
  }
}

if (require.main === module) main();

module.exports = { TARGETS, buildManifest, speakerRoles };
