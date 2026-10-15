-- Imported Gold is independent of finite seasonal issuance. One immutable
-- opening entry per authoritative account; existing v1 transactions stay intact.
BEGIN IMMEDIATE;
CREATE TABLE gold_openings(id TEXT PRIMARY KEY, account_id TEXT NOT NULL UNIQUE, delta INTEGER NOT NULL CHECK(delta >= 0 AND delta <= 9007199254740991), body TEXT NOT NULL CHECK(json_valid(body)));
PRAGMA user_version=2;
COMMIT;
