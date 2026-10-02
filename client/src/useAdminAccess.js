import { useCallback, useEffect, useState } from "react";

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
    if (!authToken) return undefined;
    fetch(`${serverUrl}/api/admin/access`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then(async (response) => response.ok && (await response.json()).authorized === true)
      .then((authorized) => { if (active) setAuthorized(authorized); })
      .catch(() => { if (active) setAuthorized(false); });
    return () => { active = false; };
  }, [serverUrl, authToken, setAuthorized]);

  return [Boolean(authToken && approved?.authToken === authToken && approved.serverUrl === serverUrl), setAuthorized];
}
