import {
  authoritativeMatchHistory,
  abilityMatchHistory,
  formatMatchLogEntry,
  matchLogSequence
} from "./matchLog";

const players = {
  1: { accountName: "Ada" },
  2: { accountName: "Babbage" }
};

test("announces healing and its general source in the expanded log", () => {
  expect(formatMatchLogEntry({ type: "life.gained", player: 1, source: "Tang", amount: 2, from: 38, to: 40 }, { players }))
    .toEqual({ icon: "life", title: "Ada gained 2 life", detail: "Tang · Life 38 → 40" });
});

test("formats payment and combat events as explicit numerical explanations", () => {
  expect(formatMatchLogEntry({
    type: "payment.discarded",
    player: 1,
    cardIds: ["a", "b"],
    total: 7,
    required: 6
  }, { players })).toEqual({
    icon: "payment",
    title: "Ada committed payment · 7/6",
    detail: "2 cards · 1 over required"
  });

  expect(formatMatchLogEntry({
    type: "damage.calculated",
    attackValue: 12,
    blockValue: 4,
    prevented: 1,
    damage: 7
  }, { players })).toEqual({
    icon: "damage",
    title: "7 damage calculated",
    detail: "12 attack − 4 block − 1 prevention = 7 damage"
  });

  expect(formatMatchLogEntry({
    type: "damage.dealt",
    player: 2,
    amount: 7,
    from: 20,
    to: 13
  }, { players })).toEqual({
    icon: "damage",
    title: "Babbage took 7 damage",
    detail: "Life 20 − 7 = 13"
  });
});

test("names attack source, lane, value, target, and blocker count", () => {
  expect(formatMatchLogEntry({
    type: "attack.declared",
    player: 1,
    targetPlayer: 2,
    laneIndex: 1,
    effectiveValue: 11
  }, { players })).toMatchObject({
    title: "Ada declared a lane 2 attack",
    detail: "Attack 11 · target Babbage"
  });
  expect(formatMatchLogEntry({
    type: "block.declared",
    player: 2,
    laneIndex: 1,
    cardIds: ["one", "two"]
  }, { players })).toMatchObject({
    title: "Babbage committed 2 blockers",
    detail: "lane 2"
  });
});

test("keeps authoritative history chronological and sequence labels stable", () => {
  const history = Array.from({ length: 5 }, (_, index) => ({ id: `event-${index + 1}` }));
  expect(authoritativeMatchHistory({ eventLog: history }, 3).map(({ id }) => id)).toEqual([
    "event-3",
    "event-4",
    "event-5"
  ]);
  expect(matchLogSequence({ sequence: 14 }, 0)).toBe(14);
  expect(matchLogSequence({}, 4)).toBe(5);
});

test("names combat and pitch cards without exposing internal IDs and preserves recorded bonuses", () => {
  const attack = { card: { id: "attack-a", rank: "A", suit: "♥" }, baseValue: 14, effectiveValue: 14, notes: [] };
  const block = { card: { id: "block-three", rank: "3", suit: "♣" }, baseValue: 3, effectiveValue: 5,
    notes: ["Emperor Nu +2"] };
  const formatted = formatMatchLogEntry({ type: "damage.calculated", attackValue: 14, blockValue: 5,
    damage: 9, calculation: { attack, blocks: [block] } }, { players });
  expect(formatted.detail).toContain("14 attack − 5 block − 0 prevention = 9 damage");
  expect(formatted.detail).toContain("Attack: A♥ — 14 base = 14 attack");
  expect(formatted.detail).toContain("Block: 3♣ — 3 base + 2 bonus = 5 block · Applied: Emperor Nu +2");
  expect(formatted.detail).not.toContain("attack-a");
  expect(formatted.detail).not.toContain("block-three");
  players[2].faction = { name: "Different future faction" };
  expect(formatMatchLogEntry({ type: "damage.calculated", attackValue: 14, blockValue: 5,
    damage: 9, calculation: { attack, blocks: [block] } }, { players }).detail).toBe(formatted.detail);
  delete players[2].faction;
  const payment = formatMatchLogEntry({ type: "payment.discarded", player: 1, cardIds: ["pitch-a", "pitch-b"],
    total: 7, required: 6, calculation: { cards: [{ id: "pitch-a", rank: "4", suit: "♦", value: 4 },
      { id: "pitch-b", rank: "3", suit: "♥", value: 3 }], notes: [] } });
  expect(payment.detail).toContain("Pitch/payment: 4♦ (4) + 3♥ (3)");
  expect(payment.detail).not.toContain("pitch-a");
  expect(payment.detail).not.toContain("pitch-b");
  expect(payment.detail).toContain("1 over required");
  const bonusPayment = formatMatchLogEntry({ type: "payment.discarded", player: 1, cardIds: ["pitch-a"],
    total: 6, required: 5, calculation: { cards: [{ id: "pitch-a", rank: "4", suit: "♦", value: 4 }],
      total: 6, required: 5, notes: ["Hera payment +2"], reductions: [{ source: "Katel", amount: 1 }] } });
  expect(bonusPayment.detail).toContain("Payment: 4 base + 2 bonus = 6");
  expect(bonusPayment.detail).toContain("Hera payment +2");
  expect(bonusPayment.detail).toContain("Katel reduces cost by 1");
});

test("does not invent modifier sources for historical totals without receipts", () => {
  expect(formatMatchLogEntry({ type: "damage.calculated", attackValue: 14, blockValue: 5, damage: 9 },
    { players: { 2: { faction: { id: "sheen" } } } }).detail).toBe("14 attack − 5 block − 0 prevention = 9 damage");
});

test("ability recall keeps named sources, automatic calculation notes and expiration after later passes", () => {
  const applied = { id: 'buff', sequence: 3, type: 'effect.applied', player: 1,
    source: { name: 'Watane' }, target: { name: '5♥' }, amount: 2, before: 5, after: 7,
    contexts: ['attack', 'block'], duration: { kind: 'turn' } };
  const expired = { ...applied, id: 'expired', sequence: 7, type: 'effect.expired',
    amount: -2, before: 7, after: 5, reason: 'Turn ended' };
  const automatic = { id: 'attack', sequence: 4, type: 'attack.declared',
    calculation: { attack: { card: { rank: '5', suit: '♥' }, baseValue: 5,
      effectiveValue: 8, notes: ['Kaiser +3'] } } };
  const history = abilityMatchHistory({ effectHistory: [applied, expired], publicCombatLog: [automatic] },
    [applied, { id: 'pass', sequence: 8, type: 'priority.passed', player: 1 }]);
  expect(history.map(e => e.id)).toEqual(['buff', 'attack', 'expired']);
  expect(formatMatchLogEntry(applied, { players })).toMatchObject({
    title: 'Watane applied · 5♥', detail: 'Ada · +2 attack/block · 5 → 7 · Until turn end'
  });
  expect(formatMatchLogEntry(expired).detail).toContain('7 → 5 · Turn ended');
  expect(formatMatchLogEntry(automatic).detail).toContain('Kaiser +3');
});

test("ability recall has readable labels without internal IDs or private results", () => {
  for (const entry of [
    { type: 'card.buffApplied', source: 'Focus', amount: 1 },
    { type: 'lanes.swapped', source: 'Polea', laneA: 0, laneB: 1 },
    { type: 'laneCard.swappedWithHand', source: 'Lafayette', laneIndex: 0 },
    { type: 'choice.committed', source: 'Rally the Crew', choice: 'attack' },
    { type: 'acceleration.gained', source: 'Focus', amount: 1 },
    { type: 'ability.used', abilityId: 'jali:watane:secret-card' }
  ]) {
    const formatted = formatMatchLogEntry(entry);
    expect(formatted.title).not.toBe('Match state updated.');
    expect(formatted.title).not.toContain('secret-card');
    expect(abilityMatchHistory({ effectHistory: [entry] })).toHaveLength(1);
  }
  expect(abilityMatchHistory({ effectHistory: [
    { type: 'card.peeked', private: true, player: 2 },
    { type: 'effect.readied', private: true, player: 2 }
  ] })).toHaveLength(0);
});
