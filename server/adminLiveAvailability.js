"use strict";

const { clone, hash, fieldsFor, validateAuthoredContent } = require("./authoredContent");

const authoringError = "Shared draft and publication history are unavailable. Live content and isolated live tests remain available. Refresh Admin to reconnect.";

async function deployedStatus(publication) {
  const release = await publication.deployedSnapshot();
  const live = clone(release.snapshot);
  const validation = validateAuthoredContent(live, live);
  if (release.id !== `gauntlet-content-${hash(live)}` || !validation.valid) {
    throw Object.assign(new Error("The deployed content snapshot is unavailable."), { status: 503 });
  }
  return { activeReleaseId: release.id, live, revision: null, draft: null, validation };
}

// Live references need no remote draft read. This accessor exists only for a
// provider that captures an immutable, validated release at deployment time.
async function readWorkshopStatus(publication, source = "live") {
  return source === "live" && publication.deployedSnapshot
    ? deployedStatus(publication)
    : publication.status();
}

async function readAuthoringStatus(publication) {
  try { return await publication.status(); }
  catch (failure) {
    if (!publication.deployedSnapshot) throw failure;
    const status = await deployedStatus(publication);
    return { ...status, liveOnly: true, writable: false, connectionRequired: false,
      sourceAvailability: { live: true, draft: false, history: false }, authoringError,
      storage: "Deployed content only. Shared drafts and publication history are unavailable.",
      guide: { ...require("./adminAuthoringGuide"),
        unavailable: authoringError,
        noDraft: "The shared draft cannot be read right now. Browse or test Live content, then refresh to reconnect.",
        validationPassed: "Deployed live content passed validation. Shared draft validation is unavailable." },
      encounterSummaries: require("./encounterAuthoring").summaries(status.live),
      assetLibrary: require("./contentAssets").assetManifest.entries,
      fields: Object.fromEntries(Object.entries(status.live.domains).map(([domain, rows]) => [domain,
        Object.fromEntries(rows.map(row => [row.id, fieldsFor(domain, row)]))])),
      changes: [], releases: [], activations: [] };
  }
}

module.exports = { readAuthoringStatus, readWorkshopStatus };
