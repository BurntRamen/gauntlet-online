-- Checkout intents, verified inbox and fulfillment evidence share the currency
-- transaction boundary. No mutable payment status or balance cache.
BEGIN IMMEDIATE;
CREATE TABLE gold_payment_intents(id TEXT PRIMARY KEY REFERENCES gold_quotes(id), account_id TEXT NOT NULL, body TEXT NOT NULL CHECK(json_valid(body)));
CREATE INDEX gold_payment_intents_account ON gold_payment_intents(account_id);
CREATE TABLE gold_payment_checkouts(id TEXT PRIMARY KEY REFERENCES gold_payment_intents(id), provider_ref TEXT NOT NULL UNIQUE, body TEXT NOT NULL CHECK(json_valid(body)));
CREATE TABLE gold_payment_events(id TEXT PRIMARY KEY, intent_id TEXT NOT NULL REFERENCES gold_payment_intents(id), body TEXT NOT NULL CHECK(json_valid(body)));
CREATE INDEX gold_payment_events_intent ON gold_payment_events(intent_id);
CREATE TABLE gold_payment_settlements(id TEXT PRIMARY KEY REFERENCES gold_payment_events(id), intent_id TEXT NOT NULL REFERENCES gold_payment_intents(id), body TEXT NOT NULL CHECK(json_valid(body)));
CREATE INDEX gold_payment_settlements_intent ON gold_payment_settlements(intent_id);
CREATE TABLE gold_payment_commands(id TEXT PRIMARY KEY, intent_id TEXT NOT NULL REFERENCES gold_payment_intents(id), body TEXT NOT NULL CHECK(json_valid(body)));
CREATE TABLE gold_payment_actions(id TEXT PRIMARY KEY REFERENCES gold_payment_commands(id), body TEXT NOT NULL CHECK(json_valid(body)));
PRAGMA user_version=4;
COMMIT;
