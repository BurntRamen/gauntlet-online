const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const buildDirectory = path.resolve(__dirname, "../client/build/static/js");
const KIB = 1024;
const budgets = {
  // Typed content presentation adds about 1 KiB to the production entry point.
  mainGzip: 177 * KIB,
  adminGzip: 18 * KIB,
  largestAsyncGzip: 350 * KIB,
  // Legacies, ranked loadouts, and the full-rules/keyword-guide controls.
  // The 72-card guide stays in static HTML, outside the application bundle.
  // The projected faction-card row, support-slot actors, and accessible ability chooser.
  // Saved light/dark controls, reversible board materials, and CSS-pixel framing.
  // Native, theme-aware board inscriptions replace the screen-space overlay.
  // Readable card rules, campaign applicability, and blocker eligibility previews.
  // Source-by-source effect receipts and persistent inspection/history.
  // Zynarth and Astral Vanguard add two complete deterministic faction engines.
  // Artwork gallery controls and the accessible card zoom dialog add ~2 KiB.
  // Keep the initial-load and largest-chunk ceilings unchanged.
  // Per-player persistent minimization for unused vault pack credits.
  // Admin is lazy-loaded and measured separately; player contracts add ~3 KiB.
  // Includes the set-specific Sealed controls from the current player release.
  totalJavaScriptGzip: 736 * KIB
};

if (!fs.existsSync(buildDirectory)) {
  throw new Error("Client build output is missing. Run npm run build:client first.");
}

const assets = fs.readdirSync(buildDirectory)
  .filter((name) => name.endsWith(".js"))
  .map((name) => {
    const content = fs.readFileSync(path.join(buildDirectory, name));
    return {
      name,
      rawBytes: content.length,
      gzipBytes: zlib.gzipSync(content, { level: 9 }).length
    };
  });

const main = assets.find((asset) => asset.name.startsWith("main."));
const asynchronous = assets.filter((asset) => asset !== main);
const largestAsync = asynchronous.reduce(
  (largest, asset) => (!largest || asset.gzipBytes > largest.gzipBytes ? asset : largest),
  null
);
const adminAssets = assets.filter((asset) => /^gauntlet-admin(?:-authoring)?\./.test(asset.name));
const adminGzipBytes = adminAssets.reduce((total, asset) => total + asset.gzipBytes, 0);
const totalGzipBytes = assets.reduce((total, asset) => total + asset.gzipBytes, 0) - adminGzipBytes;

const failures = [];
if (adminGzipBytes > budgets.adminGzip) failures.push(`Admin JavaScript is ${adminGzipBytes} bytes gzip; budget is ${budgets.adminGzip}.`);
if (!main) failures.push("Could not identify the main client bundle.");
if (main && main.gzipBytes > budgets.mainGzip) {
  failures.push(`Main bundle is ${main.gzipBytes} bytes gzip; budget is ${budgets.mainGzip}.`);
}
if (largestAsync && largestAsync.gzipBytes > budgets.largestAsyncGzip) {
  failures.push(
    `Largest async chunk ${largestAsync.name} is ${largestAsync.gzipBytes} bytes gzip; `
    + `budget is ${budgets.largestAsyncGzip}.`
  );
}
if (totalGzipBytes > budgets.totalJavaScriptGzip) {
  failures.push(
    `Total client JavaScript is ${totalGzipBytes} bytes gzip; `
    + `budget is ${budgets.totalJavaScriptGzip}.`
  );
}

const toKib = (bytes) => `${(bytes / KIB).toFixed(1)} KiB`;
console.log("Client build budgets");
console.log(`  main: ${main ? toKib(main.gzipBytes) : "missing"} / ${toKib(budgets.mainGzip)}`);
console.log(
  `  largest async: ${largestAsync ? `${largestAsync.name} ${toKib(largestAsync.gzipBytes)}` : "none"}`
  + ` / ${toKib(budgets.largestAsyncGzip)}`
);
console.log(`  player JavaScript: ${toKib(totalGzipBytes)} / ${toKib(budgets.totalJavaScriptGzip)}`);
console.log(`  lazy Admin JavaScript: ${toKib(adminGzipBytes)} / ${toKib(budgets.adminGzip)}`);

if (failures.length > 0) {
  throw new Error(failures.join("\n"));
}
