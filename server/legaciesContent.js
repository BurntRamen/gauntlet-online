"use strict";

// Author-provided lore and near-final Gauntlet drafts. Keep release status
// explicit so content previews cannot accidentally enter matchmaking.
const LEGACIES = {
  id: "legacies",
  number: 2,
  name: "Legacies",
  factions: [{
    id: "mekan",
    name: "Mekan",
    status: "playable",
    tagline: "One more song. One more dance.",
    identity: "Joyful undead · Discard synergy · Remembrance",
    introduction: "In San Mikal, death is another stage of existence. Decorated skeletons dance through streets filled with flowers, lanterns, music, and returning ancestors. The dead are honored guests, invited to celebrate rather than bound to serve.",
    philosophy: "Other factions see spent resources. The Mekan see the guest list.",
    story: [
      { title: "A city around its ancestors", text: "After generations of wandering, the Mekan reached a flower-ringed lake. A vision from their ancestors led them to found San Mikal where the living and the dead could meet. Markets, homes, and festival grounds grew around its great ceremonial burial complex." },
      { title: "The discovery of Recursion", text: "Ceremonies allowed departed relatives, musicians, and warriors to return. Spiritual leaders learned to repeat these reunions, but established a principle: returning should be a celebration, never an imprisonment. The dead are Guests." },
      { title: "The price of an endless celebration", text: "Allegro, Celebrator of Life, leads the modern Mekan as ruler, conductor, and ceremonial host. He believes generations live on through remembrance. His greatest challenge is keeping sacred Recursion from becoming a tool of conquest and armies that can never permanently die." }
    ],
    gameplay: "In Gauntlet, discarded and defeated cards become Guests. Match their suits or printed values to strengthen later plays. The Mekan reward careful sequencing and comebacks, without making constant resurrection part of every turn.",
    commander: {
      name: "Allegro, Celebrator of Life",
      ability: "Encore / Celebrate",
      text: "Encore — Once per turn, after one of your cards is discarded to pay a cost, you may mark that card as a Guest. Celebrate — Once per turn, when you play a card that shares a value or suit with a Guest in your discard pile, that card gets +1 Value until end of turn."
    },
    city: {
      name: "San Mikal, Burial Ground",
      ability: "The Guests Return",
      text: "Once per turn, when one of your cards is defeated, you may designate it as a Guest. When you play a card with the same printed Value as one of your Guests, you may remove that Guest from your discard pile from the game. If you do, the played card gets +1 Value until end of turn."
    },
    generalRule: "Each player brings exactly one General, chosen when building their deck. These are alternative choices, not five Generals in play together.",
    generalDraftNote: "Ranked draft rules use one General for your whole side of the table. Acama requires an occupied lane; Ahu rewards a resolved blocked combat. General selection is locked when the match starts.",
    generals: [
      { id: "acama", name: "Acama, Founder of the Celebration", ability: "Festival Foundations", identity: "Preparation and careful draws", text: "Once per turn, when you place a card face-down in Acama's lane, you may look at the top card of your deck. You may place that card on the bottom of your deck." },
      { id: "hui", name: "Hui, Master of Ceremonies", ability: "Invite Everyone", identity: "Link new plays to past participants", text: "The first time each turn you play a card in Hui's lane that shares a suit with a card in your discard pile, it gets +1 Value until end of turn." },
      { id: "monti", name: "Monti, Keeper of the Eternal Festival", ability: "Grand Celebration", identity: "Reward spectacular, resource-heavy turns", text: "Once per turn, if you have discarded at least two cards this turn, target card in Monti's lane gets +1 Value until end of turn." },
      { id: "ahu", name: "Ahu, Leader of the Procession", ability: "Procession of the Dead", identity: "Turn combat victories into momentum", text: "Once per turn, after you win combat in Ahu's lane, look at the top two cards of your deck. Put one on top and one on the bottom. If you discarded a Guest during that combat, the winning card gets +1 Value until end of turn." },
      { id: "temo", name: "Temo, Caller of the Departed", ability: "One More Dance", identity: "Make defeat the start of a comeback", text: "Once per turn, when one of your cards in Temo's lane is defeated, the next card you play in this lane this turn gets +1 Value." }
    ],
    festivals: [
      { name: "Day of the Dancing Dead", text: "San Mikal's great celebration thins the boundary between worlds, welcoming countless Guests." },
      { name: "Spectral Symphony", text: "Living and departed musicians perform together across generations." },
      { name: "Luminous Lanterns", text: "Thousands of lights guide departed spirits home to the celebration." },
      { name: "Jade Ball Tournament", text: "Living and departed spectators gather for an ancient ceremonial ball game." },
      { name: "Procession of Spirits", text: "Guests parade through the city before returning to the afterlife." }
    ]
  }]
};

module.exports = { LEGACIES };
