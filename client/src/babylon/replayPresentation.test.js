import {
  claimReplayCardStage,
  getBattlefieldCardPresence,
  getDetachedDeclaredBlockCards,
  replayCardIdentity,
  replayCardIsOnBattlefield,
  replayStageId
} from "./replayPresentation";

describe("replay battlefield card identity", () => {
  const attack = {
    card: { raw: { id: "attacker-1" } },
    blocks: [
      { card: { raw: { id: "blocker-1" } } },
      { card: { raw: { id: "blocker-2" } } }
    ]
  };

  test("does not stage authoritative attackers or blockers a second time", () => {
    const presence = getBattlefieldCardPresence([attack]);
    expect(replayCardIsOnBattlefield({ runtimeId: "attacker-1" }, "primary", presence)).toBe(true);
    expect(replayCardIsOnBattlefield({ runtimeId: "blocker-1" }, "primary", presence)).toBe(true);
    expect(replayCardIsOnBattlefield({ runtimeId: "blocker-2" }, "blocker", presence)).toBe(true);
    expect(replayCardIsOnBattlefield({ runtimeId: "payment-1" }, "primary", presence)).toBe(false);
  });

  test("uses stable mesh identities across adjacent semantic replay actions", () => {
    const card = { runtimeId: "public-attacker" };
    expect(replayStageId("primary", card, "attack-action")).toBe(
      replayStageId("primary", card, "resolution-action")
    );
    expect(replayStageId("payment", card, "attack-action")).not.toBe(
      replayStageId("primary", card, "attack-action")
    );
  });

  test("gives the primary and blocker views of one physical card the same identity", () => {
    expect(replayCardIdentity({ runtimeId: "blocker-1", gameplayCardId: "definition-a" })).toBe("blocker-1");
    expect(replayCardIdentity({ id: "blocker-1" })).toBe("blocker-1");
  });

  test("claims one physical replay card only once across action roles", () => {
    const claimed = new Set();
    expect(claimReplayCardStage({ runtimeId: "blocker-1" }, claimed)).toBe(true);
    expect(claimReplayCardStage({ id: "blocker-1" }, claimed)).toBe(false);
    expect(claimReplayCardStage({ runtimeId: "payment-1" }, claimed)).toBe(true);
  });

  test("keeps a combat claim when the same physical card also appears as payment evidence", () => {
    const duplicatedCard = { runtimeId: "same-card" };
    const claimed = new Set();
    expect(claimReplayCardStage(duplicatedCard, claimed)).toBe(true);
    expect(claimReplayCardStage(duplicatedCard, claimed)).toBe(false);
  });

  test("finds Basic blockers that resolved before an authoritative combat frame", () => {
    const presence = getBattlefieldCardPresence([attack]);
    expect(getDetachedDeclaredBlockCards([
      { id: "event-1", type: "block.declared", player: 1, cardIds: ["blocker-1", "blocker-3"], laneIndex: null },
      { id: "event-2", type: "block.declared", player: 2, cardIds: ["opponent-blocker"] }
    ], presence, 1)).toEqual([
      { cardId: "blocker-3", laneIndex: null, eventId: "event-1" }
    ]);
  });

  test("keeps identity-less evidence deterministic without merging unrelated actions", () => {
    expect(replayStageId("primary", {}, "action-a", 0)).toBe("replay-primary-action-a-0");
    expect(replayStageId("primary", {}, "action-b", 0)).toBe("replay-primary-action-b-0");
  });
});
