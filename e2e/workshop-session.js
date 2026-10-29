const fs = require("node:fs"), path = require("node:path");
function workshopSession(key) {
  const sessions = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../.playwright-data/slot-workshop/sessions.json"), "utf8"));
  if (!sessions[key]) throw new Error("Missing isolated workshop session: " + key);
  return sessions[key];
}
module.exports = { workshopSession };

