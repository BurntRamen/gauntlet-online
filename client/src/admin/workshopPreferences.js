const KEY = "gauntlet.admin.workspace.v1";
// Device preferences contain navigation only, never local forms or credentials.
export function readWorkshopPreferences() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY));
    if (value?.version !== 1) return { contexts: {}, recent: [] };
    const contexts = Object.fromEntries(Object.entries(value.contexts || {}).filter(([, row]) => row && typeof row === "object").slice(0, 24));
    const recent = (Array.isArray(value.recent) ? value.recent : []).filter(row => row && typeof row.label === "string" && row.target && typeof row.target.domain === "string" && typeof row.target.id === "string").slice(0, 6);
    return { contexts, recent };
  }
  catch { return { contexts: {}, recent: [] }; }
}
export function saveWorkshopPreferences(contexts, target, label) {
  try {
    const safe = Object.fromEntries(Object.entries(contexts).slice(0, 24).map(([domain, value]) => [domain, {
      query: String(value.query || "").slice(0, 160), campaign: String(value.campaign || "").slice(0, 240),
      scroll: Number.isFinite(value.scroll) ? Math.max(0, Math.min(value.scroll, 100000)) : 0,
      ...(value.target ? { target: { domain: value.target.domain, id: value.target.id, section: value.target.section, field: value.target.field } } : {})
    }]));
    const old = readWorkshopPreferences();
    const recent = target.id && label ? [{ target: { domain: target.domain, id: target.id, section: target.section, field: target.field }, label: String(label).slice(0, 160) }, ...(Array.isArray(old.recent) ? old.recent : []).filter(row => row.target?.domain !== target.domain || row.target?.id !== target.id)].slice(0, 6) : old.recent;
    localStorage.setItem(KEY, JSON.stringify({ version: 1, contexts: safe, recent }));
  } catch { /* Storage-disabled browsers retain in-memory editing and navigation. */ }
}
