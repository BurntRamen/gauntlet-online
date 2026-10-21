"use strict";

const crypto = require("crypto");

const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  const email = normalizeEmail(value);
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function createPasswordReset(now = Date.now()) {
  const token = crypto.randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashResetToken(token),
    requestedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + PASSWORD_RESET_TTL_MS).toISOString()
  };
}

function buildPasswordResetUrl(clientUrl, token) {
  const url = new URL(clientUrl);
  url.searchParams.set("resetToken", token);
  return url.toString();
}

function passwordResetMatches(identity, token, now = Date.now()) {
  const expected = String(identity?.passwordResetTokenHash || "");
  const actual = hashResetToken(token);
  if (!/^[a-f0-9]{64}$/.test(expected) || !/^[a-f0-9]{64}$/.test(actual)) return false;
  const expiresAt = Date.parse(identity?.passwordResetExpiresAt || "");
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(actual, "hex"));
}

async function sendPasswordResetEmail({ apiKey, fromEmail, toEmail, accountName, resetUrl, fetchImpl = fetch }) {
  if (!apiKey || !fromEmail) throw new Error("Password reset email delivery is not configured.");
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      subject: "Reset your Gauntlet Online password",
      html: `<p>Hello ${escapeHtml(accountName)},</p><p>Your Gauntlet Online account name is <strong>${escapeHtml(accountName)}</strong>.</p><p><a href="${escapeHtml(resetUrl)}">Reset your password</a>. This link expires in 30 minutes and can be used once.</p><p>If you did not request this, you can ignore this email.</p>`,
      text: `Hello ${accountName},\n\nYour Gauntlet Online account name is ${accountName}.\n\nReset your password: ${resetUrl}\n\nThis link expires in 30 minutes and can be used once. If you did not request this, you can ignore this email.`
    })
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Password reset email failed (${response.status}): ${body.slice(0, 200)}`);
  }
  return response.json();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

module.exports = {
  PASSWORD_RESET_TTL_MS,
  buildPasswordResetUrl,
  createPasswordReset,
  hashResetToken,
  isValidEmail,
  normalizeEmail,
  passwordResetMatches,
  sendPasswordResetEmail
};
