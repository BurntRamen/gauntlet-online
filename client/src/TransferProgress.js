import { useSyncExternalStore } from "react";

const active = new Map();
const listeners = new Set();
const notify = () => listeners.forEach(listener => listener());
const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener); };

export function TransferProgress({ scope }) {
  const snapshot = () => Array.from(active.values()).find(item => item.scope === scope);
  const item = useSyncExternalStore(subscribe, snapshot);
  if (!item) return null;
  const { loaded, total, seconds } = item;
  return <div role="status" className="transfer-progress">
    <progress className="sf-load-bar" aria-label="Download progress" value={total ? loaded : undefined} max={total || 1} />
    {total ? `${Math.floor(100 * loaded / total)}% downloaded${seconds == null ? "" : ` · about ${seconds}s remaining`}` :
      loaded ? `${Math.ceil(loaded / 1024)} KB downloaded` : "Waiting for server…"}
  </div>;
}

// Native progress events report byte counts in the same units for both operands.
export function trackedGet(scope, url, options = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    Object.entries(options.headers || {}).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    const abort = () => xhr.abort();
    let firstTime, firstBytes;
    function finish(callback) {
      active.delete(xhr); notify();
      options.signal?.removeEventListener("abort", abort);
      callback();
    }
    xhr.onprogress = ({ loaded, total, lengthComputable }) => {
      const now = performance.now();
      if (firstTime == null) { firstTime = now; firstBytes = loaded; }
      const elapsed = (now - firstTime) / 1000;
      const seconds = lengthComputable && elapsed >= .5 && loaded > firstBytes
        ? Math.ceil((total - loaded) * elapsed / (loaded - firstBytes)) : null;
      active.set(xhr, { scope, loaded, total: lengthComputable ? total : 0, seconds }); notify();
    };
    xhr.onload = () => finish(() => resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, json: async () => JSON.parse(xhr.responseText) }));
    if (scope === "admin") xhr.timeout = 120000;
    xhr.ontimeout = () => finish(() => reject(new Error("The server timed out. Retry when the connection recovers.")));
    xhr.onerror = () => finish(() => reject(new Error("The server could not be reached.")));
    xhr.onabort = () => finish(() => reject(new DOMException("Request aborted", "AbortError")));
    if (options.signal?.aborted) { reject(new DOMException("Request aborted", "AbortError")); return; }
    options.signal?.addEventListener("abort", abort, { once: true });
    active.set(xhr, { scope, loaded: 0, total: 0 }); notify();
    xhr.send();
  });
}

const accessRequests = new Map();
export function checkAdminAccess(serverUrl, token) {
  const key = JSON.stringify([serverUrl, token]);
  if (!accessRequests.has(key)) {
    const request = trackedGet("admin", serverUrl + "/api/admin/access", { headers: { Authorization: "Bearer " + token } });
    accessRequests.set(key, request.finally(() => accessRequests.delete(key)));
  }
  return accessRequests.get(key);
}
