import { render, screen } from "@testing-library/react";
import SpecialCardFace from "./SpecialCardFace";
import { getPlayingCardArtPath, getCustomCardFacePath } from "./cardArt";
import { paintPublishedCardFace } from "./babylon/composedCardFace";
import MatchCardFace from "./babylon/MatchCardFace";

function drawingContext() {
  return {
    clearRect: jest.fn(), fillRect: jest.fn(), strokeRect: jest.fn(), drawImage: jest.fn(),
    fillText: jest.fn(), save: jest.fn(), restore: jest.fn(), translate: jest.fn(), rotate: jest.fn(),
    createRadialGradient: () => ({ addColorStop: jest.fn() }),
    createLinearGradient: () => ({ addColorStop: jest.fn() }),
    measureText: (text) => ({ width: text.length * 7 })
  };
}

const card = { id: "rumin-coin-scale-spear", name: "Published spear", text: "Published rules", value: 4, suit: "♠", factionId: "rumin", presentation: { releaseId: "release-pinned", illustration: "/assets/gauntlet/releases/illustration.webp", faces: { spades: "/assets/gauntlet/releases/face.webp" }, composed: false } };
test("published references override client mappings and changed labels use composition in collection and battlefield", () => {
  expect(getPlayingCardArtPath(card)).toBe(card.presentation.faces.spades);
  const edited = { ...card, presentation: { ...card.presentation, composed: true } };
  expect(getCustomCardFacePath(edited)).toBe("");
  expect(getPlayingCardArtPath(edited)).toBe(card.presentation.illustration);
  render(<SpecialCardFace card={edited} />);
  expect(screen.getByText("Published spear")).toBeVisible();
  expect(screen.getByText("Published rules")).toBeVisible();
  expect(screen.getByRole("img")).toHaveAttribute("src", card.presentation.illustration);
  const context = drawingContext();
  paintPublishedCardFace(context, edited, {});
  expect(context.fillText.mock.calls.some(([text]) => text === "Published spear")).toBe(true);
  expect(context.fillText.mock.calls.some(([text]) => text === "Published rules")).toBe(true);
  expect(getPlayingCardArtPath(card)).toBe(card.presentation.faces.spades);
});

test("campaign preview paints the same full-art face as the battlefield", () => {
  const boss = { ...card, name: "Robespier the Red Tide Strike 1", value: 3,
    campaignBossCard: true, presentation: { ...card.presentation, composed: true } };
  const illustration = { naturalWidth: 351, naturalHeight: 351, onload: null };
  const imageMock = jest.spyOn(window, "Image").mockImplementation(() => illustration);
  const previewContext = drawingContext();
  const canvasMock = jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(previewContext);
  try {
    const { unmount } = render(<MatchCardFace card={{ raw: boss, artPath: boss.presentation.illustration }} alt={boss.name} />);
    expect(screen.getByRole("img", { name: boss.name }).tagName).toBe("CANVAS");
    expect(illustration.src).toBe(boss.presentation.illustration);
    previewContext.drawImage.mockClear();
    previewContext.fillText.mockClear();
    illustration.onload();
    const battlefieldContext = drawingContext();
    paintPublishedCardFace(battlefieldContext, boss, illustration);
    expect(previewContext.drawImage.mock.calls).toEqual(battlefieldContext.drawImage.mock.calls);
    expect(previewContext.fillText.mock.calls).toEqual(battlefieldContext.fillText.mock.calls);
    // The illustration fills the entire face, with its aspect ratio preserved.
    const [, , , cropWidth, cropHeight, x, y, width, height] = previewContext.drawImage.mock.calls[0];
    expect([x, y, width, height]).toEqual([0, 0, 384, 536]);
    expect(cropWidth / cropHeight).toBeCloseTo(width / height);
    unmount();
    expect(illustration.onload).toBeNull();
  } finally {
    imageMock.mockRestore();
    canvasMock.mockRestore();
  }
});
