"use strict";
const fs = require("node:fs"), path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
// Local operator tool. VACUUM INTO captures a consistent SQLite snapshot,
// including committed WAL data; it never copies only the live main file.
function backupGoldLedger(source, destination) {
  if (!source || !destination) throw new Error("Usage: node scripts/backup-gold-ledger.js <economy.sqlite> <new-backup.sqlite>");
  const from = path.resolve(source), to = path.resolve(destination);
  if (!fs.statSync(from).isFile() || from === to || fs.existsSync(to)) throw new Error("Use an existing ledger and a new, distinct backup path.");
  const db = new DatabaseSync(from);
  try {
    if (![1, 2].includes(db.prepare("PRAGMA user_version").get().user_version) || !db.prepare("SELECT name FROM sqlite_master WHERE name='gold_transactions'").get()) throw new Error("Expected a supported Gold ledger.");
    db.exec("PRAGMA busy_timeout=10000"); db.prepare("VACUUM INTO ?").run(to);
    const copy = new DatabaseSync(to, { readOnly: true });
    try { if (copy.prepare("PRAGMA integrity_check").get().integrity_check !== "ok") throw new Error("Backup integrity check failed."); } finally { copy.close(); }
    return to;
  } finally { db.close(); }
}
if (require.main === module) { try { console.log(backupGoldLedger(process.argv[2], process.argv[3])); } catch (e) { console.error(e.message); process.exitCode = 1; } }
module.exports = { backupGoldLedger };
