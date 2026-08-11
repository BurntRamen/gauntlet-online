const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function resolvePublicPath(publicDirectory, assetPath) {
  return path.join(publicDirectory, String(assetPath || "").replace(/^\/+/, ""));
}

function evaluateMatchAssets(requirements, publicDirectory) {
  const evaluate = (entry) => ({
    ...entry,
    present: fs.existsSync(resolvePublicPath(publicDirectory, entry.path))
  });
  const integrated = (requirements.integrated || []).map(evaluate);
  const cutoverRequired = (requirements.cutoverRequired || []).map(evaluate);
  return {
    integrated,
    cutoverRequired,
    missingIntegrated: integrated.filter((entry) => !entry.present),
    missingCutover: cutoverRequired.filter((entry) => !entry.present)
  };
}

function evaluatePresentationKitAssets(kit, publicDirectory) {
  const entries = Object.entries(kit?.assets || {}).flatMap(([kind, assets]) => (
    Object.values(assets || {}).map((asset) => {
      const paths = [asset.path, ...Object.values(asset.paths || {})].filter(Boolean);
      const missingPaths = paths.filter((assetPath) => !fs.existsSync(resolvePublicPath(publicDirectory, assetPath)));
      const expectedChecksum = String(asset.checksum || "").replace(/^sha256:/i, "").toLowerCase() || null;
      const checksumFile = asset.path ? resolvePublicPath(publicDirectory, asset.path) : null;
      const actualChecksum = expectedChecksum && checksumFile && fs.existsSync(checksumFile)
        ? crypto.createHash("sha256").update(fs.readFileSync(checksumFile)).digest("hex")
        : null;
      const checksumValid = expectedChecksum ? actualChecksum === expectedChecksum : null;
      return {
        ...asset,
        kind,
        paths,
        missingPaths,
        expectedChecksum,
        actualChecksum,
        checksumValid,
        present: paths.length > 0 && missingPaths.length === 0,
        approved: asset.status === "approved",
        cutoverReady: !asset.requiredForCutover || (
          asset.status === "approved" && paths.length > 0 && missingPaths.length === 0 && checksumValid !== false
        )
      };
    })
  ));
  return {
    schemaVersion: kit?.schemaVersion || null,
    kitId: kit?.kitId || null,
    entries,
    missing: entries.filter((entry) => entry.paths.length > 0 && !entry.present),
    provisional: entries.filter((entry) => entry.status === "provisional"),
    candidate: entries.filter((entry) => entry.status === "candidate"),
    approved: entries.filter((entry) => entry.status === "approved"),
    integrityFailures: entries.filter((entry) => entry.checksumValid === false),
    cutoverBlockers: entries.filter((entry) => !entry.cutoverReady)
  };
}

function printGroup(label, entries) {
  console.log(`\n${label}`);
  const byKind = new Map();
  entries.forEach((entry) => {
    const values = byKind.get(entry.kind) || [];
    values.push(entry);
    byKind.set(entry.kind, values);
  });
  byKind.forEach((values, kind) => {
    const present = values.filter((entry) => entry.present).length;
    console.log(`  ${kind}: ${present}/${values.length} present`);
    values.filter((entry) => !entry.present).forEach((entry) => {
      console.log(`    missing ${entry.id}: ${entry.path}`);
    });
  });
}

function runCli() {
  const repositoryRoot = path.resolve(__dirname, "..");
  const requirements = JSON.parse(fs.readFileSync(
    path.join(repositoryRoot, "client/src/babylon/MATCH_ASSET_REQUIREMENTS.json"),
    "utf8"
  ));
  const result = evaluateMatchAssets(
    requirements,
    path.join(repositoryRoot, "client/public")
  );
  const presentationKit = JSON.parse(fs.readFileSync(
    path.join(repositoryRoot, "client/public/assets/gauntlet/match/kits/gauntlet-core-v1/kit.json"),
    "utf8"
  ));
  const kitResult = evaluatePresentationKitAssets(
    presentationKit,
    path.join(repositoryRoot, "client/public")
  );
  printGroup("Integrated assets", result.integrated);
  printGroup("Cutover-required production assets", result.cutoverRequired);
  console.log(`\nCutover assets remaining: ${result.missingCutover.length}`);
  console.log(`\nPresentation kit ${kitResult.kitId} (${kitResult.schemaVersion})`);
  console.log(`  entries: ${kitResult.entries.length}`);
  console.log(`  provisional: ${kitResult.provisional.length}`);
  console.log(`  candidate: ${kitResult.candidate.length}`);
  console.log(`  approved: ${kitResult.approved.length}`);
  console.log(`  missing authored files: ${kitResult.missing.length}`);
  console.log(`  checksum mismatches: ${kitResult.integrityFailures.length}`);
  kitResult.integrityFailures.forEach((entry) => {
    console.log(`    ${entry.kind}/${entry.id}: expected ${entry.expectedChecksum}; received ${entry.actualChecksum || "missing"}`);
  });
  console.log(`  production cutover blockers: ${kitResult.cutoverBlockers.length}`);
  kitResult.cutoverBlockers.forEach((entry) => {
    console.log(`    ${entry.kind}/${entry.id}: ${entry.status}${entry.missingPaths.length ? `; missing ${entry.missingPaths.join(", ")}` : ""}`);
  });
  if (process.argv.includes("--strict") && (
    result.missingCutover.length > 0
      || kitResult.cutoverBlockers.length > 0
      || kitResult.integrityFailures.length > 0
  )) {
    process.exitCode = 1;
  }
}

if (require.main === module) runCli();

module.exports = { evaluateMatchAssets, evaluatePresentationKitAssets, resolvePublicPath };
