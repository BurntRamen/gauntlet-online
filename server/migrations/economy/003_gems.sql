-- Distinct currency in the same authoritative transaction as Gold and grants.
-- Existing Gold/account records are retained; no Timetwister conversion/import.
BEGIN IMMEDIATE;
CREATE TABLE gold_gem_transactions(id TEXT PRIMARY KEY, account_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('funding','purchase','refund','funding-reversal','correction')),
  delta INTEGER NOT NULL CHECK(delta BETWEEN -1000000 AND 1000000),
  body TEXT NOT NULL CHECK(json_valid(body)));
CREATE INDEX gold_gem_transactions_account ON gold_gem_transactions(account_id,kind);
PRAGMA user_version=3;
COMMIT;
