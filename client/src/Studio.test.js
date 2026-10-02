import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Studio from "./Studio";

jest.mock("./GauntletAdmin", () => function AdminProbe({ request, onClose }) {
  return <section><h3>Gauntlet Admin</h3><button onClick={() => request("/api/admin/catalog").catch(() => {})}>Read protected data</button><button onClick={onClose}>Close admin</button></section>;
});
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
const response = (body, status = 200) => ({ ok: status === 200, status, json: async () => body });

test("uses the existing account session only after server-side allowlist verification", async () => {
  global.fetch = jest.fn(async (url) => response(url.endsWith("/access") ? { authorized: true } : {}));
  const onAuthorizedChange = jest.fn();
  render(<Studio serverUrl="http://localhost:4000" authToken="account-session" onAuthorizedChange={onAuthorizedChange} />);
  expect(await screen.findByRole("heading", { name: "Gauntlet Admin" })).toBeVisible();
  expect(global.fetch).toHaveBeenNthCalledWith(1, "http://localhost:4000/api/admin/access", { headers: { Authorization: "Bearer account-session" } });
  fireEvent.click(screen.getByText("Read protected data"));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("http://localhost:4000/api/admin/catalog", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer account-session" }) })));
  expect(onAuthorizedChange).toHaveBeenCalledWith(true);
  expect(document.body.textContent).not.toContain("account-session");
  expect(screen.queryByLabelText("Owner token")).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Close admin"));
  expect(screen.queryByRole("heading", { name: "Gauntlet Admin" })).not.toBeInTheDocument();
});

test("unauthenticated users use the existing sign-in flow and never request protected data", () => {
  global.fetch = jest.fn();
  const onSignIn = jest.fn();
  render(<Studio serverUrl="http://localhost:4000" onSignIn={onSignIn} />);
  fireEvent.click(screen.getByText("Sign in through Identity"));
  expect(onSignIn).toHaveBeenCalledTimes(1);
  expect(global.fetch).not.toHaveBeenCalled();
});

test("denies other signed-in accounts before loading any admin adapters", async () => {
  global.fetch = jest.fn(async () => response({ error: "Gauntlet Admin is private." }, 403));
  render(<Studio serverUrl="http://localhost:4000" authToken="other-account" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Gauntlet Admin is private.");
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("heading", { name: "Gauntlet Admin" })).not.toBeInTheDocument();
});

test("clears the shell on authorization failure and immediately on account logout", async () => {
  global.fetch = jest.fn(async (url) => url.endsWith("/catalog") ? response({ error: "Session expired." }, 401) : response({ authorized: true }));
  const { rerender } = render(<Studio serverUrl="http://localhost:4000" authToken="allowed" />);
  await screen.findByRole("heading", { name: "Gauntlet Admin" });
  fireEvent.click(screen.getByText("Read protected data"));
  await waitFor(() => expect(screen.queryByRole("heading", { name: "Gauntlet Admin" })).not.toBeInTheDocument());
  fireEvent.click(screen.getByText("Check admin access"));
  await screen.findByRole("heading", { name: "Gauntlet Admin" });
  rerender(<Studio serverUrl="http://localhost:4000" authToken="" />);
  expect(screen.queryByRole("heading", { name: "Gauntlet Admin" })).not.toBeInTheDocument();
});

test("an old account's delayed access response cannot reopen admin after logout", async () => {
  let resolveAccess;
  global.fetch = jest.fn(() => new Promise((resolve) => { resolveAccess = resolve; }));
  const { rerender } = render(<Studio serverUrl="http://localhost:4000" authToken="old-account" />);
  rerender(<Studio serverUrl="http://localhost:4000" authToken="" />);
  resolveAccess(response({ authorized: true }));
  await waitFor(() => expect(screen.getByText("Sign in through Identity")).toBeVisible());
  expect(screen.queryByRole("heading", { name: "Gauntlet Admin" })).not.toBeInTheDocument();
});
