import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import GauntletContractFields from "./GauntletContractFields";
const { cardEffectDefinitions, factionEffectDefinitions } = require("../../shared/duel-rules/effectRegistry");
const options = cardEffectDefinitions();
function Harness({ effect, row, definition = { options } }) {
  const [value, setValue] = useState(effect);
  return <GauntletContractFields value={value} onChange={setValue} row={row} definition={definition} cards={[]} />;
}
test.each(["coin-scale-spear", "rumie-vault-shield", "aurelian-clawblade"])("%s parameter input follows actual declared bounds and compatible effect defaults", id => {
  const effect = options.find(entry => entry.id === id);
  render(<Harness row={{ factionId: effect.factionId, type: effect.cardType }} effect={{ id, version: effect.version, parameters: { armBonus: effect.parameters.armBonus.default } }} />);
  const bonus = screen.getByRole("spinbutton", { name: "Parameters Arm Bonus" });
  expect(bonus).toHaveAttribute("min", "0"); expect(bonus).toHaveAttribute("max", "8");
  const compatible = options.filter(entry => entry.factionId === effect.factionId && entry.cardType === effect.cardType);
  expect(screen.getAllByRole("option")).toHaveLength(compatible.length);
  const plain = compatible.find(entry => !Object.keys(entry.parameters).length);
  if (plain) { fireEvent.change(screen.getByRole("combobox", { name: "Id" }), { target: { value: plain.id } }); expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument(); expect(screen.getByText("No configurable parameters.")).toBeVisible(); }
});
test("faction parameter bounds reach nested controls without exposing contract version", () => {
  const definitions = factionEffectDefinitions(), effect = definitions.rumin;
  render(<Harness row={{ id: "rumin" }} definition={{ options: definitions }} effect={{ id: effect.id, version: effect.version, parameters: { fourthAttackBonus: effect.parameters.fourthAttackBonus.default } }} />);
  expect(screen.getByRole("spinbutton")).toHaveAttribute("max", "8");
  expect(screen.getByText(/Contract version.*Read-only/)).toBeVisible();
});
