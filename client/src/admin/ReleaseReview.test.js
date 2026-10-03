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
  expect(inspect).toHaveBeenCalledWith("encounters", "first");
  fireEvent.click(screen.getByRole("button", { name: "Publish release" }));
  expect(publish).toHaveBeenCalledTimes(1);
});

test("missing or invalidated receipt keeps publishing disabled", () => {
  render(<ReleaseReview state={state} review={{ ...review, readiness: { ...review.readiness, engineTested: false, ready: false } }} releaseName="Release" />);
  expect(screen.getByText("○ Accepted engine action recorded")).toBeVisible();
  expect(screen.getByRole("button", { name: "Publish release" })).toBeDisabled();
});

test("asset comparisons use immutable resolved paths while keeping readable filenames", () => {
  const images = { ...review, groups: [{ id: "presentation", label: "Presentation", changes: [{ domain: "assets", id: "spear", field: "art", fieldLabel: "Artwork", before: "before.webp", after: "after.webp", liveAsset: { path: "/immutable/before.webp", mediaType: "image/webp" }, draftAsset: { path: "/immutable/after.webp", mediaType: "image/webp" } }] }] };
  render(<ReleaseReview state={state} review={images} />);
  expect(screen.getByAltText("Live artwork")).toHaveAttribute("src", "/immutable/before.webp");
  expect(screen.getByAltText("Saved draft artwork")).toHaveAttribute("src", "/immutable/after.webp");
  expect(screen.getByText("before.webp")).toBeVisible();
});
