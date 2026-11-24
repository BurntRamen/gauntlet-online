// The caller supplies the server and account scope only after server authorization.
let database;
function openWorkspace() {
  if (!database) {
    database = new Promise((resolve, reject) => {
      const open = indexedDB.open("suitfire-authoring-v1", 1);
      open.onupgradeneeded = () => open.result.createObjectStore("workspace");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        db.onversionchange = () => { db.close(); database = undefined; };
        resolve(db);
      };
    }).catch(error => { database = undefined; throw error; });
  }
  return database;
}

export async function readCopy(scope, part = "draft") {
  if (!scope) return null;
  const db = await openWorkspace();
  return new Promise((resolve, reject) => {
    const read = db.transaction("workspace").objectStore("workspace").get([scope, part]);
    read.onsuccess = () => resolve(read.result || null);
    read.onerror = () => reject(read.error);
  });
}

export async function writeCopy(scope, part, entry) {
  if (!scope) return;
  const db = await openWorkspace();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("workspace", "readwrite");
    const store = tx.objectStore("workspace");
    const key = [scope, part];
    const read = store.get(key);
    read.onsuccess = () => {
      if (!read.result || read.result.revision <= entry.revision) store.put(entry, key);
    };
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error("Local storage unavailable."));
  });
}

const prefix = scope => "suitfire-edit-v1:" + JSON.stringify(scope) + "/";
export function readFields(scope) {
  const values = {}, bases = {}, revisions = new Set();
  if (!scope) return { values, bases, revision: null };
  const start = prefix(scope);
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const name = localStorage.key(i);
      if (!name?.startsWith(start)) continue;
      const field = name.slice(start.length);
      const entry = JSON.parse(localStorage.getItem(name));
      if (!entry || typeof entry.value !== "string" || !Number.isSafeInteger(entry.revision)) continue;
      values[field] = entry.value;
      bases[field] = entry.base;
      revisions.add(entry.revision);
    }
  } catch { /* In restricted browsers the current tab still supports editing. */ }
  return { values, bases, revision: revisions.size > 1 ? -1 : revisions.values().next().value ?? null };
}

export function rememberField(scope, field, base, value, revision) {
  if (scope) localStorage.setItem(prefix(scope) + field, JSON.stringify({ base, value, revision }));
}

export function forgetField(scope, field, previous) {
  if (!scope) return;
  const key = prefix(scope) + field;
  if (JSON.parse(localStorage.getItem(key))?.value === previous) localStorage.removeItem(key);
}
