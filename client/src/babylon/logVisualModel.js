import { getPlayingCardArtPath, normalizeCardDisplayText } from "../cardArt";

const suits = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" };
const number = (value) => value != null && value !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
const symbol = (value) => ({ kind: "symbol", value });
const value = (amount, icon, label) => ({ kind: "number", value: number(amount) ?? "?", icon, label });
const signed = (amount, label = "Bonus") => ({ kind: "bonus", value: number(amount) ?? "?", label });
const normalized = (name) => String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function logCardToken(card, factionId, faceDown = false) {
  if (faceDown || !card || card.hidden || card.visible === false) return { kind: "card", hidden: true, label: "Face-down card" };
  const suit = suits[card.suit] || normalizeCardDisplayText(card.suit || "");
  const rank = String(card.rank || card.value || "?");
  const faction = card.factionId || factionId;
  const ordinary = !card.type || card.type === "playing-card";
  const label = card.name || `${rank}${suit}`;
  // Receipts explicitly tag ordinary cards as playing-card; the art resolver
  // uses an absent type for that same category. Never look up hidden card IDs.
  const art = getPlayingCardArtPath(ordinary ? { ...card, type: undefined } : card, faction);
  return { kind: "card", rank, suit, label,
    art: ordinary && !card.presentation && !card.definitionId && (!faction || faction === "basic") ? "" : art,
    faction: faction || "basic" };
}

export function logSourceToken(source, players = {}, owner) {
  const name = typeof source === "string" ? source : source?.name;
  if (!name || ["hand", "lane", "ability", "constructed", "campaignBoss"].includes(name)) return null;
  const key = normalized(name);
  const ordered = [players[owner], ...Object.values(players)].filter(Boolean);
  for (const player of ordered) {
    for (const role of ["commander", "city", "general"]) {
      const profile = player.faction?.[role];
      const profileName = typeof profile === "string" ? profile : profile?.name;
      const candidate = normalized(profileName);
      if (candidate && (candidate === key || candidate.startsWith(`${key} `))) {
        return { kind: "source", label: name, role, art: profile?.image || "" };
      }
    }
  }
  return { kind: "source", label: name, role: "ability", art: "" };
}

function receiptTokens(receipt, fallback, icon, faction, players, owner) {
  const tokens = [];
  if (receipt?.card) tokens.push(logCardToken(receipt.card, faction));
  const base = number(receipt?.baseValue), total = number(receipt?.effectiveValue) ?? number(fallback);
  const delta = base != null && total != null ? total - base : 0;
  if (delta) {
    const modifiers = (receipt.notes || []).map((note) => String(note).match(/^(.+?)\s+([+−-]\d+)$/))
      .filter(Boolean).map((match) => ({ source: match[1], amount: Number(match[2].replace("−", "-")) }));
    if (modifiers.length && modifiers.reduce((sum, modifier) => sum + modifier.amount, 0) === delta) {
      modifiers.forEach((modifier) => tokens.push(logSourceToken(modifier.source, players, owner), signed(modifier.amount, modifier.source)));
    } else tokens.push(signed(delta, "Recorded value adjustment; expand for source notes"));
  }
  if (tokens.length && total != null) tokens.push(symbol("="));
  tokens.push(value(total, icon, icon === "attack" ? "Attack" : "Block"));
  return tokens.filter(Boolean);
}

const actions = {
  "attack.declared": ["Attack", "attack"], "block.declared": ["Block", "block"],
  "payment.discarded": ["Pay", "payment"], "damage.calculated": ["Damage", "damage"],
  "damage.dealt": ["Life lost", "life"], "life.gained": ["Heal", "life"],
  "campaign.bossHealed": ["Heal", "life"], "attack.fullyBlocked": ["Stopped", "block"],
  "cards.drawn": ["Draw", "draw"], "card.placedFacedown": ["Place", "placement"],
  "card.supportPlaced": ["Support", "ability"], "priority.granted": ["Priority", "priority"],
  "priority.passed": ["Pass", "pass"], "priority.retained": ["Act again", "priority"],
  "turn.started": ["Turn", "turn"], "combat.resolutionCompleted": ["Resolved", "block"],
  "ability.used": ["Ability", "ability"], "ability.activated": ["Ability", "ability"],
  "effect.applied": ["Bonus", "ability"], "effect.expired": ["Expired", "cancel"],
  "effect.consumed": ["Used", "ability"], "effect.readied": ["Ready", "ability"],
  "card.buffApplied": ["Bonus", "ability"], "resource.changed": ["Resource", "ability"],
  "lanes.swapped": ["Swap", "swap"], "laneCard.swappedWithHand": ["Swap", "swap"],
  "card.peeked": ["Inspect", "inspect"], "choice.committed": ["Choice", "ability"],
  "guest.marked": ["Guest", "ability"], "acceleration.gained": ["Charge", "ability"],
  "acceleration.spent": ["Spend", "ability"], "match.ended": ["Result", "priority"]
};

export function visualMatchLog(entry = {}, players = {}) {
  const owner = (entry.type === "damage.dealt" ? entry.targetPlayer : null) ?? entry.player ?? entry.attacker ?? entry.winner;
  const faction = players[owner]?.faction?.id;
  const [label, icon] = actions[entry.type] || ["Event", "priority"];
  const lane = (index) => ({ kind: "lane", value: number(index) == null ? "?" : Number(index) + 1, label: "Lane" });
  const player = (id) => ({ kind: "player", value: id, label: players[id]?.accountName || players[id]?.name || `Player ${id}` });
  const groups = [];
  const add = (...tokens) => { const group = tokens.filter(Boolean); if (group.length) groups.push(group); };
  const source = logSourceToken(entry.abilityName || entry.source, players, owner);
  const calculation = entry.calculation || {};
  const card = (item) => logCardToken(item, faction);
  if (entry.private && !entry.source) return { label: "Private effect", icon: "ability", owner, groups: [] };
  switch (entry.type) {
    case "attack.declared":
      add(...receiptTokens(calculation.attack || (entry.card ? { card: entry.card } : null),
        entry.effectiveValue ?? entry.attackValue ?? entry.value, "attack", faction, players, owner));
      if (entry.targetPlayer != null) add(symbol("→"), player(entry.targetPlayer));
      break;
    case "block.declared":
      if (calculation.blocks?.length) {
        calculation.blocks.forEach((receipt) => add(...receiptTokens(receipt, null, "block", faction, players, owner)));
        if (calculation.blocks.length > 1) add(value(entry.blockValue ?? entry.totalBlock, "block", "Total block"));
      }
      else add(...(entry.cards || []).map(card), value(entry.blockValue ?? entry.totalBlock, "block", "Block value"));
      break;
    case "payment.discarded": {
      const cards = calculation.cards || entry.cards || [];
      add(...cards.map(card));
      const total = number(entry.total) ?? number(calculation.total);
      const required = number(entry.required) ?? number(calculation.required);
      if (cards.length && total != null && cards.every((item) => number(item.value) != null)) {
        const bonus = total - cards.reduce((sum, item) => sum + Number(item.value), 0);
        if (bonus) add(signed(bonus, (calculation.notes || []).join("; ") || "Payment bonus"));
      }
      add(value(total, "payment", "Paid"), symbol("/"), value(required, null, "Cost"));
      (calculation.reductions || []).forEach((reduction) => add(logSourceToken(reduction.source, players, owner), signed(-reduction.amount, "Cost reduction")));
      break;
    }
    case "damage.calculated":
      add(value(entry.attackValue, "attack", "Attack"), symbol("−"), value(entry.blockValue, "block", "Block"));
      if (Number(entry.prevented ?? entry.prevention) > 0) add(symbol("−"), value(entry.prevented ?? entry.prevention, "block", "Prevention"));
      add(symbol("="), value(entry.damage, "damage", "Damage"));
      break;
    case "damage.dealt":
    case "life.gained":
    case "campaign.bossHealed":
      add(source, value(entry.amount ?? entry.damage, "life", label));
      if (entry.from != null && entry.to != null) add(value(entry.from, null, "Life before"), symbol("→"), value(entry.to, "life", "Life after"));
      break;
    case "cards.drawn":
      add(source, logCardToken(null, faction, true), signed(entry.count ?? entry.cardIds?.length, "Cards drawn"));
      break;
    case "card.placedFacedown":
      add(source, logCardToken(null, faction, true), symbol("→"), entry.laneIndex != null ? lane(entry.laneIndex) : null);
      break;
    case "lanes.swapped":
      add(source, lane(entry.laneA), symbol("↔"), lane(entry.laneB));
      break;
    case "laneCard.swappedWithHand":
      add(source, logCardToken(null, faction, true), symbol("↔"), lane(entry.laneIndex));
      break;
    case "priority.granted":
    case "priority.passed":
    case "priority.retained":
      break;
    case "turn.started":
      add(value(entry.turn, "turn", "Turn"));
      break;
    case "attack.fullyBlocked":
      add(value(0, "damage", "Damage"));
      break;
    case "combat.resolutionCompleted":
      break;
    case "match.ended":
      add({ kind: "status", icon: "priority", label: entry.winner == null ? "Draw" : "Victory" });
      break;
    default: {
      add(source);
      if (entry.card) add(card(entry.card));
      else if (entry.target) {
        const face = String(entry.target.name || "").match(/^(A|K|Q|J|10|[2-9])([♥♦♣♠])$/);
        add(card(face ? { rank: face[1], suit: face[2] } : { name: entry.target.name || "Card", rank: "?" }));
      }
      if (entry.amount != null) add(signed(entry.amount, entry.resourceLabel || label));
      if (entry.before != null && entry.after != null) add(value(entry.before, null, "Before"), symbol("→"), value(entry.after, null, "After"));
      if (entry.choice) add({ kind: "status", label: String(entry.choice), icon: "ability" });
      if (!groups.length) add({ kind: "status", label: "Details", icon: "inspect" });
    }
  }
  return { label, icon, owner, lane: entry.laneIndex != null ? Number(entry.laneIndex) + 1 : null, groups };
}
