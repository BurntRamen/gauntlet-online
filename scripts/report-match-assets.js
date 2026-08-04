const fs = require("node:fs");
const path = require("node:path");

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
  printGroup("Integrated assets", result.integrated);
  printGroup("Cutover-required production assets", result.cutoverRequired);
  console.log(`\nCutover assets remaining: ${result.missingCutover.length}`);
  if (process.argv.includes("--strict") && result.missingCutover.length > 0) {
    process.exitCode = 1;
  }
}

if (require.main === module) runCli();

module.exports = { evaluateMatchAssets, resolvePublicPath };
