import {
  authoritativeMatchHistory,
  formatMatchLogEntry,
  matchLogSequence
} from "./matchLog";

const players = {
  1: { accountName: "Ada" },
  2: { accountName: "Babbage" }
};

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
