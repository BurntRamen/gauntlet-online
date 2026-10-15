"use strict";
const { runtimeStorageConfig } = require("../server/runtimeStorage");
const { createBackupStorage, createRuntimeBackupService, restoreBackup } = require("../server/runtimeBackups");
async function main([command, key, destination]) {
  const storage = createBackupStorage({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY });
  if (command === "create") return createRuntimeBackupService({ config: runtimeStorageConfig(), storage }).run();
  if (command === "list") return storage.list(Number(key) || 0);
  if (command === "restore") return restoreBackup(key, await storage.get(key), destination);
  throw new Error("Usage: node scripts/runtime-backup.js create | list [offset] | restore <object-key> <new-absolute-directory>");
}
if (require.main === module) main(process.argv.slice(2)).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { main };
