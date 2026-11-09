import { act, render } from "@testing-library/react";
import { OperatorPreferences, useOperatorPreferences } from "./OperatorPreferences";

let operator;
function Harness() { operator = useOperatorPreferences(); return null; }
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

test("active tasks survive preference reset and reload but never transfer to another operator or environment", () => {
  const scope = "simply@local";
  const first = render(<OperatorPreferences scope={scope}><Harness /></OperatorPreferences>);
  act(() => operator.update({ task: { id: "set", root: "private-set" }, density: "compact" }));
  act(() => operator.reset());
  expect(operator.preferences.density).toBe("comfortable");
  expect(operator.preferences.task).toEqual({ id: "set", root: "private-set" });
  first.unmount();
  const resumed = render(<OperatorPreferences scope={scope}><Harness /></OperatorPreferences>);
  expect(operator.preferences.task.root).toBe("private-set");
  resumed.unmount();
  render(<OperatorPreferences scope="Burnt Ramen@other-environment"><Harness /></OperatorPreferences>);
  expect(operator.preferences.task).toBeNull();
  expect(localStorage.getItem(`gauntlet-admin:${scope}`)).toBeNull();
});
