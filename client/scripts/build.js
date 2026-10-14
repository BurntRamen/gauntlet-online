const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");

function prepareOutput() {
  const output = path.resolve(root, "build");
  // Only remove this client's generated build directory, never a symlink target.
  if (path.dirname(output) !== root || path.basename(output) !== "build" || (fs.existsSync(output) && fs.lstatSync(output).isSymbolicLink())) throw new Error("Unsafe build output path");
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output, { recursive: true });
  fs.cpSync(path.join(root, "public"), output, { recursive: true, filter: source => source !== path.join(root, "public/index.html") });
}

async function build() {
  process.env.NODE_ENV = "production";
  process.env.BABEL_ENV = "production";
  require("../config/environment").loadEnvironment(root, "production");
  const { ESLint } = require("eslint");
  const lint = new ESLint({ cwd: root });
  const results = await lint.lintFiles(["src/**/*.{js,jsx}"]);
  const report = (await lint.loadFormatter("stylish")).format(results);
  if (report) console.log(report);
  if (results.some(result => result.errorCount > 0)) throw new Error("Client lint failed");
  if (process.env.CI && process.env.CI.toLowerCase() !== "false" && results.some(result => result.warningCount > 0)) throw new Error("Client lint warnings fail CI");
  prepareOutput();
  const compiler = require("webpack")(require("../config/webpack.config")("production"));
  await new Promise((resolve, reject) => compiler.run((error, stats) => compiler.close(closeError => {
    if (error || closeError) return reject(error || closeError);
    console.log(stats.toString({ colors: false, preset: "errors-warnings" }));
    if (stats.hasErrors()) return reject(new Error("Client compilation failed"));
    resolve();
  })));
}
if (require.main === module) build().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { build, prepareOutput };
