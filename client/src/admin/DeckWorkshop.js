import Help from "./AuthoringHelp";
import { PrivateCard } from "./PrivateAsset";
import RelatedContent from "./RelatedContent";

export default function DeckWorkshop({ row, state, fields, list, search, playtest, onReview, onInspect, notes, onNotes, onSaveNotes, busy }) {
  const manifest = state.previewContent?.manifest || state.previewContent;
  const live = state.live.domains.decks.find(item => item.id === row?.id);
  const template = manifest?.deckTemplates?.find(item => item.id === row?.id);
  return <section aria-label="Deck Workshop"><h3>Deck Workshop</h3><Help topic="DeckWorkshop1" />
    <button disabled={busy} onClick={onReview}>Review release</button>{search}{list}{row && <><h4>{row.name}</h4>{!row.composition ? <Help topic="DeckWorkshop2" /> : <p>52 slots · {row.composition.cards.length} replacements · {row.status}. Saved content becomes effective after publication; players keep their copied compositions.</p>}
      {fields}
      {row.composition && <><details><summary>Compare composition with live</summary><p>Live: {live?.composition?.cards.length ?? "Not published"} replacements · Saved draft: {row.composition.cards.length}.</p>{[...new Set([...(live?.composition?.cards || []).map(card => card.cardId), ...row.composition.cards.map(card => card.cardId)])].map(id => { const before = live?.composition?.cards.find(card => card.cardId === id), after = row.composition.cards.find(card => card.cardId === id); return <p key={id}>{manifest?.cards.find(card => card.id === id)?.name || id}: {before?.printingId || "Not selected"} → {after?.printingId || "Not selected"}</p>; })}</details>
        <details><summary>Preview saved deck cards</summary><p>Standard unselected slots remain in the 52-card inventory.</p><div className="admin-playtest-hand">{row.composition.cards.map(selection => { const card = manifest?.cards.find(card => card.id === selection.cardId), printing = manifest?.collectorVariants.find(row => row.variantId === selection.printingId); return card && printing ? <div key={selection.cardId}><PrivateCard card={{ ...card, collector: printing, variantId: printing.variantId, presentation: printing.presentation }} /><span>{card.name}</span></div> : <p key={selection.cardId}>Resolve validation errors to preview this selection.</p>; })}</div></details>
        <details><summary>Private authoring notes</summary><Help topic="DeckWorkshop3" /><label>Private deck notes<textarea value={notes} maxLength={4000} disabled={busy || !state.writable} onChange={event => onNotes(event.target.value)} /></label><button disabled={busy || !state.writable || notes === (state.privateNotes?.[row.id]?.value || "")} onClick={onSaveNotes}>Save private notes</button></details>
        <details><summary>Revision and destination status</summary><p>Template revision: {template?.revision || "Preview a valid saved draft"} · Release: {manifest?.contentVersion || state.activeReleaseId}</p><p>{state.draft?.playtestedHash === state.draft?.hash && state.draft ? "Accepted action recorded for this exact shared draft; inspect the test subject below." : "No current shared-draft test receipt."}</p></details>{playtest}</>}
      <RelatedContent data={state.relationshipData} domain="decks" id={row.id} onInspect={onInspect} />
    </>}</section>;
}
