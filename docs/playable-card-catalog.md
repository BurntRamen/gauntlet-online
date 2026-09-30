# Playable card catalog

Generated from the authoritative registry in `server/gameContent.js` at content version `gauntlet-content-v10` and rules version `gauntlet-rules-v2`.

Every playable faction receives a standard 52-card deck: one card of each rank (2–10, Jack, Queen, King, Ace) in each of the four suits (spades, hearts, diamonds, clubs). Constructed cards replace matching standard slots; they do not increase the deck above 52 cards.

Edit Commander, General, and City definitions in `server/gameContent.js`. The Legacies source text is in `server/legaciesContent.js`. Edit constructed cards in the faction card arrays in `server/gameContent.js`. Mechanical changes must also be reflected in `shared/duel-rules/`.

## Rumin

- Faction ID: `rumin`
- Standard playing cards: **52**
- Constructed replacement cards: **18**

### Faction cards

| Role | Name | Ability | Rules text |
|---|---|---|---|
| Commander | Kaiser, the Jewel | — | Your fourth attack each turn gets +3 value. |
| General | Meerus | — | Whenever you play your second attack each turn, you may play your third attack with cost 3 or less without paying its cost. |
| City | Rumie, City of the Empire | — | Each turn, the first two attacks you play after your first that share a suit with your previous attack get +1 value. |

### Constructed replacement cards

| Value | Type | Name | Card ID | Rules text |
|---:|---|---|---|---|
| 3 | armament | Capital Investment Spear | `rumin-gilded-scale-legionary` | Arm from a lane: attach to a hand attacker. If a diamond was paid this turn, that attacker gets +2 value this combat, then discard this. |
| 2 | armament | Stockbroker's Gloves | `rumin-forum-ledger-runner` | If this is your first attack this turn, you may treat one payment card as +1 value. |
| 4 | armament | Insurance Policy Plate | `rumin-vault-shield-bearer` | When blocking, prevent 1 damage if you overpaid for this block. |
| 4 | armament | Dividend Yield Blade | `rumin-coin-scale-spear` | Arm from lane: when you attack from hand, reveal this from your lane to attach it. The attacker gets +2 value this combat, then discard this. |
| 5 | armament | Hedge Fund Vest | `rumin-senate-vault-guard` | The first time each turn you overpay for this by 2 or more, gain 1 life. |
| 6 | armament | Corporate Banner | `rumin-marble-market-tribune` | After this attacks, your next Rumin armament armed from a lane gives an additional +1 value. |
| 6 | armament | Shareholder's Shield | `rumin-rumie-vault-shield` | Arm from lane: attach to a hand attacker. It gets +3 value this combat, then discard this. |
| 5 | armament | Profit Margin Spear | `rumin-imperial-scale-pike` | Arm from lane: attach to a hand attacker. It gets +2 value, or +4 if it shares a suit with your previous attack. |
| 7 | armament | Executive Authority Blade | `rumin-aurelian-clawblade` | Arm from lane: attach to a hand attacker. It gets +4 value this combat. If you overpaid by 2 or more, gain 1 life. |
| 6 | armament | Market Rally Drum | `rumin-basilisk-standard` | Your fourth attack each turn gets +2 additional value if an armament is armed to it. |
| 5 | armament | Board of Directors' Insignia | `rumin-jewel-bank-contract` | After this attacks or blocks, the next Rumin attack this turn may treat its single payment card as +2 value. |
| 2 | armament | Insider's Javelin | `rumin-tax-road-scout` | If this is your first attack this turn, it costs 1 less to play. |
| 5 | armament | Ballistic Shield | `rumin-marble-phalanx` | When this blocks from a lane, it gets +2 value. |
| 7 | armament | Diversified Portfolio | `rumin-counting-house-aegis` | The first time each turn you overpay for a Rumin card by 2 or more, gain 1 life. |
| 8 | armament | Asset Crusher | `rumin-triumphal-ram` | Arm from lane: attach to a hand attacker. It gets +4 value, or +5 if the attacker has value 8 or more. |
| 8 | armament | Battle Cry Horn | `rumin-edict-of-the-vault` | When paid for your fourth attack this turn, this pays +3 additional value. |
| 9 | armament | Unstoppable Investment Lance | `rumin-kaisers-gold-claw` | Arm from lane: attach to a hand attacker. It gets +5 value this combat, or +6 if it is your fourth attack this turn. |
| 10 | armament | Crown of Authority | `rumin-rumie-market-colossus` | When this attacks, each eligible Rumin armament you control in a lane may arm to it. Each armed armament gives an extra +1 value. |

## Sheen

- Faction ID: `sheen`
- Standard playing cards: **52**
- Constructed replacement cards: **18**

### Faction cards

| Role | Name | Ability | Rules text |
|---|---|---|---|
| Commander | Emperor Nu | — | Your blocking cards get +1 value. If it's your third or later time blocking, they get +2 instead. |
| General | Tang | — | Each turn, when you block for the second time, gain 2 life. |
| City | Beli, Living City | — | After your second block each turn, your next attack with cost 10+ gains +2 value. |

### Constructed replacement cards

| Value | Type | Name | Card ID | Rules text |
|---:|---|---|---|---|
| 3 | shelter | Root Haven | `sheen-rootwatch-initiate` | When this blocks, it gets +1 value if you have already blocked this turn. |
| 4 | shelter | Healing Hollow | `sheen-quiet-grove-sentinel` | If this prevents all damage from an attack, gain 1 life. |
| 2 | shelter | Negotiation Grounds | `sheen-mossbound-staff` | When paid for a block, the first blocking card gets +1 value. |
| 5 | shelter | Barkskin Bastion | `sheen-living-bark-guard` | This may block hand attacks as though it had +1 value. |
| 5 | shelter | Entwined Thicket | `sheen-beli-vinebinder` | After your second block each turn, your next attack gets +1 value. |
| 4 | shelter | Harmony Lab | `sheen-harmony-ward` | When paid for your second or later block each turn, this pays +1 additional value. |
| 6 | shelter | Thorned Refuge | `sheen-thornroot-counterstroke` | If you took no damage this turn, this gets +2 value while attacking. |
| 6 | shelter | Verdant Canopy | `sheen-beli-canopy-shield` | Once each turn, after you block, prevent 1 additional damage. |
| 7 | shelter | Verdant Dome | `sheen-nus-verdant-edict` | Your third block this turn gets +3 value instead of +2. |
| 5 | shelter | Eternal Archive | `sheen-roots-that-remember` | Whenever you gain life from blocking, your next block this turn gets +1 value. |
| 6 | shelter | Meditation Retreat | `sheen-tangs-patient-hand` | After your second block each turn, gain 1 life and draw a card at end of turn. |
| 2 | shelter | Sapling Sanctuary | `sheen-seedwall-acolyte` | When this blocks the first incoming attack each turn, it gets +1 value. |
| 4 | shelter | Rainfall Refuge | `sheen-raincall-mender` | After this blocks, gain 1 life if you took no damage from that attack. |
| 7 | shelter | Rootbind Refuge | `sheen-ringroot-bastion` | When this blocks from a lane, it gets +2 value. |
| 3 | shelter | Floral Canopy | `sheen-sapling-chorus` | When paid for your second or later block each turn, that blocker gets +1 value. |
| 8 | shelter | Tranquility Chamber | `sheen-nus-calm-command` | If you have blocked three or more times this turn, this attacks with +3 value. |
| 9 | shelter | Evergreen Arbor | `sheen-emperors-heartwood` | Your blocking cards get +1 additional value. If it is your third or later block this turn, gain 1 life. |
| 10 | shelter | Vital Grove | `sheen-beli-awakened` | After you block without taking damage, this may attack with +3 value this turn. |

## Frumo

- Faction ID: `frumo`
- Standard playing cards: **52**
- Constructed replacement cards: **18**

### Faction cards

| Role | Name | Ability | Rules text |
|---|---|---|---|
| Commander | Lord Commander Polea | — | Once per turn, choose 1: put a card from your hand into an empty lane you control; switch the lanes of up to 2 cards you control; look at 1 face-down card; or one card you control gets +1 value until end of turn. |
| General | Lafayette | — | Once per turn, you may swap a lane card with a card from your hand. |
| City | Ristus, Sunken City | — | Your first card played each turn with a consecutive value of the last card played gets +2. |

### Constructed replacement cards

| Value | Type | Name | Card ID | Rules text |
|---:|---|---|---|---|
| 3 | ambush | Deep Dive | `frumo-deckhand-diver` | When this is placed into a lane, you may look at your top deck card. |
| 4 | ambush | Turning of the Tides | `frumo-tideglass-cutlass` | Reveal by attacking from a lane. If you have swapped a lane card this turn, this gets +2 value. |
| 2 | ambush | Collect Tribute | `frumo-sunken-coin` | When paid for an attack, block, or ability, this pays +1 value if you control an empty lane. |
| 5 | ambush | Frozen Barrier | `frumo-coral-hull-guard` | When this blocks from a lane, it gets +1 value and counts as a lane swap for your Frumo cards this turn. |
| 5 | ambush | Hauntling Lure | `frumo-riptide-smuggler` | The first time you peek at a face-down card each turn, this gets +1 value this turn. |
| 4 | ambush | Hit & Run | `frumo-lafayettes-chart` | After you swap a lane card with a hand card, your next payment card pays +1 value. |
| 6 | ambush | Opening Salvo | `frumo-pressure-lock-pistol` | When this attacks after a consecutive-value card was played, it gets +2 value. |
| 6 | ambush | Coastal Raid | `frumo-ristus-blackwake` | When this attacks from a lane while you control an empty lane, it gets +1 value. |
| 7 | ambush | Sink or Swim | `frumo-captains-bad-wager` | When this attacks from a lane after you played an even-value card, it gets +3 value this turn. |
| 6 | ambush | Command the Revolution | `frumo-poleas-sunken-order` | Use one Polea mode an additional time this turn, but only on your own cards. |
| 5 | ambush | Loot the Hold | `frumo-leviathan-salvage` | Whenever your first card played each turn gets a consecutive-value bonus, gain 1 life. |
| 2 | ambush | Sudden Scheme | `frumo-kelpcloak-trickster` | When this enters a lane, it counts as a lane swap for your Frumo cards this turn. |
| 5 | ambush | Anchor's Hold | `frumo-ballast-hook` | When this attacks from a lane while you control an empty lane, it gets +1 value. |
| 4 | ambush | Pirate's Gambit | `frumo-tide-debt-ledger` | After you swap a lane card this turn, your next payment card pays +1 value. |
| 7 | ambush | Coordinated Strike | `frumo-abyssal-switchboard` | After this enters a lane, your next attack or block gets +1 value. |
| 8 | ambush | X Marks the Spot | `frumo-poleas-moonlit-map` | If this receives the Ristus consecutive-value bonus, it gets +1 additional value. |
| 9 | ambush | Rally the Crew | `frumo-the-last-gamble` | Peek at a face-down card, then choose attack or block. Your next card of that kind gets +4 value. |
| 10 | ambush | Tidal Surge | `frumo-ristus-rises` | When this enters a lane, it gets +1 value this turn and counts as a lane swap for your Frumo cards. |

## Bizi

- Faction ID: `bizi`
- Standard playing cards: **52**
- Constructed replacement cards: **18**

### Faction cards

| Role | Name | Ability | Rules text |
|---|---|---|---|
| Commander | Focus, Conductor of Progress | — | Whenever you overpay for a card by 2 or more, put an acceleration counter on this. Once per turn, you may remove an acceleration counter: target card gets +1 value until end of turn. |
| General | Hera | — | Once per turn: If you've played a card of a suit this turn, you may use a card of the same suit to pay 2 more than its value. |
| City | Constanti, Technology Hub | — | Each turn, your first two attacks after the first that have a different suit from your previous attack get +1 value. |

### Constructed replacement cards

| Value | Type | Name | Card ID | Rules text |
|---:|---|---|---|---|
| 3 | contraption | Mechanical Refinery | `bizi-copperline-technician` | When you overpay for this by 2 or more, gain 1 acceleration counter. |
| 2 | contraption | Ammo Depot | `bizi-voltage-ration` | When paid for a Bizi card, this pays +1 additional value once each turn. |
| 4 | contraption | Hovercraft | `bizi-dune-circuit-runner` | If your previous attack had a different suit, this attacks with +1 value. |
| 5 | contraption | Bunker Defenses | `bizi-gearplate-shield` | When blocking, you may remove 1 acceleration counter to give this +2 value. |
| 5 | contraption | Signal Relay | `bizi-heras-calibration` | When paid for a Bizi card, this pays +2 additional value. |
| 5 | contraption | Electrostatic Field | `bizi-solar-array-adept` | Whenever you gain an acceleration counter, this gets +1 value until end of turn. |
| 6 | contraption | Signal Line | `bizi-constanti-conduit` | Your first two different-suit attacks after the first get an additional +1 value. |
| 6 | contraption | Searchlight Beacon | `bizi-sandstorm-processor` | If you have 2 or more acceleration counters, this may attack with +2 value. |
| 7 | contraption | Chrono-Forge Core | `bizi-focus-overclock` | Remove 1 acceleration counter: give target card +3 value this turn instead of +1. |
| 6 | contraption | Gold Mine | `bizi-regnum-voltage-bank` | The first time each turn you overpay by 2 or more, gain 1 life and 1 acceleration counter. |
| 5 | contraption | Battle Alarm | `bizi-desert-logic-engine` | When you attack with a different suit from your previous attack, that attack gets +2 value. |
| 2 | contraption | Spare Part Scrapyard | `bizi-brass-spark` | When paid for your first Bizi card each turn, this pays +1 additional value. |
| 5 | contraption | Iron Express | `bizi-railspike-marshal` | If your previous attack had a different suit, this attacks with +1 value. |
| 4 | contraption | Smoke Screen | `bizi-heat-sink-matrix` | When blocking, you may remove 1 acceleration counter to give this +2 value. |
| 7 | contraption | Energy Transporter | `bizi-clockwork-caravan` | The first time each turn you overpay for this by 2 or more, draw 1 extra card at end of turn. |
| 8 | contraption | Incinerator Turret | `bizi-voltaric-ultimatum` | Remove 2 acceleration counters: this attacks with +5 value. |
| 9 | contraption | Interference Matrix | `bizi-focus-prime-signal` | Gain 2 acceleration counters. Your next card this turn gets up to +4 value, one for each acceleration counter you have. |
| 10 | contraption | Armored Battleship | `bizi-constanti-sunforge` | When this attacks, remove up to 3 acceleration counters. It gets +2 value for each counter removed. |

## Mekan

- Faction ID: `mekan`
- Standard playing cards: **52**
- Constructed replacement cards: **0**

### Faction cards

| Role | Name | Ability | Rules text |
|---|---|---|---|
| Commander | Allegro, Celebrator of Life | Encore / Celebrate | Encore — Once per turn, mark one card paid this turn as a Guest during your priority. Celebrate — Your first attack or block each turn matching a Guest's suit or printed value gets +1. |
| General (`acama`) | Acama, Founder of the Celebration | Festival Foundations | Once per turn during your priority, if you control a face-down lane card, inspect the top card of your deck. Keep it on top or put it on the bottom. |
| General (`hui`) | Hui, Master of Ceremonies | Invite Everyone | Your first attack or block each turn sharing a suit with a card already in your discard pile gets +1 value. |
| General (`monti`) | Monti, Keeper of the Eternal Festival | Grand Celebration | Once per turn during your priority, after paying at least two cards this turn, give a card in your hand or face-down lanes +1 value until end of turn. |
| General (`ahu`) | Ahu, Leader of the Procession | Procession of the Dead | Once per turn during your priority, after winning a blocked combat this turn, inspect your top two deck cards. Choose one to keep on top and put the other on the bottom. |
| General (`temo`) | Temo, Caller of the Departed | One More Dance | The first time one of your cards is defeated each turn, your next attack or block that turn gets +1 value. |
| City | San Mikal, Burial Ground | The Guests Return | Once per turn, remember a defeated card as a Guest during your priority. You may invite a Guest: your next attack or block this turn with its printed value removes that Guest from the game and gets +1. Cancel or change an invitation before playing. |

### Constructed replacement cards

No faction-specific constructed replacements are published yet. This faction currently plays the complete standard 52-card deck.

## Jali

- Faction ID: `jali`
- Standard playing cards: **52**
- Constructed replacement cards: **0**

### Faction cards

| Role | Name | Ability | Rules text |
|---|---|---|---|
| Commander | Watane | The Bested Return | Whenever a card you control is bested, create a Revenant. During your priority, destroy a Revenant to give a card you control +2 Value until end of turn. |
| General (`basho`) | Basho | Call the Formation | Once per turn during your priority, reveal the face-down card in each of your three lanes. If all three were face-down, create a Revenant. |
| City | Katana, Floating City | Revenant Ascension | After you create a Revenant this turn, you may give each card you play with printed Value 8 or less +2 Value until end of turn. Each card can receive this bonus once. |

### Constructed replacement cards

No faction-specific constructed replacements are published yet. This faction currently plays the complete standard 52-card deck.

## Gracus

- Faction ID: `gracus`
- Standard playing cards: **52**
- Constructed replacement cards: **0**

### Faction cards

| Role | Name | Ability | Rules text |
|---|---|---|---|
| Commander | Epicura, Voice of the Arena | Call the Minotaur | Once per turn during your priority, create a 4-value Minotaur attacking an opponent or blocking an unblocked attack targeting you. The Minotaur can be blocked normally. |
| General (`platus`) | Platus | Demand Tribute | Your opponents must overpay by at least 1 while attacking you. The additional payment is included in the attack's required cost. |
| City | Athun, Coastline of Giants | Towering Follow-up | Whenever you play a card with a printed value at least 8 higher than the last card you played this turn, that card gets +2 value until end of turn. |

### Constructed replacement cards

No faction-specific constructed replacements are published yet. This faction currently plays the complete standard 52-card deck.

## Indela

- Faction ID: `indela`
- Standard playing cards: **52**
- Constructed replacement cards: **0**

### Faction cards

| Role | Name | Ability | Rules text |
|---|---|---|---|
| Commander | Katel, Magus Operandi | Opening Omen | At the beginning of your turn, reveal the top card of your deck. If it is odd, your cards cost 1 less this turn. If it is even, your opponent's cards cost 1 more this turn. |
| General (`ramar`) | Ramar | Second Reading | At the beginning of your turn, reveal the top card of your deck. If it is odd, your cards cost 1 less this turn. If it is even, your opponent's cards cost 1 more this turn. |
| City | Kashi, Academy of Omens | Opposing Parity | Your odd cards get +1 value if you revealed an even card this turn, and your even cards get +1 value if you revealed an odd card this turn. |

### Constructed replacement cards

No faction-specific constructed replacements are published yet. This faction currently plays the complete standard 52-card deck.

## Standard 52-card deck

Each faction's standard deck contains the following rank and suit combinations:

| Suit | Ranks | Count |
|---|---|---:|
| Spades | 2, 3, 4, 5, 6, 7, 8, 9, 10, Jack, Queen, King, Ace | 13 |
| Hearts | 2, 3, 4, 5, 6, 7, 8, 9, 10, Jack, Queen, King, Ace | 13 |
| Diamonds | 2, 3, 4, 5, 6, 7, 8, 9, 10, Jack, Queen, King, Ace | 13 |
| Clubs | 2, 3, 4, 5, 6, 7, 8, 9, 10, Jack, Queen, King, Ace | 13 |

**Total: 52 cards per faction.**

