import { createContext, useCallback, useContext, useState } from "react";

const defaults = { density: "comfortable", preview: null, focus: false, pinned: [], recent: [], filters: {}, task: null };
const Context = createContext(null);
const identity = target => `${target.domain || target.area}:${target.id || ""}`;
function read(scope) {
  if (!scope) return defaults;
  try {
    const previous = sessionStorage.getItem("gauntlet-admin-operator");
    // Recents and filters can disclose private draft identities. Clear them
    // when another account/environment takes over this browser session.
    if (previous && previous !== scope) localStorage.removeItem(`gauntlet-admin:${previous}`);
    sessionStorage.setItem("gauntlet-admin-operator", scope);
    const saved = JSON.parse(localStorage.getItem(`gauntlet-admin:${scope}`) || "null");
    const safeItems = value => Array.isArray(value) ? value.filter(item => item && typeof item.domain === "string" && typeof item.id === "string" && typeof item.name === "string").map(item => ({ domain: item.domain.slice(0, 60), id: item.id.slice(0, 240), name: item.name.slice(0, 180) })) : [];
    const filters = Object.fromEntries(Object.entries(saved?.filters || {}).filter(([, value]) => value && typeof value === "object").map(([domain, values]) => [domain, Object.fromEntries(Object.entries(values).filter(([key, value]) => ["query", "campaign", "sort", "faction", "type"].includes(key) && typeof value === "string" && value.length <= 240))]));
    const task = typeof saved?.task?.id === "string" && /^[a-z-]{1,30}$/.test(saved.task.id) ? { id: saved.task.id, root: typeof saved.task.root === "string" ? saved.task.root.slice(0, 240) : null } : null;
    return saved?.version === 1 ? { ...defaults, density: saved.density === "compact" ? "compact" : "comfortable", preview: typeof saved.preview === "boolean" ? saved.preview : null, focus: saved.focus === true, pinned: safeItems(saved.pinned).slice(0, 12), recent: safeItems(saved.recent).slice(0, 8), filters, task } : defaults;
  } catch { return defaults; }
}
export function OperatorPreferences({ scope, children }) {
  const [preferences, setPreferences] = useState(() => read(scope));
  const update = useCallback(patch => setPreferences(previous => {
    const next = { ...previous, ...(typeof patch === "function" ? patch(previous) : patch) };
    if (scope) try { localStorage.setItem(`gauntlet-admin:${scope}`, JSON.stringify({ ...next, version: 1 })); } catch { /* Blocked storage keeps preferences usable for this session. */ }
    return next;
  }), [scope]);
  const remember = useCallback(target => {
    if (!target?.id || !target.name) return;
    const item = { domain: target.domain, id: target.id, name: target.name };
    update(p => ({ recent: [item, ...p.recent.filter(row => identity(row) !== identity(item))].slice(0, 8) }));
  }, [update]);
  const togglePin = target => update(p => ({ pinned: p.pinned.some(row => identity(row) === identity(target)) ? p.pinned.filter(row => identity(row) !== identity(target)) : [...p.pinned, target].slice(-12) }));
  return <Context.Provider value={{ preferences, update, remember, togglePin, isPinned: target => preferences.pinned.some(row => identity(row) === identity(target)), reset: () => update(previous => ({ ...defaults, task: previous.task })) }}>{children}</Context.Provider>;
}
export function useOperatorPreferences() { return useContext(Context); }
