import { HelpProvider } from "./admin/AuthoringHelp";
const help = require("../../server/adminAuthoringGuide").help;
const render = element => renderWithoutHelp(element, { wrapper: ({ children }) => <HelpProvider value={help}>{children}</HelpProvider> });
import {useState} from "react";
import { fireEvent, render as renderWithoutHelp, screen, within } from "@testing-library/react";
import EncounterWorkshop, { EncounterSetupFields } from "./EncounterWorkshop";

const setup = { version: 1, bossLife: 40, attacksPerTurn: 2, minAttackValue: 3, maxAttackValue: 8, chapterNumber: 2, bossAbility: { id: "first-strike", title: "First strike", text: "Attack bonus", name: "Vanguard", tier: 1 }, playerAdditions: ["spear"], bossAdditions: [], attackTiming: "clear-priority", winRoute: "first-uncompleted", lossRoute: "retry" };
const cards = [{ id: "spear", name: "Spear", factionId: "rumin", text: "Spear rules" }, { id: "shield", name: "Shield", factionId: "rumin", text: "Shield rules" }, { id: "foreign", name: "Foreign card", factionId: "sheen" }];
const row = { id: "chapter-one", campaignId: "rumin", factionId: "rumin", opponentId: "opponent-one", deckId: "chapter-one:decks", title: "The first battle", setup, image: "scene", dialogueAudio: [null, "", "voice"], endDialogueAudio: [] };
const definition = { type: "object", label: "Encounter mechanics", rules: { bossLife: { min: 1, max: 100 }, attacksPerTurn: { min: 1, max: 6 }, minAttackValue: { min: 1, max: 14 }, maxAttackValue: { min: 1, max: 14 }, chapterNumber: { min: 1, max: 64 }, tier: { min: 1, max: 3 } }, abilityIds: ["first-strike", "odd-pressure"], abilityLabels: { "first-strike": "First strike", "odd-pressure": "Odd pressure" } };
const state = { revision: 3, activeReleaseId: "release-live", guide: {}, validation: { valid: true, errors: [], warnings: [] }, assetLibrary: [{ id: "scene", path: "/immutable/scene.webp" }, { id: "portrait", path: "/immutable/commander.webp" }, { id: "voice", path: "/immutable/voice.ogg" }], live: { domains: { campaigns: [{ id: "rumin", commanderName: "Rumin campaign", encounterIds: ["chapter-one"] }], characters: [{ id: "opponent-one", name: "Opponent source" }, { id: "rumin:commander", factionId: "rumin", role: "commander", name: "Commander source", image: "portrait" }], factions: [{ id: "rumin", name: "Rumin" }], cards } } };
const renderField = (name, overrides) => name === "setup" ? <form key={name} aria-label="Saved setup contract">{overrides.renderContract({ value: setup, definition, row, cards, onChange: () => {}, onInspect: () => {} })}<button>Save setup</button></form> : <div key={name}>{name} field</div>;
const field = jest.fn();
function View(props) { const [section,onSection]=useState(props.section || "story"); return <EncounterWorkshop section={section} onSection={onSection} row={row} state={state} field={field} search={<input aria-label="Search encounters" />} list={<button data-object={row.id} aria-current="true">First battle</button>} onInspect={() => {}} {...props} />; }

beforeEach(() => {
  field.mockImplementation(renderField);
  jest.spyOn(window, "scrollTo").mockImplementation(() => {});
  jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => { callback(0); return 1; });
  jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test("story, setup, mechanics and card sections keep one saved setup contract", () => {
  render(<View />);
  expect(screen.getByRole("heading", { name: "Identity / Story" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Opponent", exact: true }));
  expect(screen.getByRole("region", { name: "Opponent setup controls" })).toBeVisible();
  expect(screen.queryByRole("region", { name: "Encounter mechanics controls" })).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Encounter card additions controls" })).not.toBeInTheDocument();
  expect(screen.getByText("Presentation / Assets", { selector: "h4" })).not.toBeVisible();
  expect(screen.getAllByRole("form", { name: "Saved setup contract", hidden: true })).toHaveLength(1);
  expect(screen.getAllByRole("form")).toHaveLength(1);

  expect(screen.getByLabelText("Boss Life")).toHaveAttribute("min", "1");
  expect(screen.getByLabelText("Boss Life")).toHaveAttribute("max", "100");
  fireEvent.click(screen.getByRole("button", {name:"Rules",exact:true}));
  expect(screen.getByLabelText("Attack progression offset")).toHaveValue(2);
  fireEvent.click(screen.getByRole("button", {name:"Cards",exact:true}));
  expect(screen.getByLabelText("Player Additions card 1")).not.toHaveTextContent("Foreign card");
});

test("grouped setup edits preserve every other contract field and cross-link the supported rule", () => {
  const change = jest.fn(), inspect = jest.fn();
  render(<EncounterSetupFields value={setup} definition={definition} row={row} cards={cards} onChange={change} onInspect={inspect} />);
  fireEvent.change(screen.getByLabelText("Boss Life"), { target: { value: "44" } });
  expect(change).toHaveBeenLastCalledWith({ ...setup, bossLife: 44 });
  fireEvent.change(screen.getByLabelText("Boss Ability Id"), { target: { value: "odd-pressure" } });
  expect(change).toHaveBeenLastCalledWith({ ...setup, bossAbility: { ...setup.bossAbility, id: "odd-pressure" } });
  fireEvent.click(within(screen.getByRole("region", { name: "Encounter card additions controls" })).getAllByRole("button", { name: "Add card" })[1]);
  expect(change).toHaveBeenLastCalledWith({ ...setup, bossAdditions: ["spear"] });
  fireEvent.click(screen.getByText("Inspect this encounter rule"));
  expect(inspect).toHaveBeenCalledWith("encounter-mechanics", "first-strike");
});

test("opponent and portrait links follow their actual source and sparse audio keeps line numbering", () => {
  const inspect = jest.fn(); render(<View onInspect={inspect} />);
  fireEvent.click(screen.getByRole("button", { name: "Opponent", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Opponent source" }));
  expect(inspect).toHaveBeenLastCalledWith("characters", "opponent-one");
  fireEvent.click(screen.getByRole("button", { name: "Media", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Open Commander source portrait definition" }));
  expect(inspect).toHaveBeenLastCalledWith("characters", "rumin:commander");
  expect(screen.getByAltText("Commander source")).toHaveAttribute("src", "/immutable/commander.webp");
  expect(screen.getByText("Opening voice 3")).toBeVisible();
  expect(screen.getAllByLabelText("Opening voice 3")).toHaveLength(1);
  expect(screen.getByLabelText("Opening voice 3")).toHaveAttribute("preload", "none");
});

test("the shared navigation callback controls encounter sections", () => {
  const change=jest.fn();render(<View section="mechanics" onSection={change} />);
  expect(screen.getByLabelText("Encounter Workshop section")).toHaveValue("mechanics");
  fireEvent.change(screen.getByLabelText("Encounter Workshop section"),{target:{value:"deck"}});
  expect(change).toHaveBeenCalledWith("deck");
});

test("mobile list view preserves selection without a departure guard and unrelated validation stays separate", () => {
  const guard = jest.fn();
  const data = { ...state, validation: { valid: false, errors: [{ domain: "cards", id: "spear", field: "text", message: "Card text needed" }], warnings: [] } };
  const { rerender } = render(<View state={data} onSelectList={guard} />);
  fireEvent.click(screen.getByText("Back to list"));
  expect(guard).not.toHaveBeenCalled();
  expect(screen.getByRole("region", { name: "Encounter Workshop" })).not.toHaveClass("has-selection");
  fireEvent.click(screen.getByRole("button", { name: "First battle", exact: true }));
  fireEvent.click(screen.getByText("Validation · 0 errors", {selector:"summary"}));
  expect(screen.getByText(/No errors for this encounter/)).toBeVisible();
  expect(screen.getByText("1 validation issue elsewhere in the shared draft")).toBeVisible();
  rerender(<View state={data} onSelectList={(continueNavigation) => continueNavigation()} />);
  fireEvent.click(screen.getByText("Back to list"));
  expect(screen.getByRole("region", { name: "Encounter Workshop" })).not.toHaveClass("has-selection");
});
