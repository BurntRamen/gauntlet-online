import surfaces from "../../../shared/admin/websiteSurfaces.json";
import WorkshopShell from "./WorkshopShell";
import PlayerPageHeader from "../navigation/PlayerPageHeader";
import { PrivateImage } from "./PrivateAsset";

export default function WebsiteProseWorkshop({ state, field, preview, target, onTarget, context, onContext, busy, onReview, onInspect, buffers = {} }) {
  const domains = (state.draft?.snapshot || state.live).domains;
  const entries = [...surfaces.map(surface => ({ ...surface, fields: ["Title", "Description", "Image"].map(part => `${surface.id}Page${part}`) })), ...domains.game.filter(row => row.id !== "shared-rules").map(row => ({ id: `mode-${row.id}`, owner: row.id, name: `${row.name} · mode copy`, fields: Object.keys(state.fields.game[row.id] || {}).filter(key => !key.includes("Page")) }))];
  const selected = entries.find(entry => target.field && entry.owner === target.id && entry.fields.includes(target.field)) || entries.find(entry => entry.owner === target.id && entry.id === target.section) || entries.find(entry => entry.owner === target.id) || entries[0];
  const query = context?.query || "", row = domains.game.find(row => row.id === selected?.owner);
  const visible = entries.filter(entry => `${entry.name} ${entry.owner}`.toLowerCase().includes(query.toLowerCase()));
  const value = key => buffers[`game:${row?.id}:${key}`] ?? row?.[key] ?? state.fields.game[row?.id]?.[key]?.defaultValue;
  const imageReference = value(`${selected.id}PageImage`);
  const image = state.assetLibrary?.find(asset => [asset.id, asset.source, asset.path].includes(imageReference))?.path || (buffers[`game:${row?.id}:${selected.id}PageImage`] === undefined ? state.previewContent?.manifest?.websiteProse?.[selected.id]?.image : undefined);
  const dirty = selected.fields.some(key => buffers[`game:${row?.id}:${key}`] !== undefined);
  return <WorkshopShell busy={busy} name="Website" title={selected?.name} selectionId={selected?.id} actions={<button disabled={busy} onClick={onReview}>Review release</button>}
    search={<label className="admin-search">Find a website surface<input type="search" value={query} onChange={event => onContext({ query: event.target.value })} placeholder="Play, profile, mode…" /></label>}
    list={<div className="admin-object-list">{visible.map(entry => <button key={entry.id} disabled={busy} aria-pressed={entry.id === selected?.id} onClick={() => onTarget({ domain: "modes", id: entry.owner, section: entry.id })}><strong>{entry.name}</strong><small>{entry.id.startsWith("mode-") ? "Mode labels and supporting copy" : `/${entry.id} · player page header`}</small></button>)}{!visible.length && <p>No matching website surfaces.</p>}</div>}>
    {row && <><p className="admin-note">Edit the registered player page. Save to the shared draft, then preview and publish from Publishing.</p>
      {selected.id.startsWith("mode-") && preview ? preview : <section className="admin-website-preview" aria-label="Website presentation preview"><div className="admin-panel-heading"><span>{dirty ? "Local preview · unsaved changes" : state.draft ? "Saved draft presentation" : "Live presentation"}</span><span>Player page header</span></div><div className="admin-player-stage"><PlayerPageHeader Image={PrivateImage} title={value(`${selected.id}PageTitle`) || value("heroTitle") || value("name")} description={value(`${selected.id}PageDescription`) || value("heroDescription") || value("description")} image={imageReference ? image : undefined} /></div><p className="admin-note">Uses the player’s actual header. This visual preview does not validate a release or run an engine test.</p></section>}
      {selected.fields.map(key => field(key, { domain: "game", row }))}
      <details className="admin-website-scope"><summary>Other website presentation</summary><p>Faction artwork and biographies live with their faction and character records. Navigation destinations, interactive sections, typography and account controls are defined in code.</p>{onInspect && <button onClick={() => onInspect("factions")}>Edit faction presentation</button>}</details>
    </>}
  </WorkshopShell>;
}
