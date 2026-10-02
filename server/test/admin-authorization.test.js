const test = require("node:test");
const assert = require("node:assert/strict");
const { createGauntletAdminAuthorization, SIMPLY_ACCOUNT_ID, BURNT_RAMEN_ACCOUNT_ID } = require("../adminAuthorization");

test("allowlist uses exactly two stable production IDs and denies impersonation and disabled slots", () => {
  const auth = createGauntletAdminAuthorization({ requireAccount: async () => null });
  assert.equal(auth.isAllowed({ id: SIMPLY_ACCOUNT_ID, name: "Renamed account" }), true);
  assert.equal(auth.isAllowed({ id: BURNT_RAMEN_ACCOUNT_ID, name: "Renamed second account" }), true);
  assert.equal(auth.isAllowed({ id: "another-id", name: "simply" }), false);
  assert.equal(auth.isAllowed({ id: "another-id", name: "Burnt Ramen" }), false);
  assert.equal(auth.isAllowed(null), false);
  assert.equal(auth.configuredAccounts, 2);
  const empty = createGauntletAdminAuthorization({ requireAccount: async () => null, simplyId: "", burntRamenId: "not-an-id" });
  assert.equal(empty.configuredAccounts, 0);
  assert.equal(empty.isAllowed({ id: SIMPLY_ACCOUNT_ID }), false);
  assert.equal(empty.isAllowed({ id: BURNT_RAMEN_ACCOUNT_ID }), false);
});

test("storage failures and malformed account-token envelopes never run the protected handler", async () => {
  const auth = createGauntletAdminAuthorization({ requireAccount: async () => { throw new Error("secret service details"); } });
  const response = { set() {}, status(value) { this.code = value; return this; }, json(body) { this.body = body; } };
  const next = () => assert.fail("Protected handler must not run");
  await auth.middleware({ get: () => "Bearer token.signature.extra" }, response, next);
  assert.equal(response.code, 401);
  await auth.middleware({ get: () => "Bearer token.signature" }, response, next);
  assert.equal(response.code, 503);
  assert.equal(JSON.stringify(response.body).includes("secret"), false);
});
