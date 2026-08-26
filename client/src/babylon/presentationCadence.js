export const PRESENTATION_CADENCE_CONTRACT_VERSION = "gauntlet.presentation-cadence.v1";
export const MAJOR_DAMAGE_THRESHOLD = 8;

export const CADENCE_TIERS = Object.freeze({
  REST: "rest",
  ATTENTION: "attention",
  COMMITMENT: "commitment",
  RESOLUTION: "resolution",
  MAJOR: "major"
});

export const CADENCE_TIER_TIMINGS = Object.freeze({
  [CADENCE_TIERS.REST]: Object.freeze({ durationMs: 0, reducedMotionMs: 0 }),
  [CADENCE_TIERS.ATTENTION]: Object.freeze({ durationMs: 520, reducedMotionMs: 220 }),
  [CADENCE_TIERS.COMMITMENT]: Object.freeze({ durationMs: 820, reducedMotionMs: 280 }),
  [CADENCE_TIERS.RESOLUTION]: Object.freeze({ durationMs: 1050, reducedMotionMs: 360 }),
  [CADENCE_TIERS.MAJOR]: Object.freeze({ durationMs: 1350, reducedMotionMs: 480 })
});

export const PRESENTATION_MOTION_PROFILES = Object.freeze({
  hover: Object.freeze({ durationMs: 130, easing: "ease-out" }),
  "payment-enter": Object.freeze({ durationMs: 520, staggerMs: 170, easing: "ease-in-out", lift: 0.72 }),
  "draw-enter": Object.freeze({ durationMs: 420, staggerMs: 55, easing: "ease-out", lift: 0.58 }),
  "placement-enter": Object.freeze({ durationMs: 560, easing: "ease-in-out", lift: 0.54 }),
  "attack-enter": Object.freeze({ durationMs: 680, paymentLeadMs: 180, easing: "ease-in-out", lift: 0.7 }),
  "block-enter": Object.freeze({ durationMs: 720, staggerMs: 90, paymentLeadMs: 180, easing: "ease-in-out", lift: 0.82 }),
  "lane-shift": Object.freeze({ durationMs: 600, staggerMs: 45, easing: "ease-in-out", lift: 0.28 }),
  "swap-return": Object.freeze({ durationMs: 600, easing: "ease-in-out", lift: 0.42 }),
  "replay-stage": Object.freeze({ durationMs: 680, easing: "ease-in-out", lift: 0.7 }),
  "discard-exit": Object.freeze({ durationMs: 420, easing: "ease-in", lift: 0.28 }),
  "state-correction": Object.freeze({ durationMs: 180, easing: "ease-out" })
});

const CADENCE_TIER_LEVELS = Object.freeze({
  [CADENCE_TIERS.REST]: 0,
  [CADENCE_TIERS.ATTENTION]: 1,
  [CADENCE_TIERS.COMMITMENT]: 2,
  [CADENCE_TIERS.RESOLUTION]: 3,
  [CADENCE_TIERS.MAJOR]: 4
});

function freezeRecipe(recipe) {
  return Object.freeze({
    ...recipe,
    phases: Object.freeze({ ...recipe.phases }),
    motions: Object.freeze((recipe.motions || []).map((motion) => Object.freeze({ ...motion }))),
    cue: recipe.cue ? Object.freeze({
      ...recipe.cue,
      effect: Object.freeze({ ...recipe.cue.effect })
    }) : null
  });
}

const EFFECTS = Object.freeze({
  attention: Object.freeze({ materialRole: "sapphire", intensity: 0.26, maxAlpha: 0, spriteAlpha: 0, ringAlpha: 0, boardResponse: 0.26, maxScale: 0.36 }),
  draw: Object.freeze({ materialRole: "sapphire", intensity: 0.18, maxAlpha: 0, spriteAlpha: 0, ringAlpha: 0, boardResponse: 0.18, maxScale: 0.42 }),
  turn: Object.freeze({ materialRole: "bronze", intensity: 0.32, maxAlpha: 0.06, spriteAlpha: 0.06, ringAlpha: 0, boardResponse: 0.32, maxScale: 0.46 }),
  payment: Object.freeze({ materialRole: "bronze", intensity: 0.48, maxAlpha: 0.08, spriteAlpha: 0.08, ringAlpha: 0, boardResponse: 0.48, maxScale: 0.5 }),
  placement: Object.freeze({ materialRole: "bronze", intensity: 0.54, maxAlpha: 0.1, spriteAlpha: 0.1, ringAlpha: 0, boardResponse: 0.54, maxScale: 0.5 }),
  attack: Object.freeze({ materialRole: "sapphire", intensity: 0.64, maxAlpha: 0.18, spriteAlpha: 0.18, ringAlpha: 0, boardResponse: 0.64, maxScale: 0.66 }),
  block: Object.freeze({ materialRole: "steel", intensity: 0.68, maxAlpha: 0.16, spriteAlpha: 0.16, ringAlpha: 0, boardResponse: 0.68, maxScale: 0.66 }),
  ability: Object.freeze({ materialRole: "violet", intensity: 0.58, maxAlpha: 0, spriteAlpha: 0, ringAlpha: 0, boardResponse: 0.58, maxScale: 0.62 }),
  blocked: Object.freeze({ materialRole: "steel", accentMaterialRole: "violet", intensity: 0.82, maxAlpha: 0.22, spriteAlpha: 0.22, ringAlpha: 0, boardResponse: 0.82, maxScale: 0.76 }),
  damage: Object.freeze({ materialRole: "danger", intensity: 0.86, maxAlpha: 0.28, spriteAlpha: 0.28, ringAlpha: 0, boardResponse: 0.86, maxScale: 0.8 }),
  major: Object.freeze({ materialRole: "danger", intensity: 1, maxAlpha: 0.4, spriteAlpha: 0.4, ringAlpha: 0.22, boardResponse: 1, maxScale: 0.94 }),
  victory: Object.freeze({ materialRole: "bronze", accentMaterialRole: "sapphire", intensity: 0.88, maxAlpha: 0.3, spriteAlpha: 0.3, ringAlpha: 0.16, boardResponse: 0.88, maxScale: 0.94 }),
  defeat: Object.freeze({ materialRole: "danger", intensity: 0.88, maxAlpha: 0.3, spriteAlpha: 0.3, ringAlpha: 0.16, boardResponse: 0.88, maxScale: 0.82 }),
  drawResult: Object.freeze({ materialRole: "steel", accentMaterialRole: "bronze", intensity: 0.72, maxAlpha: 0.18, spriteAlpha: 0.18, ringAlpha: 0.1, boardResponse: 0.72, maxScale: 0.74 })
});

export const PRESENTATION_BEAT_RECIPES = Object.freeze({
  "payment.commit": freezeRecipe({
    tier: CADENCE_TIERS.COMMITMENT,
    durationMs: 700,
    reducedMotionMs: 280,
    phases: { anticipate: 0, travel: 80, impact: 420, consequence: 500, settle: 580, release: 700 },
    motions: [{ role: "payment", countKey: "paymentCards", durationMs: PRESENTATION_MOTION_PROFILES["payment-enter"].durationMs, staggerMs: PRESENTATION_MOTION_PROFILES["payment-enter"].staggerMs, settleMs: 120 }],
    cue: { cueId: "payment.release", phase: "release", atPhase: "impact", visualAssetId: "payment.release", audioAssetId: "payment.release", gain: 0.46, effect: EFFECTS.payment }
  }),
  "attack.commit": freezeRecipe({
    tier: CADENCE_TIERS.COMMITMENT,
    durationMs: 860,
    reducedMotionMs: 280,
    phases: { anticipate: 0, travel: 80, payment: 420, impact: 560, consequence: 640, settle: 720, release: 860 },
    motions: [
      { role: "payment", countKey: "paymentCards", durationMs: PRESENTATION_MOTION_PROFILES["payment-enter"].durationMs, staggerMs: PRESENTATION_MOTION_PROFILES["payment-enter"].staggerMs, settleMs: 120 },
      { role: "attack", countKey: "attackers", durationMs: PRESENTATION_MOTION_PROFILES["attack-enter"].durationMs, staggerMs: 0, settleMs: 120, leadMs: PRESENTATION_MOTION_PROFILES["attack-enter"].paymentLeadMs, leadWhenCountKey: "paymentCards" }
    ],
    cue: { cueId: "attack.declare", phase: "settle", atPhase: "impact", visualAssetId: "attack.declare", audioAssetId: "attack.declare", gain: 0.48, effect: EFFECTS.attack }
  }),
  "block.commit": freezeRecipe({
    tier: CADENCE_TIERS.COMMITMENT,
    durationMs: 920,
    reducedMotionMs: 300,
    phases: { anticipate: 0, travel: 80, payment: 420, impact: 610, consequence: 700, settle: 790, release: 920 },
    motions: [
      { role: "payment", countKey: "paymentCards", durationMs: PRESENTATION_MOTION_PROFILES["payment-enter"].durationMs, staggerMs: PRESENTATION_MOTION_PROFILES["payment-enter"].staggerMs, settleMs: 120 },
      { role: "block", countKey: "blockers", durationMs: PRESENTATION_MOTION_PROFILES["block-enter"].durationMs, staggerMs: PRESENTATION_MOTION_PROFILES["block-enter"].staggerMs, settleMs: 110, leadMs: PRESENTATION_MOTION_PROFILES["block-enter"].paymentLeadMs, leadWhenCountKey: "paymentCards" }
    ],
    cue: { cueId: "block.commit", phase: "settle", atPhase: "impact", visualAssetId: "block.commit", audioAssetId: "block.commit", gain: 0.48, effect: EFFECTS.block }
  }),
  "card.place": freezeRecipe({
    tier: CADENCE_TIERS.COMMITMENT,
    durationMs: 700,
    reducedMotionMs: 280,
    phases: { anticipate: 0, travel: 60, impact: 470, consequence: 530, settle: 590, release: 700 },
    motions: [{ role: "placement", countKey: "placements", durationMs: PRESENTATION_MOTION_PROFILES["placement-enter"].durationMs, staggerMs: 0, settleMs: 100 }],
    cue: { cueId: "card.place", phase: "settle", atPhase: "impact", visualAssetId: "card.place", audioAssetId: "card.place", gain: 0.4, effect: EFFECTS.placement }
  }),
  "card.draw": freezeRecipe({
    tier: CADENCE_TIERS.ATTENTION,
    durationMs: 520,
    reducedMotionMs: 220,
    phases: { anticipate: 0, travel: 60, impact: 90, consequence: 180, settle: 420, release: 520 },
    motions: [{ role: "draw", countKey: "drawCards", durationMs: PRESENTATION_MOTION_PROFILES["draw-enter"].durationMs, staggerMs: PRESENTATION_MOTION_PROFILES["draw-enter"].staggerMs, settleMs: 80 }],
    cue: { cueId: "card.draw", phase: "travel", atPhase: "impact", visualAssetId: "card.draw", audioAssetId: "card.draw", gain: 0.38, effect: EFFECTS.draw }
  }),
  "turn.start": freezeRecipe({
    tier: CADENCE_TIERS.ATTENTION,
    durationMs: 620,
    reducedMotionMs: 240,
    phases: { anticipate: 0, travel: 60, draw: 90, impact: 120, ability: 260, consequence: 320, settle: 500, release: 620 },
    motions: [{ role: "draw", countKey: "drawCards", durationMs: PRESENTATION_MOTION_PROFILES["draw-enter"].durationMs, staggerMs: PRESENTATION_MOTION_PROFILES["draw-enter"].staggerMs, settleMs: 80 }],
    cue: { cueId: "turn.start", phase: "impact", atPhase: "impact", visualAssetId: "turn.start", audioAssetId: "turn.start", gain: 0.42, effect: EFFECTS.turn }
  }),
  "priority.transfer": freezeRecipe({
    tier: CADENCE_TIERS.ATTENTION,
    durationMs: 360,
    reducedMotionMs: 220,
    phases: { anticipate: 0, travel: 40, impact: 80, consequence: 160, settle: 260, release: 360 },
    motions: [],
    cue: { cueId: "priority.transfer", phase: "impact", atPhase: "impact", visualAssetId: "priority.transfer", audioAssetId: "priority.transfer", gain: 0.38, effect: EFFECTS.attention }
  }),
  "ability.activate": freezeRecipe({
    tier: CADENCE_TIERS.COMMITMENT,
    durationMs: 820,
    reducedMotionMs: 280,
    phases: { anticipate: 0, travel: 80, impact: 180, consequence: 560, settle: 700, release: 820 },
    motions: [{ role: "ability", countKey: "abilityTargets", durationMs: PRESENTATION_MOTION_PROFILES["lane-shift"].durationMs, staggerMs: PRESENTATION_MOTION_PROFILES["lane-shift"].staggerMs, settleMs: 100 }],
    cue: { cueId: "ability.activate", phase: "impact", atPhase: "impact", visualAssetId: "ability.activate", audioAssetId: "ability.activate", gain: 0.4, effect: EFFECTS.ability }
  }),
  "combat.blocked": freezeRecipe({
    tier: CADENCE_TIERS.RESOLUTION,
    durationMs: 1000,
    reducedMotionMs: 360,
    phases: { anticipate: 0, travel: 80, impact: 200, consequence: 360, settle: 780, release: 1000 },
    motions: [],
    cue: { cueId: "combat.blocked", phase: "impact", atPhase: "impact", visualAssetId: "block.commit", audioAssetId: "combat.blocked", gain: 0.46, effect: EFFECTS.blocked }
  }),
  "damage.impact": freezeRecipe({
    tier: CADENCE_TIERS.RESOLUTION,
    durationMs: 1050,
    reducedMotionMs: 360,
    phases: { anticipate: 0, travel: 80, impact: 190, consequence: 320, settle: 800, release: 1050 },
    motions: [],
    cue: { cueId: "damage.impact", phase: "impact", atPhase: "impact", visualAssetId: "damage.impact", audioAssetId: "damage.impact", gain: 0.5, effect: EFFECTS.damage }
  }),
  "damage.major": freezeRecipe({
    tier: CADENCE_TIERS.MAJOR,
    durationMs: 1350,
    reducedMotionMs: 480,
    phases: { anticipate: 0, travel: 80, impact: 220, consequence: 420, settle: 1050, release: 1350 },
    motions: [],
    cue: { cueId: "damage.major", phase: "impact", atPhase: "impact", visualAssetId: "damage.impact", audioAssetId: "damage.major", gain: 0.54, effect: EFFECTS.major }
  }),
  "match.result": freezeRecipe({
    tier: CADENCE_TIERS.MAJOR,
    durationMs: 1700,
    reducedMotionMs: 480,
    phases: { anticipate: 0, travel: 80, impact: 160, consequence: 500, reveal: 900, settle: 1320, release: 1700 },
    motions: [],
    cue: { cueId: "match.result", phase: "impact", atPhase: "impact", visualAssetId: "match.victory", audioAssetId: "match.victory", gain: 0.5, effect: EFFECTS.victory }
  })
});

const PAYMENT_DECORATION_TYPES = new Set(["payment.modified", "weapons.armed"]);
const DAMAGE_CONSEQUENCE_TYPES = new Set([
  "damage.calculated",
  "damage.dealt",
  "attack.fullyBlocked",
  "combat.resolutionCompleted"
]);
const ABILITY_MUTATION_TYPES = new Set([
  "ability.activated",
  "acceleration.gained",
  "acceleration.spent",
  "lanes.swapped",
  "card.peeked",
  "card.buffApplied",
  "laneCard.swappedWithHand",
  "choice.committed",
  "campaign.bossHealed"
]);

const CADENCE_EVENT_TYPES = new Set([
  "payment.discarded",
  ...PAYMENT_DECORATION_TYPES,
  "attack.declared",
  "campaign.attackDeclared",
  "block.declared",
  ...DAMAGE_CONSEQUENCE_TYPES,
  "card.placedFacedown",
  "cards.drawn",
  "priority.passed",
  "priority.granted",
  "turn.started",
  ...ABILITY_MUTATION_TYPES,
  "match.ended"
]);

function explicitEmptyCardList(entry) {
  return Array.isArray(entry?.cardIds) && entry.cardIds.length === 0;
}

function countCards(events, type) {
  return events
    .filter((entry) => entry.type === type)
    .reduce((total, entry) => total + (Array.isArray(entry.cardIds) ? entry.cardIds.length : 1), 0);
}

function supportedAbilityPlacement(entry) {
  return entry?.type === "card.placedFacedown" && Boolean(entry.source);
}

function isBlockPaymentMutation(entry) {
  return entry?.type === "acceleration.spent" && entry.source === "constructed-block";
}

export function isPresentationCadenceEvent(entry) {
  return CADENCE_EVENT_TYPES.has(entry?.type);
}

export function presentationEventIdentity(entry, fallbackIndex = 0) {
  if (entry?.id) return entry.id;
  return [
    entry?.type || "event",
    entry?.revision || "revision",
    entry?.sequence ?? fallbackIndex,
    entry?.player ?? "player",
    entry?.cardId || (entry?.cardIds || []).join("-") || "card"
  ].join(":");
}

function mergeRepresentative(events, preferredTypes) {
  const merged = events.reduce((result, entry) => {
    Object.entries(entry || {}).forEach(([key, value]) => {
      if (value !== undefined) result[key] = value;
    });
    return result;
  }, {});
  const preferred = preferredTypes
    .map((type) => events.find((entry) => entry.type === type))
    .find(Boolean) || events[0] || {};
  return { ...merged, ...preferred, id: preferred.id || merged.id || null, type: preferred.type || merged.type };
}

function resolutionKind(events) {
  const calculated = events.find((entry) => entry.type === "damage.calculated");
  const dealt = events.find((entry) => entry.type === "damage.dealt");
  const damage = Number(calculated?.damage ?? dealt?.amount);
  if (events.some((entry) => entry.type === "attack.fullyBlocked") || damage === 0) return "combat.blocked";
  if (Number.isFinite(damage) && damage >= MAJOR_DAMAGE_THRESHOLD) return "damage.major";
  return "damage.impact";
}

function beatMotionCounts(events) {
  const block = events.find((entry) => entry.type === "block.declared");
  const abilityTargetCount = Math.max(
    1,
    ...events.map((entry) => Number(entry.movedCardCount || entry.cardIds?.length || (entry.cardId ? 1 : 0)))
  );
  return Object.freeze({
    paymentCards: countCards(events, "payment.discarded"),
    drawCards: countCards(events, "cards.drawn"),
    blockers: block ? (Array.isArray(block.cardIds) ? Math.max(1, block.cardIds.length) : 1) : 0,
    attackers: events.some((entry) => ["attack.declared", "campaign.attackDeclared"].includes(entry.type)) ? 1 : 0,
    placements: events.some((entry) => entry.type === "card.placedFacedown") ? 1 : 0,
    abilityTargets: abilityTargetCount
  });
}

function createBeat(semantic, wrappedEvents, options = {}) {
  const ordered = [...wrappedEvents].sort((a, b) => a.index - b.index);
  const events = ordered.map(({ entry }) => entry);
  let kind = semantic;
  let preferredTypes = [];
  if (semantic === "attack") {
    kind = "attack.commit";
    preferredTypes = ["attack.declared", "campaign.attackDeclared"];
  } else if (semantic === "block") {
    kind = "block.commit";
    preferredTypes = ["block.declared"];
  } else if (semantic === "resolution") {
    kind = resolutionKind(events);
    preferredTypes = ["damage.calculated", "damage.dealt", "attack.fullyBlocked"];
  } else if (semantic === "payment") {
    kind = "payment.commit";
    preferredTypes = ["payment.discarded"];
  } else if (semantic === "placement") {
    kind = "card.place";
    preferredTypes = ["card.placedFacedown"];
  } else if (semantic === "draw") {
    kind = "card.draw";
    preferredTypes = ["cards.drawn"];
  } else if (semantic === "turn") {
    kind = "turn.start";
    preferredTypes = ["turn.started", "cards.drawn"];
  } else if (semantic === "priority") {
    kind = "priority.transfer";
    preferredTypes = ["priority.granted", "priority.passed"];
  } else if (semantic === "ability") {
    kind = "ability.activate";
    preferredTypes = ["ability.activated", ...ABILITY_MUTATION_TYPES];
  } else if (semantic === "result") {
    kind = "match.result";
    preferredTypes = ["match.ended"];
  }
  const recipe = PRESENTATION_BEAT_RECIPES[kind];
  if (!recipe) return null;
  const sourceEventIds = events.map((entry, index) => presentationEventIdentity(entry, ordered[index].index));
  const beat = {
    contract: PRESENTATION_CADENCE_CONTRACT_VERSION,
    id: `${kind}:${sourceEventIds.join("+")}`,
    kind,
    tier: recipe.tier,
    event: mergeRepresentative(events, preferredTypes),
    events,
    sourceEventIds,
    firstEventIndex: ordered[0]?.index ?? 0,
    lastEventIndex: ordered.at(-1)?.index ?? 0,
    motionCounts: beatMotionCounts(events)
  };
  const timing = resolvePresentationBeatTiming(beat, options);
  return { ...beat, timing, durationMs: timing.durationMs };
}

export function projectPresentationBeats(events = [], options = {}) {
  const beats = [];
  let pendingPayment = [];
  let pendingCampaignAttack = [];
  let pendingTurn = [];
  let pendingAbility = [];

  const addBeat = (semantic, wrappedEvents) => {
    if (!wrappedEvents.length) return null;
    const beat = createBeat(semantic, wrappedEvents, options);
    if (beat) beats.push(beat);
    return beat;
  };
  const flushPayment = () => {
    const beat = addBeat("payment", pendingPayment);
    pendingPayment = [];
    return beat;
  };
  const flushCampaignAttack = () => {
    const beat = addBeat("attack", pendingCampaignAttack);
    pendingCampaignAttack = [];
    return beat;
  };
  const flushTurn = () => {
    const beat = addBeat("draw", pendingTurn);
    pendingTurn = [];
    return beat;
  };
  const flushAbility = () => {
    const beat = addBeat("ability", pendingAbility);
    pendingAbility = [];
    return beat;
  };
  const flushPending = () => {
    flushPayment();
    flushCampaignAttack();
    flushTurn();
    flushAbility();
  };

  events.forEach((entry, index) => {
    if (!isPresentationCadenceEvent(entry)) return;
    const wrapped = { entry, index };

    if (entry.type === "payment.discarded") {
      flushCampaignAttack();
      flushTurn();
      flushAbility();
      if (!explicitEmptyCardList(entry)) pendingPayment.push(wrapped);
      return;
    }
    if (PAYMENT_DECORATION_TYPES.has(entry.type) || isBlockPaymentMutation(entry)) {
      if (pendingPayment.length) pendingPayment.push(wrapped);
      return;
    }
    if (entry.type === "campaign.attackDeclared") {
      flushPayment();
      flushTurn();
      flushAbility();
      pendingCampaignAttack.push(wrapped);
      return;
    }
    if (entry.type === "attack.declared") {
      flushTurn();
      flushAbility();
      addBeat("attack", [...pendingPayment, ...pendingCampaignAttack, wrapped]);
      pendingPayment = [];
      pendingCampaignAttack = [];
      return;
    }
    if (entry.type === "block.declared") {
      flushCampaignAttack();
      flushTurn();
      flushAbility();
      addBeat("block", [...pendingPayment, wrapped]);
      pendingPayment = [];
      return;
    }
    if (DAMAGE_CONSEQUENCE_TYPES.has(entry.type)) {
      flushPending();
      let previous = beats.at(-1);
      if (
        previous?.kind === "priority.transfer"
        && previous.events.every((event) => event.type === "priority.passed")
        && entry.type !== "combat.resolutionCompleted"
      ) {
        beats.pop();
        const passedEvents = previous.events.map((event, eventIndex) => ({
          entry: event,
          index: previous.firstEventIndex + eventIndex
        }));
        addBeat("resolution", [...passedEvents, wrapped]);
        previous = beats.at(-1);
        return;
      }
      if (previous?.kind && ["combat.blocked", "damage.impact", "damage.major"].includes(previous.kind)) {
        const wrappedEvents = previous.events.map((event, eventIndex) => ({
          entry: event,
          index: previous.firstEventIndex + eventIndex
        }));
        wrappedEvents.push(wrapped);
        beats[beats.length - 1] = createBeat("resolution", wrappedEvents, options);
      } else if (entry.type !== "combat.resolutionCompleted") {
        addBeat("resolution", [wrapped]);
      }
      return;
    }
    if (entry.type === "cards.drawn") {
      flushPayment();
      flushCampaignAttack();
      flushAbility();
      if (!explicitEmptyCardList(entry)) pendingTurn.push(wrapped);
      return;
    }
    if (entry.type === "campaign.bossHealed" && pendingTurn.length) {
      pendingTurn.push(wrapped);
      return;
    }
    if (entry.type === "turn.started") {
      flushPayment();
      flushCampaignAttack();
      flushAbility();
      addBeat("turn", [...pendingTurn, wrapped]);
      pendingTurn = [];
      return;
    }
    if (entry.type === "priority.granted" || entry.type === "priority.passed") {
      flushPayment();
      flushCampaignAttack();
      flushTurn();
      flushAbility();
      const previous = beats.at(-1);
      const attachable = previous && [
        "attack.commit",
        "block.commit",
        "combat.blocked",
        "damage.impact",
        "damage.major",
        "ability.activate"
      ].includes(previous.kind);
      if (attachable || previous?.kind === "priority.transfer") {
        const semantic = previous.kind === "priority.transfer"
          ? "priority"
          : ["combat.blocked", "damage.impact", "damage.major"].includes(previous.kind)
            ? "resolution"
            : previous.kind === "attack.commit"
              ? "attack"
              : previous.kind === "block.commit"
                ? "block"
                : "ability";
        const wrappedEvents = previous.events.map((event, eventIndex) => ({
          entry: event,
          index: previous.firstEventIndex + eventIndex
        }));
        wrappedEvents.push(wrapped);
        beats[beats.length - 1] = createBeat(semantic, wrappedEvents, options);
      } else {
        addBeat("priority", [wrapped]);
      }
      return;
    }
    if (entry.type === "match.ended") {
      flushPending();
      addBeat("result", [wrapped]);
      return;
    }
    if (supportedAbilityPlacement(entry) || ABILITY_MUTATION_TYPES.has(entry.type)) {
      flushPayment();
      flushCampaignAttack();
      flushTurn();
      pendingAbility.push(wrapped);
      return;
    }
    if (entry.type === "card.placedFacedown") {
      flushPending();
      addBeat("placement", [wrapped]);
    }
  });

  flushPending();
  return beats.sort((left, right) => left.firstEventIndex - right.firstEventIndex);
}

function motionCount(beat, countKey) {
  return Math.max(0, Number(beat?.motionCounts?.[countKey] || 0));
}

export function resolvePresentationBeatTiming(beat, {
  reducedMotion = false,
  playbackRate = 1
} = {}) {
  const recipe = PRESENTATION_BEAT_RECIPES[beat?.kind];
  if (!recipe) return { durationMs: 0, phases: {}, motionWindows: [] };
  const baseDuration = reducedMotion ? recipe.reducedMotionMs : recipe.durationMs;
  const motionScale = reducedMotion ? recipe.reducedMotionMs / recipe.durationMs : 1;
  const rate = Math.max(0.25, Number(playbackRate) || 1);
  const motionWindows = recipe.motions
    .map((motion) => {
      const count = motionCount(beat, motion.countKey);
      if (!count) return null;
      const durationMs = motion.durationMs * motionScale;
      const staggerMs = motion.staggerMs * motionScale;
      const settleMs = motion.settleMs * motionScale;
      const leadApplies = motion.leadWhenCountKey
        ? motionCount(beat, motion.leadWhenCountKey) > 0
        : Boolean(motion.leadMs);
      const startMs = (leadApplies ? Number(motion.leadMs || 0) : 0) * motionScale;
      const endMs = startMs + durationMs + Math.max(0, count - 1) * staggerMs + settleMs;
      return {
        role: motion.role,
        count,
        startMs: Math.round(startMs / rate),
        durationMs: Math.round(durationMs / rate),
        staggerMs: Math.round(staggerMs / rate),
        settleMs: Math.round(settleMs / rate),
        endMs: Math.round(endMs / rate)
      };
    })
    .filter(Boolean);
  const unscaledDuration = Math.max(
    baseDuration,
    ...motionWindows.map((motion) => motion.endMs * rate)
  );
  const phases = Object.fromEntries(Object.entries(recipe.phases).map(([phase, offset]) => [
    phase,
    Math.round((offset * motionScale) / rate)
  ]));
  const durationMs = Math.round(unscaledDuration / rate);
  phases.release = durationMs;
  return {
    durationMs,
    phases: Object.freeze(phases),
    motionWindows: Object.freeze(motionWindows),
    reducedMotion: Boolean(reducedMotion),
    playbackRate: rate
  };
}

export function presentationBeatDuration(beat, options = {}) {
  return resolvePresentationBeatTiming(beat, options).durationMs;
}

export function presentationEventDuration(entry, options = {}) {
  return projectPresentationBeats([entry], options)[0]?.durationMs || 0;
}

function sourceEvent(beat, types) {
  return types.map((type) => beat.events.find((entry) => entry.type === type)).find(Boolean) || beat.event;
}

function cadenceGrammarForBeat(kind) {
  return {
    "payment.commit": "contract",
    "attack.commit": "thrust",
    "block.commit": "brace",
    "combat.blocked": "resist",
    "damage.impact": "impact",
    "damage.major": "major-impact",
    "card.place": "seat",
    "card.draw": "draw",
    "priority.transfer": "handoff",
    "turn.start": "sweep",
    "ability.activate": "focus",
    "match.result": "result"
  }[kind] || "rest";
}

function zoneResponseForBeat(kind) {
  if (kind === "priority.transfer") return "priority-mask";
  if (["card.draw", "turn.start"].includes(kind)) return "board-breathe";
  if (["payment.commit", "card.place"].includes(kind)) return "zone-commit";
  if (["attack.commit", "block.commit", "ability.activate"].includes(kind)) return "lane-commit";
  if (["combat.blocked", "damage.impact", "damage.major"].includes(kind)) return "lane-resolve";
  if (kind === "match.result") return "board-result";
  return "none";
}

function cueMetadata(beat, recipe, timing, source, overrides = {}) {
  const definition = { ...recipe.cue, ...overrides };
  const atPhase = overrides.atPhase || definition.atPhase;
  const effect = { ...definition.effect };
  const cadenceKind = overrides.cadenceKind || beat.kind;
  return {
    cueId: definition.cueId,
    phase: definition.phase,
    sourceEvent: source,
    offsetMs: Math.min(timing.durationMs, Number(timing.phases[atPhase] || 0)),
    effectDurationMs: timing.durationMs,
    visualAssetId: definition.visualAssetId,
    audioAssetId: definition.audioAssetId,
    gain: definition.gain,
    effect: Object.freeze({
      tier: recipe.tier,
      ...effect
    }),
    cadence: Object.freeze({
      contract: PRESENTATION_CADENCE_CONTRACT_VERSION,
      kind: cadenceKind,
      tier: recipe.tier,
      level: CADENCE_TIER_LEVELS[recipe.tier] || 0,
      grammar: cadenceGrammarForBeat(cadenceKind),
      materialRole: effect.materialRole || "sapphire",
      spriteAlpha: Number(effect.spriteAlpha ?? effect.maxAlpha ?? 0),
      ringAlpha: Number(effect.ringAlpha ?? 0),
      boardResponse: Number(effect.boardResponse ?? effect.intensity ?? 0),
      zoneResponse: zoneResponseForBeat(cadenceKind)
    })
  };
}

function resultCueVariant(beat, { result = null, perspectivePlayer = null, spectator = false } = {}) {
  const winner = beat.event?.winner ?? result?.winner ?? null;
  const localWon = result?.localWon ?? beat.event?.localWon;
  if (winner == null && localWon == null) return "match.draw";
  if (spectator || perspectivePlayer == null) return "match.draw";
  if (winner != null) return Number(winner) === Number(perspectivePlayer) ? "match.victory" : "match.defeat";
  return localWon ? "match.victory" : "match.defeat";
}

export function projectPresentationCueMetadata(beat, options = {}) {
  const recipe = PRESENTATION_BEAT_RECIPES[beat?.kind];
  if (!recipe?.cue) return [];
  const timing = options.timing || beat.timing || resolvePresentationBeatTiming(beat, options);
  const cues = [];

  if (["attack.commit", "block.commit"].includes(beat.kind)) {
    const payment = beat.events.find((entry) => entry.type === "payment.discarded" && !explicitEmptyCardList(entry));
    if (payment) {
      const paymentRecipe = PRESENTATION_BEAT_RECIPES["payment.commit"];
      cues.push(cueMetadata(beat, paymentRecipe, timing, payment, {
        atPhase: "payment",
        cadenceKind: "payment.commit"
      }));
    }
  }

  if (beat.kind === "turn.start") {
    const draw = beat.events.find((entry) => entry.type === "cards.drawn" && !explicitEmptyCardList(entry));
    if (draw) {
      const drawRecipe = PRESENTATION_BEAT_RECIPES["card.draw"];
      cues.push(cueMetadata(beat, drawRecipe, timing, draw, {
        atPhase: "draw",
        cadenceKind: "card.draw"
      }));
    }
    const bossHeal = beat.events.find((entry) => entry.type === "campaign.bossHealed");
    if (bossHeal) {
      const abilityRecipe = PRESENTATION_BEAT_RECIPES["ability.activate"];
      cues.push(cueMetadata(beat, abilityRecipe, timing, bossHeal, {
        atPhase: "ability",
        cadenceKind: "ability.activate"
      }));
    }
  }

  if (beat.kind === "match.result") {
    const cueId = resultCueVariant(beat, options);
    const effect = cueId === "match.victory"
      ? EFFECTS.victory
      : cueId === "match.defeat"
        ? EFFECTS.defeat
        : EFFECTS.drawResult;
    cues.push(cueMetadata(beat, recipe, timing, sourceEvent(beat, ["match.ended"]), {
      cueId,
      visualAssetId: cueId === "match.draw" ? "turn.start" : cueId,
      audioAssetId: cueId,
      effect
    }));
  } else if (beat.kind === "priority.transfer") {
    const granted = beat.events.find((entry) => entry.type === "priority.granted");
    const source = granted || sourceEvent(beat, ["priority.passed"]);
    const cueId = granted ? "priority.transfer" : "priority.pass";
    cues.push(cueMetadata(beat, recipe, timing, source, {
      cueId,
      visualAssetId: "priority.transfer",
      audioAssetId: "priority.transfer"
    }));
  } else {
    const preferredTypes = {
      "payment.commit": ["payment.discarded"],
      "attack.commit": ["attack.declared", "campaign.attackDeclared"],
      "block.commit": ["block.declared"],
      "card.place": ["card.placedFacedown"],
      "card.draw": ["cards.drawn"],
      "turn.start": ["turn.started"],
      "ability.activate": ["ability.activated", ...ABILITY_MUTATION_TYPES],
      "combat.blocked": ["damage.calculated", "attack.fullyBlocked"],
      "damage.impact": ["damage.calculated", "damage.dealt"],
      "damage.major": ["damage.calculated", "damage.dealt"]
    };
    cues.push(cueMetadata(beat, recipe, timing, sourceEvent(beat, preferredTypes[beat.kind] || [])));
  }

  if (beat.kind !== "priority.transfer") {
    const granted = [...beat.events].reverse().find((entry) => entry.type === "priority.granted");
    const passed = [...beat.events].reverse().find((entry) => entry.type === "priority.passed");
    const priority = granted || passed;
    if (priority) {
      const priorityRecipe = PRESENTATION_BEAT_RECIPES["priority.transfer"];
      cues.push(cueMetadata(beat, priorityRecipe, timing, priority, {
        atPhase: "consequence",
        cadenceKind: "priority.transfer",
        cueId: granted ? "priority.transfer" : "priority.pass",
        visualAssetId: "priority.transfer",
        audioAssetId: "priority.transfer"
      }));
    }
  }

  return cues.sort((left, right) => left.offsetMs - right.offsetMs);
}

const COMPATIBILITY_EVENT_FIXTURES = Object.freeze({
  "payment.discarded": { type: "payment.discarded" },
  "attack.declared": { type: "attack.declared" },
  "block.declared": { type: "block.declared" },
  "damage.calculated": { type: "damage.calculated", damage: 4 },
  "damage.dealt": { type: "damage.dealt", amount: 4 },
  "attack.fullyBlocked": { type: "attack.fullyBlocked" },
  "card.placedFacedown": { type: "card.placedFacedown" },
  "cards.drawn": { type: "cards.drawn" },
  "priority.granted": { type: "priority.granted" },
  "priority.passed": { type: "priority.passed" },
  "turn.started": { type: "turn.started" },
  "match.ended": { type: "match.ended", winner: 1 },
  "campaign.attackDeclared": { type: "campaign.attackDeclared" },
  "campaign.bossHealed": { type: "campaign.bossHealed" },
  "ability.activated": { type: "ability.activated" },
  "acceleration.gained": { type: "acceleration.gained" },
  "acceleration.spent": { type: "acceleration.spent" },
  "lanes.swapped": { type: "lanes.swapped" },
  "card.peeked": { type: "card.peeked" },
  "card.buffApplied": { type: "card.buffApplied" },
  "laneCard.swappedWithHand": { type: "laneCard.swappedWithHand" },
  "choice.committed": { type: "choice.committed" }
});

export const PRESENTATION_EVENT_PACING = Object.freeze(Object.fromEntries(
  Object.entries(COMPATIBILITY_EVENT_FIXTURES).map(([type, entry]) => [
    type,
    presentationEventDuration({ id: `cadence-${type}`, ...entry })
  ])
));
