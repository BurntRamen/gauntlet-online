"use strict";
const { createBackupStorage } = require("../server/runtimeBackups");
async function prepare() {
  const credentials = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY };
  for (const bucket of ["gauntlet-runtime-backups", process.env.MATCH_ARCHIVE_BUCKET || "gauntlet-match-archives"]) {
    await createBackupStorage({ ...credentials, bucket }).ensureBucket();
  }
  return "Private runtime-backup and match-archive buckets are ready. Existing public buckets were not changed.";
}
if (require.main === module) prepare().then(console.log).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { prepare };
