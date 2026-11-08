import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import Studio from "./Studio";

const originalFetch = global.fetch;
const response = (body, status = 200) => ({ ok: status === 200, status, json: async () => body });
const home = { guide: require("../../server/adminHomeGuide.json"), seasons: [], events: [], purchases: [], modules: [], tasks: [], storefront: {}, players: {}, publication: {} };
const system = { guide: require("../../server/adminSystemGuide.json"), issues: [], versions: {}, storage: {}, sources: [], boundaries: [], validation: {} };
const overview = { generatedAt: "2026-11-08T00:00:00Z", accounts: { total: 2 }, system: {}, activePlay: {}, matches: {}, season: {}, collector: {} };
const select = name => fireEvent.click(within(screen.getByRole("navigation", { name: "Administration sections" })).getByRole("button", { name, exact: true }));
const overviewReads = () => global.fetch.mock.calls.filter(([url]) => url.endsWith("/overview"));

beforeEach(() => {
  window.history.replaceState({}, "", "/admin/gauntlet");
  jest.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); });

test("Home defers historical operations, which remain readable, refreshable and fresh on re-entry", async () => {
  global.fetch = jest.fn(async url => {
    if (url.endsWith("/access")) return response({ authorized: true, accountId: "operator" });
    if (url.endsWith("/home")) return response(home);
    if (url.endsWith("/system")) return response(system);
    if (url.endsWith("/overview")) return response(overview);
    throw new Error(`Unexpected read: ${url}`);
  });
  render(<Studio serverUrl="http://localhost:4000" authToken="test-session" />);
  await screen.findByRole("heading", { name: "Your production workspace" });
  expect(overviewReads()).toHaveLength(0);
  fireEvent.click(screen.getByText("Refresh admin"));
  await screen.findByRole("heading", { name: "Your production workspace" });
  expect(overviewReads()).toHaveLength(0);

  select("Operations");
  await screen.findByRole("heading", { name: "Gauntlet Studio" });
  expect(overviewReads()).toHaveLength(1);
  expect(screen.getByRole("heading", { name: "Match Archive" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Refresh operations" }));
  await waitFor(() => expect(overviewReads()).toHaveLength(2));
  await waitFor(() => expect(screen.getByRole("button", { name: "Refresh operations" })).toBeEnabled());

  select("Home");
  await screen.findByRole("heading", { name: "Your production workspace" });
  expect(overviewReads()).toHaveLength(2);
  select("Operations");
  await waitFor(() => expect(overviewReads()).toHaveLength(3));
  expect(overviewReads().every(([, options]) => options.headers.Authorization === "Bearer test-session")).toBe(true);
});

test("direct Operations entry loads its data, reports failure and retries on re-entry", async () => {
  window.history.replaceState({}, "", "/admin/gauntlet?area=Operations");
  let unavailable = true;
  global.fetch = jest.fn(async url => {
    if (url.endsWith("/access")) return response({ authorized: true, accountId: "operator" });
    if (url.endsWith("/home")) return response(home);
    if (url.endsWith("/system")) return response(system);
    if (url.endsWith("/overview")) return unavailable ? response({ error: "Fixture history unavailable" }, 503) : response(overview);
    throw new Error(`Unexpected read: ${url}`);
  });
  render(<Studio serverUrl="http://localhost:4000" authToken="test-session" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Fixture history unavailable");
  expect(overviewReads()).toHaveLength(1);
  expect(global.fetch.mock.calls.some(([url]) => url.endsWith("/home"))).toBe(false);
  unavailable = false;
  select("Home");
  await screen.findByRole("heading", { name: "Your production workspace" });
  select("Operations");
  await screen.findByRole("heading", { name: "Gauntlet Studio" });
  expect(overviewReads()).toHaveLength(2);
});
