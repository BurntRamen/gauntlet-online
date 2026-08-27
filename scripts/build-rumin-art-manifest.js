const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const briefs = JSON.parse(fs.readFileSync(path.join(root, "docs/rumin-art-generation-briefs.json"), "utf8"));
const selection = JSON.parse(fs.readFileSync(path.join(root, "docs/rumin-art-source-selection.json"), "utf8"));
const production = JSON.parse(fs.readFileSync(path.join(root, "docs/rumin-art-production-report.json"), "utf8"));
const selectedById = Object.fromEntries(selection.map((item) => [item.assetId, item]));
const productionById = Object.fromEntries(production.map((item) => [item.assetId, item]));
const revisedAssets = new Set([
  "rumin-vault-shield-bearer",
  "rumin-counting-house-aegis",
  "rumin-triumphal-ram"
]);

const manifest = {
  schemaVersion: 1,
  runId: briefs.runId,
  generatedAt: "2026-08-27",
  status: "candidate-production-not-creative-os-approved",
  approvalNote: briefs.artifactApprovalStatus,
  authorityChain: briefs.authorityChain,
  relatedFactionControlsConsulted: briefs.relatedFactionControlsConsulted,
  conflictLedger: briefs.conflictLedger,
  variantPolicy: "Each gameplay card has one canonical illustration. Standard and collector-foil variants reference the same art path; finish remains presentation-only.",
  assetPolicy: {
    governingInput: "Verified written Creative OS authorities plus current repository implementation facts.",
    excludedAsGoverningReferences: ["ASSET-009 (Pending Review / Needs Truth)", "ASSET-023 (Not Canon)"],
    publicReleaseStatus: "Not approved or rights-cleared by Creative OS; human review remains required before external delivery."
  },
  assets: briefs.assets.map((brief) => {
    const selected = selectedById[brief.assetId];
    const built = productionById[brief.assetId];
    if (!selected || !built) throw new Error(`Missing production lineage for ${brief.assetId}`);
    return {
      assetId: brief.assetId,
      category: brief.category,
      contentId: brief.contentId,
      title: brief.title,
      styleLock: brief.styleLock === true,
      reviewStatus: revisedAssets.has(brief.assetId) ? "accepted-after-bounded-revision" : "accepted",
      visualSubject: brief.visualSubject,
      factionAuthority: brief.factionAuthority,
      culturalArchitecturalMaterialLanguage: brief.culturalArchitecturalMaterialLanguage,
      mustPreserve: brief.mustPreserve,
      mustAvoid: brief.mustAvoid,
      intendedReusableCropsSurfaces: brief.intendedReusableCropsSurfaces,
      sourceAuthorityIds: brief.sourceAuthorityIds,
      generatorOutput: selected.generatorOutput,
      productionPath: `/assets/gauntlet/${built.output}`,
      dimensions: built.dimensions,
      bytes: built.bytes,
      sha256: built.sha256
    };
  })
};

const output = path.join(root, "docs/gauntlet-art-manifest.json");
fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${manifest.assets.length} assets to ${path.relative(root, output)}`);
