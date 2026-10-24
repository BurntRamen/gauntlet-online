# Playable card catalog

Generated from the authoritative registry in `server/gameContent.js` at content version `gauntlet-content-v27` and rules version `gauntlet-rules-v6`.

Every playable faction receives a standard 52-card deck: one card of each rank (2–10, Jack, Queen, King, Ace) in each of the four suits (spades, hearts, diamonds, clubs). Every faction card has one fixed rank-and-suit slot and replaces that exact standard card; players cannot reassign its suit, and the deck always remains 52 cards.

Each published 18-card constructed pool contains 10 Servitors and 8 faction support cards. Only Servitors and standard playing cards attack or block. Armaments, Shelters, Ambushes, Contraptions, Biomorphs, and Operations occupy a separate lane support slot and remain until their rules remove them.

Edit Commander, General, and City definitions in `server/gameContent.js`. The Legacies source text is in `server/legaciesContent.js`. Edit constructed cards in the faction card arrays in `server/gameContent.js`. Mechanical changes must also be reflected in `shared/duel-rules/`.

## Rumin

- Faction ID: `rumin`
- Standard playing cards: **52**
- Constructed replacement cards: **22**

### Faction cards

| Role | Name | Ability | Rules text |
|---|---|---|---|
| Commander | Kaiser, the Jewel | — | Your fourth attack each turn gets +3 value. |
| General | Meerus | — | Whenever you play your second attack each turn, you may play your third attack with cost 3 or less without paying its cost. |
| City | Rumie, City of the Empire | — | Each turn, the first two attacks you play after your first that share a suit with your previous attack get +1 value. |

### Constructed replacement cards

| Slot | Type | Name | Card ID | Rules text |
|---:|---|---|---|---|
| 3♠ | armament | Capital Investment Spear | `rumin-gilded-scale-legionary` | Arm from a lane: attach to a hand attacker. If a diamond was paid this turn, that attacker gets +2 value this combat, then discard this. |
| 2♥ | servitor | Rumin Scout | `rumin-forum-ledger-runner` | If this is your first attack this turn, you may treat one payment card as +1 value. |
| 4♦ | servitor | Rumin Sentry | `rumin-vault-shield-bearer` | When blocking, prevent 1 damage if you overpaid for this block. |
| 4♣ | armament | Dividend Yield Blade | `rumin-coin-scale-spear` | Arm from lane: when you attack from hand, reveal this from your lane to attach it. The attacker gets +2 value this combat, then discard this. |
| 5♠ | servitor | Rumin Warrior | `rumin-senate-vault-guard` | The first time each turn you overpay for this by 2 or more, gain 1 life. |
| 6♥ | armament | Corporate Banner | `rumin-marble-market-tribune` | While Corporate Banner occupies a support slot, after one of your Servitors attacks, the next Rumin Armament you arm this turn gives that attacker +1 additional value. |
| 6♦ | armament | Shareholder's Shield | `rumin-rumie-vault-shield` | Arm from lane: attach to a hand attacker. It gets +3 value this combat, then discard this. |
| 5♣ | armament | Profit Margin Spear | `rumin-imperial-scale-pike` | Arm from lane: attach to a hand attacker. It gets +2 value, or +4 if it shares a suit with your previous attack. |
| 7♠ | armament | Executive Authority Blade | `rumin-aurelian-clawblade` | Arm from lane: attach to a hand attacker. It gets +4 value this combat. If you overpaid by 2 or more, gain 1 life. |
| 6♣ | servitor | Colosseum Duelist | `rumin-basilisk-standard` | Your fourth attack each turn gets +2 additional value if an armament is armed to it. |
| 5♦ | servitor | Rumin Military Advisor | `rumin-jewel-bank-contract` | After this attacks or blocks, the next Rumin attack this turn may treat its single payment card as +2 value. |
| 2♣ | servitor | Rumin Javelineer | `rumin-tax-road-scout` | If this is your first attack this turn, it costs 1 less to play. |
| 5♥ | servitor | Rumin Shieldmaster | `rumin-marble-phalanx` | When this blocks from a lane, it gets +2 value. |
| 7♥ | servitor | Rumin Business Analyst | `rumin-counting-house-aegis` | The first time each turn you overpay for a Rumin card by 2 or more, gain 1 life. |
| 8♦ | armament | Asset Crusher | `rumin-triumphal-ram` | Arm from lane: attach to a hand attacker. It gets +4 value, or +5 if the attacker has value 8 or more. |
| 8♠ | servitor | Rumin Legatus | `rumin-edict-of-the-vault` | When paid for your fourth attack this turn, this pays +3 additional value. |
| 9♠ | armament | Unstoppable Investment Lance | `rumin-kaisers-gold-claw` | Arm from lane: attach to a hand attacker. It gets +5 value this combat, or +6 if it is your fourth attack this turn. |
| 10♥ | servitor | Rumin Warlord | `rumin-rumie-market-colossus` | When this attacks, each eligible Rumin armament you control in a lane may arm to it. Each armed armament gives an extra +1 value. |
| J♥ | servitor | Forum Tribune | `rumin-forum-tribune` | This card has no additional ability beyond the normal rules for its card type and printed value. A practiced voice carries the Forum's verdict across the field. |
| Q♦ | armament | Queen of Ledgers | `rumin-queen-of-ledgers` | This card has no additional ability beyond the normal rules for its card type and printed value. Every debt and favor finds its place in the imperial record. |
| K♣ | servitor | Kaiser of Standards | `rumin-kaiser-of-standards` | This card has no additional ability beyond the normal rules for its card type and printed value. The legions measure their advance by the standards behind him. |
| A♠ | servitor | Golden Imperator | `rumin-golden-imperator` | This card has no additional ability beyond the normal rules for its card type and printed value. Where the Imperator marches, the empire imagines itself eternal. |

## Sheen

- Faction ID: `sheen`
- Standard playing cards: **52**
- Constructed replacement cards: **22**

### Faction cards

| Role | Name | Ability | Rules text |
|---|---|---|---|
| Commander | Emperor Nu | — | Your blocking cards get +1 value. If it's your third or later time blocking, they get +2 instead. |
| General | Tang | — | Each turn, when you block for the second time, gain 2 life. |
| City | Beli, Living City | — | After your second block each turn, your next attack with cost 10+ gains +2 value. |

### Constructed replacement cards

| Slot | Type | Name | Card ID | Rules text |
|---:|---|---|---|---|
| 3♥ | servitor | Verdant Guardian | `sheen-rootwatch-initiate` | When this blocks, it gets +1 value if you have already blocked this turn. |
| 4♦ | servitor | Harmonic Warden | `sheen-quiet-grove-sentinel` | If this prevents all damage from an attack, gain 1 life. |
| 2♣ | servitor | Starroot Observer | `sheen-mossbound-staff` | When paid for a block, the first blocking card gets +1 value. |
| 5♠ | servitor | Greenhouse Guardian | `sheen-living-bark-guard` | This may block hand attacks as though it had +1 value. |
| 5♥ | shelter | Entwined Thicket | `sheen-beli-vinebinder` | While Entwined Thicket occupies a support slot, after your second block each turn, your next attack that turn gets +1 value. |
| 4♣ | shelter | Harmony Lab | `sheen-harmony-ward` | While Harmony Lab occupies a support slot, your second and each later block during the turn gets +1 value. |
| 6♠ | servitor | Thorn Weaver | `sheen-thornroot-counterstroke` | If you took no damage this turn, this gets +2 value while attacking. |
| 6♦ | shelter | Verdant Canopy | `sheen-beli-canopy-shield` | While Verdant Canopy occupies a support slot, once each turn after you block, prevent 1 additional damage from that attack. |
| 7♥ | shelter | Verdant Dome | `sheen-nus-verdant-edict` | While Verdant Dome occupies a support slot, your third block during the turn gets +1 additional value. |
| 5♦ | shelter | Eternal Archive | `sheen-roots-that-remember` | While Eternal Archive occupies a support slot, whenever you gain life from blocking, your next block that turn gets +1 value. |
| 6♣ | shelter | Meditation Retreat | `sheen-tangs-patient-hand` | While Meditation Retreat occupies a support slot, after your second block each turn, gain 1 life and draw one extra card at the end of the turn. |
| 2♠ | servitor | Root Guardian | `sheen-seedwall-acolyte` | When this blocks the first incoming attack each turn, it gets +1 value. |
| 4♥ | servitor | Sheen Mender | `sheen-raincall-mender` | After this blocks, gain 1 life if you took no damage from that attack. |
| 7♦ | servitor | Oakheart Sentinel | `sheen-ringroot-bastion` | When this blocks from a lane, it gets +2 value. |
| 3♣ | servitor | Goldenbloom Sower | `sheen-sapling-chorus` | When paid for your second or later block each turn, that blocker gets +1 value. |
| 8♠ | servitor | Concordant Elder | `sheen-nus-calm-command` | If you have blocked three or more times this turn, this attacks with +3 value. |
| 9♠ | shelter | Evergreen Arbor | `sheen-emperors-heartwood` | While Evergreen Arbor occupies a support slot, each of your blocking cards gets +1 value; on your third and later blocks each turn, also gain 1 life. |
| 10♦ | shelter | Vital Grove | `sheen-beli-awakened` | While Vital Grove occupies a support slot, after you block without taking damage, you may give your next attack that turn +3 value. |
| J♣ | servitor | Canopy Wayfinder | `sheen-canopy-wayfinder` | This card has no additional ability beyond the normal rules for its card type and printed value. She reads the paths written in shade, rain, and new growth. |
| Q♥ | shelter | Rootsong Matriarch | `sheen-rootsong-matriarch` | This card has no additional ability beyond the normal rules for its card type and printed value. Her oldest songs pass beneath the soil from grove to grove. |
| K♦ | servitor | Elder of the First Grove | `sheen-elder-first-grove` | This card has no additional ability beyond the normal rules for its card type and printed value. The first forest remembers every season through its elder. |
| A♠ | servitor | Heartwood Avatar | `sheen-heartwood-avatar` | This card has no additional ability beyond the normal rules for its card type and printed value. An entire living covenant walks within its wooden frame. |

## Frumo

- Faction ID: `frumo`
- Standard playing cards: **52**
- Constructed replacement cards: **22**

### Faction cards

| Role | Name | Ability | Rules text |
|---|---|---|---|
| Commander | Lord Commander Polea | — | Once per turn, choose 1: put a card from your hand into an empty lane you control; switch the lanes of up to 2 cards you control; look at 1 face-down card; or one card you control gets +1 value until end of turn. |
| General | Lafayette | — | Once per turn, you may swap a lane card with a card from your hand. |
| City | Ristus, Sunken City | — | Your first card played each turn with a consecutive value of the last card played gets +2. |

### Constructed replacement cards

| Slot | Type | Name | Card ID | Rules text |
|---:|---|---|---|---|
| 3♦ | ambush | Deep Dive | `frumo-deckhand-diver` | When Deep Dive enters a support slot, you may reveal it to privately inspect the top card of your deck, then discard Deep Dive. |
| 4♣ | servitor | Deckhand Recruit | `frumo-tideglass-cutlass` | Reveal by attacking from a lane. If you have swapped a lane card this turn, this gets +2 value. |
| 2♠ | servitor | Vault Raider | `frumo-sunken-coin` | When paid for an attack, block, or ability, this pays +1 value if you control an empty lane. |
| 5♥ | servitor | Wavebreaker Maurauder | `frumo-coral-hull-guard` | When this blocks from a lane, it gets +1 value and counts as a lane swap for your Frumo cards this turn. |
| 5♦ | ambush | Hauntling Lure | `frumo-riptide-smuggler` | After your first face-down-card inspection each turn, reveal Hauntling Lure to give your next attack +1 value, then discard Hauntling Lure. |
| 4♠ | ambush | Hit & Run | `frumo-lafayettes-chart` | After you exchange a hand card with a lane card, reveal Hit & Run so your next payment card pays +1 additional value, then discard Hit & Run. |
| 6♥ | servitor | Frumo Sharpshooter | `frumo-pressure-lock-pistol` | When this attacks after a consecutive-value card was played, it gets +2 value. |
| 6♣ | servitor | Riptide Veteran | `frumo-ristus-blackwake` | When this attacks from a lane while you control an empty lane, it gets +1 value. |
| 7♦ | servitor | Renegade Outlaw | `frumo-captains-bad-wager` | When this attacks from a lane after you played an even-value card, it gets +3 value this turn. |
| 6♠ | ambush | Command the Revolution | `frumo-poleas-sunken-order` | Reveal Command the Revolution to use one Polea mode an additional time this turn, targeting only your own cards, then discard this Ambush. |
| 5♣ | ambush | Loot the Hold | `frumo-leviathan-salvage` | When your first played card of the turn receives a Ristus consecutive-value bonus, reveal Loot the Hold to gain 1 life, then discard this Ambush. |
| 2♥ | servitor | Silent Corsair | `frumo-kelpcloak-trickster` | When this enters a lane, it counts as a lane swap for your Frumo cards this turn. |
| 5♠ | servitor | Ocean Enforcer | `frumo-ballast-hook` | When this attacks from a lane while you control an empty lane, it gets +1 value. |
| 4♥ | ambush | Pirate's Gambit | `frumo-tide-debt-ledger` | After you swap a lane card, reveal Pirate's Gambit so your next payment card pays +1 additional value, then discard Pirate's Gambit. |
| 7♣ | ambush | Coordinated Strike | `frumo-abyssal-switchboard` | When Coordinated Strike enters a support slot, reveal it to give your next attack or block +1 value, then discard it. |
| 8♦ | servitor | Tide Shaper | `frumo-poleas-moonlit-map` | If this receives the Ristus consecutive-value bonus, it gets +1 additional value. |
| 9♦ | ambush | Rally the Crew | `frumo-the-last-gamble` | When you inspect a face-down card, reveal Rally the Crew and choose attack or block; your next card of that kind gets +4 value, then discard this Ambush. |
| 10♣ | servitor | Frumo Tidecrasher | `frumo-ristus-rises` | When this enters a lane, it gets +1 value this turn and counts as a lane swap for your Frumo cards. |
| J♣ | servitor | Tideglass Corsair | `frumo-tideglass-corsair` | This card has no additional ability beyond the normal rules for its card type and printed value. No map stays accurate after the Corsair decides to use it. |
| Q♦ | servitor | Pearl Republic Admiral | `frumo-pearl-republic-admiral` | This card has no additional ability beyond the normal rules for its card type and printed value. Her fleet owes allegiance to a republic built on moving water. |
| K♥ | servitor | Storm-Crowned Navigator | `frumo-storm-crowned-navigator` | This card has no additional ability beyond the normal rules for its card type and printed value. Lightning marks the route that lesser captains refuse to sail. |
| A♠ | servitor | Leviathan's Chosen | `frumo-leviathans-chosen` | This card has no additional ability beyond the normal rules for its card type and printed value. The deep answered once, and the Chosen has followed ever since. |

## Bizi

- Faction ID: `bizi`
- Standard playing cards: **52**
- Constructed replacement cards: **22**

### Faction cards

| Role | Name | Ability | Rules text |
|---|---|---|---|
| Commander | Focus, Conductor of Progress | — | Whenever you overpay for a card by 2 or more, put an acceleration counter on this. Once per turn, you may remove an acceleration counter: target card gets +1 value until end of turn. |
| General | Hera | — | Once per turn: If you've played a card of a suit this turn, you may use a card of the same suit to pay 2 more than its value. |
| City | Constanti, Technology Hub | — | Each turn, your first two attacks after the first that have a different suit from your previous attack get +1 value. |

### Constructed replacement cards

| Slot | Type | Name | Card ID | Rules text |
|---:|---|---|---|---|
| 3♣ | servitor | Bizi Technician | `bizi-copperline-technician` | When you overpay for this by 2 or more, gain 1 acceleration counter. |
| 2♠ | contraption | Ammo Depot | `bizi-voltage-ration` | When paid for a Bizi card, this pays +1 additional value once each turn. |
| 4♥ | servitor | Aerial Drone | `bizi-dune-circuit-runner` | If your previous attack had a different suit, this attacks with +1 value. |
| 5♦ | servitor | Bizi Guardian | `bizi-gearplate-shield` | When blocking, you may remove 1 acceleration counter to give this +2 value. |
| 5♣ | contraption | Signal Relay | `bizi-heras-calibration` | When paid for a Bizi card, this pays +2 additional value. |
| 5♠ | contraption | Electrostatic Field | `bizi-solar-array-adept` | While Electrostatic Field occupies a support slot, each acceleration counter you gain gives your next Bizi Servitor attack +1 value that turn. |
| 6♥ | contraption | Signal Line | `bizi-constanti-conduit` | Your first two different-suit attacks after the first get an additional +1 value. |
| 6♦ | servitor | Air Traffic Controller | `bizi-sandstorm-processor` | If you have 2 or more acceleration counters, this may attack with +2 value. |
| 7♣ | contraption | Chrono-Forge Core | `bizi-focus-overclock` | Remove 1 acceleration counter: give target card +3 value this turn instead of +1. |
| 6♠ | contraption | Gold Mine | `bizi-regnum-voltage-bank` | The first time each turn you overpay by 2 or more, gain 1 life and 1 acceleration counter. |
| 5♥ | contraption | Battle Alarm | `bizi-desert-logic-engine` | When you attack with a different suit from your previous attack, that attack gets +2 value. |
| 2♦ | servitor | Bizi Sparksmith | `bizi-brass-spark` | When paid for your first Bizi card each turn, this pays +1 additional value. |
| 3♠ | servitor | Velocity Vanguard | `bizi-railspike-marshal` | If your previous attack had a different suit, this attacks with +1 value. |
| 4♦ | servitor | Utility Specialist | `bizi-heat-sink-matrix` | When blocking, you may remove 1 acceleration counter to give this +2 value. |
| 7♥ | servitor | Clockwork Merchant | `bizi-clockwork-caravan` | The first time each turn you overpay for this by 2 or more, draw 1 extra card at end of turn. |
| 8♣ | servitor | Shrapnel Blaster | `bizi-voltaric-ultimatum` | Remove 2 acceleration counters: this attacks with +5 value. |
| 9♦ | contraption | Interference Matrix | `bizi-focus-prime-signal` | When Interference Matrix enters a support slot, gain 2 acceleration counters; your next card that turn may get up to +4 value, one per acceleration counter you have. |
| 10♠ | servitor | Bizi Architect | `bizi-constanti-sunforge` | When this attacks, remove up to 3 acceleration counters. It gets +2 value for each counter removed. |
| J♥ | servitor | Clockwork Envoy | `bizi-clockwork-envoy` | This card has no additional ability beyond the normal rules for its card type and printed value. Its message is delivered in precisely measured movements. |
| Q♣ | servitor | Foundry Savant | `bizi-foundry-savant` | This card has no additional ability beyond the normal rules for its card type and printed value. Every failed design becomes a tool for the next attempt. |
| K♦ | servitor | Prime Artificer | `bizi-prime-artificer` | This card has no additional ability beyond the normal rules for its card type and printed value. The workshop grows quiet when the Prime Artificer begins. |
| A♠ | contraption | The Living Engine | `bizi-living-engine` | This card has no additional ability beyond the normal rules for its card type and printed value. No blueprint explains where the mechanism ends and life begins. |

## Mekan

- Faction ID: `mekan`
- Standard playing cards: **52**
- Constructed replacement cards: **52**

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

| Slot | Type | Name | Card ID | Rules text |
|---:|---|---|---|---|
| 2♠ | servitor | Midnight Welcomer | `mekan-spades-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Midnight Welcomer carries the midnight tradition into the convergence. |
| 3♠ | servitor | Midnight Lantern Bearer | `mekan-spades-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Midnight Lantern Bearer carries the midnight tradition into the convergence. |
| 4♠ | servitor | Midnight Mask Dancer | `mekan-spades-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Midnight Mask Dancer carries the midnight tradition into the convergence. |
| 5♠ | servitor | Midnight Memory Keeper | `mekan-spades-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Midnight Memory Keeper carries the midnight tradition into the convergence. |
| 6♠ | servitor | Midnight Procession Guide | `mekan-spades-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Midnight Procession Guide carries the midnight tradition into the convergence. |
| 7♠ | servitor | Midnight Ancestor Host | `mekan-spades-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Midnight Ancestor Host carries the midnight tradition into the convergence. |
| 8♠ | servitor | Midnight Candlewright | `mekan-spades-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Midnight Candlewright carries the midnight tradition into the convergence. |
| 9♠ | servitor | Midnight Feast Steward | `mekan-spades-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Midnight Feast Steward carries the midnight tradition into the convergence. |
| 10♠ | servitor | Midnight Sunset Herald | `mekan-spades-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Midnight Sunset Herald carries the midnight tradition into the convergence. |
| J♠ | servitor | Midnight Bridge Walker | `mekan-spades-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Midnight Bridge Walker carries the midnight tradition into the convergence. |
| Q♠ | servitor | Midnight Revel Matriarch | `mekan-spades-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Midnight Revel Matriarch carries the midnight tradition into the convergence. |
| K♠ | servitor | Midnight Eternal Celebrant | `mekan-spades-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Midnight Eternal Celebrant carries the midnight tradition into the convergence. |
| A♠ | servitor | Midnight Dawn Returned | `mekan-spades-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Midnight Dawn Returned carries the midnight tradition into the convergence. |
| 2♥ | servitor | Festival Welcomer | `mekan-hearts-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Festival Welcomer carries the festival tradition into the convergence. |
| 3♥ | servitor | Festival Lantern Bearer | `mekan-hearts-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Festival Lantern Bearer carries the festival tradition into the convergence. |
| 4♥ | servitor | Festival Mask Dancer | `mekan-hearts-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Festival Mask Dancer carries the festival tradition into the convergence. |
| 5♥ | servitor | Festival Memory Keeper | `mekan-hearts-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Festival Memory Keeper carries the festival tradition into the convergence. |
| 6♥ | servitor | Festival Procession Guide | `mekan-hearts-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Festival Procession Guide carries the festival tradition into the convergence. |
| 7♥ | servitor | Festival Ancestor Host | `mekan-hearts-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Festival Ancestor Host carries the festival tradition into the convergence. |
| 8♥ | servitor | Festival Candlewright | `mekan-hearts-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Festival Candlewright carries the festival tradition into the convergence. |
| 9♥ | servitor | Festival Feast Steward | `mekan-hearts-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Festival Feast Steward carries the festival tradition into the convergence. |
| 10♥ | servitor | Festival Sunset Herald | `mekan-hearts-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Festival Sunset Herald carries the festival tradition into the convergence. |
| J♥ | servitor | Festival Bridge Walker | `mekan-hearts-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Festival Bridge Walker carries the festival tradition into the convergence. |
| Q♥ | servitor | Festival Revel Matriarch | `mekan-hearts-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Festival Revel Matriarch carries the festival tradition into the convergence. |
| K♥ | servitor | Festival Eternal Celebrant | `mekan-hearts-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Festival Eternal Celebrant carries the festival tradition into the convergence. |
| A♥ | servitor | Festival Dawn Returned | `mekan-hearts-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Festival Dawn Returned carries the festival tradition into the convergence. |
| 2♦ | servitor | Marigold Welcomer | `mekan-diamonds-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Marigold Welcomer carries the marigold tradition into the convergence. |
| 3♦ | servitor | Marigold Lantern Bearer | `mekan-diamonds-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Marigold Lantern Bearer carries the marigold tradition into the convergence. |
| 4♦ | servitor | Marigold Mask Dancer | `mekan-diamonds-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Marigold Mask Dancer carries the marigold tradition into the convergence. |
| 5♦ | servitor | Marigold Memory Keeper | `mekan-diamonds-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Marigold Memory Keeper carries the marigold tradition into the convergence. |
| 6♦ | servitor | Marigold Procession Guide | `mekan-diamonds-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Marigold Procession Guide carries the marigold tradition into the convergence. |
| 7♦ | servitor | Marigold Ancestor Host | `mekan-diamonds-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Marigold Ancestor Host carries the marigold tradition into the convergence. |
| 8♦ | servitor | Marigold Candlewright | `mekan-diamonds-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Marigold Candlewright carries the marigold tradition into the convergence. |
| 9♦ | servitor | Marigold Feast Steward | `mekan-diamonds-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Marigold Feast Steward carries the marigold tradition into the convergence. |
| 10♦ | servitor | Marigold Sunset Herald | `mekan-diamonds-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Marigold Sunset Herald carries the marigold tradition into the convergence. |
| J♦ | servitor | Marigold Bridge Walker | `mekan-diamonds-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Marigold Bridge Walker carries the marigold tradition into the convergence. |
| Q♦ | servitor | Marigold Revel Matriarch | `mekan-diamonds-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Marigold Revel Matriarch carries the marigold tradition into the convergence. |
| K♦ | servitor | Marigold Eternal Celebrant | `mekan-diamonds-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Marigold Eternal Celebrant carries the marigold tradition into the convergence. |
| A♦ | servitor | Marigold Dawn Returned | `mekan-diamonds-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Marigold Dawn Returned carries the marigold tradition into the convergence. |
| 2♣ | servitor | Drumfire Welcomer | `mekan-clubs-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Drumfire Welcomer carries the drumfire tradition into the convergence. |
| 3♣ | servitor | Drumfire Lantern Bearer | `mekan-clubs-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Drumfire Lantern Bearer carries the drumfire tradition into the convergence. |
| 4♣ | servitor | Drumfire Mask Dancer | `mekan-clubs-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Drumfire Mask Dancer carries the drumfire tradition into the convergence. |
| 5♣ | servitor | Drumfire Memory Keeper | `mekan-clubs-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Drumfire Memory Keeper carries the drumfire tradition into the convergence. |
| 6♣ | servitor | Drumfire Procession Guide | `mekan-clubs-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Drumfire Procession Guide carries the drumfire tradition into the convergence. |
| 7♣ | servitor | Drumfire Ancestor Host | `mekan-clubs-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Drumfire Ancestor Host carries the drumfire tradition into the convergence. |
| 8♣ | servitor | Drumfire Candlewright | `mekan-clubs-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Drumfire Candlewright carries the drumfire tradition into the convergence. |
| 9♣ | servitor | Drumfire Feast Steward | `mekan-clubs-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Drumfire Feast Steward carries the drumfire tradition into the convergence. |
| 10♣ | servitor | Drumfire Sunset Herald | `mekan-clubs-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Drumfire Sunset Herald carries the drumfire tradition into the convergence. |
| J♣ | servitor | Drumfire Bridge Walker | `mekan-clubs-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Drumfire Bridge Walker carries the drumfire tradition into the convergence. |
| Q♣ | servitor | Drumfire Revel Matriarch | `mekan-clubs-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Drumfire Revel Matriarch carries the drumfire tradition into the convergence. |
| K♣ | servitor | Drumfire Eternal Celebrant | `mekan-clubs-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Drumfire Eternal Celebrant carries the drumfire tradition into the convergence. |
| A♣ | servitor | Drumfire Dawn Returned | `mekan-clubs-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Drumfire Dawn Returned carries the drumfire tradition into the convergence. |

## Jali

- Faction ID: `jali`
- Standard playing cards: **52**
- Constructed replacement cards: **52**

### Faction cards

| Role | Name | Ability | Rules text |
|---|---|---|---|
| Commander | Watane | The Bested Return | Whenever a card you control is bested, create a Revenant. During your priority, destroy a Revenant to give a card you control +2 Value until end of turn. |
| General (`basho`) | Basho | Call the Formation | Once per turn during your priority, reveal the face-down card in each of your three lanes. If all three were face-down, create a Revenant. |
| City | Katana, Floating City | Revenant Ascension | After you create a Revenant this turn, you may give each card you play with printed Value 8 or less +2 Value until end of turn. Each card can receive this bonus once. |

### Constructed replacement cards

| Slot | Type | Name | Card ID | Rules text |
|---:|---|---|---|---|
| 2♠ | servitor | Shadow Initiate | `jali-spades-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Shadow Initiate carries the shadow tradition into the convergence. |
| 3♠ | servitor | Shadow Standard Guard | `jali-spades-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Shadow Standard Guard carries the shadow tradition into the convergence. |
| 4♠ | servitor | Shadow Quiet Archer | `jali-spades-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Shadow Quiet Archer carries the shadow tradition into the convergence. |
| 5♠ | servitor | Shadow Line Keeper | `jali-spades-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Shadow Line Keeper carries the shadow tradition into the convergence. |
| 6♠ | servitor | Shadow Name Caller | `jali-spades-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Shadow Name Caller carries the shadow tradition into the convergence. |
| 7♠ | servitor | Shadow Revenant Guide | `jali-spades-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Shadow Revenant Guide carries the shadow tradition into the convergence. |
| 8♠ | servitor | Shadow Wind Reader | `jali-spades-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Shadow Wind Reader carries the shadow tradition into the convergence. |
| 9♠ | servitor | Shadow Gate Sentinel | `jali-spades-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Shadow Gate Sentinel carries the shadow tradition into the convergence. |
| 10♠ | servitor | Shadow Fallen Captain | `jali-spades-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Shadow Fallen Captain carries the shadow tradition into the convergence. |
| J♠ | servitor | Shadow Veil Strider | `jali-spades-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Shadow Veil Strider carries the shadow tradition into the convergence. |
| Q♠ | servitor | Shadow Memory Queen | `jali-spades-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Shadow Memory Queen carries the shadow tradition into the convergence. |
| K♠ | servitor | Shadow Oath Shogun | `jali-spades-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Shadow Oath Shogun carries the shadow tradition into the convergence. |
| A♠ | servitor | Shadow Ancestor Ascendant | `jali-spades-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Shadow Ancestor Ascendant carries the shadow tradition into the convergence. |
| 2♥ | servitor | Oath Initiate | `jali-hearts-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Oath Initiate carries the oath tradition into the convergence. |
| 3♥ | servitor | Oath Standard Guard | `jali-hearts-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Oath Standard Guard carries the oath tradition into the convergence. |
| 4♥ | servitor | Oath Quiet Archer | `jali-hearts-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Oath Quiet Archer carries the oath tradition into the convergence. |
| 5♥ | servitor | Oath Line Keeper | `jali-hearts-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Oath Line Keeper carries the oath tradition into the convergence. |
| 6♥ | servitor | Oath Name Caller | `jali-hearts-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Oath Name Caller carries the oath tradition into the convergence. |
| 7♥ | servitor | Oath Revenant Guide | `jali-hearts-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Oath Revenant Guide carries the oath tradition into the convergence. |
| 8♥ | servitor | Oath Wind Reader | `jali-hearts-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Oath Wind Reader carries the oath tradition into the convergence. |
| 9♥ | servitor | Oath Gate Sentinel | `jali-hearts-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Oath Gate Sentinel carries the oath tradition into the convergence. |
| 10♥ | servitor | Oath Fallen Captain | `jali-hearts-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Oath Fallen Captain carries the oath tradition into the convergence. |
| J♥ | servitor | Oath Veil Strider | `jali-hearts-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Oath Veil Strider carries the oath tradition into the convergence. |
| Q♥ | servitor | Oath Memory Queen | `jali-hearts-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Oath Memory Queen carries the oath tradition into the convergence. |
| K♥ | servitor | Oath Oath Shogun | `jali-hearts-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Oath Oath Shogun carries the oath tradition into the convergence. |
| A♥ | servitor | Oath Ancestor Ascendant | `jali-hearts-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Oath Ancestor Ascendant carries the oath tradition into the convergence. |
| 2♦ | servitor | Moonsteel Initiate | `jali-diamonds-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Moonsteel Initiate carries the moonsteel tradition into the convergence. |
| 3♦ | servitor | Moonsteel Standard Guard | `jali-diamonds-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Moonsteel Standard Guard carries the moonsteel tradition into the convergence. |
| 4♦ | servitor | Moonsteel Quiet Archer | `jali-diamonds-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Moonsteel Quiet Archer carries the moonsteel tradition into the convergence. |
| 5♦ | servitor | Moonsteel Line Keeper | `jali-diamonds-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Moonsteel Line Keeper carries the moonsteel tradition into the convergence. |
| 6♦ | servitor | Moonsteel Name Caller | `jali-diamonds-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Moonsteel Name Caller carries the moonsteel tradition into the convergence. |
| 7♦ | servitor | Moonsteel Revenant Guide | `jali-diamonds-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Moonsteel Revenant Guide carries the moonsteel tradition into the convergence. |
| 8♦ | servitor | Moonsteel Wind Reader | `jali-diamonds-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Moonsteel Wind Reader carries the moonsteel tradition into the convergence. |
| 9♦ | servitor | Moonsteel Gate Sentinel | `jali-diamonds-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Moonsteel Gate Sentinel carries the moonsteel tradition into the convergence. |
| 10♦ | servitor | Moonsteel Fallen Captain | `jali-diamonds-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Moonsteel Fallen Captain carries the moonsteel tradition into the convergence. |
| J♦ | servitor | Moonsteel Veil Strider | `jali-diamonds-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Moonsteel Veil Strider carries the moonsteel tradition into the convergence. |
| Q♦ | servitor | Moonsteel Memory Queen | `jali-diamonds-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Moonsteel Memory Queen carries the moonsteel tradition into the convergence. |
| K♦ | servitor | Moonsteel Oath Shogun | `jali-diamonds-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Moonsteel Oath Shogun carries the moonsteel tradition into the convergence. |
| A♦ | servitor | Moonsteel Ancestor Ascendant | `jali-diamonds-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Moonsteel Ancestor Ascendant carries the moonsteel tradition into the convergence. |
| 2♣ | servitor | Formation Initiate | `jali-clubs-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Formation Initiate carries the formation tradition into the convergence. |
| 3♣ | servitor | Formation Standard Guard | `jali-clubs-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Formation Standard Guard carries the formation tradition into the convergence. |
| 4♣ | servitor | Formation Quiet Archer | `jali-clubs-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Formation Quiet Archer carries the formation tradition into the convergence. |
| 5♣ | servitor | Formation Line Keeper | `jali-clubs-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Formation Line Keeper carries the formation tradition into the convergence. |
| 6♣ | servitor | Formation Name Caller | `jali-clubs-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Formation Name Caller carries the formation tradition into the convergence. |
| 7♣ | servitor | Formation Revenant Guide | `jali-clubs-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Formation Revenant Guide carries the formation tradition into the convergence. |
| 8♣ | servitor | Formation Wind Reader | `jali-clubs-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Formation Wind Reader carries the formation tradition into the convergence. |
| 9♣ | servitor | Formation Gate Sentinel | `jali-clubs-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Formation Gate Sentinel carries the formation tradition into the convergence. |
| 10♣ | servitor | Formation Fallen Captain | `jali-clubs-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Formation Fallen Captain carries the formation tradition into the convergence. |
| J♣ | servitor | Formation Veil Strider | `jali-clubs-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Formation Veil Strider carries the formation tradition into the convergence. |
| Q♣ | servitor | Formation Memory Queen | `jali-clubs-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Formation Memory Queen carries the formation tradition into the convergence. |
| K♣ | servitor | Formation Oath Shogun | `jali-clubs-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Formation Oath Shogun carries the formation tradition into the convergence. |
| A♣ | servitor | Formation Ancestor Ascendant | `jali-clubs-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Formation Ancestor Ascendant carries the formation tradition into the convergence. |

## Gracus

- Faction ID: `gracus`
- Standard playing cards: **52**
- Constructed replacement cards: **52**

### Faction cards

| Role | Name | Ability | Rules text |
|---|---|---|---|
| Commander | Epicura, Voice of the Arena | Call the Minotaur | Once per turn during your priority, create a 4-value Minotaur attacking an opponent or blocking an unblocked attack targeting you. The Minotaur can be blocked normally. |
| General (`platus`) | Platus | Demand Tribute | Your opponents must overpay by at least 1 while attacking you. The additional payment is included in the attack's required cost. |
| City | Athun, Coastline of Giants | Towering Follow-up | Whenever you play a card with a printed value at least 8 higher than the last card you played this turn, that card gets +2 value until end of turn. |

### Constructed replacement cards

| Slot | Type | Name | Card ID | Rules text |
|---:|---|---|---|---|
| 2♠ | servitor | Obsidian Debater | `gracus-spades-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Obsidian Debater carries the obsidian tradition into the convergence. |
| 3♠ | servitor | Obsidian Shield Bearer | `gracus-spades-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Obsidian Shield Bearer carries the obsidian tradition into the convergence. |
| 4♠ | servitor | Obsidian Stone Runner | `gracus-spades-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Obsidian Stone Runner carries the obsidian tradition into the convergence. |
| 5♠ | servitor | Obsidian Arena Witness | `gracus-spades-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Obsidian Arena Witness carries the obsidian tradition into the convergence. |
| 6♠ | servitor | Obsidian Civic Hoplite | `gracus-spades-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Obsidian Civic Hoplite carries the obsidian tradition into the convergence. |
| 7♠ | servitor | Obsidian Question Keeper | `gracus-spades-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Obsidian Question Keeper carries the obsidian tradition into the convergence. |
| 8♠ | servitor | Obsidian Coastal Strategist | `gracus-spades-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Obsidian Coastal Strategist carries the obsidian tradition into the convergence. |
| 9♠ | servitor | Obsidian Laurel Champion | `gracus-spades-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Obsidian Laurel Champion carries the obsidian tradition into the convergence. |
| 10♠ | servitor | Obsidian Monument Warden | `gracus-spades-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Obsidian Monument Warden carries the obsidian tradition into the convergence. |
| J♠ | servitor | Obsidian Forum Tribune | `gracus-spades-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Obsidian Forum Tribune carries the obsidian tradition into the convergence. |
| Q♠ | servitor | Obsidian Marble Queen | `gracus-spades-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Obsidian Marble Queen carries the obsidian tradition into the convergence. |
| K♠ | servitor | Obsidian Philosopher King | `gracus-spades-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Obsidian Philosopher King carries the obsidian tradition into the convergence. |
| A♠ | servitor | Obsidian Living Colossus | `gracus-spades-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Obsidian Living Colossus carries the obsidian tradition into the convergence. |
| 2♥ | servitor | Civic Debater | `gracus-hearts-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Civic Debater carries the civic tradition into the convergence. |
| 3♥ | servitor | Civic Shield Bearer | `gracus-hearts-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Civic Shield Bearer carries the civic tradition into the convergence. |
| 4♥ | servitor | Civic Stone Runner | `gracus-hearts-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Civic Stone Runner carries the civic tradition into the convergence. |
| 5♥ | servitor | Civic Arena Witness | `gracus-hearts-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Civic Arena Witness carries the civic tradition into the convergence. |
| 6♥ | servitor | Civic Civic Hoplite | `gracus-hearts-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Civic Civic Hoplite carries the civic tradition into the convergence. |
| 7♥ | servitor | Civic Question Keeper | `gracus-hearts-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Civic Question Keeper carries the civic tradition into the convergence. |
| 8♥ | servitor | Civic Coastal Strategist | `gracus-hearts-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Civic Coastal Strategist carries the civic tradition into the convergence. |
| 9♥ | servitor | Civic Laurel Champion | `gracus-hearts-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Civic Laurel Champion carries the civic tradition into the convergence. |
| 10♥ | servitor | Civic Monument Warden | `gracus-hearts-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Civic Monument Warden carries the civic tradition into the convergence. |
| J♥ | servitor | Civic Forum Tribune | `gracus-hearts-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Civic Forum Tribune carries the civic tradition into the convergence. |
| Q♥ | servitor | Civic Marble Queen | `gracus-hearts-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Civic Marble Queen carries the civic tradition into the convergence. |
| K♥ | servitor | Civic Philosopher King | `gracus-hearts-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Civic Philosopher King carries the civic tradition into the convergence. |
| A♥ | servitor | Civic Living Colossus | `gracus-hearts-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Civic Living Colossus carries the civic tradition into the convergence. |
| 2♦ | servitor | Sunstone Debater | `gracus-diamonds-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Sunstone Debater carries the sunstone tradition into the convergence. |
| 3♦ | servitor | Sunstone Shield Bearer | `gracus-diamonds-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Sunstone Shield Bearer carries the sunstone tradition into the convergence. |
| 4♦ | servitor | Sunstone Stone Runner | `gracus-diamonds-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Sunstone Stone Runner carries the sunstone tradition into the convergence. |
| 5♦ | servitor | Sunstone Arena Witness | `gracus-diamonds-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Sunstone Arena Witness carries the sunstone tradition into the convergence. |
| 6♦ | servitor | Sunstone Civic Hoplite | `gracus-diamonds-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Sunstone Civic Hoplite carries the sunstone tradition into the convergence. |
| 7♦ | servitor | Sunstone Question Keeper | `gracus-diamonds-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Sunstone Question Keeper carries the sunstone tradition into the convergence. |
| 8♦ | servitor | Sunstone Coastal Strategist | `gracus-diamonds-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Sunstone Coastal Strategist carries the sunstone tradition into the convergence. |
| 9♦ | servitor | Sunstone Laurel Champion | `gracus-diamonds-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Sunstone Laurel Champion carries the sunstone tradition into the convergence. |
| 10♦ | servitor | Sunstone Monument Warden | `gracus-diamonds-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Sunstone Monument Warden carries the sunstone tradition into the convergence. |
| J♦ | servitor | Sunstone Forum Tribune | `gracus-diamonds-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Sunstone Forum Tribune carries the sunstone tradition into the convergence. |
| Q♦ | servitor | Sunstone Marble Queen | `gracus-diamonds-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Sunstone Marble Queen carries the sunstone tradition into the convergence. |
| K♦ | servitor | Sunstone Philosopher King | `gracus-diamonds-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Sunstone Philosopher King carries the sunstone tradition into the convergence. |
| A♦ | servitor | Sunstone Living Colossus | `gracus-diamonds-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Sunstone Living Colossus carries the sunstone tradition into the convergence. |
| 2♣ | servitor | Arena Debater | `gracus-clubs-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Arena Debater carries the arena tradition into the convergence. |
| 3♣ | servitor | Arena Shield Bearer | `gracus-clubs-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Arena Shield Bearer carries the arena tradition into the convergence. |
| 4♣ | servitor | Arena Stone Runner | `gracus-clubs-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Arena Stone Runner carries the arena tradition into the convergence. |
| 5♣ | servitor | Arena Arena Witness | `gracus-clubs-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Arena Arena Witness carries the arena tradition into the convergence. |
| 6♣ | servitor | Arena Civic Hoplite | `gracus-clubs-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Arena Civic Hoplite carries the arena tradition into the convergence. |
| 7♣ | servitor | Arena Question Keeper | `gracus-clubs-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Arena Question Keeper carries the arena tradition into the convergence. |
| 8♣ | servitor | Arena Coastal Strategist | `gracus-clubs-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Arena Coastal Strategist carries the arena tradition into the convergence. |
| 9♣ | servitor | Arena Laurel Champion | `gracus-clubs-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Arena Laurel Champion carries the arena tradition into the convergence. |
| 10♣ | servitor | Arena Monument Warden | `gracus-clubs-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Arena Monument Warden carries the arena tradition into the convergence. |
| J♣ | servitor | Arena Forum Tribune | `gracus-clubs-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Arena Forum Tribune carries the arena tradition into the convergence. |
| Q♣ | servitor | Arena Marble Queen | `gracus-clubs-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Arena Marble Queen carries the arena tradition into the convergence. |
| K♣ | servitor | Arena Philosopher King | `gracus-clubs-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Arena Philosopher King carries the arena tradition into the convergence. |
| A♣ | servitor | Arena Living Colossus | `gracus-clubs-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Arena Living Colossus carries the arena tradition into the convergence. |

## Indela

- Faction ID: `indela`
- Standard playing cards: **52**
- Constructed replacement cards: **22**

### Faction cards

| Role | Name | Ability | Rules text |
|---|---|---|---|
| Commander | Katel, Magus Operandi | Opening Omen | At the beginning of your turn, reveal the top card of your deck. If it is odd, your cards cost 1 less this turn. If it is even, your opponent's cards cost 1 more this turn. |
| General (`ramar`) | Ramar | Second Reading | At the beginning of your turn, reveal the top card of your deck. If it is odd, your cards cost 1 less this turn. If it is even, your opponent's cards cost 1 more this turn. |
| City | Kashi, Academy of Omens | Opposing Parity | Your odd cards get +1 value if you revealed an even card this turn, and your even cards get +1 value if you revealed an odd card this turn. |

### Constructed replacement cards

| Slot | Type | Name | Card ID | Rules text |
|---:|---|---|---|---|
| 2♥ | servitor | Student of Flame | `indela-student-of-flame` | While your omen is odd, this gets +1 value on your first attack each turn. |
| 2♠ | servitor | Frost Apprentice | `indela-frost-apprentice` | While your omen is even, this gets +1 value on your first block each turn. |
| 3♦ | servitor | Blazing Initiate | `indela-blazing-initiate` | While your omen is odd, this gets +1 value when it attacks after an odd-value card. |
| 4♣ | servitor | Glacier Initiate | `indela-glacier-initiate` | While your omen is even, this gets +1 value when it blocks an attack from hand. |
| 5♥ | servitor | Flameweaver | `indela-flameweaver` | While your omen is odd, this gets +1 value when it attacks from a lane. |
| 5♠ | servitor | Blizzard Caller | `indela-blizzard-caller` | While your omen is even, this gets +1 value when it blocks from a lane. |
| 6♦ | servitor | Mystic of Embers | `indela-mystic-of-embers` | While your omen is odd, this pays +1 additional value for an Indela card. |
| 6♣ | servitor | Arctic Channeler | `indela-arctic-channeler` | While your omen is even, this pays +1 additional value for an Indela card. |
| 7♥ | servitor | Fire Enchanter | `indela-fire-enchanter` | While your omen is odd, this gets +1 value on your third or later attack each turn. |
| 10♠ | servitor | Headmaster of Kashi | `indela-headmaster` | When this attacks or blocks, it gets +1 value for each Arcana you control, up to +2. |
| 3♣ | arcana | Arcane Amplification | `indela-arcane-amplification` | While this occupies a support slot, Kashi gives an additional +1 value to your cards of the parity opposite your omen. |
| 4♦ | arcana | Elemental Infusion | `indela-elemental-infusion` | While this occupies a support slot, your first attack gets +1 during an odd omen; your first block gets +1 during an even omen. |
| 5♣ | arcana | Scorched Earth Ritual | `indela-scorched-earth-ritual` | While this occupies a support slot and your omen is odd, your lane attacks get +1 value. |
| 6♠ | arcana | Frostbite Gale | `indela-frostbite-gale` | While this occupies a support slot and your omen is even, prevent 1 damage after your first block each turn. |
| 7♦ | arcana | Glacial Insight | `indela-glacial-insight` | While this occupies a support slot and your omen is even, your first clean block each turn draws 1 extra card at turn end. |
| 8♥ | arcana | Ring of Fire | `indela-ring-of-fire` | While this occupies a support slot and your omen is odd, your third and later attacks get +1 value. |
| 9♣ | arcana | Frost Nova | `indela-frost-nova` | While this occupies a support slot and your omen is even, your blocking cards get +1 value. |
| 10♦ | arcana | Elemental Array | `indela-elemental-array` | While this occupies a support slot, your first attack or block each turn matching your omen's parity gets +1 value. |
| J♦ | servitor | Dualflame Adept | `indela-dualflame-adept` | This card has no additional ability beyond the normal rules for its card type and printed value. Two flames answer her hands, each certain the other is impossible. |
| Q♥ | servitor | Mistress of Embers | `indela-mistress-of-embers` | This card has no additional ability beyond the normal rules for its card type and printed value. She keeps tomorrow's fire hidden inside yesterday's ash. |
| K♣ | servitor | Glacier Archon | `indela-glacier-archon` | This card has no additional ability beyond the normal rules for its card type and printed value. The oldest ice preserves choices the world believes forgotten. |
| A♠ | arcana | Avatar of Equilibrium | `indela-avatar-of-equilibrium` | This card has no additional ability beyond the normal rules for its card type and printed value. Balance is not stillness. It is every force arriving together. |

## Ingles

- Faction ID: `ingles`
- Standard playing cards: **52**
- Constructed replacement cards: **52**

### Faction cards

| Role | Name | Ability | Rules text |
|---|---|---|---|
| Commander | First Speaker Elian Wren | — | Charter — Build a balanced hand, commit deliberately, and make every lane support the whole formation. |
| General | Marshal Rowan Vale | — | Common Ground — Favor flexible cards and shared-suit formations that can answer changing threats. |
| City | Crownless Haven | — | Open Council — Patient defense creates the strongest moment for a coordinated reply. |

### Constructed replacement cards

| Slot | Type | Name | Card ID | Rules text |
|---:|---|---|---|---|
| 2♠ | servitor | Crownless Petitioner | `ingles-spades-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Crownless Petitioner carries the crownless tradition into the convergence. |
| 3♠ | servitor | Crownless Harbor Watch | `ingles-spades-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Crownless Harbor Watch carries the crownless tradition into the convergence. |
| 4♠ | servitor | Crownless Clause Keeper | `ingles-spades-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Crownless Clause Keeper carries the crownless tradition into the convergence. |
| 5♠ | servitor | Crownless Island Scout | `ingles-spades-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Crownless Island Scout carries the crownless tradition into the convergence. |
| 6♠ | servitor | Crownless Council Guard | `ingles-spades-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Crownless Council Guard carries the crownless tradition into the convergence. |
| 7♠ | servitor | Crownless Public Advocate | `ingles-spades-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Crownless Public Advocate carries the crownless tradition into the convergence. |
| 8♠ | servitor | Crownless Fleet Delegate | `ingles-spades-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Crownless Fleet Delegate carries the crownless tradition into the convergence. |
| 9♠ | servitor | Crownless Common Marshal | `ingles-spades-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Crownless Common Marshal carries the crownless tradition into the convergence. |
| 10♠ | servitor | Crownless Accord Captain | `ingles-spades-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Crownless Accord Captain carries the crownless tradition into the convergence. |
| J♠ | servitor | Crownless Charter Envoy | `ingles-spades-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Crownless Charter Envoy carries the crownless tradition into the convergence. |
| Q♠ | servitor | Crownless First Speaker | `ingles-spades-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Crownless First Speaker carries the crownless tradition into the convergence. |
| K♠ | servitor | Crownless Crownless Warden | `ingles-spades-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Crownless Crownless Warden carries the crownless tradition into the convergence. |
| A♠ | servitor | Crownless Unwritten Compact | `ingles-spades-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Crownless Unwritten Compact carries the crownless tradition into the convergence. |
| 2♥ | servitor | Common Petitioner | `ingles-hearts-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Common Petitioner carries the common tradition into the convergence. |
| 3♥ | servitor | Common Harbor Watch | `ingles-hearts-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Common Harbor Watch carries the common tradition into the convergence. |
| 4♥ | servitor | Common Clause Keeper | `ingles-hearts-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Common Clause Keeper carries the common tradition into the convergence. |
| 5♥ | servitor | Common Island Scout | `ingles-hearts-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Common Island Scout carries the common tradition into the convergence. |
| 6♥ | servitor | Common Council Guard | `ingles-hearts-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Common Council Guard carries the common tradition into the convergence. |
| 7♥ | servitor | Common Public Advocate | `ingles-hearts-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Common Public Advocate carries the common tradition into the convergence. |
| 8♥ | servitor | Common Fleet Delegate | `ingles-hearts-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Common Fleet Delegate carries the common tradition into the convergence. |
| 9♥ | servitor | Common Common Marshal | `ingles-hearts-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Common Common Marshal carries the common tradition into the convergence. |
| 10♥ | servitor | Common Accord Captain | `ingles-hearts-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Common Accord Captain carries the common tradition into the convergence. |
| J♥ | servitor | Common Charter Envoy | `ingles-hearts-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Common Charter Envoy carries the common tradition into the convergence. |
| Q♥ | servitor | Common First Speaker | `ingles-hearts-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Common First Speaker carries the common tradition into the convergence. |
| K♥ | servitor | Common Crownless Warden | `ingles-hearts-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Common Crownless Warden carries the common tradition into the convergence. |
| A♥ | servitor | Common Unwritten Compact | `ingles-hearts-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Common Unwritten Compact carries the common tradition into the convergence. |
| 2♦ | servitor | Harbor Petitioner | `ingles-diamonds-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Harbor Petitioner carries the harbor tradition into the convergence. |
| 3♦ | servitor | Harbor Harbor Watch | `ingles-diamonds-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Harbor Harbor Watch carries the harbor tradition into the convergence. |
| 4♦ | servitor | Harbor Clause Keeper | `ingles-diamonds-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Harbor Clause Keeper carries the harbor tradition into the convergence. |
| 5♦ | servitor | Harbor Island Scout | `ingles-diamonds-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Harbor Island Scout carries the harbor tradition into the convergence. |
| 6♦ | servitor | Harbor Council Guard | `ingles-diamonds-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Harbor Council Guard carries the harbor tradition into the convergence. |
| 7♦ | servitor | Harbor Public Advocate | `ingles-diamonds-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Harbor Public Advocate carries the harbor tradition into the convergence. |
| 8♦ | servitor | Harbor Fleet Delegate | `ingles-diamonds-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Harbor Fleet Delegate carries the harbor tradition into the convergence. |
| 9♦ | servitor | Harbor Common Marshal | `ingles-diamonds-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Harbor Common Marshal carries the harbor tradition into the convergence. |
| 10♦ | servitor | Harbor Accord Captain | `ingles-diamonds-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Harbor Accord Captain carries the harbor tradition into the convergence. |
| J♦ | servitor | Harbor Charter Envoy | `ingles-diamonds-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Harbor Charter Envoy carries the harbor tradition into the convergence. |
| Q♦ | servitor | Harbor First Speaker | `ingles-diamonds-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Harbor First Speaker carries the harbor tradition into the convergence. |
| K♦ | servitor | Harbor Crownless Warden | `ingles-diamonds-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Harbor Crownless Warden carries the harbor tradition into the convergence. |
| A♦ | servitor | Harbor Unwritten Compact | `ingles-diamonds-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Harbor Unwritten Compact carries the harbor tradition into the convergence. |
| 2♣ | servitor | Charter Petitioner | `ingles-clubs-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Charter Petitioner carries the charter tradition into the convergence. |
| 3♣ | servitor | Charter Harbor Watch | `ingles-clubs-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Charter Harbor Watch carries the charter tradition into the convergence. |
| 4♣ | servitor | Charter Clause Keeper | `ingles-clubs-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Charter Clause Keeper carries the charter tradition into the convergence. |
| 5♣ | servitor | Charter Island Scout | `ingles-clubs-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Charter Island Scout carries the charter tradition into the convergence. |
| 6♣ | servitor | Charter Council Guard | `ingles-clubs-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Charter Council Guard carries the charter tradition into the convergence. |
| 7♣ | servitor | Charter Public Advocate | `ingles-clubs-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Charter Public Advocate carries the charter tradition into the convergence. |
| 8♣ | servitor | Charter Fleet Delegate | `ingles-clubs-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Charter Fleet Delegate carries the charter tradition into the convergence. |
| 9♣ | servitor | Charter Common Marshal | `ingles-clubs-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Charter Common Marshal carries the charter tradition into the convergence. |
| 10♣ | servitor | Charter Accord Captain | `ingles-clubs-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Charter Accord Captain carries the charter tradition into the convergence. |
| J♣ | servitor | Charter Charter Envoy | `ingles-clubs-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Charter Charter Envoy carries the charter tradition into the convergence. |
| Q♣ | servitor | Charter First Speaker | `ingles-clubs-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Charter First Speaker carries the charter tradition into the convergence. |
| K♣ | servitor | Charter Crownless Warden | `ingles-clubs-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Charter Crownless Warden carries the charter tradition into the convergence. |
| A♣ | servitor | Charter Unwritten Compact | `ingles-clubs-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Charter Unwritten Compact carries the charter tradition into the convergence. |

## Mercaw

- Faction ID: `mercaw`
- Standard playing cards: **52**
- Constructed replacement cards: **52**

### Faction cards

| Role | Name | Ability | Rules text |
|---|---|---|---|
| Commander | Convener Mara Kest | — | Many-Star Accord — Keep several useful lines open, then concentrate them when a common purpose is chosen. |
| General | Rook Talon | — | Frontier Initiative — Adapt quickly with the cards available instead of waiting for a perfect plan. |
| City | Accord Spire | — | Federated Signal — Diverse lanes become strongest when their independent choices converge. |

### Constructed replacement cards

| Slot | Type | Name | Card ID | Rules text |
|---:|---|---|---|---|
| 2♠ | servitor | Stormwing Rook Scout | `mercaw-spades-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Stormwing Rook Scout carries the stormwing tradition into the convergence. |
| 3♠ | servitor | Stormwing Signal Runner | `mercaw-spades-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Stormwing Signal Runner carries the stormwing tradition into the convergence. |
| 4♠ | servitor | Stormwing Nest Inventor | `mercaw-spades-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Stormwing Nest Inventor carries the stormwing tradition into the convergence. |
| 5♠ | servitor | Stormwing Sky Courier | `mercaw-spades-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Stormwing Sky Courier carries the stormwing tradition into the convergence. |
| 6♠ | servitor | Stormwing Compact Guard | `mercaw-spades-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Stormwing Compact Guard carries the stormwing tradition into the convergence. |
| 7♠ | servitor | Stormwing Aerie Delegate | `mercaw-spades-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Stormwing Aerie Delegate carries the stormwing tradition into the convergence. |
| 8♠ | servitor | Stormwing Frontier Tactician | `mercaw-spades-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Stormwing Frontier Tactician carries the stormwing tradition into the convergence. |
| 9♠ | servitor | Stormwing Wind Convener | `mercaw-spades-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Stormwing Wind Convener carries the stormwing tradition into the convergence. |
| 10♠ | servitor | Stormwing Federation Captain | `mercaw-spades-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Stormwing Federation Captain carries the stormwing tradition into the convergence. |
| J♠ | servitor | Stormwing Many-Star Envoy | `mercaw-spades-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Stormwing Many-Star Envoy carries the stormwing tradition into the convergence. |
| Q♠ | servitor | Stormwing Accord Matriarch | `mercaw-spades-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Stormwing Accord Matriarch carries the stormwing tradition into the convergence. |
| K♠ | servitor | Stormwing Talon Marshal | `mercaw-spades-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Stormwing Talon Marshal carries the stormwing tradition into the convergence. |
| A♠ | servitor | Stormwing Convergent Flight | `mercaw-spades-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Stormwing Convergent Flight carries the stormwing tradition into the convergence. |
| 2♥ | servitor | Accord Rook Scout | `mercaw-hearts-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Accord Rook Scout carries the accord tradition into the convergence. |
| 3♥ | servitor | Accord Signal Runner | `mercaw-hearts-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Accord Signal Runner carries the accord tradition into the convergence. |
| 4♥ | servitor | Accord Nest Inventor | `mercaw-hearts-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Accord Nest Inventor carries the accord tradition into the convergence. |
| 5♥ | servitor | Accord Sky Courier | `mercaw-hearts-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Accord Sky Courier carries the accord tradition into the convergence. |
| 6♥ | servitor | Accord Compact Guard | `mercaw-hearts-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Accord Compact Guard carries the accord tradition into the convergence. |
| 7♥ | servitor | Accord Aerie Delegate | `mercaw-hearts-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Accord Aerie Delegate carries the accord tradition into the convergence. |
| 8♥ | servitor | Accord Frontier Tactician | `mercaw-hearts-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Accord Frontier Tactician carries the accord tradition into the convergence. |
| 9♥ | servitor | Accord Wind Convener | `mercaw-hearts-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Accord Wind Convener carries the accord tradition into the convergence. |
| 10♥ | servitor | Accord Federation Captain | `mercaw-hearts-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Accord Federation Captain carries the accord tradition into the convergence. |
| J♥ | servitor | Accord Many-Star Envoy | `mercaw-hearts-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Accord Many-Star Envoy carries the accord tradition into the convergence. |
| Q♥ | servitor | Accord Accord Matriarch | `mercaw-hearts-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Accord Accord Matriarch carries the accord tradition into the convergence. |
| K♥ | servitor | Accord Talon Marshal | `mercaw-hearts-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Accord Talon Marshal carries the accord tradition into the convergence. |
| A♥ | servitor | Accord Convergent Flight | `mercaw-hearts-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Accord Convergent Flight carries the accord tradition into the convergence. |
| 2♦ | servitor | Starbright Rook Scout | `mercaw-diamonds-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Starbright Rook Scout carries the starbright tradition into the convergence. |
| 3♦ | servitor | Starbright Signal Runner | `mercaw-diamonds-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Starbright Signal Runner carries the starbright tradition into the convergence. |
| 4♦ | servitor | Starbright Nest Inventor | `mercaw-diamonds-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Starbright Nest Inventor carries the starbright tradition into the convergence. |
| 5♦ | servitor | Starbright Sky Courier | `mercaw-diamonds-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Starbright Sky Courier carries the starbright tradition into the convergence. |
| 6♦ | servitor | Starbright Compact Guard | `mercaw-diamonds-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Starbright Compact Guard carries the starbright tradition into the convergence. |
| 7♦ | servitor | Starbright Aerie Delegate | `mercaw-diamonds-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Starbright Aerie Delegate carries the starbright tradition into the convergence. |
| 8♦ | servitor | Starbright Frontier Tactician | `mercaw-diamonds-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Starbright Frontier Tactician carries the starbright tradition into the convergence. |
| 9♦ | servitor | Starbright Wind Convener | `mercaw-diamonds-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Starbright Wind Convener carries the starbright tradition into the convergence. |
| 10♦ | servitor | Starbright Federation Captain | `mercaw-diamonds-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Starbright Federation Captain carries the starbright tradition into the convergence. |
| J♦ | servitor | Starbright Many-Star Envoy | `mercaw-diamonds-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Starbright Many-Star Envoy carries the starbright tradition into the convergence. |
| Q♦ | servitor | Starbright Accord Matriarch | `mercaw-diamonds-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Starbright Accord Matriarch carries the starbright tradition into the convergence. |
| K♦ | servitor | Starbright Talon Marshal | `mercaw-diamonds-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Starbright Talon Marshal carries the starbright tradition into the convergence. |
| A♦ | servitor | Starbright Convergent Flight | `mercaw-diamonds-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Starbright Convergent Flight carries the starbright tradition into the convergence. |
| 2♣ | servitor | Aerie Rook Scout | `mercaw-clubs-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Aerie Rook Scout carries the aerie tradition into the convergence. |
| 3♣ | servitor | Aerie Signal Runner | `mercaw-clubs-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Aerie Signal Runner carries the aerie tradition into the convergence. |
| 4♣ | servitor | Aerie Nest Inventor | `mercaw-clubs-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Aerie Nest Inventor carries the aerie tradition into the convergence. |
| 5♣ | servitor | Aerie Sky Courier | `mercaw-clubs-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Aerie Sky Courier carries the aerie tradition into the convergence. |
| 6♣ | servitor | Aerie Compact Guard | `mercaw-clubs-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Aerie Compact Guard carries the aerie tradition into the convergence. |
| 7♣ | servitor | Aerie Aerie Delegate | `mercaw-clubs-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Aerie Aerie Delegate carries the aerie tradition into the convergence. |
| 8♣ | servitor | Aerie Frontier Tactician | `mercaw-clubs-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Aerie Frontier Tactician carries the aerie tradition into the convergence. |
| 9♣ | servitor | Aerie Wind Convener | `mercaw-clubs-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Aerie Wind Convener carries the aerie tradition into the convergence. |
| 10♣ | servitor | Aerie Federation Captain | `mercaw-clubs-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Aerie Federation Captain carries the aerie tradition into the convergence. |
| J♣ | servitor | Aerie Many-Star Envoy | `mercaw-clubs-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Aerie Many-Star Envoy carries the aerie tradition into the convergence. |
| Q♣ | servitor | Aerie Accord Matriarch | `mercaw-clubs-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Aerie Accord Matriarch carries the aerie tradition into the convergence. |
| K♣ | servitor | Aerie Talon Marshal | `mercaw-clubs-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Aerie Talon Marshal carries the aerie tradition into the convergence. |
| A♣ | servitor | Aerie Convergent Flight | `mercaw-clubs-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Aerie Convergent Flight carries the aerie tradition into the convergence. |

## M'Tano

- Faction ID: `mtano`
- Standard playing cards: **52**
- Constructed replacement cards: **52**

### Faction cards

| Role | Name | Ability | Rules text |
|---|---|---|---|
| Commander | Rainkeeper Amari | — | Living Waters — Preserve options, redirect pressure, and let measured defense prepare the next advance. |
| General | Pathfinder Kito | — | Highland Paths — A formation survives by moving knowledge and strength to the lane that needs them. |
| City | Mawingu Terraces | — | Ancestral Watershed — Every victory must leave enough life and memory for what follows. |

### Constructed replacement cards

| Slot | Type | Name | Card ID | Rules text |
|---:|---|---|---|---|
| 2♠ | servitor | Stone Name Student | `mtano-spades-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Stone Name Student carries the stone tradition into the convergence. |
| 3♠ | servitor | Stone River Guide | `mtano-spades-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Stone River Guide carries the stone tradition into the convergence. |
| 4♠ | servitor | Stone Terrace Keeper | `mtano-spades-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Stone Terrace Keeper carries the stone tradition into the convergence. |
| 5♠ | servitor | Stone Veil Listener | `mtano-spades-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Stone Veil Listener carries the stone tradition into the convergence. |
| 6♠ | servitor | Stone Memory Bearer | `mtano-spades-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Stone Memory Bearer carries the stone tradition into the convergence. |
| 7♠ | servitor | Stone Savannah Warden | `mtano-spades-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Stone Savannah Warden carries the stone tradition into the convergence. |
| 8♠ | servitor | Stone Watershed Scout | `mtano-spades-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Stone Watershed Scout carries the stone tradition into the convergence. |
| 9♠ | servitor | Stone Covenant Speaker | `mtano-spades-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Stone Covenant Speaker carries the stone tradition into the convergence. |
| 10♠ | servitor | Stone Golden Defender | `mtano-spades-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Stone Golden Defender carries the stone tradition into the convergence. |
| J♠ | servitor | Stone Passage Envoy | `mtano-spades-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Stone Passage Envoy carries the stone tradition into the convergence. |
| Q♠ | servitor | Stone Rain Queen | `mtano-spades-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Stone Rain Queen carries the stone tradition into the convergence. |
| K♠ | servitor | Stone Mountain Elder | `mtano-spades-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Stone Mountain Elder carries the stone tradition into the convergence. |
| A♠ | servitor | Stone Remembered Many | `mtano-spades-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Stone Remembered Many carries the stone tradition into the convergence. |
| 2♥ | servitor | Living Name Student | `mtano-hearts-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Living Name Student carries the living tradition into the convergence. |
| 3♥ | servitor | Living River Guide | `mtano-hearts-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Living River Guide carries the living tradition into the convergence. |
| 4♥ | servitor | Living Terrace Keeper | `mtano-hearts-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Living Terrace Keeper carries the living tradition into the convergence. |
| 5♥ | servitor | Living Veil Listener | `mtano-hearts-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Living Veil Listener carries the living tradition into the convergence. |
| 6♥ | servitor | Living Memory Bearer | `mtano-hearts-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Living Memory Bearer carries the living tradition into the convergence. |
| 7♥ | servitor | Living Savannah Warden | `mtano-hearts-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Living Savannah Warden carries the living tradition into the convergence. |
| 8♥ | servitor | Living Watershed Scout | `mtano-hearts-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Living Watershed Scout carries the living tradition into the convergence. |
| 9♥ | servitor | Living Covenant Speaker | `mtano-hearts-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Living Covenant Speaker carries the living tradition into the convergence. |
| 10♥ | servitor | Living Golden Defender | `mtano-hearts-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Living Golden Defender carries the living tradition into the convergence. |
| J♥ | servitor | Living Passage Envoy | `mtano-hearts-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Living Passage Envoy carries the living tradition into the convergence. |
| Q♥ | servitor | Living Rain Queen | `mtano-hearts-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Living Rain Queen carries the living tradition into the convergence. |
| K♥ | servitor | Living Mountain Elder | `mtano-hearts-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Living Mountain Elder carries the living tradition into the convergence. |
| A♥ | servitor | Living Remembered Many | `mtano-hearts-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Living Remembered Many carries the living tradition into the convergence. |
| 2♦ | servitor | Rain Name Student | `mtano-diamonds-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Rain Name Student carries the rain tradition into the convergence. |
| 3♦ | servitor | Rain River Guide | `mtano-diamonds-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Rain River Guide carries the rain tradition into the convergence. |
| 4♦ | servitor | Rain Terrace Keeper | `mtano-diamonds-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Rain Terrace Keeper carries the rain tradition into the convergence. |
| 5♦ | servitor | Rain Veil Listener | `mtano-diamonds-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Rain Veil Listener carries the rain tradition into the convergence. |
| 6♦ | servitor | Rain Memory Bearer | `mtano-diamonds-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Rain Memory Bearer carries the rain tradition into the convergence. |
| 7♦ | servitor | Rain Savannah Warden | `mtano-diamonds-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Rain Savannah Warden carries the rain tradition into the convergence. |
| 8♦ | servitor | Rain Watershed Scout | `mtano-diamonds-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Rain Watershed Scout carries the rain tradition into the convergence. |
| 9♦ | servitor | Rain Covenant Speaker | `mtano-diamonds-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Rain Covenant Speaker carries the rain tradition into the convergence. |
| 10♦ | servitor | Rain Golden Defender | `mtano-diamonds-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Rain Golden Defender carries the rain tradition into the convergence. |
| J♦ | servitor | Rain Passage Envoy | `mtano-diamonds-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Rain Passage Envoy carries the rain tradition into the convergence. |
| Q♦ | servitor | Rain Rain Queen | `mtano-diamonds-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Rain Rain Queen carries the rain tradition into the convergence. |
| K♦ | servitor | Rain Mountain Elder | `mtano-diamonds-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Rain Mountain Elder carries the rain tradition into the convergence. |
| A♦ | servitor | Rain Remembered Many | `mtano-diamonds-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Rain Remembered Many carries the rain tradition into the convergence. |
| 2♣ | servitor | Ancestor Name Student | `mtano-clubs-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Ancestor Name Student carries the ancestor tradition into the convergence. |
| 3♣ | servitor | Ancestor River Guide | `mtano-clubs-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Ancestor River Guide carries the ancestor tradition into the convergence. |
| 4♣ | servitor | Ancestor Terrace Keeper | `mtano-clubs-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Ancestor Terrace Keeper carries the ancestor tradition into the convergence. |
| 5♣ | servitor | Ancestor Veil Listener | `mtano-clubs-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Ancestor Veil Listener carries the ancestor tradition into the convergence. |
| 6♣ | servitor | Ancestor Memory Bearer | `mtano-clubs-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Ancestor Memory Bearer carries the ancestor tradition into the convergence. |
| 7♣ | servitor | Ancestor Savannah Warden | `mtano-clubs-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Ancestor Savannah Warden carries the ancestor tradition into the convergence. |
| 8♣ | servitor | Ancestor Watershed Scout | `mtano-clubs-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Ancestor Watershed Scout carries the ancestor tradition into the convergence. |
| 9♣ | servitor | Ancestor Covenant Speaker | `mtano-clubs-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Ancestor Covenant Speaker carries the ancestor tradition into the convergence. |
| 10♣ | servitor | Ancestor Golden Defender | `mtano-clubs-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Ancestor Golden Defender carries the ancestor tradition into the convergence. |
| J♣ | servitor | Ancestor Passage Envoy | `mtano-clubs-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Ancestor Passage Envoy carries the ancestor tradition into the convergence. |
| Q♣ | servitor | Ancestor Rain Queen | `mtano-clubs-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Ancestor Rain Queen carries the ancestor tradition into the convergence. |
| K♣ | servitor | Ancestor Mountain Elder | `mtano-clubs-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Ancestor Mountain Elder carries the ancestor tradition into the convergence. |
| A♣ | servitor | Ancestor Remembered Many | `mtano-clubs-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Ancestor Remembered Many carries the ancestor tradition into the convergence. |

## Russo

- Faction ID: `russo`
- Standard playing cards: **52**
- Constructed replacement cards: **52**

### Faction cards

| Role | Name | Ability | Rules text |
|---|---|---|---|
| Commander | Warden Irina Volkov | — | Winter Oath — Endure early pressure, protect the formation, and commit strength only when the line can hold. |
| General | Mikhail Saran | — | Shared Hearth — Resources kept in reserve can preserve more than one lane through a long contest. |
| City | Novaya Hearth | — | The Long Thaw — Resilience is strongest when authority remains answerable to the people enduring beside it. |

### Constructed replacement cards

| Slot | Type | Name | Card ID | Rules text |
|---:|---|---|---|---|
| 2♠ | servitor | Winter Snow Scout | `russo-spades-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Winter Snow Scout carries the winter tradition into the convergence. |
| 3♠ | servitor | Winter Store Keeper | `russo-spades-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Winter Store Keeper carries the winter tradition into the convergence. |
| 4♠ | servitor | Winter Pine Guard | `russo-spades-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Winter Pine Guard carries the winter tradition into the convergence. |
| 5♠ | servitor | Winter Hearth Worker | `russo-spades-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Winter Hearth Worker carries the winter tradition into the convergence. |
| 6♠ | servitor | Winter Ice Road Warden | `russo-spades-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Winter Ice Road Warden carries the winter tradition into the convergence. |
| 7♠ | servitor | Winter Common Steward | `russo-spades-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Winter Common Steward carries the winter tradition into the convergence. |
| 8♠ | servitor | Winter Foundry Captain | `russo-spades-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Winter Foundry Captain carries the winter tradition into the convergence. |
| 9♠ | servitor | Winter Thaw Engineer | `russo-spades-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Winter Thaw Engineer carries the winter tradition into the convergence. |
| 10♠ | servitor | Winter Oath Defender | `russo-spades-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Winter Oath Defender carries the winter tradition into the convergence. |
| J♠ | servitor | Winter Winter Envoy | `russo-spades-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Winter Winter Envoy carries the winter tradition into the convergence. |
| Q♠ | servitor | Winter Hearth Matriarch | `russo-spades-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Winter Hearth Matriarch carries the winter tradition into the convergence. |
| K♠ | servitor | Winter Forest Marshal | `russo-spades-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Winter Forest Marshal carries the winter tradition into the convergence. |
| A♠ | servitor | Winter Long Winter Bear | `russo-spades-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Winter Long Winter Bear carries the winter tradition into the convergence. |
| 2♥ | servitor | Hearth Snow Scout | `russo-hearts-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Hearth Snow Scout carries the hearth tradition into the convergence. |
| 3♥ | servitor | Hearth Store Keeper | `russo-hearts-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Hearth Store Keeper carries the hearth tradition into the convergence. |
| 4♥ | servitor | Hearth Pine Guard | `russo-hearts-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Hearth Pine Guard carries the hearth tradition into the convergence. |
| 5♥ | servitor | Hearth Hearth Worker | `russo-hearts-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Hearth Hearth Worker carries the hearth tradition into the convergence. |
| 6♥ | servitor | Hearth Ice Road Warden | `russo-hearts-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Hearth Ice Road Warden carries the hearth tradition into the convergence. |
| 7♥ | servitor | Hearth Common Steward | `russo-hearts-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Hearth Common Steward carries the hearth tradition into the convergence. |
| 8♥ | servitor | Hearth Foundry Captain | `russo-hearts-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Hearth Foundry Captain carries the hearth tradition into the convergence. |
| 9♥ | servitor | Hearth Thaw Engineer | `russo-hearts-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Hearth Thaw Engineer carries the hearth tradition into the convergence. |
| 10♥ | servitor | Hearth Oath Defender | `russo-hearts-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Hearth Oath Defender carries the hearth tradition into the convergence. |
| J♥ | servitor | Hearth Winter Envoy | `russo-hearts-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Hearth Winter Envoy carries the hearth tradition into the convergence. |
| Q♥ | servitor | Hearth Hearth Matriarch | `russo-hearts-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Hearth Hearth Matriarch carries the hearth tradition into the convergence. |
| K♥ | servitor | Hearth Forest Marshal | `russo-hearts-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Hearth Forest Marshal carries the hearth tradition into the convergence. |
| A♥ | servitor | Hearth Long Winter Bear | `russo-hearts-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Hearth Long Winter Bear carries the hearth tradition into the convergence. |
| 2♦ | servitor | Iron Snow Scout | `russo-diamonds-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Iron Snow Scout carries the iron tradition into the convergence. |
| 3♦ | servitor | Iron Store Keeper | `russo-diamonds-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Iron Store Keeper carries the iron tradition into the convergence. |
| 4♦ | servitor | Iron Pine Guard | `russo-diamonds-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Iron Pine Guard carries the iron tradition into the convergence. |
| 5♦ | servitor | Iron Hearth Worker | `russo-diamonds-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Iron Hearth Worker carries the iron tradition into the convergence. |
| 6♦ | servitor | Iron Ice Road Warden | `russo-diamonds-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Iron Ice Road Warden carries the iron tradition into the convergence. |
| 7♦ | servitor | Iron Common Steward | `russo-diamonds-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Iron Common Steward carries the iron tradition into the convergence. |
| 8♦ | servitor | Iron Foundry Captain | `russo-diamonds-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Iron Foundry Captain carries the iron tradition into the convergence. |
| 9♦ | servitor | Iron Thaw Engineer | `russo-diamonds-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Iron Thaw Engineer carries the iron tradition into the convergence. |
| 10♦ | servitor | Iron Oath Defender | `russo-diamonds-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Iron Oath Defender carries the iron tradition into the convergence. |
| J♦ | servitor | Iron Winter Envoy | `russo-diamonds-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Iron Winter Envoy carries the iron tradition into the convergence. |
| Q♦ | servitor | Iron Hearth Matriarch | `russo-diamonds-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Iron Hearth Matriarch carries the iron tradition into the convergence. |
| K♦ | servitor | Iron Forest Marshal | `russo-diamonds-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Iron Forest Marshal carries the iron tradition into the convergence. |
| A♦ | servitor | Iron Long Winter Bear | `russo-diamonds-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Iron Long Winter Bear carries the iron tradition into the convergence. |
| 2♣ | servitor | Forest Snow Scout | `russo-clubs-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Forest Snow Scout carries the forest tradition into the convergence. |
| 3♣ | servitor | Forest Store Keeper | `russo-clubs-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Forest Store Keeper carries the forest tradition into the convergence. |
| 4♣ | servitor | Forest Pine Guard | `russo-clubs-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Forest Pine Guard carries the forest tradition into the convergence. |
| 5♣ | servitor | Forest Hearth Worker | `russo-clubs-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Forest Hearth Worker carries the forest tradition into the convergence. |
| 6♣ | servitor | Forest Ice Road Warden | `russo-clubs-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Forest Ice Road Warden carries the forest tradition into the convergence. |
| 7♣ | servitor | Forest Common Steward | `russo-clubs-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Forest Common Steward carries the forest tradition into the convergence. |
| 8♣ | servitor | Forest Foundry Captain | `russo-clubs-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Forest Foundry Captain carries the forest tradition into the convergence. |
| 9♣ | servitor | Forest Thaw Engineer | `russo-clubs-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Forest Thaw Engineer carries the forest tradition into the convergence. |
| 10♣ | servitor | Forest Oath Defender | `russo-clubs-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Forest Oath Defender carries the forest tradition into the convergence. |
| J♣ | servitor | Forest Winter Envoy | `russo-clubs-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Forest Winter Envoy carries the forest tradition into the convergence. |
| Q♣ | servitor | Forest Hearth Matriarch | `russo-clubs-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Forest Hearth Matriarch carries the forest tradition into the convergence. |
| K♣ | servitor | Forest Forest Marshal | `russo-clubs-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Forest Forest Marshal carries the forest tradition into the convergence. |
| A♣ | servitor | Forest Long Winter Bear | `russo-clubs-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Forest Long Winter Bear carries the forest tradition into the convergence. |

## Zynarth

- Faction ID: `zynarth`
- Standard playing cards: **52**
- Constructed replacement cards: **22**

### Faction cards

| Role | Name | Ability | Rules text |
|---|---|---|---|
| Commander | Broodmother Zalara | — | At the start of your turn, create an Egg in an empty lane. Once per turn, hatch an Egg into a Worker, Soldier, or Guard. |
| General (`klar`) | K'Lar, Biomass Keeper | — | Once per turn, sacrifice two Underlings you control to draw one card. |
| City | Brood Nest | — | The first time you hatch each turn, you may hatch a second Egg into a Worker. |

### Constructed replacement cards

| Slot | Type | Name | Card ID | Rules text |
|---:|---|---|---|---|
| 2♠ | servitor | Spore Runner | `zynarth-spore-runner` | On your first attack each turn, this gets +1 value if you control an Underling. |
| 2♥ | servitor | Nutrient Tender | `zynarth-nutrient-tender` | This gets +1 value while attacking if you control an Egg, Worker, Soldier, or Guard. |
| 3♦ | servitor | Brood Shepherd | `zynarth-brood-shepherd` | When this attacks from a lane, it gets +1 value. |
| 4♣ | servitor | Carapace Keeper | `zynarth-carapace-keeper` | When this blocks, it gets +1 value if you control an Underling. |
| 5♠ | servitor | Adaptive Stalker | `zynarth-adaptive-stalker` | When this attacks, it gets +1 value for each different Underling form you control, up to +2. |
| 5♥ | servitor | Hunting Cluster | `zynarth-hunting-cluster` | When this attacks, it gets +1 value for each other Underling you control, up to +2. |
| 6♦ | servitor | Biomass Reclaimer | `zynarth-biomass-reclaimer` | The first time an Underling you control is defeated each turn, your next attack gets +1 value. |
| 7♣ | servitor | Hive Warden | `zynarth-hive-warden` | When this blocks from a lane, it gets +2 value. |
| 9♠ | servitor | Brood Titan | `zynarth-brood-titan` | When this attacks, it gets +2 value if you control two or more Underlings. |
| 10♥ | servitor | Ancient Devourer | `zynarth-ancient-devourer` | When this attacks, it gets +1 value for each Underling you control, up to +3. |
| 3♣ | biomorph | Spawning Pool | `zynarth-spawning-pool` | While this occupies a support slot, the first Underling you hatch each turn gets +1 value until end of turn. |
| 4♦ | biomorph | Pheromone Route | `zynarth-pheromone-route` | While this occupies a support slot, your first attack each turn made by an Underling gets +1 value. |
| 6♠ | biomorph | Hardened Nursery | `zynarth-hardened-nursery` | While this occupies a support slot, your first Underling block each turn gets +1 value. |
| 6♥ | biomorph | Metabolic Web | `zynarth-metabolic-web` | While this occupies a support slot, your attacks get +1 value while you control three Underlings. |
| 7♦ | biomorph | Adaptive Carapace | `zynarth-adaptive-carapace` | While this occupies a support slot, once each turn after an Underling blocks, prevent 1 damage. |
| 8♣ | biomorph | Carrion Vat | `zynarth-carrion-vat` | While this occupies a support slot, the first time one of your Underlings is defeated each turn, gain 1 life. |
| 9♦ | biomorph | Ravenous Cycle | `zynarth-ravenous-cycle` | While this occupies a support slot, after you sacrifice an Underling, your next attack this turn gets +2 value. |
| 10♣ | biomorph | Broodmind Synapse | `zynarth-broodmind-synapse` | While this occupies a support slot, your Underlings get +1 value while attacking or blocking. |
| J♦ | servitor | Broodmind Herald | `zynarth-broodmind-herald` | This card has no additional ability beyond the normal rules for its card type and printed value. The colony hears its arrival through a thousand borrowed senses. |
| Q♥ | servitor | Gene-Mother | `zynarth-gene-mother` | This card has no additional ability beyond the normal rules for its card type and printed value. Her descendants carry answers to hungers not yet encountered. |
| K♣ | servitor | Apex Reclaimer | `zynarth-apex-reclaimer` | This card has no additional ability beyond the normal rules for its card type and printed value. Nothing consumed is wasted; nothing defeated is truly lost. |
| A♠ | biomorph | Worldseed Queen | `zynarth-worldseed-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Within the seed waits an ecology eager to become a world. |

## Astral Vanguard

- Faction ID: `astral-vanguard`
- Standard playing cards: **52**
- Constructed replacement cards: **22**

### Faction cards

| Role | Name | Ability | Rules text |
|---|---|---|---|
| Commander | High Marshal Alden | — | Once per turn, deploy the top card of your deck to an empty lane if it is a Servitor with printed value 3 or less. |
| General (`myra-cross`) | Sergeant Myra Cross | — | Once per turn, put a card from your hand on top of your deck. Your next payment this turn gets +2 value. |
| City | Vanguard Outpost | — | Whenever a Servitor enters one of your lanes directly from your deck, it gets +1 value until end of turn. |

### Constructed replacement cards

| Slot | Type | Name | Card ID | Rules text |
|---:|---|---|---|---|
| 2♣ | servitor | Orbital Pathfinder | `astral-vanguard-orbital-pathfinder` | On your first attack each turn, this gets +1 value if you staged a card this turn. |
| 3♠ | servitor | Breach Team | `astral-vanguard-breach-team` | When this attacks from a lane, it gets +1 value. |
| 3♥ | servitor | Shock Trooper | `astral-vanguard-shock-trooper` | If this entered a lane directly from your deck this turn, it gets +2 value while attacking. |
| 4♦ | servitor | Electronic Warfare Specialist | `astral-vanguard-electronic-warfare-specialist` | When this attacks after an attack of a different suit, it gets +1 value. |
| 5♣ | servitor | Incendiary Trooper | `astral-vanguard-incendiary-trooper` | When this attacks, it gets +1 value if the opponent controls a lane card. |
| 5♠ | servitor | Combat Medic | `astral-vanguard-combat-medic` | After this blocks and you take no damage, gain 1 life. |
| 6♥ | servitor | Jump Trooper | `astral-vanguard-jump-trooper` | When this attacks from your hand, it gets +1 value. |
| 7♦ | servitor | Powered Breacher | `astral-vanguard-powered-breacher` | When this attacks from a lane, it gets +2 value if that lane has an Operation. |
| 7♣ | servitor | EMP Grenadier | `astral-vanguard-emp-grenadier` | When this blocks, it gets +1 value for each Operation you control, up to +2. |
| 10♠ | servitor | Aegis Shock Company | `astral-vanguard-aegis-shock-company` | When this attacks from a lane, it gets +3 value if it entered from your deck this turn. |
| 2♥ | operation | Drop Pod Beacon | `astral-vanguard-drop-pod-beacon` | While this occupies a support slot, the first Servitor deployed from your deck each turn gets +1 additional value. |
| 4♠ | operation | Forward Supply Cache | `astral-vanguard-forward-supply-cache` | While this occupies a support slot, your first payment after staging a card gets +1 value. |
| 6♣ | operation | Field Triage | `astral-vanguard-field-triage` | While this occupies a support slot, the first time you block without taking damage each turn, gain 1 life. |
| 6♠ | operation | Suppression Order | `astral-vanguard-suppression-order` | While this occupies a support slot, your first lane attack each turn gets +1 value. |
| 8♥ | operation | Breach Charge | `astral-vanguard-breach-charge` | While this occupies a support slot, your first Servitor attack from its lane each turn gets +2 value. |
| 8♦ | operation | Tactical Relay | `astral-vanguard-tactical-relay` | While this occupies a support slot, the first staged card you play each turn gets +1 value. |
| 9♣ | operation | Orbital Interdiction | `astral-vanguard-orbital-interdiction` | While this occupies a support slot, your attacks after a different-suit attack get +1 value. |
| 10♦ | operation | Fleet Command | `astral-vanguard-fleet-command` | While this occupies a support slot, Servitors deployed from your deck get +2 value until end of turn instead of +1. |
| J♣ | servitor | Recon Commander | `astral-vanguard-recon-commander` | This card has no additional ability beyond the normal rules for its card type and printed value. First contact begins with a question carried beyond the map. |
| Q♦ | operation | Fleet Strategist | `astral-vanguard-fleet-strategist` | This card has no additional ability beyond the normal rules for its card type and printed value. Contradictory doctrines become one plan without losing their names. |
| K♥ | servitor | Vanguard Marshal | `astral-vanguard-vanguard-marshal` | This card has no additional ability beyond the normal rules for its card type and printed value. Every formation changes when the unfamiliar proves useful. |
| A♠ | servitor | Convergence Admiral | `astral-vanguard-convergence-admiral` | This card has no additional ability beyond the normal rules for its card type and printed value. The fleet advances by connecting what others keep apart. |

## Voltari

- Faction ID: `voltari`
- Standard playing cards: **52**
- Constructed replacement cards: **52**

### Faction cards

| Role | Name | Ability | Rules text |
|---|---|---|---|
| Commander | Stormlord Veyra | — | Campaign faction: build localized conduit networks while preserving independent command and civilian power. |
| General | Warden Kryos | — | Campaign faction: overload isolated systems to break stronger centralized machines. |
| City | Voltara Skyhold | — | Campaign faction: storm power, defensive anchors, and local shutdown keys keep the network accountable. |

### Constructed replacement cards

| Slot | Type | Name | Card ID | Rules text |
|---:|---|---|---|---|
| 2♠ | servitor | Null Relay Adept | `voltari-spades-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Null Relay Adept carries the null tradition into the convergence. |
| 3♠ | servitor | Null Grid Surveyor | `voltari-spades-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Null Grid Surveyor carries the null tradition into the convergence. |
| 4♠ | servitor | Null Signal Warden | `voltari-spades-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Null Signal Warden carries the null tradition into the convergence. |
| 5♠ | servitor | Null Process Auditor | `voltari-spades-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Null Process Auditor carries the null tradition into the convergence. |
| 6♠ | servitor | Null Energy Broker | `voltari-spades-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Null Energy Broker carries the null tradition into the convergence. |
| 7♠ | servitor | Null Consent Keeper | `voltari-spades-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Null Consent Keeper carries the null tradition into the convergence. |
| 8♠ | servitor | Null Pattern Engineer | `voltari-spades-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Null Pattern Engineer carries the null tradition into the convergence. |
| 9♠ | servitor | Null System Mediator | `voltari-spades-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Null System Mediator carries the null tradition into the convergence. |
| 10♠ | servitor | Null Anchor Architect | `voltari-spades-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Null Anchor Architect carries the null tradition into the convergence. |
| J♠ | servitor | Null Optimization Envoy | `voltari-spades-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Null Optimization Envoy carries the null tradition into the convergence. |
| Q♠ | servitor | Null Circuit Matriarch | `voltari-spades-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Null Circuit Matriarch carries the null tradition into the convergence. |
| K♠ | servitor | Null Process Sovereign | `voltari-spades-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Null Process Sovereign carries the null tradition into the convergence. |
| A♠ | servitor | Null Prime Continuity | `voltari-spades-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Null Prime Continuity carries the null tradition into the convergence. |
| 2♥ | servitor | Sovereign Relay Adept | `voltari-hearts-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Sovereign Relay Adept carries the sovereign tradition into the convergence. |
| 3♥ | servitor | Sovereign Grid Surveyor | `voltari-hearts-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Sovereign Grid Surveyor carries the sovereign tradition into the convergence. |
| 4♥ | servitor | Sovereign Signal Warden | `voltari-hearts-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Sovereign Signal Warden carries the sovereign tradition into the convergence. |
| 5♥ | servitor | Sovereign Process Auditor | `voltari-hearts-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Sovereign Process Auditor carries the sovereign tradition into the convergence. |
| 6♥ | servitor | Sovereign Energy Broker | `voltari-hearts-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Sovereign Energy Broker carries the sovereign tradition into the convergence. |
| 7♥ | servitor | Sovereign Consent Keeper | `voltari-hearts-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Sovereign Consent Keeper carries the sovereign tradition into the convergence. |
| 8♥ | servitor | Sovereign Pattern Engineer | `voltari-hearts-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Sovereign Pattern Engineer carries the sovereign tradition into the convergence. |
| 9♥ | servitor | Sovereign System Mediator | `voltari-hearts-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Sovereign System Mediator carries the sovereign tradition into the convergence. |
| 10♥ | servitor | Sovereign Anchor Architect | `voltari-hearts-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Sovereign Anchor Architect carries the sovereign tradition into the convergence. |
| J♥ | servitor | Sovereign Optimization Envoy | `voltari-hearts-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Sovereign Optimization Envoy carries the sovereign tradition into the convergence. |
| Q♥ | servitor | Sovereign Circuit Matriarch | `voltari-hearts-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Sovereign Circuit Matriarch carries the sovereign tradition into the convergence. |
| K♥ | servitor | Sovereign Process Sovereign | `voltari-hearts-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Sovereign Process Sovereign carries the sovereign tradition into the convergence. |
| A♥ | servitor | Sovereign Prime Continuity | `voltari-hearts-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Sovereign Prime Continuity carries the sovereign tradition into the convergence. |
| 2♦ | servitor | Golden Relay Adept | `voltari-diamonds-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Golden Relay Adept carries the golden tradition into the convergence. |
| 3♦ | servitor | Golden Grid Surveyor | `voltari-diamonds-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Golden Grid Surveyor carries the golden tradition into the convergence. |
| 4♦ | servitor | Golden Signal Warden | `voltari-diamonds-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Golden Signal Warden carries the golden tradition into the convergence. |
| 5♦ | servitor | Golden Process Auditor | `voltari-diamonds-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Golden Process Auditor carries the golden tradition into the convergence. |
| 6♦ | servitor | Golden Energy Broker | `voltari-diamonds-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Golden Energy Broker carries the golden tradition into the convergence. |
| 7♦ | servitor | Golden Consent Keeper | `voltari-diamonds-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Golden Consent Keeper carries the golden tradition into the convergence. |
| 8♦ | servitor | Golden Pattern Engineer | `voltari-diamonds-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Golden Pattern Engineer carries the golden tradition into the convergence. |
| 9♦ | servitor | Golden System Mediator | `voltari-diamonds-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Golden System Mediator carries the golden tradition into the convergence. |
| 10♦ | servitor | Golden Anchor Architect | `voltari-diamonds-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Golden Anchor Architect carries the golden tradition into the convergence. |
| J♦ | servitor | Golden Optimization Envoy | `voltari-diamonds-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Golden Optimization Envoy carries the golden tradition into the convergence. |
| Q♦ | servitor | Golden Circuit Matriarch | `voltari-diamonds-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Golden Circuit Matriarch carries the golden tradition into the convergence. |
| K♦ | servitor | Golden Process Sovereign | `voltari-diamonds-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Golden Process Sovereign carries the golden tradition into the convergence. |
| A♦ | servitor | Golden Prime Continuity | `voltari-diamonds-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Golden Prime Continuity carries the golden tradition into the convergence. |
| 2♣ | servitor | Conduit Relay Adept | `voltari-clubs-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Conduit Relay Adept carries the conduit tradition into the convergence. |
| 3♣ | servitor | Conduit Grid Surveyor | `voltari-clubs-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Conduit Grid Surveyor carries the conduit tradition into the convergence. |
| 4♣ | servitor | Conduit Signal Warden | `voltari-clubs-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Conduit Signal Warden carries the conduit tradition into the convergence. |
| 5♣ | servitor | Conduit Process Auditor | `voltari-clubs-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Conduit Process Auditor carries the conduit tradition into the convergence. |
| 6♣ | servitor | Conduit Energy Broker | `voltari-clubs-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Conduit Energy Broker carries the conduit tradition into the convergence. |
| 7♣ | servitor | Conduit Consent Keeper | `voltari-clubs-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Conduit Consent Keeper carries the conduit tradition into the convergence. |
| 8♣ | servitor | Conduit Pattern Engineer | `voltari-clubs-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Conduit Pattern Engineer carries the conduit tradition into the convergence. |
| 9♣ | servitor | Conduit System Mediator | `voltari-clubs-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Conduit System Mediator carries the conduit tradition into the convergence. |
| 10♣ | servitor | Conduit Anchor Architect | `voltari-clubs-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Conduit Anchor Architect carries the conduit tradition into the convergence. |
| J♣ | servitor | Conduit Optimization Envoy | `voltari-clubs-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Conduit Optimization Envoy carries the conduit tradition into the convergence. |
| Q♣ | servitor | Conduit Circuit Matriarch | `voltari-clubs-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Conduit Circuit Matriarch carries the conduit tradition into the convergence. |
| K♣ | servitor | Conduit Process Sovereign | `voltari-clubs-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Conduit Process Sovereign carries the conduit tradition into the convergence. |
| A♣ | servitor | Conduit Prime Continuity | `voltari-clubs-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Conduit Prime Continuity carries the conduit tradition into the convergence. |

## XenDra

- Faction ID: `xendra`
- Standard playing cards: **52**
- Constructed replacement cards: **52**

### Faction cards

| Role | Name | Ability | Rules text |
|---|---|---|---|
| Commander | Elias Varen, Final Conduit | — | Campaign faction: survive the Deep Currents while reality changes around the battle. |
| General | Syllith, the Echoing Child | — | Campaign faction: memories, dialogue, and repeated attacks become unreliable. |
| City | The Deep Currents | — | Campaign faction: each chapter reveals more of the XenDra ritual beneath Reath. |

### Constructed replacement cards

| Slot | Type | Name | Card ID | Rules text |
|---:|---|---|---|---|
| 2♠ | servitor | Absent Distant Witness | `xendra-spades-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Absent Distant Witness carries the absent tradition into the convergence. |
| 3♠ | servitor | Absent Borrowed Reflection | `xendra-spades-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Absent Borrowed Reflection carries the absent tradition into the convergence. |
| 4♠ | servitor | Absent Unfixed Shape | `xendra-spades-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Absent Unfixed Shape carries the absent tradition into the convergence. |
| 5♠ | servitor | Absent Horizon Listener | `xendra-spades-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Absent Horizon Listener carries the absent tradition into the convergence. |
| 6♠ | servitor | Absent Memory Current | `xendra-spades-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Absent Memory Current carries the absent tradition into the convergence. |
| 7♠ | servitor | Absent Aspect Weaver | `xendra-spades-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Absent Aspect Weaver carries the absent tradition into the convergence. |
| 8♠ | servitor | Absent Threshold Echo | `xendra-spades-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Absent Threshold Echo carries the absent tradition into the convergence. |
| 9♠ | servitor | Absent Impossible Pilgrim | `xendra-spades-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Absent Impossible Pilgrim carries the absent tradition into the convergence. |
| 10♠ | servitor | Absent Veiled Harbinger | `xendra-spades-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Absent Veiled Harbinger carries the absent tradition into the convergence. |
| J♠ | servitor | Absent Deep Voice | `xendra-spades-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Absent Deep Voice carries the absent tradition into the convergence. |
| Q♠ | servitor | Absent Queen of Angles | `xendra-spades-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Absent Queen of Angles carries the absent tradition into the convergence. |
| K♠ | servitor | Absent King Without Form | `xendra-spades-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Absent King Without Form carries the absent tradition into the convergence. |
| A♠ | servitor | Absent Total Eclipse | `xendra-spades-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Absent Total Eclipse carries the absent tradition into the convergence. |
| 2♥ | servitor | Dreaming Distant Witness | `xendra-hearts-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Dreaming Distant Witness carries the dreaming tradition into the convergence. |
| 3♥ | servitor | Dreaming Borrowed Reflection | `xendra-hearts-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Dreaming Borrowed Reflection carries the dreaming tradition into the convergence. |
| 4♥ | servitor | Dreaming Unfixed Shape | `xendra-hearts-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Dreaming Unfixed Shape carries the dreaming tradition into the convergence. |
| 5♥ | servitor | Dreaming Horizon Listener | `xendra-hearts-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Dreaming Horizon Listener carries the dreaming tradition into the convergence. |
| 6♥ | servitor | Dreaming Memory Current | `xendra-hearts-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Dreaming Memory Current carries the dreaming tradition into the convergence. |
| 7♥ | servitor | Dreaming Aspect Weaver | `xendra-hearts-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Dreaming Aspect Weaver carries the dreaming tradition into the convergence. |
| 8♥ | servitor | Dreaming Threshold Echo | `xendra-hearts-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Dreaming Threshold Echo carries the dreaming tradition into the convergence. |
| 9♥ | servitor | Dreaming Impossible Pilgrim | `xendra-hearts-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Dreaming Impossible Pilgrim carries the dreaming tradition into the convergence. |
| 10♥ | servitor | Dreaming Veiled Harbinger | `xendra-hearts-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Dreaming Veiled Harbinger carries the dreaming tradition into the convergence. |
| J♥ | servitor | Dreaming Deep Voice | `xendra-hearts-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Dreaming Deep Voice carries the dreaming tradition into the convergence. |
| Q♥ | servitor | Dreaming Queen of Angles | `xendra-hearts-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Dreaming Queen of Angles carries the dreaming tradition into the convergence. |
| K♥ | servitor | Dreaming King Without Form | `xendra-hearts-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Dreaming King Without Form carries the dreaming tradition into the convergence. |
| A♥ | servitor | Dreaming Total Eclipse | `xendra-hearts-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Dreaming Total Eclipse carries the dreaming tradition into the convergence. |
| 2♦ | servitor | Prismatic Distant Witness | `xendra-diamonds-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Prismatic Distant Witness carries the prismatic tradition into the convergence. |
| 3♦ | servitor | Prismatic Borrowed Reflection | `xendra-diamonds-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Prismatic Borrowed Reflection carries the prismatic tradition into the convergence. |
| 4♦ | servitor | Prismatic Unfixed Shape | `xendra-diamonds-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Prismatic Unfixed Shape carries the prismatic tradition into the convergence. |
| 5♦ | servitor | Prismatic Horizon Listener | `xendra-diamonds-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Prismatic Horizon Listener carries the prismatic tradition into the convergence. |
| 6♦ | servitor | Prismatic Memory Current | `xendra-diamonds-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Prismatic Memory Current carries the prismatic tradition into the convergence. |
| 7♦ | servitor | Prismatic Aspect Weaver | `xendra-diamonds-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Prismatic Aspect Weaver carries the prismatic tradition into the convergence. |
| 8♦ | servitor | Prismatic Threshold Echo | `xendra-diamonds-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Prismatic Threshold Echo carries the prismatic tradition into the convergence. |
| 9♦ | servitor | Prismatic Impossible Pilgrim | `xendra-diamonds-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Prismatic Impossible Pilgrim carries the prismatic tradition into the convergence. |
| 10♦ | servitor | Prismatic Veiled Harbinger | `xendra-diamonds-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Prismatic Veiled Harbinger carries the prismatic tradition into the convergence. |
| J♦ | servitor | Prismatic Deep Voice | `xendra-diamonds-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Prismatic Deep Voice carries the prismatic tradition into the convergence. |
| Q♦ | servitor | Prismatic Queen of Angles | `xendra-diamonds-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Prismatic Queen of Angles carries the prismatic tradition into the convergence. |
| K♦ | servitor | Prismatic King Without Form | `xendra-diamonds-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Prismatic King Without Form carries the prismatic tradition into the convergence. |
| A♦ | servitor | Prismatic Total Eclipse | `xendra-diamonds-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Prismatic Total Eclipse carries the prismatic tradition into the convergence. |
| 2♣ | servitor | Resonant Distant Witness | `xendra-clubs-2` | This card has no additional ability beyond the normal rules for its card type and printed value. Resonant Distant Witness carries the resonant tradition into the convergence. |
| 3♣ | servitor | Resonant Borrowed Reflection | `xendra-clubs-3` | This card has no additional ability beyond the normal rules for its card type and printed value. Resonant Borrowed Reflection carries the resonant tradition into the convergence. |
| 4♣ | servitor | Resonant Unfixed Shape | `xendra-clubs-4` | This card has no additional ability beyond the normal rules for its card type and printed value. Resonant Unfixed Shape carries the resonant tradition into the convergence. |
| 5♣ | servitor | Resonant Horizon Listener | `xendra-clubs-5` | This card has no additional ability beyond the normal rules for its card type and printed value. Resonant Horizon Listener carries the resonant tradition into the convergence. |
| 6♣ | servitor | Resonant Memory Current | `xendra-clubs-6` | This card has no additional ability beyond the normal rules for its card type and printed value. Resonant Memory Current carries the resonant tradition into the convergence. |
| 7♣ | servitor | Resonant Aspect Weaver | `xendra-clubs-7` | This card has no additional ability beyond the normal rules for its card type and printed value. Resonant Aspect Weaver carries the resonant tradition into the convergence. |
| 8♣ | servitor | Resonant Threshold Echo | `xendra-clubs-8` | This card has no additional ability beyond the normal rules for its card type and printed value. Resonant Threshold Echo carries the resonant tradition into the convergence. |
| 9♣ | servitor | Resonant Impossible Pilgrim | `xendra-clubs-9` | This card has no additional ability beyond the normal rules for its card type and printed value. Resonant Impossible Pilgrim carries the resonant tradition into the convergence. |
| 10♣ | servitor | Resonant Veiled Harbinger | `xendra-clubs-10` | This card has no additional ability beyond the normal rules for its card type and printed value. Resonant Veiled Harbinger carries the resonant tradition into the convergence. |
| J♣ | servitor | Resonant Deep Voice | `xendra-clubs-jack` | This card has no additional ability beyond the normal rules for its card type and printed value. Resonant Deep Voice carries the resonant tradition into the convergence. |
| Q♣ | servitor | Resonant Queen of Angles | `xendra-clubs-queen` | This card has no additional ability beyond the normal rules for its card type and printed value. Resonant Queen of Angles carries the resonant tradition into the convergence. |
| K♣ | servitor | Resonant King Without Form | `xendra-clubs-king` | This card has no additional ability beyond the normal rules for its card type and printed value. Resonant King Without Form carries the resonant tradition into the convergence. |
| A♣ | servitor | Resonant Total Eclipse | `xendra-clubs-ace` | This card has no additional ability beyond the normal rules for its card type and printed value. Resonant Total Eclipse carries the resonant tradition into the convergence. |

## Standard 52-card deck

Each faction's standard deck contains the following rank and suit combinations:

| Suit | Ranks | Count |
|---|---|---:|
| Spades | 2, 3, 4, 5, 6, 7, 8, 9, 10, Jack, Queen, King, Ace | 13 |
| Hearts | 2, 3, 4, 5, 6, 7, 8, 9, 10, Jack, Queen, King, Ace | 13 |
| Diamonds | 2, 3, 4, 5, 6, 7, 8, 9, 10, Jack, Queen, King, Ace | 13 |
| Clubs | 2, 3, 4, 5, 6, 7, 8, 9, 10, Jack, Queen, King, Ace | 13 |

**Total: 52 cards per faction.**

