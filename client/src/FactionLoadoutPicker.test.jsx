import { fireEvent, render, screen } from "@testing-library/react";
import FactionLoadoutPicker from "./FactionLoadoutPicker";
const monti = { id: "monti", name: "Monti", text: "Grand Celebration" };
const hui = { id: "hui", name: "Hui", text: "Invite Everyone" };
const factions = [{ id: "rumin", name: "Rumin", general: { name: "Meerus" } }, { id: "mekan", name: "Mekan", general: monti, generals: [monti, hui], draftRules: true }];
test("choosing Mekan selects its default General and offers a single alternative selection", () => {
  const onChange = jest.fn();
  const { rerender } = render(<FactionLoadoutPicker factions={factions} factionId="rumin" onChange={onChange} />);
  fireEvent.change(screen.getByLabelText("Ranked faction"), { target: { value: "mekan" } });
  expect(onChange).toHaveBeenCalledWith("mekan", "monti");
  rerender(<FactionLoadoutPicker factions={factions} factionId="mekan" generalId="hui" onChange={onChange} />);
  expect(screen.getByLabelText("Deck General")).toHaveValue("hui");
  expect(screen.getByText("Invite Everyone")).toBeVisible();
  fireEvent.change(screen.getByLabelText("Deck General"), { target: { value: "monti" } });
  expect(onChange).toHaveBeenCalledWith("mekan", "monti");
  rerender(<FactionLoadoutPicker factions={factions} factionId="mekan" generalId="monti" disabled onChange={onChange} />);
  expect(screen.getByLabelText("Deck General")).toBeDisabled();
  expect(screen.getByLabelText("Ranked faction")).toBeDisabled();
});
