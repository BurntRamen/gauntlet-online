import { render, screen } from "@testing-library/react";
import SpecialCardFace from "./SpecialCardFace";
import { getPlayingCardArtPath, getCustomCardFacePath } from "./cardArt";
import { paintPublishedCardFace } from "./babylon/composedCardFace";

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
  const context = { fillRect: jest.fn(), strokeRect: jest.fn(), drawImage: jest.fn(), fillText: jest.fn(), measureText: (text) => ({ width: text.length * 7 }) };
  paintPublishedCardFace(context, edited, {});
  expect(context.fillText.mock.calls.some(([text]) => text === "Published spear")).toBe(true);
  expect(context.fillText.mock.calls.some(([text]) => text === "Published rules")).toBe(true);
  expect(getPlayingCardArtPath(card)).toBe(card.presentation.faces.spades);
});
