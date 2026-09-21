const test = require("node:test");
const assert = require("node:assert/strict");
const { server } = require("../index");

let baseUrl;
const previousCommit = process.env.RENDER_GIT_COMMIT;
test.before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => {
  if (previousCommit === undefined) delete process.env.RENDER_GIT_COMMIT;
  else process.env.RENDER_GIT_COMMIT = previousCommit;
  await new Promise((resolve) => server.close(resolve));
});

test("public game content identifies the rules runtime and deployed commit without changing its body", async () => {
  process.env.RENDER_GIT_COMMIT = "a".repeat(40);
  const response = await fetch(`${baseUrl}/api/game-content`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-gauntlet-rules-version"), "gauntlet-duel-v4");
  assert.equal(response.headers.get("x-gauntlet-commit"), "a".repeat(40));
  const body = await response.json();
  assert.deepEqual(Object.keys(body), ["content"]);
  assert.ok(body.content);
});

test("deployment diagnostics never echo invalid configuration values", async () => {
  process.env.RENDER_GIT_COMMIT = "not-a-public-commit";
  const response = await fetch(`${baseUrl}/api/game-content`);
  assert.equal(response.headers.get("x-gauntlet-commit"), null);
  assert.equal((await response.text()).includes("not-a-public-commit"), false);
});
