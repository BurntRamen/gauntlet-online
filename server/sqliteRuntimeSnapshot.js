"use strict";
const digest = require("./authoredContent").hash;
// Preserve the proven transaction/constraint implementation in an in-memory
// SQLite projection. PostgreSQL is the authority; no local file is recovery.
function createSqliteRuntimeSnapshot(db, prefix) {
  if (!["gold", "para"].includes(prefix)) throw new Error("Unsupported operational store.");
  const definitions = db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type,name").all();
  const tables = definitions.filter(row=>row.type==="table").map(row=>row.name);
  if (tables.some(name=>!new RegExp(`^${prefix}_[a-z_]+$`).test(name))) throw new Error("Unexpected operational table.");
  const schema = digest(definitions), version=db.prepare("PRAGMA user_version").get().user_version;
  const columns = Object.fromEntries(tables.map(name=>[name,db.prepare(`PRAGMA table_info(${name})`).all().map(row=>row.name)]));
  function snapshot() {
    return {schemaVersion:"gauntlet.sqlite-projection.v1",prefix,version,schema,tables:Object.fromEntries(tables.map(name=>[name,db.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all().map(row=>Object.fromEntries(columns[name].map(key=>[key,row[key]])))]))};
  }
  function restore(value) {
    if (!value || value.schemaVersion!=="gauntlet.sqlite-projection.v1" || value.prefix!==prefix || value.version!==version || value.schema!==schema || Object.keys(value.tables||{}).sort().join()!==tables.slice().sort().join()) throw new Error("Operational snapshot requires its compatible database schema.");
    if (tables.some(name=>db.prepare(`SELECT count(*) n FROM ${name}`).get().n)) throw new Error("Restore requires an empty operational projection.");
    db.exec("BEGIN IMMEDIATE; PRAGMA defer_foreign_keys=ON;");
    try {
      for (const table of tables) {
        if (!Array.isArray(value.tables[table])) throw new Error("Invalid operational records.");
        const keys=columns[table], statement=db.prepare(`INSERT INTO ${table}(${keys.join()}) VALUES(${keys.map(()=>"?").join()})`);
        for (const row of value.tables[table]) {
          if (!row || Object.keys(row).sort().join()!==keys.slice().sort().join() || Object.values(row).some(v=>v!==null && typeof v!=="string" && !(typeof v==="number" && Number.isSafeInteger(v)))) throw new Error("Invalid operational record fields.");
          statement.run(...keys.map(key=>row[key]));
        }
      }
      if (db.prepare("PRAGMA foreign_key_check").all().length || db.prepare("PRAGMA integrity_check").get().integrity_check!=="ok") throw new Error("Restored operational invariants failed.");
      if (digest(snapshot())!==digest(value)) throw new Error("Operational restore reconciliation failed.");
      db.exec("COMMIT");
    } catch(error) { db.exec("ROLLBACK"); throw error; }
    return {rows:Object.values(value.tables).reduce((sum,rows)=>sum+rows.length,0),sha256:digest(value)};
  }
  return {snapshot,restore};
}
module.exports={createSqliteRuntimeSnapshot,digest};
