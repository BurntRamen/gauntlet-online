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
      const equationAvailable = attack != null || block != null || prevented > 0;
      return {
        icon: damage > 0 ? "damage" : "block",
        title: damage > 0 ? `${damage} damage calculated` : "Attack fully stopped",
        detail: [equationAvailable
          ? `${attack ?? 0} attack − ${block ?? 0} block − ${prevented} prevention = ${damage ?? 0} damage${attack != null && attack - (block ?? 0) - prevented < 0 ? " (minimum 0)" : ""}`
          : `${damage ?? 0} damage`, ...calculationDetails(entry.calculation)].join("\n")
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
        title: `${actor} drew ${countLabel(cardCount ?? 0, "card")}`,
        detail: cardCount == null ? "" : `Hand +${cardCount}`
      };
    case "card.placedFacedown":
      return {
        icon: "placement",
        title: `${actor} placed a face-down card`,
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

module.exports = { formatMatchLogEntry, authoritativeMatchHistory, matchLogSequence };
