"use strict";
const crypto = require("node:crypto");
// Isolated deterministic contract fixture, never imported by the application.
// It cannot collect money, contact a provider or create a merchant checkout.
function paymentTestAdapter({ now = () => Date.now(), secret = crypto.randomBytes(32), onCheckout, onRefund } = {}) {
  const sign = event => {
    const body = Buffer.from(JSON.stringify(event)), stamp = String(Math.floor(now() / 1000));
    const signature = crypto.createHmac("sha256", secret).update(stamp + ".").update(body).digest("hex");
    return { body, headers: { "x-fixture-time": stamp, "x-fixture-signature": signature } };
  };
  return {
    contract: { version: 1, id: "gauntlet-contract-fixture", mode: "sandbox", taxMode: "inclusive", taxConfigured: true, countries: ["US", "GB"], currencies: ["usd", "gbp"], checkoutHosts: ["checkout.invalid"] },
    sign,
    async createCheckout(intent) { if (onCheckout) await onCheckout(intent); return { checkoutId: `fixture-${intent.id}`, url: `https://checkout.invalid/${intent.id}`, expiresAt: new Date(now() + 3600000).toISOString() }; },
    async requestRefund(intent, command) { if (onRefund) await onRefund(intent, command); return { requestId: `refund-${command.id}` }; },
    async verifyWebhook(body, headers) {
      const stamp = headers["x-fixture-time"], signature = headers["x-fixture-signature"];
      if (typeof stamp !== "string" || !/^\d{10}$/.test(stamp) || Math.abs(now() / 1000 - Number(stamp)) > 300 || typeof signature !== "string" || !/^[a-f0-9]{64}$/.test(signature)) throw Object.assign(new Error("Unverified or stale payment signature."), { status: 401 });
      const expected = crypto.createHmac("sha256", secret).update(stamp + ".").update(body).digest();
      if (!crypto.timingSafeEqual(expected, Buffer.from(signature, "hex"))) throw Object.assign(new Error("Unverified payment signature."), { status: 401 });
      try { return JSON.parse(body.toString("utf8")); } catch { throw Object.assign(new Error("Malformed verified payment event."), { status: 400 }); }
    }
  };
}
module.exports = { paymentTestAdapter };
