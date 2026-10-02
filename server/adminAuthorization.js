"use strict";

// Two account identities, not roles. Both production IDs were verified against
// the live account directory (BurntRamen also by public profile, 2026-10-02).
// Other environments must pin their own IDs. Explicit empty slots deny access.
const SIMPLY_ACCOUNT_ID = "47d97ddb-65f9-4014-be92-9b677467d943";
const BURNT_RAMEN_ACCOUNT_ID = "9a9dcf5c-1d3f-422e-b0eb-ca1a32a699e5";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function createGauntletAdminAuthorization({ requireAccount, simplyId = SIMPLY_ACCOUNT_ID, burntRamenId = BURNT_RAMEN_ACCOUNT_ID }) {
  const allowedIds = new Set([simplyId, burntRamenId].filter((id) => UUID.test(id)));
  const isAllowed = (account) => !!account?.id && allowedIds.has(account.id);
  async function middleware(req, res, next) {
    res.set("Cache-Control", "private, no-store");
    try {
      // Do not accept owner headers or malformed variants of the account token.
      const header = req.get("authorization") || "";
      if (!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(header)) {
        res.status(401).json({ error: "Sign in with an authorized account." });
        return;
      }
      const context = await requireAccount(req, res);
      if (!context) return;
      if (!isAllowed(context.account)) {
        res.status(403).json({ error: "Gauntlet Admin is private. This account does not have access." });
        return;
      }
      req.gauntletAdminAccount = { id: context.account.id };
      next();
    } catch {
      res.status(503).json({ error: "Admin authorization is temporarily unavailable." });
    }
  }
  return { middleware, isAllowed, configuredAccounts: allowedIds.size };
}

module.exports = { createGauntletAdminAuthorization, SIMPLY_ACCOUNT_ID, BURNT_RAMEN_ACCOUNT_ID };
