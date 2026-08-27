const fs = require("node:fs");
const path = require("node:path");

const REPOSITORY_ROOT = path.resolve(__dirname, "..");
const DEFAULT_OUTPUT_ROOT = path.join(REPOSITORY_ROOT, "artifacts/babylon-visual-comparison");

const DEFAULT_MAPPINGS = Object.freeze([
  { id: "neutral", label: "Neutral / rest", states: ["neutral-rest"], viewports: ["desktop"] },
  { id: "player-priority", label: "Player priority", states: ["live-priority"], viewports: ["desktop"] },
  { id: "attack-available", label: "Attack available", states: ["attack-available"], viewports: ["desktop"] },
  { id: "attack-committed", label: "Attack committed", states: ["attack-transition-midpoint", "attack-settled"], viewports: ["desktop-motion", "desktop"] },
  { id: "legal-block", label: "Legal block", states: ["incoming-hand-attack"], viewports: ["desktop"] },
  { id: "block-committed", label: "Block committed", states: ["block-transition-midpoint"], viewports: ["desktop-motion"] },
  { id: "fully-blocked", label: "Fully blocked resolution", states: ["combat-resolution", "combat-final"], viewports: ["desktop-motion", "desktop"] },
  { id: "ordinary-damage", label: "Ordinary damage", states: ["lane-damage-resolution", "lane-damage-final"], viewports: ["desktop-motion", "desktop"] },
  { id: "major-damage", label: "Major damage", states: ["major-damage-resolution", "major-damage-final"], viewports: ["desktop-motion", "desktop"] },
  { id: "ability-activation", label: "Ability activation", states: ["ability-activation", "ability-activation-settled"], viewports: ["desktop-motion", "desktop"] },
  { id: "placement", label: "Placement", states: ["placement-transition-midpoint", "placement-settled"], viewports: ["desktop-motion", "desktop"] },
  { id: "victory", label: "Victory / result", states: ["victory-result", "victory-result-transition"], viewports: ["desktop", "desktop-motion"] },
  { id: "mobile-combat", label: "Representative mobile combat", states: ["mobile-combat-motion", "lane-damage-final", "lane-block-final"], viewports: ["phone-landscape-motion", "phone-landscape", "phone-portrait"] }
]);

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function safeSlug(value) {
  return String(value || "capture")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "capture";
}

function resolveManifest(inputPath) {
  const resolved = path.resolve(inputPath);
  const manifestPath = fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()
    ? path.join(resolved, "manifest.json")
    : resolved;
  if (!fs.existsSync(manifestPath)) throw new Error(`Babylon review manifest not found: ${manifestPath}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(manifest.states)) throw new Error(`Invalid Babylon review manifest: ${manifestPath}`);
  return { manifest, manifestPath, directory: path.dirname(manifestPath) };
}

function pickCapture(manifest, mapping) {
  for (const stateId of mapping.states || []) {
    const state = manifest.states.find((entry) => entry.id === stateId);
    if (!state || !Array.isArray(state.captures) || state.captures.length === 0) continue;
    for (const viewport of mapping.viewports || []) {
      const capture = state.captures.find((entry) => entry.viewport === viewport);
      if (capture) return { stateId, capture };
    }
    return { stateId, capture: state.captures[0] };
  }
  return null;
}

function pathWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function copySelectedCapture(source, side, mappingId, outputDirectory) {
  if (!source) return null;
  const sourcePath = path.resolve(source.directory, source.selection.capture.file);
  if (!pathWithin(source.directory, sourcePath) || !fs.existsSync(sourcePath)) {
    return {
      unavailable: true,
      reason: `Capture file is missing or outside its review directory: ${source.selection.capture.file}`
    };
  }
  const extension = path.extname(sourcePath).toLowerCase() || ".jpg";
  const relativePath = path.join("images", side, `${safeSlug(mappingId)}${extension}`);
  const destinationPath = path.join(outputDirectory, relativePath);
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath, fs.constants.COPYFILE_EXCL);
  return {
    unavailable: false,
    file: relativePath.replaceAll(path.sep, "/"),
    sourceFile: source.selection.capture.file,
    stateId: source.selection.stateId,
    viewport: source.selection.capture.viewport,
    width: source.selection.capture.width,
    height: source.selection.capture.height,
    diagnostics: source.selection.capture.diagnostics || null
  };
}

function renderSide(side, resolved) {
  if (!resolved || resolved.unavailable) {
    return `<div class="unavailable"><strong>${htmlEscape(side)}</strong><span>${htmlEscape(
      resolved?.reason || `${side} unavailable for this mapping.`
    )}</span></div>`;
  }
  return `<figure><img src="${htmlEscape(resolved.file)}" alt="${htmlEscape(side)}: ${htmlEscape(resolved.stateId)}">
    <figcaption><strong>${htmlEscape(side)}</strong> · mapped from <code>${htmlEscape(resolved.stateId)}</code> ·
    ${htmlEscape(resolved.viewport)}${resolved.width && resolved.height ? ` · ${resolved.width}×${resolved.height}` : ""}</figcaption></figure>`;
}

function buildHtml(comparison) {
  const rows = comparison.pairs.map((pair) => `
    <section>
      <h2>${htmlEscape(pair.label)}</h2>
      <p class="mapping">Mapping candidates: <code>${htmlEscape(pair.mapping.states.join(" → "))}</code> · viewports <code>${htmlEscape(pair.mapping.viewports.join(" → "))}</code></p>
      <div class="pair">${renderSide("Qualified baseline", pair.before)}${renderSide("Cadence pass", pair.after)}</div>
    </section>`).join("");
  const beforeMeta = comparison.before.metadata || {};
  const afterMeta = comparison.after.metadata || {};
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${htmlEscape(comparison.title)}</title><style>
    :root{color-scheme:dark}body{margin:0 auto;max-width:1800px;padding:28px;background:#080c11;color:#e6e1d1;font-family:system-ui,sans-serif}h1,h2{letter-spacing:.02em}code{color:#dfbe72}header,.questions,section{background:#111720;border:1px solid #37424e;border-radius:10px;padding:18px;margin:0 0 18px}.provenance{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}.provenance div{background:#0b1017;padding:12px}.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}figure{margin:0;background:#080c11}img{display:block;width:100%;height:auto}figcaption{padding:10px;color:#b8c1cb}.mapping{color:#9eabb8}.unavailable{min-height:260px;border:1px dashed #875d55;background:#211513;display:grid;place-content:center;gap:8px;padding:20px;text-align:center;color:#e3b9ae}.questions li{margin:.45rem 0}@media(max-width:800px){.pair{grid-template-columns:1fr}body{padding:12px}}
    </style><body><header><h1>${htmlEscape(comparison.title)}</h1><p>Generated ${htmlEscape(comparison.generatedAt)}. Missing qualified frames are stated explicitly; they are never silently substituted.</p>
    <div class="provenance"><div><strong>Qualified baseline</strong><br><code>${htmlEscape(beforeMeta.branch || "unknown")}</code><br><code>${htmlEscape(beforeMeta.shortRevision || beforeMeta.revision || "unknown")}</code></div>
    <div><strong>Cadence pass</strong><br><code>${htmlEscape(afterMeta.branch || "unknown")}</code><br><code>${htmlEscape(afterMeta.shortRevision || afterMeta.revision || "unknown")}</code></div></div></header>
    <div class="questions"><strong>Review questions</strong><ul><li>Is hierarchy better?</li><li>Does the board feel calmer?</li><li>Do consequential actions have more weight?</li><li>Are cards clearer?</li><li>Does the match feel more cohesive and recognizably Gauntlet?</li><li>Is the sequence pleasant to watch repeatedly?</li></ul></div>${rows}</body></html>`;
}

function buildComparisonPackage({
  before,
  after,
  output,
  mappings = DEFAULT_MAPPINGS,
  title = "Gauntlet Babylon art-direction comparison",
  outputRoot = DEFAULT_OUTPUT_ROOT
}) {
  if (!before || !after || !output) throw new Error("before, after, and output are required.");
  const beforeSource = resolveManifest(before);
  const afterSource = resolveManifest(after);
  const outputDirectory = path.resolve(output);
  const safeOutputRoot = path.resolve(outputRoot);
  if (!pathWithin(safeOutputRoot, outputDirectory)) {
    throw new Error(`Comparison output must be inside ${safeOutputRoot}. Received ${outputDirectory}.`);
  }
  if (fs.existsSync(outputDirectory)) {
    throw new Error(`Comparison output already exists: ${outputDirectory}. Choose a new directory.`);
  }
  fs.mkdirSync(outputDirectory, { recursive: true });

  const pairs = mappings.map((mapping) => {
    const beforeSelection = pickCapture(beforeSource.manifest, mapping);
    const afterSelection = pickCapture(afterSource.manifest, mapping);
    const beforeResolved = copySelectedCapture(
      beforeSelection ? { ...beforeSource, selection: beforeSelection } : null,
      "before",
      mapping.id,
      outputDirectory
    );
    const afterResolved = copySelectedCapture(
      afterSelection ? { ...afterSource, selection: afterSelection } : null,
      "after",
      mapping.id,
      outputDirectory
    );
    return {
      id: mapping.id,
      label: mapping.label,
      mapping,
      before: beforeResolved || { unavailable: true, reason: `Baseline unavailable. Tried: ${mapping.states.join(", ")}.` },
      after: afterResolved || { unavailable: true, reason: `Cadence capture unavailable. Tried: ${mapping.states.join(", ")}.` }
    };
  });

  const comparison = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    title,
    before: {
      manifest: path.relative(REPOSITORY_ROOT, beforeSource.manifestPath).replaceAll(path.sep, "/"),
      metadata: beforeSource.manifest.metadata || {}
    },
    after: {
      manifest: path.relative(REPOSITORY_ROOT, afterSource.manifestPath).replaceAll(path.sep, "/"),
      metadata: afterSource.manifest.metadata || {}
    },
    pairs
  };
  fs.writeFileSync(path.join(outputDirectory, "comparison.json"), `${JSON.stringify(comparison, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDirectory, "index.html"), buildHtml(comparison));
  return { outputDirectory, comparison };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}.`);
    args[key] = value;
    index += 1;
  }
  return args;
}

function usage() {
  return "Usage: npm run compare:babylon-review -- --before <review-dir> --after <review-dir> --output <new-comparison-dir> [--mapping <json>] [--title <text>]";
}

function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (!args.before || !args.after || !args.output) throw new Error(usage());
  const mappings = args.mapping
    ? JSON.parse(fs.readFileSync(path.resolve(args.mapping), "utf8"))
    : DEFAULT_MAPPINGS;
  const result = buildComparisonPackage({
    before: args.before,
    after: args.after,
    output: args.output,
    mappings,
    title: args.title || undefined
  });
  console.log(`Babylon visual comparison: ${result.outputDirectory}`);
  const unavailable = result.comparison.pairs.filter((pair) => pair.before.unavailable || pair.after.unavailable);
  console.log(`${result.comparison.pairs.length} mappings; ${unavailable.length} with unavailable evidence.`);
}

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_MAPPINGS,
  buildComparisonPackage,
  parseArgs,
  pickCapture,
  resolveManifest
};
