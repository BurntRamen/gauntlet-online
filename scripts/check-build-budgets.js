const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const buildDirectory = path.resolve(__dirname, "../client/build/static/js");
const KIB = 1024;
const budgets = {
  mainGzip: 175 * KIB,
  largestAsyncGzip: 350 * KIB,
  // Legacies, ranked loadouts, and the full-rules/keyword-guide controls.
  // The 72-card guide stays in static HTML, outside the application bundle.
  // The projected faction-card row, support-slot actors, and accessible ability chooser.
  // Saved light/dark controls, reversible board materials, and CSS-pixel framing.
  // Native, theme-aware board inscriptions replace the screen-space overlay.
  // Readable card rules, campaign applicability, and blocker eligibility previews.
  // Source-by-source effect receipts and persistent inspection/history.
  // Keep the initial-load and largest-chunk ceilings unchanged.
  totalJavaScriptGzip: 726 * KIB
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
const totalGzipBytes = assets.reduce((total, asset) => total + asset.gzipBytes, 0);

const failures = [];
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
console.log(`  all JavaScript: ${toKib(totalGzipBytes)} / ${toKib(budgets.totalJavaScriptGzip)}`);

if (failures.length > 0) {
  throw new Error(failures.join("\n"));
}
