export default function ModuleHome({ data, onSelect }) {
  return <>
    <p className="admin-lede">Manage the game from saved definitions to verified player outcomes.</p>
    <div className="admin-counts">
      <button onClick={() => onSelect("Competition")}><strong>{data.seasons?.length ?? "—"}</strong><span>Season definitions</span></button>
      <button onClick={() => onSelect("Store & Economy")}><strong>{data.storefront.accountProducts === null ? "Unavailable" : data.storefront.accountProducts + data.storefront.digitalProducts}</strong><span>Published offers · runtime gates apply</span></button>
      <button onClick={() => onSelect("Players")}><strong>{data.players.seenLastDay ?? "Unavailable"}</strong><span>Recently seen in account sample</span></button>
      <button onClick={() => onSelect("Publishing")}><strong>{data.publication?.pending || (data.publication?.hasDraft ? "Review draft" : data.publication ? "Current" : "Unavailable")}</strong><span>Publishing</span></button>
    </div><p className="admin-note">{data.players.scope}</p>
    <h4>Needs attention</h4>{!data.tasks.length && <p>No outstanding tasks reported by the connected sources.</p>}
    <div className="admin-cards">{data.tasks.map((task, i) => <article key={i}><h5>{task.title}</h5><p>{task.message}</p><button onClick={() => onSelect(task.area)}>Open {task.area}</button></article>)}</div>
    <h4>Competition status</h4>{data.seasons.filter(season => season.seasonId || season.status === "active").map(season => <p key={season.id || season.seasonId}>{season.name || season.displayName} · {season.status}{season.runtimeEnabled === false ? " · runtime disabled" : ""}</p>)}{data.events.map(event => <article className="admin-source" key={event.id}><strong>{event.name}</strong><p>{event.availability.label}{event.schedule?.startsAt && ` · ${new Date(event.schedule.startsAt).toLocaleString()}`}</p></article>)}
    <h4>Recent purchases</h4><p className="admin-note">Latest deck and digital receipts in the account sample. Open Store & Economy for ledger evidence.</p>
    {data.purchases.length ? data.purchases.map(receipt => <p key={`${receipt.playerName}:${receipt.id || receipt.requestId}`}>{receipt.playerName} · {receipt.productName || receipt.offer?.name || receipt.offerId} · {receipt.price} {receipt.currency}</p>) : <p>No purchase receipts in this sample.</p>}
    <details><summary>Advanced · active content release</summary><code>{data.publication?.activeReleaseId || "Unavailable"}</code></details>
    <details><summary>Module capabilities</summary>{data.modules.map(module => <details className="admin-player-card" key={module.id}><summary>{module.name}<span>{module.status} · {module.implementation}</span></summary>
      <p>{module.boundary}</p><p>{module.consumer}</p><p>{module.activation}</p><button onClick={() => onSelect(module.area)}>Open {module.area}</button>
      <details><summary>Advanced · contract and evidence</summary><dl>{["source", "schema", "dependencies", "actions", "preview", "publication", "operations", "history", "tests"].map(key => <div key={key}><dt>{key}</dt><dd>{Array.isArray(module[key]) ? module[key].join(", ") : module[key]}</dd></div>)}</dl></details>
    </details>)}</details>
  </>;
}
