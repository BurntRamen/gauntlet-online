import { TransferProgress, trackedGet, checkAdminAccess } from "./TransferProgress";
import "./Studio.css";
import { brandText } from './brand/brandPreview';
import { useCallback, useEffect, useRef, useState } from "react";
import GauntletAdmin from "./GauntletAdmin";

export default function Studio({ serverUrl, authToken = "", onSignIn, onAuthorizedChange, onClose, exitGuard }) {
  const sessionRef = useRef("");
  const [authorizedToken, setAuthorizedToken] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  const authorizationListener = useRef(onAuthorizedChange);
  useEffect(() => { authorizationListener.current = onAuthorizedChange; }, [onAuthorizedChange]);

  const closeAdmin = useCallback(() => {
    sessionRef.current = "";
    setAuthorizedToken("");
    setOperatorId("");
    authorizationListener.current?.(false);
  }, []);

  useEffect(() => {
    let active = true;
    closeAdmin();
    setError("");
    if (!authToken) return undefined;
    setLoading(true);
    checkAdminAccess(serverUrl, authToken)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !body.authorized) throw new Error(body.error || "This account does not have admin access.");
        if (active) {
          sessionRef.current = authToken;
          setAuthorizedToken(authToken);
          setOperatorId(body.accountId);
          authorizationListener.current?.(true);
        }
      })
      .catch((failure) => { if (active) setError(failure.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; sessionRef.current = ""; };
  }, [authToken, serverUrl, closeAdmin, attempt]);

  const ownerRequest = useCallback(async (path, options = {}) => {
    const token = sessionRef.current;
    if (!token || token !== authToken) throw new Error("Sign in with an authorized account.");
    const readJson = !options.download && (!options.method || options.method === "GET");
    const send = readJson ? (url, init) => trackedGet("admin", url, init) : fetch;
    const response = await send(`${serverUrl}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}), Authorization: `Bearer ${token}` }
    });
    const body = options.download && response.ok ? await response.blob() : await response.json();
    if (sessionRef.current !== token) throw new Error("Admin session closed.");
    if (response.status === 401 || response.status === 403) closeAdmin();
    if (!response.ok) throw Object.assign(new Error(body.error || "Admin data is unavailable."), { status: response.status });
    if(options.download) {
      const url=URL.createObjectURL(body), link=document.createElement('a');
      link.href=url;link.download=options.download;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
    }
    return body;
  }, [authToken, closeAdmin, serverUrl]);

  if (!authorizedToken || authorizedToken !== authToken) {
    return (
      <section className="studio-gate" aria-labelledby="studio-gate-title">
        <span>{brandText("SuitFire Admin · private operations", "Gauntlet Admin · private operations")}</span>
        <h3 id="studio-gate-title">Private administration</h3>
        <p>Server-verified access for simply and Burnt Ramen.</p>
        {!authToken && <button onClick={onSignIn}>Sign in through Profile</button>}
        {authToken && loading && <TransferProgress scope="admin" />}
        {authToken && <button disabled={loading} onClick={() => setAttempt((value) => value + 1)}>{loading ? "Checking access…" : "Check admin access"}</button>}
        {onClose && <button onClick={onClose}>{brandText("Back to SuitFire", "Back to Gauntlet")}</button>}
        {error && <p className="studio-error" role="alert">{error}</p>}
      </section>
    );
  }

  return <><TransferProgress scope="admin" /><GauntletAdmin key={`${serverUrl}:${operatorId}`} operatorScope={operatorId ? `${serverUrl}:${operatorId}` : ""} environment={serverUrl} exitGuard={exitGuard} request={ownerRequest} onClose={onClose || closeAdmin} /></>;
}
