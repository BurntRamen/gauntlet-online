import { HelpProvider } from "./AuthoringHelp";
const help = require("../../../server/adminHelpTopics.json");
const render = element => renderWithoutHelp(element, { wrapper: ({ children }) => <HelpProvider value={help}>{children}</HelpProvider> });
import { fireEvent, render as renderWithoutHelp, screen, within } from "@testing-library/react";
import PrintingWorkshop from "./PrintingWorkshop";
import AssetCapacity from "./AssetCapacity";
import CatalogControls from "./CatalogControls";
import { resolvePrinting, canUsePrinting } from "@gauntlet/duel-rules/printings";
jest.mock("./PrivateAsset", () => ({ PrivateCard: ({ card }) => <p data-testid="printing-face">{card.variantId} · {card.presentation.printingRevision}</p> }));
const card = { id: "card", name: "Example", defaultVariantId: "card:standard" };
const variants = [{ id: "card:standard", name: "Standard", gameplayCardId: "card", edition: "source" }, { id: "p2", name: "Alternate", gameplayCardId: "card", edition: "edition", collectorNumber: "002", origin: "admin-printing-v1" }, { id: "old", name: "Retired", edition: "edition", status: "archived" }];
const state = { writable: true, capabilities: { printingCreation: 1 }, printingEditions: [{ id: "edition", name: "Digital edition" }], live: { domains: { cards: [card], assets: variants, sets: [{ id: "edition", name: "Digital edition", status: "active" }] } }, previewContent: { manifest: { cards: [card], collectorVariants: variants.map(row => ({ ...row, variantId: row.id, presentation: { printingRevision: row.id + "-revision" } })) } } };
test("printing search, edition filter, archived discovery, guarded selection and actual comparison", () => {
  const select = jest.fn(), create = jest.fn(), field = jest.fn(key => <p key={key}>Field {key}</p>);
  const view = render(<PrintingWorkshop card={card} variants={variants} selected={variants[1]} state={state} field={field} onSelect={select} onCreate={create} />);
  const results = within(screen.getByRole("group", { name: "Printing results" }));
  expect(results.queryByText(/Retired/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Find printing"), { target: { value: "002" } }); expect(results.getAllByRole("button")).toHaveLength(1);
  fireEvent.click(results.getByRole("button")); expect(select).toHaveBeenCalledWith("p2");
  fireEvent.click(screen.getByRole("button", { name: "Duplicate selected printing" })); expect(create).toHaveBeenCalledWith("p2");
  expect(field.mock.calls.slice(0, 7).map(call => call[0])).toEqual(["name", "edition", "collectorNumber", "position", "finish", "status", "art"]);
  const details = screen.getByText("Compare with default printing").closest("details"); details.open = true; fireEvent(details, new Event("toggle"));
  expect(screen.getAllByTestId("printing-face")).toHaveLength(2);
  view.rerender(<PrintingWorkshop card={card} variants={variants} selected={variants[1]} state={state} field={field} onSelect={select} unsaved />);
  expect(results.getByRole("button")).toBeDisabled();
});
test("guided printing creation sends only the owner and presentation inputs", () => {
  const create = jest.fn(); render(<CatalogControls creation={{ domain: "assets", gameplayCardId: "card", sourceId: "p2" }} value={{ name: "Copy", collectorNumber: "003" }} state={state} onCreate={create} onEdit={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Save new printing to draft" }));
  expect(create).toHaveBeenCalledWith({ domain: "assets", gameplayCardId: "card", sourceId: "p2", name: "Copy", edition: "edition", collectorNumber: "003" });
});
test("asset capacity explains retained byte and version counts, remaining space and prerequisites", () => {
  render(<AssetCapacity provider="github" value={{ storedBytes: 1048576, remainingBytes: 5242880, versionCount: 3, remainingVersions: 497, uniqueBlobCount: 2, encodedBytes: 1400000, metadataBytes: 400, statePayloadBytes: 2000000 }} />);
  expect(screen.getByText(/1.00 \/ 6 MiB · 3 \/ 500/)).toBeInTheDocument();
  expect(screen.getByText(/5.00 MiB and 497 versions remaining/)).toBeInTheDocument();
  expect(screen.getByText(/private repository/)).toBeInTheDocument();
});
test("one resolver preserves deterministic legacy defaults, rejects mismatch and keeps entitlement distinct", () => {
  const rows = [{ variantId: "card:standard", gameplayCardId: "card" }, { variantId: "p2", gameplayCardId: "card", entitlementRequired: true }];
  expect(resolvePrinting("card", rows).variantId).toBe("card:standard");
  expect(resolvePrinting("other", rows, "p2")).toBeNull(); expect(resolvePrinting("card", rows, "unknown")).toBeNull();
  expect(canUsePrinting(rows[1], {})).toBe(false); expect(canUsePrinting(rows[1], { p2: 1 })).toBe(true);
});
