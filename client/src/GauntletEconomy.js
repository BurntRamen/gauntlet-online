import {useHelp as useCreativeCopy} from "./admin/AuthoringHelp";
import { lazy, Suspense } from "react";
const Console = lazy(() => import(/* webpackChunkName: "gauntlet-admin-economy-shared" */ "./EconomyConsole"));
export default function GauntletEconomy({ tab, catalog = [], summary, preview, request }) {
  const creativeCopy=useCreativeCopy();

  return <><Suspense fallback={<p>Loading ledger…</p>}><Console request={request} admin /></Suspense>
    {["Overview", "Gold Awards"].includes(tab) && <section><h3 className="admin-section-heading">{creativeCopy.creativeGauntletEconomy1}</h3>{summary.map((row) => <p key={row.seasonId}>{row.seasonId}: catalog {row.catalogGold} · budget {row.budget} · maximum {row.maximumGold}{row.capped ? " (budget constrained)" : ""}</p>)}<p className="admin-note">{creativeCopy.creativeGauntletEconomy2}</p></section>}
    {preview && <section aria-label={creativeCopy.creativeGauntletEconomy3}><h3 className="admin-section-heading">{creativeCopy.creativeGauntletEconomy4}</h3><div className="admin-cards">{catalog.map((p) => <article key={p.id}><h4>{p.name}</h4><p>{p.description}</p><p>{p.price} · {p.status}</p><ul>{p.inclusions.map((text, i) => <li key={i}>{text}</li>)}</ul></article>)}</div></section>}
  </>;
}
