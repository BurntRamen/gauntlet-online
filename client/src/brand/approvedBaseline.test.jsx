import { act, fireEvent, render } from "@testing-library/react";
import registry from "../../public/brand/suitfire-art/manifest.json";
import inventory from "../../../docs/branding/suitfire-art-audit-inventory.json";
import { chooseBrand, setAccountBrand } from "./brandPreview";
import { loadPresentationRegistry } from "./presentationArt";
import { getCardForPresentation, getPlayingCardArtPath } from "../cardArt";
import SpecialCardFace from "../SpecialCardFace";
import MatchCardFace from "../babylon/MatchCardFace";
const { COLLECTION_CARDS } = require("../../../server/gameContent");
const suits = { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" };
beforeAll(async () => {
  const original = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => registry });
  await loadPresentationRegistry(); global.fetch = original;
});
let canvasContext;
beforeEach(() => { canvasContext = jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null); localStorage.clear(); setAccountBrand({ id: "local-art-fixture", brandPreview: "suitfire" }); chooseBrand("suitfire"); });
afterEach(() => { canvasContext.mockRestore(); act(() => setAccountBrand(null)); });

test.each(inventory.cards)("$cardId preserves captured names, rules and all four suits", reviewed => {
  const current = COLLECTION_CARDS.find(card => card.id === reviewed.cardId);
  for (const [suit, symbol] of Object.entries(suits)) {
    const source = reviewed.originals.find(original => original.source.endsWith(`-${suit}.webp`)).immutablePath;
    const card = Object.freeze({ ...current, suit, presentation: Object.freeze({ face: source, releaseId: "captured-art-review" }) });
    const before = JSON.stringify(card);
    const shown = getCardForPresentation(card);
    expect(shown.presentation.illustration).toBe(reviewed.target);
    expect(shown).toMatchObject({ name: current.name, type: current.type, text: current.text, value: current.value, suit });
    expect(getPlayingCardArtPath(card)).toBe(reviewed.target);
    const view = render(<SpecialCardFace card={card} />);
    expect(view.container.querySelector(".special-card-name")).toHaveTextContent(current.name);
    expect(view.container.querySelector(".special-card-caption")).toHaveTextContent(current.displayText || current.text);
    expect(view.container.querySelector(".special-card-corner")).toHaveTextContent(symbol);
    expect(view.container.querySelector("img")).toHaveAttribute("src", reviewed.target);
    view.rerender(<MatchCardFace card={{ raw: card, artPath: source }} />);
    expect(view.container.querySelector("canvas")).toHaveAttribute("data-art-source", reviewed.target);
    view.rerender(<SpecialCardFace card={card} previewArt={false} />);
    expect(view.container.querySelector("img")).toHaveAttribute("src", source);
    expect(JSON.stringify(card)).toBe(before);
    view.unmount();
  }
});

test("a missing optional illustration retains readable card information and own-faction fallback", () => {
  const reviewed = inventory.cards[0];
  const card = COLLECTION_CARDS.find(card => card.id === reviewed.cardId);
  const view = render(<SpecialCardFace card={card} />);
  const art = view.container.querySelector("img");
  expect(art).toHaveAttribute("src", reviewed.target);
  fireEvent.error(art);
  expect(art).not.toHaveAttribute("src", reviewed.target);
  expect(view.container.querySelector(".special-card-name")).toHaveTextContent(card.name);
  expect(view.container.querySelector(".special-card-caption")).toHaveTextContent(card.displayText || card.text);
});
