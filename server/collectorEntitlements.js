"use strict";

const crypto = require("crypto");
const {
  PAID_COLLECTOR_ACQUISITION,
  getCollectorVariantById
} = require("./gameContent");

const COLLECTOR_ENTITLEMENT_SCHEMA_VERSION = "gauntlet.collector-entitlement.v1";
const COLLECTOR_REDEMPTION_RECEIPT_VERSION = 1;
const PHYSICAL_COLLECTOR_PRODUCT_TYPE = "physical-collector-entitlement";
const COLLECTOR_ENTITLEMENT_SOURCES = new Set([
  "physical-order",
  "owner-manual-fulfillment"
]);

const PHYSICAL_COLLECTOR_PRODUCTS = Object.freeze({
  "rumin-foundation-physical-box": Object.freeze({
    id: "rumin-foundation-physical-box",
    name: "Rumin Foundation Physical Collector Box",
    productType: PHYSICAL_COLLECTOR_PRODUCT_TYPE,
    collectorPackId: "rumin-collector",
    edition: "foundation-collector",
    finish: "foil",
    description: "Eight account-bound Rumin Foundation collector foils associated with one physical box fulfillment. Cosmetic presentation only.",
    competitivePower: false,
    variantIds: Object.freeze([
      "rumin-gilded-scale-legionary:collector-foil",
      "rumin-forum-ledger-runner:collector-foil",
      "rumin-vault-shield-bearer:collector-foil",
      "rumin-coin-scale-spear:collector-foil",
      "rumin-senate-vault-guard:collector-foil",
      "rumin-marble-market-tribune:collector-foil",
      "rumin-rumie-vault-shield:collector-foil",
      "rumin-imperial-scale-pike:collector-foil"
    ])
  })
});

function cleanText(value, maxLength = 200) {
  return String(value || "").trim().slice(0, maxLength);
}

function hashExternalReference(value) {
  const reference = cleanText(value);
  if (!reference) throw new Error("A trusted external order or fulfillment reference is required.");
  return crypto.createHash("sha256").update(reference).digest("hex");
}

function deriveEntitlementId({ accountId, productId, issuanceSource, externalReference }) {
  const identity = [
    cleanText(issuanceSource, 80),
    cleanText(externalReference),
    cleanText(productId, 120),
    cleanText(accountId, 120)
  ];
  if (identity.some((value) => !value)) throw new Error("Complete fulfillment identity is required.");
  return `ce_${crypto.createHash("sha256").update(identity.join("\u001f")).digest("hex").slice(0, 40)}`;
}

function signPayload(payload, secret) {
  if (!cleanText(secret, 4096)) throw new Error("Collector entitlement signing is unavailable.");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function resolveCollectorEntitlementProduct(productId) {
  return PHYSICAL_COLLECTOR_PRODUCTS[cleanText(productId, 120)] || null;
}

function publicCollectorEntitlementProduct(product) {
  if (!product) return null;
  return {
    id: product.id,
    name: product.name,
    productType: product.productType,
    edition: product.edition,
    finish: product.finish,
    description: product.description,
    competitivePower: false,
    variantCount: product.variantIds.length,
    variants: product.variantIds.map((variantId) => {
      const variant = getCollectorVariantById(variantId);
      return variant ? {
        variantId: variant.variantId,
        gameplayCardId: variant.gameplayCardId,
        name: variant.name,
        edition: variant.edition,
        finish: variant.finish,
        frame: variant.frame,
        border: variant.border
      } : { variantId };
    })
  };
}

function validateCollectorEntitlementProducts() {
  for (const product of Object.values(PHYSICAL_COLLECTOR_PRODUCTS)) {
    if (product.productType !== PHYSICAL_COLLECTOR_PRODUCT_TYPE) throw new Error(`Invalid physical collector product ${product.id}.`);
    if (!product.collectorPackId || !product.variantIds.length) throw new Error(`Physical collector product ${product.id} has no collector mapping.`);
    for (const variantId of product.variantIds) {
      const variant = getCollectorVariantById(variantId);
      if (!variant || !variant.paid || variant.acquisition !== PAID_COLLECTOR_ACQUISITION) {
        throw new Error(`Physical collector product ${product.id} references invalid collector variant ${variantId}.`);
      }
    }
  }
  return true;
}

validateCollectorEntitlementProducts();

function issueCollectorEntitlement(input, secret, now = Date.now()) {
  const accountId = cleanText(input?.accountId, 120);
  const productId = cleanText(input?.productId, 120);
  const issuanceSource = cleanText(input?.issuanceSource, 80);
  const externalReference = cleanText(input?.externalReference);
  const product = resolveCollectorEntitlementProduct(productId);
  if (!accountId) throw new Error("A Gauntlet account ID is required.");
  if (!product) throw new Error("Unknown physical collector product.");
  if (!COLLECTOR_ENTITLEMENT_SOURCES.has(issuanceSource)) throw new Error("Unknown collector fulfillment source.");
  const issuedAt = new Date(now).toISOString();
  if (!Number.isFinite(Date.parse(issuedAt))) throw new Error("Invalid entitlement issue time.");
  const expiresAt = input?.expiresAt ? new Date(input.expiresAt).toISOString() : null;
  if (expiresAt && Date.parse(expiresAt) <= now) throw new Error("Entitlement expiration must be after issuance.");
  const payload = {
    schemaVersion: COLLECTOR_ENTITLEMENT_SCHEMA_VERSION,
    entitlementId: deriveEntitlementId({ accountId, productId, issuanceSource, externalReference }),
    accountId,
    productId,
    productType: product.productType,
    issuanceSource,
    externalReferenceHash: hashExternalReference(externalReference),
    issuedAt,
    expiresAt
  };
  return { payload, token: signPayload(payload, secret) };
}

function invalidVerification(code, message) {
  return { valid: false, code, message };
}

function verifyCollectorEntitlement(token, secret, now = Date.now()) {
  if (!token || typeof token !== "string" || token.length > 8192) return invalidVerification("MALFORMED_ENTITLEMENT", "Malformed collector entitlement.");
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return invalidVerification("MALFORMED_ENTITLEMENT", "Malformed collector entitlement.");
  const [body, signature] = parts;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
    return invalidVerification("INVALID_ENTITLEMENT", "Collector entitlement signature is invalid.");
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    const requiredText = [
      payload.schemaVersion,
      payload.entitlementId,
      payload.accountId,
      payload.productId,
      payload.productType,
      payload.issuanceSource,
      payload.externalReferenceHash,
      payload.issuedAt
    ];
    if (requiredText.some((value) => typeof value !== "string" || !value)) {
      return invalidVerification("MALFORMED_ENTITLEMENT", "Collector entitlement payload is incomplete.");
    }
    if (payload.schemaVersion !== COLLECTOR_ENTITLEMENT_SCHEMA_VERSION || payload.productType !== PHYSICAL_COLLECTOR_PRODUCT_TYPE) {
      return invalidVerification("UNSUPPORTED_ENTITLEMENT", "Collector entitlement version is not supported.");
    }
    if (!COLLECTOR_ENTITLEMENT_SOURCES.has(payload.issuanceSource)) {
      return invalidVerification("UNSUPPORTED_ENTITLEMENT", "Collector entitlement source is not supported.");
    }
    const issuedAt = Date.parse(payload.issuedAt);
    if (!Number.isFinite(issuedAt) || issuedAt > now + 60 * 1000) {
      return invalidVerification("MALFORMED_ENTITLEMENT", "Collector entitlement issue time is invalid.");
    }
    if (payload.expiresAt != null) {
      const expiresAt = Date.parse(payload.expiresAt);
      if (!Number.isFinite(expiresAt)) return invalidVerification("MALFORMED_ENTITLEMENT", "Collector entitlement expiration is invalid.");
      if (expiresAt <= now) return invalidVerification("EXPIRED_ENTITLEMENT", "Collector entitlement has expired.");
    }
    return { valid: true, payload };
  } catch (_error) {
    return invalidVerification("MALFORMED_ENTITLEMENT", "Malformed collector entitlement.");
  }
}

module.exports = {
  COLLECTOR_ENTITLEMENT_SCHEMA_VERSION,
  COLLECTOR_ENTITLEMENT_SOURCES,
  COLLECTOR_REDEMPTION_RECEIPT_VERSION,
  PHYSICAL_COLLECTOR_PRODUCT_TYPE,
  PHYSICAL_COLLECTOR_PRODUCTS,
  deriveEntitlementId,
  hashExternalReference,
  issueCollectorEntitlement,
  publicCollectorEntitlementProduct,
  resolveCollectorEntitlementProduct,
  validateCollectorEntitlementProducts,
  verifyCollectorEntitlement
};
