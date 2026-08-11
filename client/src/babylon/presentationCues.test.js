import {
  BOARD_ACTION_CUE_IDS,
  createInteractionCue,
  PRESENTATION_CUE_CONTRACT_VERSION,
  PresentationCueLedger,
  projectPresentationCues
} from "./presentationCues";

test("projects stable visual and audio cue records from accepted event IDs", () => {
  const event = { id: "event-7", type: "block.declared", player: 2, laneIndex: 1, cardId: "card-b" };
  const first = projectPresentationCues(event, { matchId: "match-a", traversalId: "live" })[0];
  const duplicate = projectPresentationCues({ ...event }, { matchId: "match-a", traversalId: "live" })[0];
  expect(first.contract).toBe(PRESENTATION_CUE_CONTRACT_VERSION);
  expect(first.cueId).toBe("block.commit");
  expect(first.occurrenceId).toBe(duplicate.occurrenceId);
  expect(first.target).toEqual(expect.objectContaining({ zone: "lane", laneIndex: 1, cardId: "card-b" }));
  expect(first.visual.assetId).toBe("block.commit");
  expect(first.audio.assetId).toBe("block.commit");
  expect(first.offsetMs).toBeGreaterThan(0);
  expect(first.offsetMs).toBeLessThan(first.durationMs);
});

test("replay traversal generation permits deliberate replay without duplicate snapshot playback", () => {
  const event = { id: "event-2", type: "damage.calculated", attackId: "attack-1" };
  const one = projectPresentationCues(event, { matchId: "m", traversalId: "replay-1" })[0];
  const same = projectPresentationCues(event, { matchId: "m", traversalId: "replay-1" })[0];
  const restarted = projectPresentationCues(event, { matchId: "m", traversalId: "replay-2" })[0];
  const ledger = new PresentationCueLedger();
  expect(ledger.accept(one)).toBe(true);
  expect(ledger.accept(same)).toBe(false);
  expect(ledger.accept(restarted)).toBe(true);
});

test("semantic interaction cues are based on command tokens rather than mesh clicks", () => {
  const cue = createInteractionCue("ui.confirm", { matchId: "m", revision: 4, token: 2 });
  expect(cue.occurrenceId).toContain("interaction-4-2");
  expect(cue.audio.assetId).toBe("ui.confirm");
});

test("the contract reserves hooks for every requested board action", () => {
  expect(BOARD_ACTION_CUE_IDS).toEqual(expect.arrayContaining([
    "card.lift", "card.travel", "card.settle", "card.draw", "card.place",
    "payment.commit", "payment.release", "card.discard", "attack.declare",
    "block.commit", "combat.resolve", "damage.impact", "priority.transfer",
    "turn.start", "ability.activate", "match.victory", "match.defeat"
  ]));
});

test("events without a lane remain board-targeted instead of coercing to lane zero", () => {
  const [cue] = projectPresentationCues({ id: "turn-2", type: "turn.started", player: 1 }, {
    matchId: "match-1"
  });
  expect(cue.target.zone).toBe("board");
  expect(cue.target.laneIndex).toBeNull();
  expect(cue.occurrenceId).toContain(":board");
});
