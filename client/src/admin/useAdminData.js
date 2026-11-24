import { useEffect, useState } from "react";

// Each signed-in Studio owns a distinct request function. Only summary reads
// are reusable, and an explicit workspace refresh changes the revision.
const summaries = new WeakMap();
const reusablePaths = new Set(["/api/admin/home?view=tasks", "/api/admin/catalog"]);

function readSummary(request, path, revision) {
  let entries = summaries.get(request);
  if (!entries) {
    entries = new Map();
    summaries.set(request, entries);
  }
  const current = entries.get(path);
  if (current?.revision === revision && current.expires > Date.now()) return current.promise;
  const entry = { revision, expires: Infinity };
  entry.promise = request(path).then(data => {
    entry.data = data;
    entry.expires = path === "/api/admin/home?view=tasks" ? Infinity : Date.now() + 30000;
    return data;
  }, error => {
    if (entries.get(path) === entry) entries.delete(path);
    throw error;
  });
  entries.set(path, entry);
  return entry.promise;
}

export default function useAdminData(request, path, revision, enabled = true) {
  const [state, setState] = useState(null);
  const key = JSON.stringify([path, revision]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const read = reusablePaths.has(path) ? readSummary(request, path, revision) : request(path);
    read.then(data => { if (active) setState({ request, key, loading: false, data, error: "" }); }, error => { if (active) setState({ request, key, loading: false, data: null, error: error.message }); });
    return () => { active = false; };
  }, [request, path, revision, key, enabled]);
  if (enabled && state?.request === request && state.key === key) return state;
  const cached = enabled && summaries.get(request)?.get(path);
  if (cached && cached.revision === revision && cached.data && cached.expires > Date.now()) {
    return { loading: false, data: cached.data, error: "" };
  }
  return { loading: true, data: null, error: "" };
}
