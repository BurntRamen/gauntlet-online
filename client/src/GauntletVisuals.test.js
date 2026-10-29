import fs from "fs";
import path from "path";
import { render } from "@testing-library/react";
import { FactionArtwork, getFactionAsset, getFactionArtwork } from "./GauntletVisuals";

test("keeps the neutral fallback behind only artwork-free faction surfaces", () => {
  const stylesheet = fs.readFileSync(path.join(__dirname, "GauntletVisuals.css"), "utf8");
  expect(stylesheet).toContain(".faction-artwork.is-neutral::before");
  expect(stylesheet).not.toMatch(/\.faction-artwork::before\s*\{/);

  const { container, rerender } = render(<FactionArtwork factionId="bizi" art="/assets/gauntlet/factions/bizi/constanti-technology-hub.webp" decorative />);
  expect(container.firstChild).toHaveClass("has-art");
  expect(container.firstChild).not.toHaveClass("is-neutral");

  rerender(<FactionArtwork factionId="xendra" decorative />);
  expect(container.firstChild).toHaveClass("is-neutral");
});

test("rejects borrowed faction art in named and immutable release references", () => {
  expect(getFactionAsset("xendra", "/assets/gauntlet/rumin-card.webp")).toBe("");
  expect(getFactionAsset("xendra", "/assets/gauntlet/releases/9ca19b20fc4aeefc11241734a5c6142cc6f3b2edd10cefc06708d6ce08903dc4.webp")).toBe("");
  expect(getFactionArtwork("voltari", "/assets/gauntlet/constructed/bizi/bizi-voltaric-ultimatum.webp")).toBe("");
  expect(getFactionArtwork("voltari", "/assets/gauntlet/releases/f189ddef7733a9dcaf07601714a2b94c52d38f726a57db3b67e6108d1f3ae1a8.webp")).toBe("");
  expect(getFactionArtwork("gracus")).toBe("/assets/gauntlet/gracus-emblem.svg");
  expect(getFactionAsset("rumin", "/assets/gauntlet/meerus-gauntlet-2.webp")).toBe("/assets/gauntlet/meerus-gauntlet-2.webp");
  expect(getFactionAsset("frumo", "/assets/gauntlet/ristus.webp")).toBe("/assets/gauntlet/ristus.webp");
});

test("a faction with no own artwork renders a neutral identity instead of another faction", () => {
  const { container } = render(<FactionArtwork factionId="xendra" art="/assets/gauntlet/bizi-card.webp" />);
  expect(container.firstChild).toHaveClass("is-neutral");
  expect(container.firstChild.style.backgroundImage).toBe("");
});
