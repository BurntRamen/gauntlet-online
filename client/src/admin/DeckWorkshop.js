import { useHelp } from "./AuthoringHelp";
import { useState } from "react";
import Help from "./AuthoringHelp";
import { PrivateCard } from "./PrivateAsset";
import RelatedContent from "./RelatedContent";
import WorkshopShell, { WorkshopFacts, WorkshopSection } from "./WorkshopShell";

const sections = [["details", "Details"], ["composition", "Composition"], ["test", "Test"], ["related", "Related content"]];
export default function DeckWorkshop({ row, state, fields, list, search, playtest, onReview, onInspect, notes, onNotes, onSaveNotes, busy, unsaved, section, onSection, onSelectList }) {
  const helpCopy = useHelp();
  const [localSection, setSection] = useState("details");
  const active = sections.some(([id]) => id === section) ? section : localSection;
  const manifest = state.previewContent?.manifest || state.previewContent;
  const snapshot = state.draft?.snapshot || state.live;
  const live = state.live.domains.decks.find(item => item.id === row?.id);
  const template = manifest?.deckTemplates?.find(item => item.id === row?.id);
  const source = state.draft ? "Saved draft" : "Live content";
  const factionId = row?.composition?.factionId || row?.factionId;
  const faction = snapshot.domains.factions?.find(item => item.id === factionId);
  const entries = (fields || []).filter(Boolean);
  const compositionFields = entries.filter(item => item.props?.field === "composition");
  const identityFields = entries.filter(item => item.props?.field !== "composition");
  const issues = [...(state.validation?.errors || []), ...(state.validation?.warnings || [])].filter(item => item.domain === "decks" && item.id === row?.id);
  const cards = <><p className="admin-preview-source">{source} · selected printings</p>{unsaved && <Help topic="workspaceDeckWorkshop1" className="admin-note" />}
    <div className="admin-deck-preview">{(row?.composition?.cards || []).map(selection => {
      const card = manifest?.cards?.find(item => item.id === selection.cardId), printing = manifest?.collectorVariants?.find(item => item.variantId === selection.printingId);
      return <article key={selection.cardId}>{card && printing ? <PrivateCard card={{ ...card, collector: printing, variantId: printing.variantId, presentation: printing.presentation }} /> : <Help topic="workspaceDeckWorkshop2" />}<strong>{card?.name || snapshot.domains.cards?.find(item => item.id === selection.cardId)?.name || selection.cardId}</strong><small>{snapshot.domains.assets?.find(item => item.id === selection.printingId)?.name || "Printing not resolved"}</small></article>;
    })}</div>{!row?.composition?.cards?.length && <Help topic="workspaceDeckWorkshop3" className="admin-note" />}</>;
  return <WorkshopShell name="Deck Workshop" title={row?.name || "Choose a deck"} selectionId={row?.id} list={list} search={search} busy={busy} onSelectList={onSelectList}
    status={<span>{unsaved ? "Unsaved changes in this browser" : source}{row?.status ? ` · ${row.status}` : ""}</span>}
    sections={row && sections} section={active} onSection={onSection || setSection}
    actions={<button disabled={busy} onClick={onReview}>Review release</button>}
    preview={row?.composition && active !== "test" && <WorkshopSection title="Deck preview" id="deck-preview">{cards}</WorkshopSection>}>
    {row ? <>
      <div hidden={active !== "details"}><WorkshopSection title="Deck details" id="deck-details"><Help topic="DeckWorkshop1" />
        <WorkshopFacts values={{ Faction: faction?.name || factionId || "Not recorded", Type: row.composition ? "Authored recipe" : "Campaign deck", ...(row.composition ? { Slots: 52, Replacements: row.composition.cards.length } : {}) }} />
        {!row.composition && <Help topic="DeckWorkshop2" />}{identityFields}
        {row.composition && <Help topic="workspaceDeckWorkshop4" className="admin-note" />}
      </WorkshopSection>
      {row.composition && <WorkshopSection title="Private notes" id="deck-notes"><Help topic="DeckWorkshop3" /><label className="admin-search">Private deck notes<textarea value={notes} maxLength={4000} disabled={busy || !state.writable} onChange={event => onNotes(event.target.value)} /></label><button disabled={busy || !state.writable || notes === (state.privateNotes?.[row.id]?.value || "")} onClick={onSaveNotes}>Save private notes</button><Help topic="workspaceDeckWorkshop5" className="admin-note" /></WorkshopSection>}</div>
      <div hidden={active !== "composition"}><WorkshopSection title="Composition & legality" id="deck-composition">{compositionFields.length ? compositionFields : <Help topic="workspaceDeckWorkshop6" className="admin-note" />}
        {issues.length ? <ul className="admin-alert">{issues.map((issue, index) => <li key={index}>{issue.message}</li>)}</ul> : <Help topic="workspaceDeckWorkshop7" className="admin-good" />}
        {unsaved && <Help topic="workspaceDeckWorkshop8" className="admin-note" />}
        {row.composition && <details><summary>Compare composition with live</summary><p>Live: {live?.composition?.cards.length ?? "Not published"} replacements · Saved draft: {row.composition.cards.length}.</p><div className="admin-table-wrap"><table className="design-table"><thead><tr><th>Card</th><th>Live printing</th><th>Saved printing</th></tr></thead><tbody>{[...new Set([...(live?.composition?.cards || []).map(card => card.cardId), ...row.composition.cards.map(card => card.cardId)])].map(id => {
          const before = live?.composition?.cards.find(card => card.cardId === id), after = row.composition.cards.find(card => card.cardId === id);
          const printingName = selection => selection ? snapshot.domains.assets?.find(item => item.id === selection.printingId)?.name || selection.printingId : "Not selected";
          return <tr key={id}><th scope="row">{manifest?.cards?.find(card => card.id === id)?.name || id}</th><td>{printingName(before)}</td><td>{printingName(after)}</td></tr>;
        })}</tbody></table></div></details>}
      </WorkshopSection></div>
      <div hidden={active !== "test"}><WorkshopSection title="Test this recipe" id="deck-test"><p className="admin-note">{state.draft?.playtestedHash === state.draft?.hash && state.draft ? helpCopy.deckNote1 : "No current shared-draft test receipt."}</p>{playtest || <Help topic="workspaceDeckWorkshop9" />}</WorkshopSection></div>
      <div hidden={active !== "related"}><WorkshopSection title="Used by" id="deck-related"><RelatedContent data={state.relationshipData} domain="decks" id={row.id} onInspect={onInspect} /></WorkshopSection></div>
      <details className="admin-json"><summary>Technical · recipe identity and revision</summary><pre>{JSON.stringify({ id: row.id, revision: template?.revision || null, release: manifest?.contentVersion || state.activeReleaseId }, null, 2)}</pre></details>
    </> : <Help topic="workspaceDeckWorkshop10" className="admin-note" />}
  </WorkshopShell>;
}
