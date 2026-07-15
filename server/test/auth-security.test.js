const test = require("node:test");
const assert = require("node:assert/strict");

const { server, __test } = require("../index");

const {
  issueAccountSession,
  signAuthPayload,
  validateAuthConfiguration,
  verifyAuthToken
} = __test;

test.after(() => server.close());

test("rejects known development auth secrets in production", () => {
  assert.throws(
    () => validateAuthConfiguration("production", "dev-gauntlet-auth-secret-change-me"),
    /ACCOUNT_AUTH_SECRET/
  );
  assert.throws(
    () => validateAuthConfiguration("production", "local-development-secret-change-me"),
    /ACCOUNT_AUTH_SECRET/
  );
  assert.doesNotThrow(() => validateAuthConfiguration("production", "production-secret-from-a-secure-environment"));
});

test("issues expiring sessions and rejects expired or legacy tokens", () => {
  const now = Date.parse("2026-07-15T12:00:00.000Z");
  const account = { id: "11111111-1111-4111-8111-111111111111", name: "Alpha", stats: {} };
  const session = issueAccountSession(account, now);
  const payload = verifyAuthToken(session.token, now + 1000);

  assert.equal(payload.id, account.id);
  assert.equal(payload.iat, now);
  assert.ok(payload.exp > payload.iat);
  assert.equal(verifyAuthToken(session.token, payload.exp), null);
  assert.equal(verifyAuthToken(signAuthPayload({ id: account.id, name: account.name }), now), null);
});

test("rate limits repeated login attempts without echoing credentials", async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const password = "not-a-real-password";
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args.join(" "));

  try {
    let response;
    for (let attempt = 0; attempt < 11; attempt += 1) {
      response = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Missing Account", password })
      });
    }
    assert.equal(response.status, 429);
    assert.ok(Number(response.headers.get("retry-after")) > 0);
    assert.equal(warnings.some((entry) => entry.includes("rate_limited")), true);
    assert.equal(warnings.some((entry) => entry.includes(password)), false);
    assert.equal(warnings.some((entry) => entry.includes("Missing Account")), false);
  } finally {
    console.warn = originalWarn;
  }
});
