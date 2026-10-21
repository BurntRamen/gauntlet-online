const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PASSWORD_RESET_TTL_MS,
  buildPasswordResetUrl,
  createPasswordReset,
  hashResetToken,
  isValidEmail,
  normalizeEmail,
  passwordResetMatches,
  sendPasswordResetEmail
} = require("../accountRecovery");

test("recovery emails normalize and validate without accepting malformed addresses", () => {
  assert.equal(normalizeEmail("  Player@Example.COM "), "player@example.com");
  assert.equal(isValidEmail("player@example.com"), true);
  assert.equal(isValidEmail("player example.com"), false);
  assert.equal(isValidEmail("player@example"), false);
});

test("password reset tokens are hashed, expire, and are single-purpose inputs", () => {
  const now = Date.parse("2026-10-20T12:00:00.000Z");
  const reset = createPasswordReset(now);
  const identity = { passwordResetTokenHash: reset.tokenHash, passwordResetExpiresAt: reset.expiresAt };
  assert.notEqual(reset.token, reset.tokenHash);
  assert.equal(reset.tokenHash, hashResetToken(reset.token));
  assert.equal(passwordResetMatches(identity, reset.token, now + PASSWORD_RESET_TTL_MS - 1), true);
  assert.equal(passwordResetMatches(identity, "wrong-token", now), false);
  assert.equal(passwordResetMatches(identity, reset.token, now + PASSWORD_RESET_TTL_MS), false);
});

test("password reset links preserve the public client origin and carry only the opaque token", () => {
  const url = new URL(buildPasswordResetUrl("https://gauntlet.example/play?join=ABCD", "opaque-token"));
  assert.equal(url.origin, "https://gauntlet.example");
  assert.equal(url.searchParams.get("join"), "ABCD");
  assert.equal(url.searchParams.get("resetToken"), "opaque-token");
});

test("recovery mail includes the account name and reset link through the configured provider", async () => {
  let request;
  const result = await sendPasswordResetEmail({
    apiKey: "test-key",
    fromEmail: "Gauntlet <recovery@example.com>",
    toEmail: "player@example.com",
    accountName: "Player One",
    resetUrl: "https://gauntlet.example/?resetToken=secret",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ id: "email-1" }) };
    }
  });
  const body = JSON.parse(request.options.body);
  assert.equal(request.url, "https://api.resend.com/emails");
  assert.deepEqual(body.to, ["player@example.com"]);
  assert.match(body.text, /Player One/);
  assert.match(body.text, /resetToken=secret/);
  assert.deepEqual(result, { id: "email-1" });
});
