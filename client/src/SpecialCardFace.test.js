import { fireEvent, render, screen } from "@testing-library/react";
import SpecialCardFace from "./SpecialCardFace";

test("a failed face keeps that card's unique artwork and the full-art fallback", () => {
  const { container, rerender } = render(<SpecialCardFace card={{ id: "sheen-raincall-mender", name: "Raincall Mender", factionId: "sheen", value: 4, suit: "clubs" }} />);
  fireEvent.error(screen.getByRole("img"));
  expect(screen.getByRole("img")).toHaveAttribute("src", "/assets/gauntlet/constructed/sheen/sheen-raincall-mender.webp");
  expect(container.querySelectorAll(".special-card-corner")).toHaveLength(2);
  rerender(<SpecialCardFace card={{ id: "sheen-raincall-mender", name: "Raincall Mender", factionId: "sheen", value: 4, suit: "hearts" }} />);
  expect(screen.getByRole("img")).toHaveAttribute("src", "/assets/gauntlet/constructed/faces/sheen-raincall-mender-hearts.webp?v=2");
});

test("missing and broken collector images retain faction artwork and playing-card corners", () => {
  const card = { name: "Forest guard", factionId: "sheen", value: 12, suit: "hearts" };
  const { container, rerender } = render(<SpecialCardFace card={card} art="/missing.webp" />);
  fireEvent.error(screen.getByRole("img"));
  expect(screen.getByRole("img")).toHaveAttribute("src", "/assets/gauntlet/sheen-card.webp");
  expect(container.querySelectorAll(".special-card-corner")).toHaveLength(2);
  expect(container.querySelector(".special-card-face")).toHaveClass("is-red");
  expect(screen.getAllByText("Q")).toHaveLength(2);
  rerender(<SpecialCardFace card={{ ...card, factionId: "frumo" }} />);
  expect(screen.getByRole("img")).toHaveAttribute("src", "/assets/gauntlet/frumo-card.webp");
});

test("registered cards show the full-art face for their fixed replacement suit", () => {
  const { rerender } = render(<SpecialCardFace card={{ id: "rumin-gilded-scale-legionary", name: "Gilded Scale Legionary", value: 3, suit: "hearts" }} />);
  expect(screen.getByRole("img")).toHaveAttribute("src", "/assets/gauntlet/constructed/faces/rumin-gilded-scale-legionary-hearts.webp?v=2");
  rerender(<SpecialCardFace card={{ id: "rumin-gilded-scale-legionary", name: "Gilded Scale Legionary", value: 3, suit: "clubs" }} />);
  expect(screen.getByRole("img")).toHaveAttribute("src", "/assets/gauntlet/constructed/faces/rumin-gilded-scale-legionary-clubs.webp?v=2");
});

test("paid foil presentations receive the animated collector layers", () => {
  const { container } = render(<SpecialCardFace
    card={{ id: "indela-student-of-flame", name: "Student of Flame", factionId: "indela", value: 2, suit: "hearts" }}
    presentation={{ paid: true, finish: "foil", animated: true, animationStyle: "elemental-omen" }}
  />);
  expect(container.querySelector(".special-card-presentation")).toHaveClass("is-animated-collector");
  expect(container.querySelector(".special-card-presentation")).toHaveAttribute("data-collector-style", "elemental-omen");
  expect(container.querySelector(".collector-card-sheen")).toBeInTheDocument();
});

test("an explicit standard choice overrides an equipped foil and restores it when removed", () => {
  const card = { name: "Guard", value: 3, suit: "spades", collector: { finish: "foil", animationStyle: "gilded-march" } };
  const { container, rerender } = render(<SpecialCardFace card={card} />);
  expect(container.querySelector(".collector-card-sheen")).toBeInTheDocument();
  rerender(<SpecialCardFace card={card} presentation={{ finish: "standard" }} />);
  expect(container.querySelector(".collector-card-sheen")).toBeNull();
  rerender(<SpecialCardFace card={card} />);
  expect(container.querySelector("[data-collector-style]")).toHaveAttribute("data-collector-style", "gilded-march");
});
