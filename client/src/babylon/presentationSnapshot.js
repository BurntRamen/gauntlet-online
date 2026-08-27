export const PRESENTATION_SNAPSHOT_VERSION = "gauntlet.presentation-snapshot.v1";

const ZONE_PRIORITY = Object.freeze({
  hand: 10,
  lane: 20,
  attachment: 30,
  payment: 40,
  combat: 50
});

function sideForPlayer(player, bottomPlayer) {
  return Number(player) === Number(bottomPlayer) ? "local" : "opponent";
}

function knownCardId(card) {
  const id = card?.runtimeId
    || card?.cardInstanceId
    || card?.id
    || card?.raw?.runtimeId
    || card?.raw?.cardInstanceId
    || card?.raw?.id
    || null;
  return id && !String(id).startsWith("hidden") ? String(id) : null;
}

export function visibleCardIdentity(card, fallback) {
  const id = knownCardId(card);
  return id ? `card:${id}` : `hidden:${fallback}`;
}

export function presentationZoneKey(zone) {
  if (!zone) return "none";
  return [
    zone.kind,
    zone.side,
    zone.laneIndex ?? "table",
    zone.role || "card",
    zone.slotIndex ?? 0
  ].join(":");
}

export function normalizePresentationActorSlots(actors = []) {
  const normalized = actors.map((actor) => ({
    ...actor,
    zone: actor?.zone ? { ...actor.zone } : actor?.zone
  }));
  const paymentActors = normalized
    .filter((actor) => actor.zone?.kind === "payment")
    .sort((left, right) => left.actorId.localeCompare(right.actorId));
  paymentActors.forEach((actor, index) => {
    actor.zone = { ...actor.zone, slotIndex: index, count: paymentActors.length };
  });
  return normalized;
}

function actorFromCard(card, actorId, zone, options = {}) {
  const faceDown = Boolean(options.faceDown);
  return {
    actorId,
    visibleIdentity: actorId,
    cardId: knownCardId(card),
    card: card || null,
    label: card?.label || card?.name || (options.faceDown ? "Face-down card" : "Card"),
    artPath: faceDown ? "" : (card?.artPath || card?.collector?.art || ""),
    factionId: faceDown ? "" : (card?.factionId || card?.raw?.factionId || ""),
    expectsFaceArt: !faceDown && Boolean(card?.expectsFaceArt),
    faceDown,
    anonymous: actorId.startsWith("hidden:"),
    zone,
    selected: Boolean(options.selected),
    selectionRole: options.selectionRole || null,
    unavailable: Boolean(options.unavailable),
    interaction: options.interaction || null,
    preview: options.preview || null,
    value: card?.value ?? null,
    source: options.source || "state"
  };
}

function addActor(actors, actor, priority = ZONE_PRIORITY[actor.zone.kind] || 0) {
  const current = actors.get(actor.actorId);
  if (!current || priority >= current.priority) actors.set(actor.actorId, { actor, priority });
}

function handSelectionRole(card) {
  if (card?.selected?.attacker) return "attacker";
  if (card?.selected?.blocker) return "blocker";
  if (card?.selected?.payment) return "payment";
  if (card?.selected?.placement) return "placement";
  return null;
}

function addPaymentCards(actors, payment, bottomPlayer, source, eventId = null) {
  const cards = payment?.cards || [];
  const side = sideForPlayer(payment?.owner, bottomPlayer);
  cards.forEach((card, index) => {
    const actorId = visibleCardIdentity(card, `${side}:payment:${eventId || source}:${index}`);
    addActor(actors, actorFromCard(card, actorId, {
      kind: "payment",
      side,
      role: "payment",
      slotIndex: index,
      count: cards.length,
      eventId
    }, {
      source,
      selectionRole: "payment",
      preview: { ...card, stateLabel: "Committed payment", stateIcon: "payment" }
    }));
  });
}

function addCombatAttack(actors, attack, bottomPlayer, combatSlots, source = "state") {
  if (!attack?.card) return;
  const side = sideForPlayer(attack.owner, bottomPlayer);
  const laneIndex = attack.laneIndex == null ? null : Number(attack.laneIndex);
  const combatKey = laneIndex == null ? "hand" : `lane-${laneIndex}`;
  const attackActorId = visibleCardIdentity(attack.card, `${side}:${combatKey}:attacker:${attack.id}`);
  const attackSlot = combatSlots.get(attackActorId) || { index: 0, count: 1 };
  addActor(actors, actorFromCard(attack.card, attackActorId, {
    kind: "combat",
    side,
    role: "attacker",
    laneIndex,
    attackId: attack.id,
    slotIndex: attackSlot.index,
    count: attackSlot.count
  }, {
    source,
    selectionRole: side === "local" ? "attacker" : "danger",
    preview: {
      ...attack.card,
      stateLabel: laneIndex == null ? "Hand-combat attacker" : `Lane ${laneIndex + 1} attacker`,
      stateIcon: "attack"
    }
  }));

  (attack.blocks || []).forEach((block, index, blocks) => {
    if (!block?.card) return;
    const blockSide = sideForPlayer(block.owner, bottomPlayer);
    const actorId = visibleCardIdentity(block.card, `${blockSide}:${combatKey}:blocker:${attack.id}:${index}`);
    const slot = combatSlots.get(actorId) || { index, count: blocks.length };
    addActor(actors, actorFromCard(block.card, actorId, {
      kind: "combat",
      side: blockSide,
      role: "blocker",
      laneIndex,
      attackId: attack.id,
      slotIndex: slot.index,
      count: slot.count
    }, {
      source,
      selectionRole: "blocker",
      preview: {
        ...block.card,
        stateLabel: laneIndex == null ? "Hand-combat blocker" : `Lane ${laneIndex + 1} blocker`,
        stateIcon: "block"
      }
    }));
  });

  (attack.attachments || attack.attachedCards || []).forEach((card, index, cards) => {
    const actorId = visibleCardIdentity(card, `${side}:${combatKey}:attachment:${attack.id}:${index}`);
    addActor(actors, actorFromCard(card, actorId, {
      kind: "attachment",
      side,
      role: "attachment",
      laneIndex,
      attackId: attack.id,
      slotIndex: index,
      count: cards.length
    }, {
      source,
      selectionRole: "ability",
      preview: { ...card, stateLabel: "Combat attachment", stateIcon: "ability" }
    }));
  });
}

function publicEventCard(viewModel, cardId) {
  const card = viewModel?.visibleCardCatalog?.[cardId] || null;
  if (card) return card;
  return {
    id: String(cardId),
    visible: true,
    label: "Public card",
    value: null,
    artPath: "",
    raw: { id: String(cardId) }
  };
}

function addAcceptedEventActors(actors, viewModel, bottomPlayer) {
  (viewModel?.events || []).forEach((event) => {
    const side = sideForPlayer(event.player, bottomPlayer);
    const laneIndex = event.laneIndex == null ? null : Number(event.laneIndex);
    const eventId = event.id || `${event.type}:${event.player || "player"}`;
    if (["attack.declared", "campaign.attackDeclared"].includes(event.type) && event.cardId) {
      const card = publicEventCard(viewModel, event.cardId);
      const actorId = visibleCardIdentity(card, `${side}:event:${eventId}:attacker`);
      addActor(actors, actorFromCard(card, actorId, {
        kind: "combat",
        side,
        role: "attacker",
        laneIndex,
        attackId: event.attackId || eventId,
        slotIndex: 0,
        count: 1,
        eventId
      }, {
        source: "accepted-event",
        selectionRole: side === "local" ? "attacker" : "danger",
        preview: { ...card, stateLabel: "Declared attacker", stateIcon: "attack" }
      }), ZONE_PRIORITY.combat - 1);
    }

    if (event.type === "block.declared") {
      const cardIds = event.cardIds || (event.cardId ? [event.cardId] : []);
      cardIds.forEach((cardId, index) => {
        const card = publicEventCard(viewModel, cardId);
        const actorId = visibleCardIdentity(card, `${side}:event:${eventId}:blocker:${index}`);
        addActor(actors, actorFromCard(card, actorId, {
          kind: "combat",
          side,
          role: "blocker",
          laneIndex,
          attackId: event.attackId || eventId,
          slotIndex: index,
          count: cardIds.length,
          eventId
        }, {
          source: "accepted-event",
          selectionRole: "blocker",
          preview: { ...card, stateLabel: "Declared blocker", stateIcon: "block" }
        }), ZONE_PRIORITY.combat - 1);
      });
    }

    if (event.type === "payment.discarded") {
      const cardIds = event.cardIds || [];
      cardIds.forEach((cardId, index) => {
        const card = publicEventCard(viewModel, cardId);
        const actorId = visibleCardIdentity(card, `${side}:event:${eventId}:payment:${index}`);
        addActor(actors, actorFromCard(card, actorId, {
          kind: "payment",
          side,
          role: "payment",
          slotIndex: index,
          count: cardIds.length,
          eventId
        }, {
          source: "accepted-event",
          selectionRole: "payment",
          preview: { ...card, stateLabel: "Committed payment", stateIcon: "payment" }
        }), ZONE_PRIORITY.payment - 1);
      });
    }
  });
}

function buildCombatSlots(attacks = []) {
  const byRegionAndRole = new Map();
  attacks.forEach((attack) => {
    const region = attack.laneIndex == null ? "hand" : `lane-${attack.laneIndex}`;
    const attackers = byRegionAndRole.get(`${region}:attacker`) || [];
    if (attack.card) attackers.push(visibleCardIdentity(attack.card, `${region}:attacker:${attack.id}`));
    byRegionAndRole.set(`${region}:attacker`, attackers);
    const blockers = byRegionAndRole.get(`${region}:blocker`) || [];
    (attack.blocks || []).forEach((block, index) => {
      if (block.card) blockers.push(visibleCardIdentity(block.card, `${region}:blocker:${attack.id}:${index}`));
    });
    byRegionAndRole.set(`${region}:blocker`, blockers);
  });
  const result = new Map();
  byRegionAndRole.forEach((ids) => ids.forEach((id, index) => result.set(id, { index, count: ids.length })));
  return result;
}

function addReplayActionActors(actors, viewModel, bottomPlayer) {
  const action = viewModel?.replayAction;
  if (!action) return;
  const side = sideForPlayer(action.actorPlayerNum, bottomPlayer);
  const laneIndex = action.laneIndex == null ? null : Number(action.laneIndex);
  const cards = action.cards || {};
  const primaryRole = action.kind === "block" ? "blocker" : "attacker";
  const replayBlockers = [];
  const blockerIdentity = new Set();
  if (primaryRole === "blocker" && cards.primary) {
    replayBlockers.push(cards.primary);
    blockerIdentity.add(visibleCardIdentity(cards.primary, `${side}:replay:${action.id}:primary`));
  }
  (cards.blockers || []).forEach((card) => {
    const identity = visibleCardIdentity(card, `${side}:replay:${action.id}:blocker:${replayBlockers.length}`);
    if (blockerIdentity.has(identity)) return;
    blockerIdentity.add(identity);
    replayBlockers.push(card);
  });
  if (primaryRole === "attacker" && cards.primary) {
    const actorId = visibleCardIdentity(cards.primary, `${side}:replay:${action.id}:primary`);
    if (!actors.has(actorId)) {
      addActor(actors, actorFromCard(cards.primary, actorId, {
        kind: "combat",
        side,
        role: "attacker",
        laneIndex,
        attackId: action.id,
        slotIndex: 0,
        count: 1
      }, {
        source: "replay-action",
        selectionRole: "attacker",
        preview: { ...cards.primary, stateLabel: action.summary, stateIcon: action.kind }
      }));
    }
  }
  replayBlockers.forEach((card, index) => {
    const actorId = visibleCardIdentity(card, `${side}:replay:${action.id}:blocker:${index}`);
    if (actors.has(actorId)) return;
    addActor(actors, actorFromCard(card, actorId, {
      kind: "combat",
      side,
      role: "blocker",
      laneIndex,
      attackId: action.id,
      slotIndex: index,
      count: replayBlockers.length
    }, {
      source: "replay-action",
      selectionRole: "blocker",
      preview: { ...card, stateLabel: action.summary, stateIcon: "block" }
    }));
  });
  (cards.payments || []).forEach((card, index, payments) => {
    const actorId = visibleCardIdentity(card, `${side}:replay:${action.id}:payment:${index}`);
    if (actors.has(actorId)) return;
    addActor(actors, actorFromCard(card, actorId, {
      kind: "payment",
      side,
      role: "payment",
      slotIndex: index,
      count: payments.length,
      eventId: action.id
    }, {
      source: "replay-action",
      selectionRole: "payment",
      preview: { ...card, stateLabel: "Replay payment", stateIcon: "payment" }
    }));
  });
  (cards.attachments || []).forEach((card, index, attachments) => {
    const actorId = visibleCardIdentity(card, `${side}:replay:${action.id}:attachment:${index}`);
    if (actors.has(actorId)) return;
    addActor(actors, actorFromCard(card, actorId, {
      kind: "attachment",
      side,
      role: "attachment",
      laneIndex,
      attackId: action.id,
      slotIndex: index,
      count: attachments.length
    }, {
      source: "replay-action",
      selectionRole: "ability",
      preview: { ...card, stateLabel: "Replay attachment", stateIcon: "ability" }
    }));
  });
}

export function createPresentationSnapshot(viewModel, options = {}) {
  const actors = new Map();
  const bottomPlayer = viewModel?.perspective?.player || viewModel?.perspective?.bottomPlayer;
  const topPlayer = viewModel?.perspective?.opponent || viewModel?.perspective?.topPlayer;
  const hand = viewModel?.hand || [];

  hand.forEach((card, index) => {
    const actorId = visibleCardIdentity(card, `player-${bottomPlayer}:hand:${index}`);
    const selectionRole = handSelectionRole(card);
    addActor(actors, actorFromCard(card, actorId, {
      kind: "hand",
      side: "local",
      role: "hand",
      slotIndex: index,
      count: hand.length
    }, {
      selected: Boolean(selectionRole),
      selectionRole,
      unavailable: card.unavailable,
      interaction: {
        type: "hand",
        index,
        enabled: card.interactionEnabled && !card.unavailable,
        card: card.raw
      },
      preview: {
        ...card,
        stateLabel: selectionRole ? `Selected for ${selectionRole}` : "In hand",
        stateIcon: selectionRole || "inspect"
      }
    }));
  });

  if (viewModel?.perspective?.spectator) {
    const bottomCount = Number(viewModel?.bottom?.handCount || 0);
    for (let index = 0; index < bottomCount; index += 1) {
      const actorId = `hidden:player-${bottomPlayer}:hand:${index}`;
      addActor(actors, actorFromCard(null, actorId, {
        kind: "hand",
        side: "local",
        role: "hand",
        slotIndex: index,
        count: bottomCount
      }, { faceDown: true, source: "spectator-private" }));
    }
  }

  const opponentCount = Number(viewModel?.top?.handCount || 0);
  for (let index = 0; index < opponentCount; index += 1) {
    const actorId = `hidden:player-${topPlayer}:hand:${index}`;
    addActor(actors, actorFromCard(null, actorId, {
      kind: "hand",
      side: "opponent",
      role: "hand",
      slotIndex: index,
      count: opponentCount
    }, { faceDown: true }));
  }

  (viewModel?.lanes || []).forEach((lane, laneIndex) => {
    if (lane.hasLocalCard) {
      const known = lane.localCard?.visible ? lane.localCard : null;
      const actorId = visibleCardIdentity(known, `player-${bottomPlayer}:lane:${laneIndex}`);
      const selectedAttack = viewModel?.selection?.attackMode?.from === "lane"
        && Number(viewModel.selection.attackMode.lane) === laneIndex;
      const selectedBlock = viewModel?.selection?.blockMode?.type === "laneAttack"
        && Number(viewModel.selection.blockMode.lane) === laneIndex;
      addActor(actors, actorFromCard(known, actorId, {
        kind: "lane",
        side: "local",
        role: "facedown",
        laneIndex,
        slotIndex: 0,
        count: 1
      }, {
        faceDown: true,
        selected: selectedAttack || selectedBlock,
        selectionRole: selectedBlock ? "blocker" : selectedAttack ? "attacker" : null,
        interaction: {
          type: "lane",
          laneIndex,
          owner: "local",
          enabled: (viewModel?.interactions?.legalLanes || []).includes(laneIndex)
        },
        preview: lane.localCard ? {
          ...lane.localCard,
          stateLabel: `Face-down in Lane ${laneIndex + 1}`,
          stateIcon: "placement"
        } : null
      }));
    }
    if (lane.hasOpponentCard) {
      const actorId = `hidden:player-${topPlayer}:lane:${laneIndex}`;
      addActor(actors, actorFromCard(null, actorId, {
        kind: "lane",
        side: "opponent",
        role: "facedown",
        laneIndex,
        slotIndex: 0,
        count: 1
      }, {
        faceDown: true,
        interaction: {
          type: "lane",
          laneIndex,
          owner: "opponent",
          enabled: (viewModel?.interactions?.legalLanes || []).includes(laneIndex)
        },
        preview: {
          label: "Opponent face-down card",
          stateLabel: `Face-down in Lane ${laneIndex + 1}`,
          stateIcon: "placement"
        }
      }));
    }
  });

  const attacks = viewModel?.attacks || [];
  const combatSlots = buildCombatSlots(attacks);
  attacks.forEach((attack) => addCombatAttack(actors, attack, bottomPlayer, combatSlots));
  (viewModel?.publicPayments || []).forEach((payment) => {
    addPaymentCards(actors, payment, bottomPlayer, "public-payment", payment.eventId);
  });
  addAcceptedEventActors(actors, viewModel, bottomPlayer);
  addReplayActionActors(actors, viewModel, bottomPlayer);

  const attackTargeting = ["polea-buff", "focus-buff"].includes(viewModel?.selection?.abilityMode?.abilityId);
  if (attackTargeting) {
    actors.forEach((entry) => {
      if (entry.actor.zone.kind !== "combat" || entry.actor.zone.role !== "attacker") return;
      if (entry.actor.zone.side !== "local") return;
      entry.actor.interaction = {
        type: "attack",
        enabled: true,
        attackId: entry.actor.zone.attackId
      };
    });
  }

  const actorList = normalizePresentationActorSlots(
    Array.from(actors.values(), (entry) => entry.actor).sort((left, right) => (
      left.actorId.localeCompare(right.actorId)
    ))
  );
  return {
    schemaVersion: PRESENTATION_SNAPSHOT_VERSION,
    matchId: viewModel?.matchId || "match",
    revision: Number(viewModel?.revision || 0),
    source: options.source || viewModel?.presentationSource || "unknown",
    transitionMode: options.transitionMode || viewModel?.presentationTransitionMode || "animate",
    traversalGeneration: Number(options.traversalGeneration ?? viewModel?.replayTraversalGeneration ?? 0),
    events: (viewModel?.events || []).slice(),
    actors: actorList,
    actorById: new Map(actorList.map((actor) => [actor.actorId, actor])),
    piles: {
      localDeck: Number(viewModel?.bottom?.deckCount || 0),
      localDiscard: Number(viewModel?.bottom?.discardCount || 0),
      opponentDeck: Number(viewModel?.top?.deckCount || 0),
      opponentDiscard: Number(viewModel?.top?.discardCount || 0)
    }
  };
}

export function presentationSnapshotMetrics(snapshot) {
  const actorsByZone = {};
  const identities = new Map();
  (snapshot?.actors || []).forEach((actor) => {
    actorsByZone[actor.zone.kind] = (actorsByZone[actor.zone.kind] || 0) + 1;
    identities.set(actor.visibleIdentity, (identities.get(actor.visibleIdentity) || 0) + 1);
  });
  return {
    cardActorCount: snapshot?.actors?.length || 0,
    actorsByZone,
    anonymousActorCount: (snapshot?.actors || []).filter((actor) => actor.anonymous).length,
    knownActorCount: (snapshot?.actors || []).filter((actor) => !actor.anonymous).length,
    faceArtActorCount: (snapshot?.actors || []).filter((actor) => !actor.faceDown && actor.artPath).length,
    basicFaceArtActorCount: (snapshot?.actors || []).filter((actor) => (
      !actor.faceDown && actor.artPath?.includes("/playing-cards/basic-")
    )).length,
    missingFaceArtCount: (snapshot?.actors || []).filter((actor) => (
      actor.expectsFaceArt && !actor.faceDown && !actor.artPath
    )).length,
    duplicateVisibleIdentityCount: Array.from(identities.values()).filter((count) => count > 1).length
  };
}
