import { fireEvent, render, screen } from "@testing-library/react";
import CampaignChapterBriefing from "./CampaignChapterBriefing";

const campaign = {
  factionName: "Rumin",
  commanderName: "The Jewel of Rumie",
  chapters: [{ id: "chapter-1" }, { id: "chapter-2" }]
};

const chapter = {
  id: "chapter-2",
  title: "The Republic",
  story: "Rumie grows wealthy while the republic begins to fracture.",
  playableName: "Senate Reformers",
  opponentName: "Tribune Marcell",
  beforeBattle: "Gold has begun to vote louder than citizens.",
  afterBattle: "The Republic survives, but its sickness has been named.",
  dialogue: ["Narrator: The Senate gathers.", "Marcell: Order has a price."],
  dialogueAudio: ["/voices/narrator.mp3", null],
  endDialogue: ["Reformer: The work begins."],
  image: "/chapter-2.webp"
};

const difficulty = {
  bossLife: 21,
  attacksPerTurn: 2,
  minAttackValue: 2,
  maxAttackValue: 5
};

function renderBriefing(overrides = {}) {
  const props = {
    campaign,
    factionId: "rumin",
    theme: { primary: "#8b5e3c", border: "#6f4628" },
    chapter,
    chapterIndex: 1,
    difficulty,
    complexity: ["Marcell adds a Senate pressure modifier."],
    unlocked: false,
    completed: false,
    current: false,
    canPlayAsPlayer: true,
    onBack: jest.fn(),
    onStartChapter: jest.fn(),
    onPrevious: jest.fn(),
    onNext: null,
    ...overrides
  };
  render(<CampaignChapterBriefing {...props} />);
  return props;
}

test("shows the complete source-grounded briefing while keeping a locked battle gated", () => {
  const props = renderBriefing();

  expect(screen.getByRole("heading", { name: "The Republic", level: 2 })).toBeVisible();
  expect(screen.getByText("Gold has begun to vote louder than citizens.")).toBeVisible();
  expect(screen.getByText("The Senate gathers.")).toBeVisible();
  expect(screen.getByText("Marcell adds a Senate pressure modifier.")).toBeVisible();
  expect(screen.getByText("Clear Chapter 1 to unlock this battle.")).toBeVisible();
  expect(screen.getByText("Clear this chapter to unlock its outcome and closing dialogue.")).toBeVisible();

  const battleButton = screen.getByRole("button", { name: "Clear Chapter 1 First" });
  expect(battleButton).toBeDisabled();
  fireEvent.click(battleButton);
  expect(props.onStartChapter).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "← Back to Chapter Map" }));
  expect(props.onBack).toHaveBeenCalledTimes(1);
});

test("reveals the after-action archive and starts a cleared chapter", () => {
  const props = renderBriefing({ unlocked: true, completed: true, current: false });

  expect(screen.getByText("The Republic survives, but its sickness has been named.")).toBeVisible();
  expect(screen.getByText("The work begins.")).toBeVisible();
  const battleButton = screen.getByRole("button", { name: "Begin Battle" });
  expect(battleButton).toBeEnabled();
  fireEvent.click(battleButton);
  expect(props.onStartChapter).toHaveBeenCalledWith("rumin", "chapter-2");
});
