import { act, render, screen, waitFor } from "@testing-library/react";
import aliases from "../../public/brand/suitfire-art/manifest.json";
import { setAccountBrand, chooseBrand } from "./brandPreview";
import { resolvePresentationArt, loadPresentationRegistry } from "./presentationArt";
import { getCardForPresentation, getPlayingCardArtPath } from "../cardArt";
import { getFactionCover, getFactionAsset } from "../GauntletVisuals";
import SpecialCardFace from "../SpecialCardFace";
import MatchCardFace from "../babylon/MatchCardFace";
import CollectorSetPackTile from "../CollectorSetPackTile";

const source = "/assets/gauntlet/constructed/faces/sheen-fixture-hearts.webp";
const illustration = "/test-fixtures/approved-illustration.webp";
const city = "/test-fixtures/approved-city.webp";
const fixture = { version: 1, aliases: aliases.aliases, replacements: {
  [source]: { status: "approved", factionId: "sheen", cardId: "sheen-fixture", surfaces: ["card"], target: illustration, kind: "illustration" }
}, covers: { sheen: { status: "approved", target: city } } };
const enable = () => { setAccountBrand({ id: "fixture-only", brandPreview: "suitfire" }); chooseBrand("suitfire"); };
const card = Object.freeze({ id: "sheen-fixture", factionId: "sheen", name: "Captured card", value: 12, suit: "hearts", text: "Keep these printed rules.", presentation: Object.freeze({ releaseId: "old-release", face: source, illustration: "/old-illustration.webp" }) });
beforeAll(async () => {
  const original = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => fixture });
  await loadPresentationRegistry();
  global.fetch = original;
});
beforeEach(() => { localStorage.clear(); setAccountBrand(null); });
afterEach(() => act(() => setAccountBrand(null)));

test("an exact approved match respects faction, card identity, surface and external URLs", () => {
  const request = { source: source + "?v=3", factionId: "sheen", cardId: card.id, surface: "card" };
  const resolve = extra => resolvePresentationArt({ ...request, ...extra }, { preview: true, registry: fixture });
  expect(resolve({})).toMatchObject({ src: illustration, kind: "illustration" });
  for (const mismatch of [{ factionId: "bizi" }, { cardId: "sheen-other" }, { surface: "portrait" }, { source: "https://unrelated.test" + source }]) {
    expect(resolve(mismatch).src).not.toBe(illustration);
  }
  const draft = { ...fixture, replacements: { [source]: { ...fixture.replacements[source], status: "draft" } } };
  expect(resolvePresentationArt(request, { preview: true, registry: draft }).src).toBe(request.source);
  expect(resolvePresentationArt(request, { preview: false, registry: fixture }).src).toBe(request.source);
});

test("captured content hashes route by exact original path without editing the saved card", () => {
  const historical = Object.keys(aliases.aliases).find(key => aliases.aliases[key].startsWith("/assets/gauntlet/constructed/faces/sheen-"));
  expect(historical).toBeTruthy();
  const config = { ...fixture, aliases: { [historical]: source } };
  expect(resolvePresentationArt({ source: historical + "?v=4", factionId: "sheen", cardId: card.id, surface: "card" }, { preview: true, registry: config }).src).toBe(illustration);
});

test("composed preview keeps captured rules, identity, rank, suit and release untouched", () => {
  enable();
  const before = JSON.stringify(card);
  const shown = getCardForPresentation(card);
  expect(shown).toMatchObject({ id: card.id, name: card.name, value: 12, suit: "hearts", text: card.text });
  expect(shown.presentation).toMatchObject({ composed: true, illustration, releaseId: "old-release", face: "", faces: {} });
  expect(getPlayingCardArtPath(card)).toBe(illustration);
  const { container } = render(<SpecialCardFace card={card} />);
  expect(screen.getByText(card.name)).toBeInTheDocument();
  expect(screen.getByText(card.text)).toBeInTheDocument();
  expect(container.querySelector(".special-card-corner")).toHaveTextContent("Q♥");
  expect(container.querySelector("img")).toHaveAttribute("src", illustration);
  expect(JSON.stringify(card)).toBe(before);
});

test("replay canvas uses the new illustration instead of nesting a captured complete face", () => {
  enable();
  const context = jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const { container } = render(<MatchCardFace card={{ raw: card, artPath: source }} alt="Replay card" />);
  expect(container.querySelector("canvas")).toHaveAttribute("data-art-source", illustration);
  expect(card.presentation.face).toBe(source);
  context.mockRestore();
});

test("decorative covers do not replace chapter events, portraits, or another faction", () => {
  enable();
  const scene = "/assets/gauntlet/campaigns/sheen/retained-event.webp";
  expect(getFactionCover("sheen", scene)).toBe(city);
  expect(getFactionAsset("sheen", scene)).toBe(scene);
  for (const surface of ["scene", "portrait", "illustration", "card"]) {
    expect(resolvePresentationArt({ source: scene, factionId: "sheen", surface }).src).toBe(scene);
  }
  expect(getFactionCover("bizi", "/retained-bizi-city.webp")).toBe("/retained-bizi-city.webp");
});

test("Initiative packs use approved covers outside the crest; other sets cannot borrow them", async () => {
  enable();
  const view = render(<CollectorSetPackTile product={{ id: "pack", setId: "initiative", setName: "Initiative", artPath: "/old-baked-logo.png" }} />);
  await waitFor(() => expect(view.container.querySelector(".preview-pack-faction")).toHaveAttribute("src", city));
  expect(view.container.querySelector(".preview-pack-crest")).toHaveAttribute("src", "/brand/suitfire-v14/crest.png");
  view.rerender(<CollectorSetPackTile product={{ id: "pack", setId: "fractured-realms", artPath: "/old-baked-logo.png" }} />);
  expect(view.container.querySelector(".preview-pack-faction")).toBeNull();
});

test("public accounts, GO selection, and Admin stored-art previews keep original artwork", () => {
  setAccountBrand({ id: "ordinary", name: "simply" }); chooseBrand("suitfire");
  expect(getCardForPresentation(card)).toBe(card);
  enable();
  const view = render(<SpecialCardFace card={card} previewArt={false} />);
  expect(view.container.querySelector("img")).toHaveAttribute("src", source);
  act(() => chooseBrand("gauntlet"));
  expect(getCardForPresentation(card)).toBe(card);
  expect(getFactionCover("sheen", "/original-city.webp")).toBe("/original-city.webp");
  view.unmount();
  const pack = render(<CollectorSetPackTile product={{ id: "pack", setId: "initiative", artPath: "/old-baked-logo.png" }} />);
  expect(pack.container.innerHTML).toContain("old-baked-logo.png");
  expect(pack.container.querySelector(".preview-pack-art")).toBeNull();
});
