const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { loadEnvironment, publicEnvironment } = require("../config/environment");
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-toolchain-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}
test("environment precedence, references and test isolation preserve public configuration", t => {
  const dir = fixture(t);
  fs.writeFileSync(path.join(dir, ".env.production.local"), 'REACT_APP_SOURCE=local-production\nURL=https://${HOST}/play\nESCAPED=\\$HOST\nDEFAULT=${MISSING:-fallback}\n');
  fs.writeFileSync(path.join(dir, ".env.local"), "REACT_APP_SOURCE=local\nONLY_LOCAL=yes\n");
  fs.writeFileSync(path.join(dir, ".env.production"), "REACT_APP_SOURCE=production\n");
  fs.writeFileSync(path.join(dir, ".env"), "REACT_APP_SOURCE=base\nHOST=ignored\n");
  const env = loadEnvironment(dir, "production", { HOST: "example.test" });
  assert.equal(env.REACT_APP_SOURCE, "local-production");
  assert.equal(env.URL, "https://example.test/play");
  assert.equal(env.ESCAPED, "$HOST"); assert.equal(env.DEFAULT, "fallback");
  assert.equal(loadEnvironment(dir, "production", { REACT_APP_SOURCE: "hosted" }).REACT_APP_SOURCE, "hosted");
  assert.equal(loadEnvironment(dir, "test", {}).ONLY_LOCAL, undefined);
  fs.writeFileSync(path.join(dir, ".env.test"), "A=${B}\nB=${A}\n");
  assert.throws(() => loadEnvironment(dir, "test", {}), /Circular/);
});
test("only explicitly public variables reach browser definitions and HTML", () => {
  const env = { REACT_APP_SOCKET_URL: "https://api.example.test", PUBLIC_URL: "/game/", SUPABASE_SERVICE_ROLE_KEY: "private-sentinel", GAUNTLET_GITHUB_TOKEN: "private-sentinel" };
  assert.deepEqual(publicEnvironment("production", env), { REACT_APP_SOCKET_URL: env.REACT_APP_SOCKET_URL, NODE_ENV: "production", PUBLIC_URL: "/game" });
  const config = require("../config/webpack.config")("production", env);
  assert.equal(JSON.stringify(config.plugins).includes("private-sentinel"), false);
});
test("reviewed YAML override preserves NYC config loading and rejects malformed or executable YAML", async t => {
  const dir = fixture(t), { loadNycConfig } = require("@istanbuljs/load-nyc-config");
  fs.writeFileSync(path.join(dir, "package.json"), "{}");
  fs.writeFileSync(path.join(dir, "base.yml"), "all: true\ninclude:\n  - src/**/*.js\ncheck-coverage: true\n");
  fs.writeFileSync(path.join(dir, ".nycrc.yml"), "extends: ./base.yml\nreporter: [text, lcov]\nexclude: test/**\n");
  const config = await loadNycConfig({ cwd: dir });
  assert.equal(config.all, true); assert.equal(config.checkCoverage, true);
  assert.deepEqual(config.include, ["src/**/*.js"]); assert.deepEqual(config.exclude, ["test/**"]); assert.deepEqual(config.reporter, ["text", "lcov"]);
  fs.writeFileSync(path.join(dir, ".nycrc.yml"), "include: [missing-end\n");
  await assert.rejects(loadNycConfig({ cwd: dir }));
  fs.writeFileSync(path.join(dir, ".nycrc.yml"), 'include: !!js/function "function () { return 1; }"');
  await assert.rejects(loadNycConfig({ cwd: dir }), /unknown.*tag/);
});
test("development HTTP serves compiled assets and SPA routes but rejects cross-origin and filesystem access", async t => {
  const dir = fixture(t);
  fs.writeFileSync(path.join(dir, "index.html"), "<h1>Gauntlet</h1>");
  fs.writeFileSync(path.join(dir, "app.js"), "window.ready = true;");
  fs.writeFileSync(path.join(dir, ".env"), "PRIVATE=secret");
  const server = require("./start").createServer(dir);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const port = server.address().port;
  const request = (url, headers = {}, method = "GET") => new Promise((resolve, reject) => {
    http.request({ hostname: "127.0.0.1", port, path: url, headers, method }, response => { let body = ""; response.on("data", data => { body += data; }); response.on("end", () => resolve({ status: response.statusCode, body, headers: response.headers })); }).on("error", reject).end();
  });
  assert.equal((await request("/admin/gauntlet")).body, "<h1>Gauntlet</h1>");
  assert.equal((await request("/app.js")).headers["content-type"], "text/javascript; charset=utf-8");
  assert.equal((await request("/missing.js")).status, 404);
  for (const url of ["/%2e%2e/private", "/.env", "/%5c..%5cprivate", "/C:/private", "/%00"]) assert.equal((await request(url)).status, 403);
  assert.equal((await request("/%zz")).status, 400);
  assert.equal((await request("/", { host: `attacker.test:${port}` })).status, 403);
  assert.equal((await request("/", { origin: "https://attacker.test" })).status, 403);
  assert.equal((await request("/", { "sec-fetch-site": "cross-site" })).status, 403);
  assert.equal((await request("/", {}, "POST")).status, 405);
});
