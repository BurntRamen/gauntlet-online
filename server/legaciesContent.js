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
  }, {
    id: "jali",
    name: "Jali",
    status: "playable",
    tagline: "The bested rise. The formation answers.",
    identity: "Revenants · Revealed formations · Counterattacks",
    introduction: "The Jali turn defeat into a source of strength. Their fallen return as Revenants, disciplined formations reveal themselves at the decisive moment, and modest cards become dangerous once the boundary between the living and the remembered has opened.",
    philosophy: "A bested warrior leaves a place in the line, and a Revenant steps into it.",
    story: [
      { title: "Strength after defeat", text: "Jali doctrine treats a bested card as the beginning of the next exchange. Watane gathers Revenants from those losses and sends their strength back into the formation." },
      { title: "The revealed formation", text: "Basho rewards a player who establishes all three lanes, then accepts the risk of revealing that formation to the opponent. The Jali trade secrecy for another Revenant and a stronger counterattack." },
      { title: "Katana's answer", text: "Once a Revenant has appeared, Katana turns low-value cards into serious threats. The result is a faction that is most dangerous immediately after it appears to have lost ground." }
    ],
    gameplay: "In Gauntlet, a Jali card is bested when an attacker is fully blocked or a blocker is overcome. Each such defeat creates a Revenant. Spend Revenants during priority to give cards +2 value, reveal a complete three-lane formation with Basho to create another, and use Katana to strengthen cards with printed value 8 or less after a Revenant is created that turn.",
    commander: {
      name: "Watane",
      ability: "The Bested Return",
      text: "Whenever a card you control is bested, create a Revenant. During your priority, destroy a Revenant to give a card you control +2 Value until end of turn."
    },
    city: {
      name: "Katana, Floating City",
      ability: "Revenant Ascension",
      text: "After you create a Revenant this turn, you may give each card you play with printed Value 8 or less +2 Value until end of turn. Each card can receive this bonus once."
    },
    generalRule: "Each player brings exactly one General. Basho is the first released Jali General; later Jali Generals can be added as alternative deck choices.",
    generalDraftNote: "Basho requires one face-down card in each of your three lanes. Revealing the formation makes those cards public and creates one Revenant. Basho can be used once per turn.",
    generals: [
      { id: "basho", name: "Basho", ability: "Call the Formation", identity: "Trade hidden information for Revenant momentum", text: "Once per turn during your priority, reveal the face-down card in each of your three lanes. If all three were face-down, create a Revenant." }
    ],
    festivals: [
      { name: "Revenant", text: "A persistent Jali resource created when one of your cards is bested. Watane spends it for +2 Value." },
      { name: "Revealed Formation", text: "Basho exposes all three lane cards to both players and creates a Revenant." },
      { name: "Counterattack", text: "Katana makes printed Values 8 and below dangerous after a Revenant is created." }
    ]
  }]
};

module.exports = { LEGACIES };
