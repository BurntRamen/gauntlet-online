import { fireEvent, render, screen } from "@testing-library/react";
import { AccountPanel } from "./App";

const baseProps = {
  account: null,
  mode: "login",
  form: { name: "", password: "", email: "", token: "" },
  error: "",
  notice: "",
  onModeChange: jest.fn(),
  onFormChange: jest.fn(),
  onSubmit: jest.fn(),
  onSignOut: jest.fn(),
  onRecoveryEmail: jest.fn()
};

beforeEach(() => jest.clearAllMocks());

test("offers password recovery directly from sign in", () => {
  render(<AccountPanel {...baseProps} />);
  fireEvent.click(screen.getByRole("button", { name: "Forgot Password?" }));
  expect(baseProps.onModeChange).toHaveBeenCalledWith("forgot");
});

test("collects the recovery email and submits a reset-link request", () => {
  const props = { ...baseProps, mode: "forgot", form: { ...baseProps.form, email: "pilot@example.com" } };
  render(<AccountPanel {...props} />);
  expect(screen.getByRole("heading", { name: "Recover Account" })).toBeInTheDocument();
  fireEvent.submit(screen.getByRole("button", { name: "Email Recovery Link" }).closest("form"));
  expect(props.onSubmit).toHaveBeenCalledTimes(1);
});
