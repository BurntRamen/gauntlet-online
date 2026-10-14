import { lazy, Suspense } from "react";
const Console = lazy(() => import(/* webpackChunkName: "gauntlet-admin-economy-shared" */ "./EconomyConsole"));
export default function GauntletEconomy({ tab, catalog = [], summary, preview, request }) {
  return <><Suspense fallback={<p>Loading ledger…</p>}><Console request={request} admin /></Suspense>
    {["Overview", "Gold Awards"].includes(tab) && <section><h4>Proposed Gold issuance per eligible account</h4>{summary.map((row) => <p key={row.seasonId}>{row.seasonId}: catalog {row.catalogGold} · budget {row.budget} · maximum {row.maximumGold}{row.capped ? " (budget constrained)" : ""}</p>)}<p className="admin-note">Draft forecast; operational terms pin on first use.</p></section>}
    {preview && <section aria-label="Saved Para catalog preview"><h4>Saved catalog preview</h4><div className="admin-cards">{catalog.map((p) => <article key={p.id}><h4>{p.name}</h4><p>{p.description}</p><p>{p.price} · {p.status}</p><ul>{p.inclusions.map((text, i) => <li key={i}>{text}</li>)}</ul></article>)}</div></section>}
  </>;
}
