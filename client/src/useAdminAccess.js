import { useCallback, useEffect, useState } from "react";

function clearPreviousWorkspace(nextScope) {
  try {
    const previous = sessionStorage.getItem("gauntlet-admin-operator");
    if (previous && previous !== nextScope) {
      localStorage.removeItem(`gauntlet-admin:${previous}`);
      sessionStorage.removeItem("gauntlet-admin-operator");
    }
  } catch { /* Storage restrictions must not affect server authorization. */ }
}

// This only discovers the navigation entry. Every Admin request is still
// authorized by the server, and Studio performs its own access check on entry.
export default function useAdminAccess(serverUrl, authToken) {
  const [approved, setApproved] = useState(null);
  const setAuthorized = useCallback((authorized) => {
    setApproved(authorized ? { serverUrl, authToken } : null);
  }, [serverUrl, authToken]);

  useEffect(() => {
    let active = true;
    setApproved(null);
    if (!authToken) { clearPreviousWorkspace(); return undefined; }
    fetch(`${serverUrl}/api/admin/access`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then(async response => {
        const access = response.ok ? await response.json() : null;
        if (!active) return;
        if (access?.authorized && access.accountId) clearPreviousWorkspace(`${serverUrl}:${access.accountId}`);
        else if (access?.authorized === false || [401, 403].includes(response.status)) clearPreviousWorkspace();
        setAuthorized(access?.authorized === true);
      })
      .catch(() => { if (active) setAuthorized(false); });
    return () => { active = false; };
  }, [serverUrl, authToken, setAuthorized]);

  return [Boolean(authToken && approved?.authToken === authToken && approved.serverUrl === serverUrl), setAuthorized];
}
