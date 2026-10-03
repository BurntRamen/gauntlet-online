const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const KIB = 1024;
const budgets = Object.freeze({
  mainGzip: 177 * KIB,
  adminEntryGzip: 20 * KIB,
  // Every named lazy workshop shares this total; splitting grants no extra allowance.
  adminGzip: 48 * KIB,
  largestAsyncGzip: 350 * KIB,
  totalJavaScriptGzip: 740 * KIB
});
const adminName = name => /^gauntlet-admin(?:-[a-z0-9-]+)?\./i.test(name);
const adminSource = source => /(?:^|\/)src\/(?:admin\/|(?:GauntletAdmin|GauntletAuthoring|GauntletPlaytest|GauntletContractFields|EncounterWorkshop)\.js(?:$|\?))/.test(source.replace(/\\/g, "/"));

function readAssets(directory) {
  if (!fs.existsSync(directory)) throw new Error("Client build output is missing. Run npm run build:client first.");
  return fs.readdirSync(directory).filter(name => name.endsWith(".js")).map(name => {
    const content = fs.readFileSync(path.join(directory, name));
    const mapFile = path.join(directory, `${name}.map`);
    // CRA source maps expose accidental unnamed Admin splits or player imports.
    const sources = fs.existsSync(mapFile) ? JSON.parse(fs.readFileSync(mapFile, "utf8")).sources || [] : [];
    return { name, rawBytes: content.length, gzipBytes: zlib.gzipSync(content, { level: 9 }).length, sources };
  });
}

function evaluateBudgets(assets, limits = budgets) {
  const mains = assets.filter(asset => /^main\./.test(asset.name)), main = mains[0];
  const asynchronous = assets.filter(asset => !mains.includes(asset));
  const largestAsync = asynchronous.reduce((largest, asset) => !largest || asset.gzipBytes > largest.gzipBytes ? asset : largest, null);
  const adminAssets = assets.filter(asset => adminName(asset.name) || (asset.sources || []).some(adminSource));
  const adminEntries = assets.filter(asset => /^gauntlet-admin\./i.test(asset.name));
  const sum = rows => rows.reduce((total, asset) => total + asset.gzipBytes, 0);
  const adminGzipBytes = sum(adminAssets), adminEntryGzipBytes = sum(adminEntries);
  const totalGzipBytes = sum(assets.filter(asset => !adminAssets.includes(asset)));
  const failures = [];
  if (mains.length !== 1) failures.push("Expected exactly one main client bundle.");
  if (adminEntries.length !== 1) failures.push("Expected exactly one named gauntlet-admin entry bundle.");
  for (const asset of adminAssets) if (!adminName(asset.name)) failures.push(`Admin modules appeared in ${asset.name}. Keep them outside the player bundle and name lazy chunks gauntlet-admin-*.`);
  if (main && main.gzipBytes > limits.mainGzip) failures.push(`Main bundle is ${main.gzipBytes} bytes gzip; budget is ${limits.mainGzip}.`);
  if (adminEntryGzipBytes > limits.adminEntryGzip) failures.push(`Initial Admin entry is ${adminEntryGzipBytes} bytes gzip; budget is ${limits.adminEntryGzip}.`);
  if (adminGzipBytes > limits.adminGzip) failures.push(`All Admin JavaScript is ${adminGzipBytes} bytes gzip; budget is ${limits.adminGzip}.`);
  if (largestAsync && largestAsync.gzipBytes > limits.largestAsyncGzip) failures.push(`Largest async chunk ${largestAsync.name} is ${largestAsync.gzipBytes} bytes gzip; budget is ${limits.largestAsyncGzip}.`);
  if (totalGzipBytes > limits.totalJavaScriptGzip) failures.push(`Player JavaScript is ${totalGzipBytes} bytes gzip; budget is ${limits.totalJavaScriptGzip}.`);
  return { main, largestAsync, adminAssets, adminGzipBytes, adminEntryGzipBytes, totalGzipBytes, failures };
}

function checkBuildBudgets(directory = path.resolve(__dirname, "../client/build/static/js")) {
  const result = evaluateBudgets(readAssets(directory));
  const toKib = bytes => `${(bytes / KIB).toFixed(1)} KiB`;
  console.log("Client build budgets");
  console.log(`  main: ${result.main ? toKib(result.main.gzipBytes) : "missing"} / ${toKib(budgets.mainGzip)}`);
  console.log(`  largest async: ${result.largestAsync ? `${result.largestAsync.name} ${toKib(result.largestAsync.gzipBytes)}` : "none"} / ${toKib(budgets.largestAsyncGzip)}`);
  console.log(`  player JavaScript: ${toKib(result.totalGzipBytes)} / ${toKib(budgets.totalJavaScriptGzip)}`);
  console.log(`  initial Admin entry: ${toKib(result.adminEntryGzipBytes)} / ${toKib(budgets.adminEntryGzip)}`);
  console.log(`  all lazy Admin JavaScript: ${toKib(result.adminGzipBytes)} / ${toKib(budgets.adminGzip)}`);
  if (result.failures.length) throw new Error(result.failures.join("\n"));
  return result;
}

if (require.main === module) checkBuildBudgets();
module.exports = { budgets, adminName, readAssets, evaluateBudgets, checkBuildBudgets };
