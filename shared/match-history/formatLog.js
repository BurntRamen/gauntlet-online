function numeric(value) {
  if (value === "" || value == null || typeof value === "boolean") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function playerLabel(player, players = {}) {
  const playerNumber = numeric(player);
  if (playerNumber == null) return "Player";
  const profile = players[playerNumber] || players[String(playerNumber)] || {};
  return profile.accountName || profile.name || `Player ${playerNumber}`;
}

function laneLabel(entry) {
  const laneIndex = numeric(entry?.laneIndex);
  return laneIndex == null ? "hand" : `lane ${laneIndex + 1}`;
}

function countLabel(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function fallbackText(entry) {
  return entry?.text || entry?.label || entry?.message || "Match state updated.";
}

function logCardName(card) {
  if (!card) return "Card not recorded";
  const suit = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" }[card.suit] || card.suit || "";
  const face = `${card.rank || card.value || ""}${suit}`;
  const name = card.name && card.name !== face ? `${card.name}${face ? ` (${face})` : ""}` : face || "Card";
  return name;
}

function explainValue(receipt, role) {
  if (!receipt) return "";
  const base = numeric(receipt.baseValue);
  const effective = numeric(receipt.effectiveValue);
  if (base == null || effective == null) return "";
  const delta = effective - base;
  return `${role}: ${logCardName(receipt.card)} — ${base} base${delta ? ` ${delta > 0 ? "+" : "−"} ${Math.abs(delta)} bonus` : ""} = ${effective} ${role.toLowerCase()}`
    + ((receipt.notes || []).length ? ` · Applied: ${receipt.notes.join("; ")}` : delta ? " · Modifier source not recorded" : "");
}

function calculationDetails(calculation) {
  if (!calculation) return [];
  return [
    explainValue(calculation.attack, "Attack"),
    ...(calculation.blocks || []).map((receipt) => explainValue(receipt, "Block")),
    ...(calculation.blocks || []).filter((receipt) => receipt.prevention > 0).map((receipt) =>
      `Prevention: ${receipt.prevention}${receipt.preventionNotes?.length ? ` · ${receipt.preventionNotes.join("; ")}` : " · Source not recorded"}`)
  ].filter(Boolean);
}

function explainPayment(calculation) {
  if (!calculation?.cards?.length || numeric(calculation.total) == null) return "";
  const base = calculation.cards.reduce((sum, card) => sum + (numeric(card.value) ?? 0), 0);
  const delta = calculation.total - base;
  return `Payment: ${base} base${delta ? ` ${delta > 0 ? "+" : "−"} ${Math.abs(delta)} bonus` : ""} = ${calculation.total}`;
}

const ABILITY_NAMES = {
  'jali:watane': 'Watane', 'jali:katana': 'Katana', 'jali:basho': 'Basho',
  'mekan:monti': 'Monti', 'mekan:encore': 'Encore', 'mekan:remember': 'San Mikal',
  'mekan:invite': 'San Mikal · invite a Guest', 'mekan:cancel-invite': 'San Mikal · cancel invitation',
  'mekan:look': 'Private deck inspection', 'mekan:keep': 'Keep top card',
  'mekan:bottom': 'Move card to bottom', 'gracus:epicura': 'Epicura'
};

function abilityName(entry, fallback = 'Ability') {
  return entry.abilityName || ABILITY_NAMES[entry.abilityId?.split(':').slice(0, 2).join(':')]
    || entry.source?.name || (typeof entry.source === 'string' ? entry.source : null) || fallback;
}

function isAbilityLogEntry(entry) {
  if (!entry || (entry.private && !entry.source && !entry.card)) return false;
  if (/^(effect\.|ability\.|guest\.|jali\.|gracus\.|indela\.|acceleration\.|card\.(peeked|buffApplied)$|lanes\.swapped$|laneCard\.swappedWithHand$|choice\.committed$)/.test(entry.type)) return true;
  if (['card.placedFacedown', 'cards.drawn'].includes(entry.type) && entry.source) return true;
  const calculation = entry.calculation;
  return Boolean(calculation && (calculation.notes?.length || calculation.reductions?.length
    || calculation.attack?.notes?.length
    || calculation.blocks?.some(block => block.notes?.length || block.preventionNotes?.length)));
}

// The snapshot and incoming events have already been projected for this viewer.
function abilityMatchHistory(snapshot, entries = []) {
  return Array.from(new Map([
    ...entries, ...authoritativeMatchHistory(snapshot), ...(snapshot?.publicCombatLog || []),
    ...(snapshot?.effectHistory || [])
  ].filter(isAbilityLogEntry).map((entry, index) => [entry.id || `unrecorded-${index}`, entry])).values())
    .sort((left, right) => Number(left.sequence || 0) - Number(right.sequence || 0));
}

function formatMatchLogEntry(entry, { players = {} } = {}) {
  if (!entry) return { title: "Match state updated.", detail: "", icon: "priority" };
  const actor = playerLabel(entry.player ?? entry.attacker, players);
  const target = playerLabel(entry.targetPlayer, players);
  const cardCount = Array.isArray(entry.cardIds)
    ? entry.cardIds.length
    : numeric(entry.count);
  const total = numeric(entry.total);
  const required = numeric(entry.required);
  const attack = numeric(entry.attackValue ?? entry.effectiveValue ?? entry.value);
  const block = numeric(entry.blockValue ?? entry.totalBlock);
  const prevented = numeric(entry.prevented ?? entry.prevention) ?? 0;
  const damage = numeric(entry.damage ?? entry.amount);

  switch (entry.type) {
    case "effect.applied":
    case "effect.expired":
    case "effect.consumed":
    case "effect.readied": {
      if (entry.private && !entry.source) return { icon: "priority", title: "Private effect updated", detail: "" };
      const source = entry.source?.name || entry.source || "Effect";
      const verb = { "effect.applied": "applied", "effect.expired": entry.target ? "expired" : "availability ended", "effect.consumed": "used", "effect.readied": "ready" }[entry.type];
      return { icon: "priority", title: `${source} ${verb}${entry.target?.name ? ` · ${entry.target.name}` : ""}`,
        detail: [actor, entry.label, entry.amount != null ? `${entry.amount >= 0 ? '+' : '−'}${Math.abs(entry.amount)} ${(entry.contexts || []).join('/')}` : "",
          entry.target && entry.before != null && entry.after != null ? `${entry.before} → ${entry.after}` : "",
          entry.type === "effect.applied" && entry.duration?.kind === "turn" ? "Until turn end" : entry.reason].filter(Boolean).join(" · ") };
    }
    case "resource.changed":
      return { icon: "priority", title: `${actor} · ${entry.resourceLabel}`, detail: `${entry.before} ${entry.amount >= 0 ? '+' : '−'} ${Math.abs(entry.amount)} = ${entry.after}` };
    case "priority.retained":
      return { icon: "priority", title: `${actor} retains priority`, detail: "Passes reset. Opponent may respond after the next pass." };
    case "card.peeked":
      return { icon: "inspect", title: `${abilityName(entry, 'Private inspection')} · ${actor} inspected a card`, detail: entry.card ? `${logCardName(entry.card)}${entry.deckPosition ? ` · deck position ${entry.deckPosition}` : ''} · only visible to you` : "Card identity is private" };
    case "card.buffApplied":
      return { icon: "priority", title: `${abilityName(entry)} · ${actor} gave a card ${entry.amount >= 0 ? '+' : '−'}${Math.abs(entry.amount)}`, detail: "Attack/block value · until turn end" };
    case "acceleration.gained":
    case "acceleration.spent":
      return { icon: "priority", title: `${abilityName(entry, 'Acceleration')} · ${actor} ${entry.type.endsWith('spent') ? 'spent' : 'gained'} ${entry.amount ?? 1} acceleration`, detail: "" };
    case "lanes.swapped":
      return { icon: "placement", title: `${abilityName(entry)} · ${actor} moved lane cards`, detail: `Lane ${Number(entry.laneA) + 1} ↔ Lane ${Number(entry.laneB) + 1}` };
    case "laneCard.swappedWithHand":
      return { icon: "placement", title: `${abilityName(entry)} · ${actor} exchanged a hand and lane card`, detail: `Lane ${Number(entry.laneIndex) + 1}` };
    case "choice.committed":
      return { icon: "priority", title: `${abilityName(entry)} · ${actor} chose ${entry.choice || 'an effect'}`, detail: "Choice committed" };
    case "guest.marked":
      return { icon: "priority", title: `${abilityName(entry, 'Guest ability')} · ${entry.target?.name || "Card"} became a Guest`, detail: "Remains in discard until an invitation consumes it" };
    case "jali.revenantCreated":
      return { icon: "priority", title: `${abilityName(entry, 'Jali')} · ${actor} created a Revenant`, detail: `${entry.revenants} Revenants` };
    case "jali.formationRevealed":
      return { icon: "priority", title: `Basho · ${actor} revealed their formation`, detail: "All three lane cards are public" };
    case "gracus.minotaurCreated":
      return { icon: "priority", title: `Epicura · ${actor} created a Minotaur ${entry.role}`, detail: "Value 4 · combat remains open for response" };
    case "indela.omenRevealed":
      return { icon: "priority", title: `${actor} revealed ${entry.parity} omen ${entry.value}`, detail: `${(entry.sources || []).join(' + ')} · ${entry.parity === 'odd' ? 'own costs −' : 'opponent costs +'}${entry.triggers} this turn` };
    case "ability.used":
    case "ability.activated":
      return { icon: "priority", title: `${actor} activated ${abilityName(entry)}`, detail: "Activation committed" };
    case "payment.discarded": {
      const overpayment = total != null && required != null ? Math.max(0, total - required) : null;
      return {
        icon: "payment",
        title: `${actor} committed payment${total == null ? "" : ` · ${total}/${required ?? "?"}`}`,
        detail: [
          entry.calculation?.cards?.length
            ? `Pitch/payment: ${entry.calculation.cards.map((card) => `${logCardName(card)} (${card.value})`).join(" + ")}`
            : entry.cards?.length ? `Pitch/payment: ${entry.cards.map(logCardName).join(", ")}` : "",
          cardCount != null ? countLabel(cardCount, "card") : "",
          explainPayment(entry.calculation),
          ...(entry.calculation?.notes || []),
          ...(entry.calculation?.reductions || []).map((reduction) => `${reduction.source} reduces cost by ${reduction.amount}`),
          overpayment > 0 ? `${overpayment} over required` : total != null && required != null ? "cost met" : ""
        ].filter(Boolean).join(" · ")
      };
    }
    case "attack.declared":
      return {
        icon: "attack",
        title: `${actor} declared a ${laneLabel(entry)} attack`,
        detail: [
          attack != null ? `Attack ${attack}` : "",
          entry.targetPlayer != null ? `target ${target}` : ""
        ].filter(Boolean).join(" · ") + [
          !entry.calculation && entry.card ? logCardName(entry.card) : "",
          ...calculationDetails(entry.calculation)
        ].filter(Boolean).map((line) => `\n${line}`).join("")
      };
    case "block.declared":
      return {
        icon: "block",
        title: `${actor} committed ${cardCount != null ? countLabel(cardCount, "blocker") : "a block"}`,
        detail: [laneLabel(entry), block != null ? `Block ${block}` : ""].filter(Boolean).join(" · ") + [
          !entry.calculation && entry.cards?.length ? entry.cards.map(logCardName).join(", ") : "",
          ...calculationDetails(entry.calculation)].filter(Boolean).map((line) => `\n${line}`).join("")
      };
    case "damage.calculated": {
      const equationAvailable = attack != null && block != null && damage != null;
      return {
        icon: damage > 0 ? "damage" : "block",
        title: damage == null ? "Damage calculation recorded; amount not recorded" : damage > 0 ? `${damage} damage calculated` : "Attack fully stopped",
        detail: [equationAvailable
          ? `${attack ?? 0} attack − ${block ?? 0} block − ${prevented} prevention = ${damage ?? 0} damage${attack != null && attack - (block ?? 0) - prevented < 0 ? " (minimum 0)" : ""}`
          : `${damage == null ? "Amount not recorded" : `${damage} damage`} · Full calculation not recorded`, ...calculationDetails(entry.calculation)].join("\n")
      };
    }
    case "damage.dealt": {
      const from = numeric(entry.from);
      const to = numeric(entry.to);
      return {
        icon: "damage",
        title: `${target === "Player" ? actor : target} took ${damage ?? 0} damage`,
        detail: from != null && to != null
          ? `Life ${from} − ${damage ?? Math.max(0, from - to)} = ${to}`
          : `${damage ?? 0} life lost`
      };
    }
    case "attack.fullyBlocked":
      return { icon: "block", title: "Attack fully blocked", detail: "0 damage" };
    case "cards.drawn":
      return {
        icon: "placement",
        title: `${entry.source ? `${abilityName(entry)} · ` : ''}${actor} drew ${cardCount == null ? "cards (count not recorded)" : countLabel(cardCount, "card")}`,
        detail: cardCount == null ? "" : `Hand +${cardCount}`
      };
    case "card.placedFacedown":
      return {
        icon: "placement",
        title: `${entry.source ? `${abilityName(entry)} · ` : ''}${actor} placed a face-down card`,
        detail: numeric(entry.laneIndex) == null ? "" : `Lane ${numeric(entry.laneIndex) + 1}`
      };
    case "priority.granted":
      return { icon: "priority", title: `Priority → ${actor}`, detail: "Next action" };
    case "priority.passed":
      return { icon: "priority", title: `${actor} passed priority`, detail: "" };
    case "turn.started":
      return {
        icon: "priority",
        title: `Turn ${numeric(entry.turn) ?? "—"} started`,
        detail: entry.player != null ? `${actor} has priority` : ""
      };
    case "combat.resolutionCompleted":
      return { icon: "damage", title: "Combat resolution completed", detail: "Attack and block cleared" };
    case "campaign.bossHealed":
      return {
        icon: "priority",
        title: `Boss restored ${numeric(entry.amount) ?? 0} life`,
        detail: numeric(entry.to) == null ? "" : `Life → ${numeric(entry.to)}`
      };
    case "match.ended":
      return {
        icon: "priority",
        title: entry.winner == null ? "Match ended in a draw" : `${playerLabel(entry.winner, players)} won the match`,
        detail: entry.reason || "Final result"
      };
    default:
      return {
        icon: "priority",
        title: fallbackText(entry),
        detail: entry.phase ? `Phase · ${entry.phase}` : ""
      };
  }
}

function authoritativeMatchHistory(snapshot, limit = 300) {
  const source = snapshot?.eventLog?.length ? snapshot.eventLog : snapshot?.actionHistory || [];
  return source.slice(-Math.max(1, Number(limit) || 300));
}

function matchLogSequence(entry, fallbackIndex = 0) {
  return numeric(entry?.sequence) ?? fallbackIndex + 1;
}

module.exports = { formatMatchLogEntry, authoritativeMatchHistory, matchLogSequence, isAbilityLogEntry, abilityMatchHistory };
