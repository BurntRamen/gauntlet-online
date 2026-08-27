import { useEffect, useState } from "react";
import { resolveVisualAsset } from "./GauntletVisuals";
import "./CollectorClaimScreen.css";

async function readJson(response) {
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || "Collector claim could not be loaded.");
    error.code = data.code || "";
    throw error;
  }
  return data;
}

export default function CollectorClaimScreen({
  token,
  serverUrl,
  account,
  authToken,
  authMode,
  authForm,
  authError,
  onAuthModeChange,
  onAuthFormChange,
  onSubmitAuth,
  onSignOut,
  onAccountUpdated,
  onOpenCollection,
  onDismiss
}) {
  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");

  useEffect(() => {
    if (!account || !authToken || !token) {
      setClaim(null);
      setLoading(false);
      setError("");
      setErrorCode("");
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError("");
    setErrorCode("");
    fetch(`${serverUrl}/api/collection/collector-entitlement/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ token })
    })
      .then(readJson)
      .then((data) => active && setClaim(data))
      .catch((previewError) => {
        if (!active) return;
        setError(previewError.message);
        setErrorCode(previewError.code || "");
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [account, authToken, serverUrl, token]);

  async function redeem() {
    if (!authToken || redeeming) return;
    setRedeeming(true);
    setError("");
    try {
      const response = await fetch(`${serverUrl}/api/collection/collector-entitlement/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ token })
      });
      const data = await readJson(response);
      setClaim(data);
      if (data.account) onAccountUpdated(data.account);
    } catch (redeemError) {
      setError(redeemError.message);
      setErrorCode(redeemError.code || "");
    } finally {
      setRedeeming(false);
    }
  }

  const alreadyRedeemed = claim?.status === "already-redeemed";
  const variants = claim?.grantedVariants?.length
    ? claim.grantedVariants
    : claim?.receipt?.grantedVariantIds?.map((variantId) => (
        claim.product?.variants?.find((variant) => variant.variantId === variantId) || { variantId, name: variantId }
      )) || claim?.product?.variants || [];

  return (
    <main className="collector-claim-page">
      <section className="collector-claim-card" aria-labelledby="collector-claim-title">
        <div className="collector-claim-kicker">Physical-to-Digital Collector Bridge</div>
        <h1 id="collector-claim-title">Account-Bound Collector Claim</h1>
        <p className="collector-claim-power">Collector presentation only. This reward never grants cards, copies, values, abilities, legal actions, or competitive power.</p>

        {!account && (
          <section className="collector-claim-auth" aria-label="Sign in to continue collector claim">
            <h2>Sign in to continue</h2>
            <p>This non-transferable claim remains in this link and will continue after authentication.</p>
            <form onSubmit={(event) => { event.preventDefault(); onSubmitAuth(); }}>
              <input
                value={authForm.name}
                onChange={(event) => onAuthFormChange({ ...authForm, name: event.target.value })}
                placeholder="Account name"
                autoComplete="username"
              />
              <input
                value={authForm.password}
                onChange={(event) => onAuthFormChange({ ...authForm, password: event.target.value })}
                placeholder="Password"
                type="password"
                autoComplete={authMode === "register" ? "new-password" : "current-password"}
              />
              {authError && <p role="alert">{authError}</p>}
              <div className="collector-claim-actions">
                <button type="submit">{authMode === "register" ? "Create Account" : "Sign In"}</button>
                <button type="button" className="secondary" onClick={() => onAuthModeChange(authMode === "register" ? "login" : "register")}>
                  {authMode === "register" ? "Use Existing Account" : "Make Account"}
                </button>
              </div>
            </form>
          </section>
        )}

        {account && loading && <p role="status">Checking the signed entitlement...</p>}

        {account && error && (
          <section className="collector-claim-error" role="alert">
            <h2>{errorCode === "ENTITLEMENT_ACCOUNT_MISMATCH" ? "Bound to another account" : "Claim unavailable"}</h2>
            <p>{error}</p>
            {errorCode === "ENTITLEMENT_ACCOUNT_MISMATCH" && <button type="button" onClick={onSignOut}>Sign Out</button>}
          </section>
        )}

        {account && claim && (
          <>
            <section className="collector-claim-summary">
              <span>{alreadyRedeemed ? "Already redeemed" : "Ready to redeem"}</span>
              <h2>{claim.product.name}</h2>
              <p>{claim.product.description}</p>
              <dl>
                <div><dt>Bound account</dt><dd>{claim.boundAccount.name}</dd></div>
                <div><dt>Reward</dt><dd>{claim.product.variantCount} collector variants</dd></div>
                <div><dt>Edition</dt><dd>{claim.product.edition}</dd></div>
                <div><dt>Finish</dt><dd>{claim.product.finish}</dd></div>
              </dl>
            </section>

            {alreadyRedeemed ? (
              <p className="collector-claim-confirmation" role="status">Already redeemed. These collector variants remain owned by {claim.boundAccount.name}.</p>
            ) : (
              <button type="button" className="collector-claim-redeem" disabled={redeeming} onClick={redeem}>
                {redeeming ? "Redeeming..." : "Redeem Collector Item"}
              </button>
            )}

            {(alreadyRedeemed || claim.alreadyRedeemed === false) && (
              <section className="collector-claim-rewards" aria-label="Collector rewards">
                <h2>Collector ownership confirmed</h2>
                <ul>
                  {variants.map((variant, index) => (
                    <li key={`${variant.variantId}-${index}`}>
                      {variant.art && <img src={resolveVisualAsset(variant.art)} alt="" loading="lazy" decoding="async" />}
                      <span className="collector-claim-reward-copy">
                        <strong>{variant.name || variant.variantId}</strong>
                        <small>{variant.edition || claim.product.edition} / {variant.finish || claim.product.finish}</small>
                      </span>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={onOpenCollection}>Open Collection</button>
              </section>
            )}
          </>
        )}

        <button type="button" className="collector-claim-dismiss" onClick={onDismiss}>Return to Gauntlet</button>
      </section>
    </main>
  );
}
