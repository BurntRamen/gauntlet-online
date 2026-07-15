import { fireEvent, render, screen } from "@testing-library/react";
import DeckLibraryPanel from "./DeckLibraryPanel";

const library = {
  activeConstructedDeckId: "deck-1",
  activeDraftDeckIds: { player: "draft-1", bot: null },
  decks: [
    {
      id: "deck-1",
      name: "Gold Guard",
      factionId: "rumin",
      factionName: "Rumin",
      format: "constructed",
      archived: false,
      featured: true,
      versions: [{ id: "version-1" }, { id: "version-2" }],
      record: { wins: 3, losses: 1, draws: 0 }
    },
    {
      id: "draft-1",
      name: "Root Draft",
      factionId: "sheen",
      factionName: "Sheen",
      format: "draft",
      draftType: "player",
      archived: false,
      featured: false,
      versions: [{ id: "draft-version" }],
      record: { wins: 1, losses: 2, draws: 1 }
    },
    {
      id: "deck-archived",
      name: "Old Guard",
      factionId: "rumin",
      factionName: "Rumin",
      format: "constructed",
      archived: true,
      featured: false,
      versions: [{ id: "old-version" }],
      record: {}
    }
  ]
};

test("shows active deck identity and exposes library actions", () => {
  const onSelect = jest.fn();
  const onNew = jest.fn();
  const onAction = jest.fn();
  render(<DeckLibraryPanel library={library} selectedDeckId="deck-1" onSelect={onSelect} onNew={onNew} onAction={onAction} />);

  expect(screen.getByText("Gold Guard")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Gold Guard Rumin Constructed - v2 3W 1L 0D/ })).toBeInTheDocument();
  expect(screen.getAllByText("Active")).toHaveLength(2);
  expect(screen.queryByText("Old Guard")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Gold Guard/ }));
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "deck-1" }));

  fireEvent.click(screen.getAllByRole("button", { name: "Duplicate" })[0]);
  expect(onAction).toHaveBeenCalledWith("deck-1", "duplicate");

  fireEvent.click(screen.getByRole("button", { name: "New Constructed" }));
  expect(onNew).toHaveBeenCalled();

  fireEvent.click(screen.getByLabelText("Archived"));
  expect(screen.getByText("Old Guard")).toBeInTheDocument();
});
