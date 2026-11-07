import { fireEvent, render, screen } from "@testing-library/react";
import DeckWorkshop from "./DeckWorkshop";
import { HelpProvider } from "./AuthoringHelp";
const wrapper = ({ children }) => <HelpProvider value={require("../../../server/adminAuthoringGuide").help}>{children}</HelpProvider>;
jest.mock("./PrivateAsset", () => ({ PrivateCard: ({ card }) => <p>{card.name} face</p> }));
const row = { id: "deck", name: "Rumin recipe", status: "active", composition: { factionId: "rumin", cards: [{ cardId: "spear", printingId: "first" }] } };
const state = { writable: true, draft: { hash: "saved" , snapshot: { domains: { decks: [row], factions: [{ id: "rumin", name: "Rumin" }], cards: [{ id: "spear", name: "Coin Spear" }], assets: [{ id: "first", name: "First printing" }] } } }, live: { domains: { decks: [row] } }, previewContent: { cards: [{ id: "spear", name: "Coin Spear" }], collectorVariants: [{ variantId: "first", presentation: {} }] }, validation: { errors: [], warnings: [] } };
function Field({ field }) { return <label>{field}<input defaultValue={field === "name" ? "Rumin recipe" : "Saved composition"} /></label>; }
test("deck sections keep editor inputs mounted and distinguish saved preview from private notes", () => {
  const notes = jest.fn();
  render(<DeckWorkshop row={row} state={state} fields={[<Field key="name" field="name" />, <Field key="composition" field="composition" />]} notes="" onNotes={notes} unsaved />, { wrapper });
  expect(screen.getByText("Rumin", { exact: true })).toBeVisible();
  fireEvent.change(screen.getByLabelText("name"), { target: { value: "Local recipe name" } });
  fireEvent.click(screen.getByRole("button", { name: "Composition", exact: true }));
  expect(screen.getByLabelText("composition")).toBeVisible();
  expect(screen.getByLabelText("name")).not.toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Details", exact: true }));
  expect(screen.getByLabelText("name")).toHaveValue("Local recipe name");
  expect(screen.getByText("Saved draft · selected printings")).toBeInTheDocument();
  expect(screen.getByText(/Save changes to include your local edits/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save private notes" })).toBeDisabled();
  expect(screen.getByText(/These notes are never included/)).toBeVisible();
});
