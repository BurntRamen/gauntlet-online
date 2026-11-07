import surfaces from "../../../shared/admin/websiteSurfaces.json";
import WorkshopShell from "./WorkshopShell";

const titleKey = surface => `${surface.id}PageTitle`;
export default function WebsiteProseWorkshop({ state, field, preview, target, onTarget, context, onContext, busy, onReview }) {
  const domains = (state.draft?.snapshot || state.live).domains;
  const entries = [...surfaces.map(surface => ({ ...surface, fields: [titleKey(surface), `${surface.id}PageDescription`] })), ...domains.game.filter(row => row.id !== "shared-rules").map(row => ({ id: `mode-${row.id}`, owner: row.id, name: `${row.name} · mode copy`, fields: Object.keys(state.fields.game[row.id]).filter(key => !key.includes("Page")) }))];
  const selected = entries.find(entry => target.field && entry.owner === target.id && entry.fields.includes(target.field)) || entries.find(entry => entry.owner === target.id && entry.id === target.section) || entries.find(entry => entry.owner === target.id) || entries[0];
  const query = context?.query || "", row = domains.game.find(row => row.id === selected?.owner);
  const visible = entries.filter(entry => `${entry.name} ${entry.owner}`.toLowerCase().includes(query.toLowerCase()));
  const values = row && Object.fromEntries(selected.fields.map(key => [key, row[key] ?? state.fields.game[row.id]?.[key]?.defaultValue]));
  return <WorkshopShell busy={busy} name="Website prose" title={selected?.name} selectionId={selected?.id} actions={<button disabled={busy} onClick={onReview}>Review release</button>}
    search={<label className="admin-search">Find a website surface<input type="search" value={query} onChange={event => onContext({ query: event.target.value })} placeholder="Play, profile, mode…" /></label>}
    list={<div className="admin-object-list">{visible.map(entry => <button key={entry.id} disabled={busy} aria-pressed={entry.id === selected?.id} onClick={() => onTarget({ domain: "modes", id: entry.owner, section: entry.id })}><strong>{entry.name}</strong><small>{entry.id.startsWith("mode-") ? "Mode labels and focused setup" : `/${entry.id} · page header`}</small></button>)}{!visible.length && <p>No matching website surfaces.</p>}</div>}>
    {row && <><p className="admin-note">Text changes join the shared draft. They become visible after publication. Navigation and action names remain consistent across the game.</p>{selected.id.startsWith("mode-") && preview ? preview : <section className="admin-preview" aria-label="Saved prose preview"><small>Saved preview · {selected.name}</small><h3>{values[titleKey(selected)] || values.heroTitle || values.name}</h3><p>{values[`${selected.id}PageDescription`] || values.heroDescription || values.description}</p></section>}{selected.fields.map(key => field(key, { domain: "game", row }))}</>}
  </WorkshopShell>;
}
