const test = require("node:test");
const assert = require("node:assert/strict");

const originalFetch = global.fetch;

process.env.SUPABASE_URL = "https://gauntlet-collector-test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "collector-test-service-role";
process.env.OWNER_STATS_TOKEN = "collector-owner-test-token";
process.env.COLLECTOR_ENTITLEMENT_SECRET = "collector-entitlement-test-secret-at-least-thirty-two-characters";

const accounts = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Collector Alpha",
    name_key: "collector alpha",
    password_salt: "salt-a",
    password_hash: "hash-a",
    created_at: "2026-08-07T12:00:00.000Z",
    last_login_at: null,
    last_seen_at: null,
    stats: { collection: { cards: { "rumin-gilded-scale-legionary": 2 } } }
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Collector Beta",
    name_key: "collector beta",
    password_salt: "salt-b",
    password_hash: "hash-b",
    created_at: "2026-08-07T12:00:00.000Z",
    last_login_at: null,
    last_seen_at: null,
    stats: {}
  }
];
let patchCount = 0;

global.fetch = async (url, options = {}) => {
  const parsed = new URL(url);
  const endpoint = `${parsed.pathname}${parsed.search}`;
  if (endpoint.startsWith("/rest/v1/gauntlet_accounts?id=eq.")) {
    const id = decodeURIComponent(endpoint.match(/id=eq\.([^&]+)/)?.[1] || "");
    const account = accounts.find((entry) => entry.id === id);
    if ((options.method || "GET") === "PATCH") {
      patchCount += 1;
      Object.assign(account, JSON.parse(options.body));
      return new Response(null, { status: 204 });
    }
    return Response.json(account ? [structuredClone(account)] : []);
  }
  if (endpoint.startsWith("/rest/v1/gauntlet_accounts?name_key=eq.")) {
    const nameKey = decodeURIComponent(endpoint.match(/name_key=eq\.([^&]+)/)?.[1] || "");
    const account = accounts.find((entry) => entry.name_key === nameKey);
    return Response.json(account ? [structuredClone(account)] : []);
  }
  return Response.json({ code: "PGRST205", message: `Unexpected test endpoint: ${endpoint}` }, { status: 404 });
};

const {
  COLLECTOR_ENTITLEMENT_SCHEMA_VERSION,
  deriveEntitlementId,
  issueCollectorEntitlement,
  verifyCollectorEntitlement
} = require("../collectorEntitlements");
const { server, __test } = require("../index");

test.after(() => server.close());

function accountSession(row) {
  return __test.issueAccountSession({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    stats: structuredClone(row.stats)
  }).token;
}

async function post(port, pathname, body, token = "") {
  return originalFetch(`http://127.0.0.1:${port}${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
}

test("signs deterministic account-bound entitlements and rejects tampering, expiry, and malformed claims", () => {
  const now = Date.parse("2026-08-07T13:00:00.000Z");
  const input = {
    accountId: accounts[0].id,
    productId: "rumin-foundation-physical-box",
    issuanceSource: "physical-order",
    externalReference: "test-order-1001",
    expiresAt: "2026-08-08T13:00:00.000Z"
  };
  const first = issueCollectorEntitlement(input, process.env.COLLECTOR_ENTITLEMENT_SECRET, now);
  const second = issueCollectorEntitlement(input, process.env.COLLECTOR_ENTITLEMENT_SECRET, now + 1000);

  assert.equal(first.payload.schemaVersion, COLLECTOR_ENTITLEMENT_SCHEMA_VERSION);
  assert.equal(first.payload.entitlementId, second.payload.entitlementId);
  assert.equal(first.payload.entitlementId, deriveEntitlementId(input));
  assert.equal(first.payload.accountId, accounts[0].id);
  assert.equal(Object.prototype.hasOwnProperty.call(first.payload, "externalReference"), false);
  assert.equal(verifyCollectorEntitlement(first.token, process.env.COLLECTOR_ENTITLEMENT_SECRET, now + 1000).valid, true);

  const tampered = `${first.token.slice(0, -1)}${first.token.endsWith("a") ? "b" : "a"}`;
  assert.equal(verifyCollectorEntitlement(tampered, process.env.COLLECTOR_ENTITLEMENT_SECRET, now).code, "INVALID_ENTITLEMENT");
  assert.equal(verifyCollectorEntitlement(first.token, process.env.COLLECTOR_ENTITLEMENT_SECRET, Date.parse(input.expiresAt)).code, "EXPIRED_ENTITLEMENT");
  assert.equal(verifyCollectorEntitlement("unsigned-client-claim", process.env.COLLECTOR_ENTITLEMENT_SECRET, now).code, "MALFORMED_ENTITLEMENT");
  assert.throws(
    () => issueCollectorEntitlement({ ...input, productId: "unknown-product" }, process.env.COLLECTOR_ENTITLEMENT_SECRET, now),
    /Unknown physical collector product/
  );
});

test("trusted issuance and account JSONB redemption remain exactly once across sessions and runtime reset", async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const issueBody = {
    accountName: "Collector Alpha",
    productId: "rumin-foundation-physical-box",
    issuanceSource: "owner-manual-fulfillment",
    externalReference: "qualification-order-collector-alpha"
  };

  const forbiddenIssue = await post(port, "/api/admin/collector-entitlements/issue", issueBody);
  assert.equal(forbiddenIssue.status, 403);

  const issueResponse = await post(port, "/api/admin/collector-entitlements/issue", issueBody, process.env.OWNER_STATS_TOKEN);
  const issued = await issueResponse.json();
  const duplicateIssueResponse = await post(port, "/api/admin/collector-entitlements/issue", issueBody, process.env.OWNER_STATS_TOKEN);
  const duplicateIssued = await duplicateIssueResponse.json();
  assert.equal(issueResponse.status, 200);
  assert.equal(issued.entitlement.entitlementId, duplicateIssued.entitlement.entitlementId);
  assert.match(issued.claimUrl, /\?claim=/);
  assert.equal(issued.nonTransferable, true);

  const signedOutPreview = await post(port, "/api/collection/collector-entitlement/preview", { token: issued.token });
  assert.equal(signedOutPreview.status, 401);

  const alphaToken = accountSession(accounts[0]);
  const betaToken = accountSession(accounts[1]);
  const wrongAccount = await post(port, "/api/collection/collector-entitlement/preview", { token: issued.token }, betaToken);
  assert.equal(wrongAccount.status, 403);
  assert.equal((await wrongAccount.json()).code, "ENTITLEMENT_ACCOUNT_MISMATCH");

  const unsigned = await post(port, "/api/collection/collector-entitlement/redeem", { token: "client-created" }, alphaToken);
  assert.equal(unsigned.status, 400);
  assert.equal((await unsigned.json()).code, "MALFORMED_ENTITLEMENT");

  const [firstResponse, concurrentRetryResponse] = await Promise.all([
    post(port, "/api/collection/collector-entitlement/redeem", { token: issued.token }, alphaToken),
    post(port, "/api/collection/collector-entitlement/redeem", { token: issued.token }, alphaToken)
  ]);
  const first = await firstResponse.json();
  const concurrentRetry = await concurrentRetryResponse.json();
  assert.equal(firstResponse.status, 200);
  assert.equal(concurrentRetryResponse.status, 200);
  assert.deepEqual([first.alreadyRedeemed, concurrentRetry.alreadyRedeemed].sort(), [false, true]);
  assert.equal(patchCount, 1);
  assert.equal(first.grantedVariants.length, 8);
  assert.equal(Object.values(accounts[0].stats.collection.gameplayEntitlements).reduce((sum, count) => sum + count, 0), 2);
  assert.equal(Object.values(accounts[0].stats.collection.collectorVariants).reduce((sum, count) => sum + count, 0), 10);
  assert.equal(Object.keys(accounts[0].stats.collection.collectorRedemptionReceipts).length, 1);

  const refreshedSession = accountSession(accounts[0]);
  const previewAfterSignIn = await post(port, "/api/collection/collector-entitlement/preview", { token: issued.token }, refreshedSession);
  const preview = await previewAfterSignIn.json();
  assert.equal(preview.status, "already-redeemed");
  assert.equal(preview.receipt.grantedVariantIds.length, 8);

  __test.resetCollectorEntitlementRuntimeState();
  const afterReplacement = await post(port, "/api/collection/collector-entitlement/redeem", { token: issued.token }, refreshedSession);
  const replacementBody = await afterReplacement.json();
  assert.equal(replacementBody.alreadyRedeemed, true);
  assert.equal(patchCount, 1);
  assert.equal(Object.keys(accounts[0].stats.collection.collectorRedemptionReceipts).length, 1);
});
