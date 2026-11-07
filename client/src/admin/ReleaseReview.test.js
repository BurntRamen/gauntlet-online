import { fireEvent, render, screen } from "@testing-library/react";
import ReleaseReview from "./ReleaseReview";

const state = { writable: true, draft: { hash: "draft-hash" } };
const review = { readiness: { saved: true, validated: true, previewed: true, engineTestRequired: true, engineTested: true, ready: true }, groups: [{ id: "mechanics", label: "Mechanics", changes: [{ domain: "encounters", id: "first", label: "First battle", field: "setup", fieldLabel: "Boss life", before: 40, after: 44 }] }] };

test("review shows grouped human differences and cannot publish unsaved local values", () => {
  const publish = jest.fn(), inspect = jest.fn();
  const props = { state, review, releaseName: "Better encounter", onPublish: publish, onInspect: inspect };
  const { rerender } = render(<ReleaseReview {...props} unsaved />);
  expect(screen.getByText("40")).toBeVisible(); expect(screen.getByText("44")).toBeVisible();
  expect(screen.getByRole("button", { name: "Publish release" })).toBeDisabled();
  rerender(<ReleaseReview {...props} unsaved={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Open First battle" }));
  expect(inspect).toHaveBeenCalledWith("encounters", "first", "setup");
  fireEvent.click(screen.getByRole("button", { name: "Publish release" }));
  expect(publish).toHaveBeenCalledTimes(1);
});

test("missing or invalidated receipt keeps publishing disabled", () => {
  render(<ReleaseReview state={state} review={{ ...review, readiness: { ...review.readiness, engineTested: false, ready: false } }} releaseName="Release" />);
  expect(screen.getByText("○ Accepted engine action recorded")).toBeVisible();
  expect(screen.getByRole("button", { name: "Publish release" })).toBeDisabled();
});

test("review opens definition changes using their complete domain and field target", () => {
  const inspect = jest.fn();
  render(<ReleaseReview state={state} review={{ ...review, groups: [{ id: "economy", label: "Economy", changes: [{ domain: "para:products", id: "offer-one", label: "Season entry", field: "displayName", before: "Old entry", after: "Season entry" }] }] }} onInspect={inspect} />);
  fireEvent.click(screen.getByRole("button", { name: "Open Season entry" }));
  expect(inspect).toHaveBeenCalledWith("para:products", "offer-one", "displayName");
});

test("asset comparisons use immutable resolved paths while keeping readable filenames", () => {
  const images = { ...review, groups: [{ id: "presentation", label: "Presentation", changes: [{ domain: "assets", id: "spear", field: "art", fieldLabel: "Artwork", before: "before.webp", after: "after.webp", liveAsset: { path: "/immutable/before.webp", mediaType: "image/webp" }, draftAsset: { path: "/immutable/after.webp", mediaType: "image/webp" } }] }] };
  render(<ReleaseReview state={state} review={images} />);
  expect(screen.getByAltText("Live artwork")).toHaveAttribute("src", "/immutable/before.webp");
  expect(screen.getByAltText("Saved draft artwork")).toHaveAttribute("src", "/immutable/after.webp");
  expect(screen.getByText("before.webp")).toBeVisible();
});


test("validation issues lead to the exact record field and activation is never inferred from readiness", () => {
  const inspect = jest.fn(), validate = jest.fn(), preview = jest.fn();
  const invalid = { ...state, activeReleaseId: "live", validation: { errors: [{ domain: "decks", id: "deck-one", field: "composition", message: "Choose valid printings" }], warnings: [] } };
  const { rerender } = render(<ReleaseReview state={invalid} review={{ ...review, readiness: { ...review.readiness, validated: false, previewed: false, ready: false } }} onInspect={inspect} onValidate={validate} onPreview={preview} />);
  fireEvent.click(screen.getByRole("button", { name: "Fix composition" }));
  expect(inspect).toHaveBeenCalledWith("decks", "deck-one", "composition");
  expect(screen.getByRole("button", { name: "Preview saved draft" })).toBeDisabled();
  expect(screen.queryByText("Published release verified active on this server")).not.toBeInTheDocument();
  rerender(<ReleaseReview state={{ ...invalid, draft: null }} review={{ ...review, groups: [] }} />);
  expect(screen.getByRole("status")).toHaveTextContent("Active status unavailable");
  rerender(<ReleaseReview state={{ ...invalid, draft: null, publication: { activeReleaseId: "live", deployment: "active-on-this-server" } }} review={{ ...review, groups: [] }} />);
  expect(screen.getByRole("status")).toHaveTextContent("Published release verified active on this server");
});
