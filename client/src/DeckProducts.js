import { useEffect, useState } from "react";
import DeckOfferCard from "./DeckOfferCard";
import "./DeckProducts.css";

export default function DeckProducts({ endpoint, token, accountId, onAccount, balance }) {
  const key = `gauntlet_deck_purchase_${accountId}`;
  const [data, setData] = useState(null), [error, setError] = useState(""), [pending, setPending] = useState(false), [receipt, setReceipt] = useState(null), [history, setHistory] = useState([]);
  const [quote, setQuote] = useState(() => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } });
  const [attempted, setAttempted] = useState(!!quote);
  async function request(path, body) {
    const response = await fetch(`${endpoint}/api/economy/${path}`, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, ...(body ? { method: "POST", body: JSON.stringify(body) } : {}) });
    const result = await response.json(); if (!response.ok) throw Object.assign(new Error(result.error || "Request failed."), { purchaseRejected: result.purchaseRejected === true }); return result;
  }
  useEffect(() => {
    let active = true;
    Promise.all([request("deck-products"), request("deck-receipts")]).then(([products, receipts]) => { if (active) { setData(products); setHistory(receipts.receipts); } }).catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, token, accountId]);
  const product = data?.offers.find(offer => offer.id === quote?.offerId && offer.revision === quote?.revision);
  async function purchase() {
    setPending(true); setError(""); setAttempted(true);
    try {
      // Retain the same key across a lost response or tab refresh.
      localStorage.setItem(key, JSON.stringify(quote));
      const result = await request("buy-deck-product", quote);
      setReceipt(result.receipt); onAccount(result.account); setHistory(current => [result.receipt, ...current.filter(row => row.requestId !== result.receipt.requestId)]);
      localStorage.removeItem(key); setQuote(null);
    } catch (error) {
      if (error.purchaseRejected) {
        localStorage.removeItem(key); setAttempted(false); setQuote(null);
        setError(`${error.message} No payment was taken. Review the current offer before trying again.`);
        try { setData(await request("deck-products")); } catch { /* Retain the existing error and offer until refresh. */ }
      } else setError(`${error.message} Retry uses the same purchase request and cannot charge it twice.`);
    }
    finally { setPending(false); }
  }
  return <section aria-label="Deck products"><h3>Deck products</h3><p>Recipes and cosmetics. All legal gameplay cards are available in ranked and constructed events; Draft and Sealed use their generated pools.</p>{error && <p role="alert">{error}</p>}{data && !data.capability.ready && <p role="status">{data.capability.reason} Purchases are unavailable.</p>}{!data ? <p>Loading products…</p> : !data.offers.length ? <p>No deck products are currently published.</p> : data.offers.map(offer => <DeckOfferCard key={offer.id} offer={offer} manifest={data} balance={balance} pending={pending || !!quote || !data.capability.ready} onBuy={(offer, currency) => { setAttempted(false); setReceipt(null); setQuote({ offerId: offer.id, revision: offer.revision, currency, requestId: crypto.randomUUID() }); }} />)}
    {quote && <section className="deck-purchase-confirm" aria-label="Confirm deck purchase" tabIndex={-1}><h4>{attempted ? "Resume purchase" : "Review purchase"}</h4>{product ? <><p>{product.name} · {product.prices[quote.currency]} {quote.currency}</p><p>{product.terms.savedDeck}</p><p>{product.terms.duplicates}</p></> : <p>These terms are no longer listed. A retry returns an existing receipt or rejects the purchase without charging.</p>}<button disabled={pending || !data?.capability.ready} onClick={purchase}>{attempted ? "Retry same purchase" : "Confirm purchase"}</button>{!attempted && <button disabled={pending} onClick={() => setQuote(null)}>Keep browsing</button>}</section>}
    {receipt && <p role="status">Purchased {receipt.template.name}. A separate deck is active in your library; your previous deck is retained.</p>}
    {!!history.length && <details><summary>Your deck purchase receipts</summary>{history.map(row => <p key={row.requestId}>{row.template.name} · {row.price} {row.currency} · {new Date(row.purchasedAt).toLocaleString()} · Recipe {row.template.revision.slice(0, 12)}</p>)}</details>}
  </section>;
}
