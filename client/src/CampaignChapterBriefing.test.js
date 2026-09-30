import { act, fireEvent, render, screen, within } from "@testing-library/react";
import CampaignChapterBriefing, { CampaignBriefingDialogue } from "./CampaignChapterBriefing";

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

describe("dialogue preview playback", () => {
  let originalAudio;
  let clips;
  beforeEach(() => {
    originalAudio = window.Audio;
    clips = [];
    window.Audio = jest.fn((src) => {
      const clip = { src, play: jest.fn(() => Promise.resolve()), pause: jest.fn(), currentTime: 0 };
      clips.push(clip);
      return clip;
    });
  });
  afterEach(() => { window.Audio = originalAudio; });

  test("offers exchanges alongside line previews, with pause/resume and chapter-change cleanup", () => {
    const props = { title: "Opening", lines: ["A: Hello.", "B: Welcome."], audio: ["/a.mp3", "/b.mp3"], factionId: "rumin" };
    const { rerender, unmount } = render(<CampaignBriefingDialogue {...props} scopeKey="one" />);
    fireEvent.click(screen.getByRole("button", { name: "Play exchange" }));
    expect(screen.getByRole("button", { name: "Stop A voice" })).toHaveAttribute("aria-pressed", "true");
    expect(clips[0].src).toContain("rumin-reverie.wav");
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(clips[0].pause).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    act(() => clips[1].onended());
    expect(screen.getByRole("button", { name: "Stop B voice" })).toHaveAttribute("aria-pressed", "true");
    // Identical transcript arrays from a refreshed snapshot must not interrupt speech.
    rerender(<CampaignBriefingDialogue {...props} lines={[...props.lines]} scopeKey="one" />);
    expect(clips[2].pause).not.toHaveBeenCalled();
    rerender(<CampaignBriefingDialogue {...props} scopeKey="two" />);
    expect(clips[2].pause).toHaveBeenCalled();
    expect(clips[0].pause).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Play exchange" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Play B voice" }));
    expect(clips.at(-1).src).toBe("/b.mp3");
    expect(clips).toHaveLength(4);
    unmount();
    expect(clips[3].pause).toHaveBeenCalled();
  });

  test("switches between opening and ending previews without overlapping voices or beds", () => {
    renderBriefing({ completed: true, chapter: { ...chapter, endDialogueAudio: ["/ending.mp3"] } });
    const opening = within(screen.getByRole("region", { name: "Voices before the battle" }));
    const ending = within(screen.getByRole("region", { name: "Voices after the battle" }));
    fireEvent.click(opening.getByRole("button", { name: "Play exchange" }));
    const previousEnded = clips[1].onended;
    fireEvent.click(ending.getByRole("button", { name: "Play exchange" }));
    expect(clips[0].pause).toHaveBeenCalled();
    expect(clips[1].pause).toHaveBeenCalled();
    expect(opening.getByRole("button", { name: "Play exchange" })).toBeEnabled();
    act(previousEnded);
    expect(clips).toHaveLength(4);
  });

  test("keeps a clear disabled exchange control for unrecorded or muted passages", () => {
    const { rerender } = render(<CampaignBriefingDialogue title="Opening" lines={["A: Hello."]} />);
    expect(screen.getByRole("button", { name: "Play exchange" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Recorded voice is not available");
    rerender(<CampaignBriefingDialogue title="Opening" lines={["A: Hello."]} audio={["/a.mp3"]} audioEnabled={false} />);
    expect(screen.getByRole("button", { name: "Play exchange" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Play A voice" })).toBeDisabled();
    expect(clips).toHaveLength(0);
  });
});
