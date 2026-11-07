import { fireEvent, render, screen, within } from "@testing-library/react";
import FactionBoardCards from "./FactionBoardCards";
import { factionAbilityRole, factionBoardAnchors, factionBoardCards } from "./factionBoard";
import { BOARD_LAYOUT_PROFILES, boardModuleDescriptors } from "./boardStage";

const faction = {
  id: "frumo",
  commander: { name: "Polea", image: "/polea.webp", text: "Choose one of four orders." },
  city: { name: "Ristus", text: "Your first consecutive play gets +2." },
  general: { name: "Lafayette", text: "Swap a lane card and a hand card." }
};
const abilities = [
  { id: "polea-place", label: "Place a hand card", available: true },
  { id: "polea-peek", label: "Inspect a lane", available: false, reason: "There are no lane cards." },
  { id: "lafayette-swap", label: "Swap hand and lane", available: false, reason: "No lane card to swap." },
  { id: "constructed:last-gamble:attack", label: "The Last Gamble", available: true }
];
const viewModel = { phase: "priority", interactions: { abilities }, perspective: { player: 1 } };
let width, height;
beforeAll(() => {
  width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
  height = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 1800 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 700 });
});
afterAll(() => {
  if (width) Object.defineProperty(HTMLElement.prototype, "clientWidth", width);
  else delete HTMLElement.prototype.clientWidth;
  if (height) Object.defineProperty(HTMLElement.prototype, "clientHeight", height);
  else delete HTMLElement.prototype.clientHeight;
});

test("only ready source cards glow and only legal choices submit their existing ability ID", () => {
  const activateAbility = jest.fn();
  const onFactionCardClick = jest.fn();
  render(<FactionBoardCards faction={faction} viewModel={viewModel}
    layoutProfile="desktop" commands={{ activateAbility }} onFactionCardClick={onFactionCardClick} />);
  const commander = screen.getByRole("button", { name: "commander: Polea · Ready" });
  expect(commander).toHaveClass("is-ready");
  expect(screen.getByRole("button", { name: "general: Lafayette · Unavailable" })).not.toHaveClass("is-ready");
  fireEvent.click(commander);
  expect(onFactionCardClick).toHaveBeenCalledWith("commander", expect.objectContaining({ name: "Polea" }));
  const dialog = screen.getByRole("dialog", { name: "Polea abilities" });
  expect(within(dialog).getByRole("button", { name: /Inspect a lane/ })).toBeDisabled();
  expect(within(dialog).queryByText("The Last Gamble")).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "Place a hand card" }));
  expect(activateAbility).toHaveBeenCalledWith("polea-place");
  fireEvent.click(screen.getByRole("button", { name: "general: Lafayette · Unavailable" }));
  expect(onFactionCardClick).toHaveBeenCalledWith("general", expect.objectContaining({ name: "Lafayette" }));
  fireEvent.keyDown(document, { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "city: Ristus · Passive" }));
  expect(onFactionCardClick).toHaveBeenCalledWith("city", expect.objectContaining({ name: "Ristus" }));
  expect(screen.getByRole("dialog", { name: "Ristus abilities" })).toBeInTheDocument();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "city: Ristus · Passive" })).toHaveFocus();
});

test("passive cards explain automatic effects and Escape returns focus", () => {
  render(<FactionBoardCards faction={faction} viewModel={viewModel} layoutProfile="desktop" commands={{}} />);
  const city = screen.getByRole("button", { name: "city: Ristus · Passive" });
  fireEvent.click(city);
  expect(screen.getByRole("dialog")).toHaveTextContent("applies automatically");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(city).toHaveFocus();
});

test.each(["locked", "spectator"])("an already-open choice cannot activate while %s", (state) => {
  const activateAbility = jest.fn();
  const props = { faction, viewModel, layoutProfile: "desktop", commands: { activateAbility } };
  const rendered = render(<FactionBoardCards {...props} />);
  fireEvent.click(screen.getByRole("button", { name: /commander: Polea/ }));
  rendered.rerender(<FactionBoardCards {...props} locked={state === "locked"}
    viewModel={{ ...viewModel, perspective: { spectator: state === "spectator" } }} />);
  const action = within(screen.getByRole("dialog")).getByRole("button", { name: /Place a hand card/ });
  expect(action).toBeDisabled();
  fireEvent.click(action);
  expect(activateAbility).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: /commander: Polea/ })).not.toHaveClass("is-ready");
});

test("special payment and legacy actions belong to their actual source roles", () => {
  expect(factionAbilityRole("meerus-free-attack")).toBe("general");
  expect(factionAbilityRole("hera-payment")).toBe("general");
  expect(factionAbilityRole("mekan:encore:card-1")).toBe("commander");
  expect(factionAbilityRole("mekan:invite:card-1")).toBe("city");
  expect(factionAbilityRole("mekan:monti:card-1")).toBe("general");
  expect(factionAbilityRole("jali:katana:card-1")).toBe("city");
  expect(factionAbilityRole("gracus:epicura:block")).toBe("commander");
  expect(factionAbilityRole("zynarth:hatch:0:soldier")).toBe("commander");
  expect(factionAbilityRole("zynarth:klar:0:1")).toBe("general");
  expect(factionAbilityRole("astral:deploy:2")).toBe("commander");
  expect(factionAbilityRole("astral:stage:card-1")).toBe("general");
  expect(factionAbilityRole("constructed:arm:card-1")).toBeNull();
  expect(factionBoardCards({ id: "basic" })).toEqual([]);
  expect(factionBoardCards({ id: "mekan", general: { id: "ahu", name: "Ahu" } })[0]).toMatchObject({ name: "Ahu", activated: true });
});

test("Zynarth and Astral Vanguard actions appear on the character who owns them", () => {
  const zynarth = factionBoardCards({
    id: "zynarth", commander: { name: "Zalara" }, city: { name: "Brood Nest" }, general: { name: "K'Lar" }
  }, [
    { id: "zynarth:hatch:0:worker", label: "Hatch", available: true },
    { id: "zynarth:klar", label: "Sacrifice", available: false }
  ]);
  expect(zynarth.find((card) => card.role === "commander")).toMatchObject({ activated: true, abilities: [{ id: "zynarth:hatch:0:worker" }] });
  expect(zynarth.find((card) => card.role === "general")).toMatchObject({ activated: true, abilities: [{ id: "zynarth:klar" }] });
  expect(zynarth.find((card) => card.role === "city")).toMatchObject({ activated: false, abilities: [] });

  const astral = factionBoardCards({
    id: "astral-vanguard", commander: { name: "Alden" }, city: { name: "Outpost" }, general: { name: "Myra" }
  }, [
    { id: "astral:deploy", label: "Deploy", available: false },
    { id: "astral:stage:card-1", label: "Stage", available: true }
  ]);
  expect(astral.find((card) => card.role === "commander")).toMatchObject({ activated: true, abilities: [{ id: "astral:deploy" }] });
  expect(astral.find((card) => card.role === "general")).toMatchObject({ activated: true, abilities: [{ id: "astral:stage:card-1" }] });
});

test.each(["desktop", "ultrawide"])("%s faction cards stay clear of all gameplay modules", (id) => {
  const profile = BOARD_LAYOUT_PROFILES[id];
  const modules = boardModuleDescriptors(profile).filter((module) => module.id !== "board-base");
  for (const anchor of factionBoardAnchors(profile)) {
    const bounds = { left: anchor.x - anchor.width / 2, right: anchor.x + anchor.width / 2,
      bottom: anchor.z - anchor.depth / 2, top: anchor.z + anchor.depth / 2 };
    for (const module of modules) {
      expect(bounds.left < module.bounds.right && bounds.right > module.bounds.left
        && bounds.bottom < module.bounds.top && bounds.top > module.bounds.bottom).toBe(false);
    }
  }
  expect(factionBoardAnchors(BOARD_LAYOUT_PROFILES.portrait)).toEqual([]);
});
