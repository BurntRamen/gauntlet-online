"use strict";

const { hash, clone, resolveEngineContent } = require("./authoredContent");
const { cardAuthoringDefinitions } = require("./adminCardAuthoring");
const { rulesAuthoringData } = require("./adminRulesAuthoring");
const { contentRelationships } = require("./adminContentRelationships");
const { releaseReview } = require("./adminReleaseReview");
const { readWorkshopStatus } = require("./adminLiveAvailability");
function fail(status, message) { throw Object.assign(new Error(message), { status }); }

function selectWorkshopSnapshot(status, { source = "live", hash: expectedHash } = {}) {
  if (!["live", "draft"].includes(source)) fail(400, "Choose Live or Saved draft.");
  const snapshot = source === "live" ? status.live : status.draft?.snapshot;
  if (!snapshot) fail(404, "There is no saved draft.");
  const contentHash = hash(snapshot);
  if (expectedHash != null && expectedHash !== contentHash) fail(409, "Content changed. Refresh this workshop before continuing.");
  return { source, hash: contentHash, releaseId: source === "live" ? status.activeReleaseId : `draft:${contentHash}`, revision: status.revision, snapshot };
}

function workshopMetadata(selection) {
  const { snapshot, ...identity } = selection;
  // Metadata must remain readable while the shared draft has validation errors.
  // Contract bindings are protected fields, so do not execute draft resolution.
  const bindings = { authoredRelease: identity.releaseId, ...Object.fromEntries([
    "rulesVersion", "cardEffectContractVersion", "factionEffectContractVersion", "encounterContractVersion", "assetManifestVersion", "gameConfigVersion"
  ].map(key => [key, snapshot.engine[key]])) };
  return { version: 1, ...identity, cardEffects: cardAuthoringDefinitions(), ...rulesAuthoringData(snapshot),
    bindings: clone(bindings), capabilities: { liveTests: true, customScenarios: 1, commandPreview: true, livePresentation: true, relationships: true, releaseReview: true } };
}

function registerAdminWorkshopRoutes(app, { publication }) {
  for (const [path, operation] of [
    ["", async req => workshopMetadata(selectWorkshopSnapshot(await readWorkshopStatus(publication, req.query?.source), req.query))],
    ["/relationships", async req => {
      const status = await readWorkshopStatus(publication, req.query?.source), selection = selectWorkshopSnapshot(status, req.query);
      return contentRelationships(selection.snapshot, { source: selection.source, liveSnapshot: status.live });
    }],
    ["/presentation", async req => {
      const status = await readWorkshopStatus(publication, req.query?.source), { snapshot, ...identity } = selectWorkshopSnapshot(status, req.query);
      if (identity.source === "draft" && !status.validation.valid) fail(422, "Correct the saved draft's validation errors before previewing it.");
      return { ...identity, resolved: resolveEngineContent(snapshot, identity.releaseId) };
    }],
    ["/review", async req => {
      const status = await publication.status();
      if (req.query?.hash != null) selectWorkshopSnapshot(status, { source: "draft", hash: req.query.hash });
      return releaseReview(status);
    }],
    ["/releases/:id/review", async req => {
      if (!/^gauntlet-content-[a-f0-9]{64}$/.test(req.params.id)) fail(400, "Invalid content release ID.");
      // status can advance between reads; comparison remains against the exact
      // status hash, and the mutation's expectedRevision is still authoritative.
      const status = await publication.status();
      if (req.query?.hash != null) selectWorkshopSnapshot(status, { source: "live", hash: req.query.hash });
      const release = await publication.releaseSnapshot(req.params.id);
      return releaseReview(status, release);
    }]
  ]) app.get(`/api/admin/workshops${path}`, async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    if (!req.gauntletAdminAccount?.id) return res.status(403).json({ error: "Admin access required." });
    try { res.json(await operation(req)); }
    catch (error) { res.status(error.status || 503).json({ error: error.status ? error.message : "Workshop information is unavailable. Refresh to retry." }); }
  });
}

module.exports = { selectWorkshopSnapshot, workshopMetadata, registerAdminWorkshopRoutes };
