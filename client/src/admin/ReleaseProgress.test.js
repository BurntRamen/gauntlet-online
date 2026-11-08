import { releaseProgress } from "./ReleaseProgress";

const state = { guide: require("../../../server/adminAuthoringGuide"), revision: 4, writable: true, activeReleaseId: "old-live", draft: { hash: "candidate" }, publication: { deployment: "active-on-this-server", activeReleaseId: "old-live" } };
const receipt = { revision: 4, hash: "candidate", readiness: { saved: true, validated: true, previewed: true, engineTestRequired: true, engineTested: true, ready: true } };

test("a changed revision or hash never presents earlier evidence as current", () => {
  for (const stale of [{ ...receipt, revision: 3 }, { ...receipt, hash: "earlier" }]) {
    expect(releaseProgress(state, stale).ready).toBe(false);
    expect(releaseProgress(state, stale).current).toBe(false);
  }
  expect(releaseProgress(state, receipt).ready).toBe(true);
});

test("an active older release is not proof that the candidate is live", () => {
  expect(releaseProgress(state, receipt).steps.at(-1)).toEqual(["Deployment / live", "Unverified"]);
  expect(releaseProgress({ ...state, draft: null }, null).steps.at(-1)).toEqual(["Deployment / live", "Active on this server"]);
});

test("unsaved edits, a pending publication, or unavailable storage withhold publishing", () => {
  expect(releaseProgress(state, receipt, true).ready).toBe(false);
  expect(releaseProgress({ ...state, pending: { phase: "checks-failed" } }, receipt).reason).toContain("recorded outcome");
  expect(releaseProgress({ ...state, writable: false }, receipt).ready).toBe(false);
});

test("mechanical evidence is required independently of a saved presentation preview", () => {
  const result = releaseProgress(state, { ...receipt, readiness: { ...receipt.readiness, engineTested: false, ready: false } });
  expect(result.reason).toContain("accepted engine action");
  expect(result.steps[2][1]).toBe("Required");
});
