"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
function read(file) {
  if (!fs.existsSync(file)) return { accounts: [], revision: 0 };
  const value = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(value.accounts)) throw new Error("Account storage is invalid; refusing to overwrite it.");
  return { accounts: value.accounts, revision: value.revision || 0 };
}
function save(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let lock;
  try { lock = fs.openSync(`${file}.lock`, "wx"); }
  catch (error) { if (error.code === "EEXIST") throw Object.assign(new Error("Account storage is busy. Retry the same request."), { status: 409 }); throw error; }
  const temp = `${file}.${crypto.randomUUID()}.tmp`;
  try {
    const current = read(file);
    if ((value.revision || 0) !== current.revision) throw Object.assign(new Error("Account data changed. Refresh and retry; no changes were saved."), { status: 409 });
    const next = { ...value, revision: current.revision + 1 };
    const fd = fs.openSync(temp, "wx");
    try { fs.writeFileSync(fd, JSON.stringify(next)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(temp, file);
    value.revision = next.revision;
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
    fs.closeSync(lock); fs.unlinkSync(`${file}.lock`);
  }
}
module.exports = { read, save };
