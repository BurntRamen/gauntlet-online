import fs from "fs";
import path from "path";
import { render } from "@testing-library/react";
import { FactionArtwork } from "./GauntletVisuals";

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
