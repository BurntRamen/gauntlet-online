import { useState } from "react";
import WorkshopShell, { WorkshopFacts, WorkshopSection } from "./WorkshopShell";
import RelatedContent from "./RelatedContent";

const sections = { "card-effects": "Card effects", "faction-effects": "Faction effects", "encounter-mechanics": "Encounter mechanics", game: "Shared configuration" };
const pretty = (value) => value?.replace(/([A-Z])/g, " $1").replaceAll("-", " ") || "";

export default function EngineWorkshop({ state, field, playtest, onInspect, onReview, target, onTarget, context, onContext }) {
  const [localQuery, setLocalQuery] = useState("");
  const query = context?.query ?? localQuery;
  const setQuery = (value) => onContext ? onContext({ query: value }) : setLocalQuery(value);
  const metadata = state.workshopMetadata;
  const domains = (state.draft?.snapshot || state.live)?.domains || {};
  const domain = Object.hasOwn(sections, target?.domain) ? target.domain : "card-effects";
  const entries = domain === "card-effects" ? metadata?.cardEffects || [] : domain === "faction-effects" ? metadata?.factionEffects || [] : domain === "encounter-mechanics" ? metadata?.bossAbilities || metadata?.encounterMechanics?.abilities || [] : [{ id: "shared-rules", label: "Shared rules" }];
  const selected = target?.id ? entries.find((item) => item.id === target.id) : entries[0];
  const visible = entries.filter((item) => `${item.label} ${item.id} ${item.factionId || ""}`.toLowerCase().includes(query.toLowerCase()));
  const owner = domain === "faction-effects" ? domains.factions?.find((item) => item.id === selected?.factionId) : domain === "game" ? domains.game?.find((item) => item.id === "shared-rules") : null;
  const usedBy = domain === "card-effects" ? (domains.cards || []).filter((item) => item.effect?.id === selected?.id) : [];
  const compatible = domain === "card-effects" ? (domains.cards || []).filter((item) => item.factionId === selected?.factionId && item.type === selected?.cardType) : [];
  const config = metadata?.gameConfig;
  const choose = (nextDomain, id) => onTarget?.({ domain: nextDomain, id });
  return <WorkshopShell name="Engine / Rules Workshop" title="Supported rules, visible behavior" description="Inspect the deployed contracts, edit values on their authored owners, and test the real engine." actions={onReview && <button onClick={onReview}>Review release</button>}
    search={<><nav className="design-tabs" aria-label="Engine rule categories">{Object.entries(sections).map(([id, label]) => <button key={id} aria-pressed={domain === id} onClick={() => choose(id, id === "game" ? "shared-rules" : null)}>{label}</button>)}</nav><label className="admin-search">Search rules<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, effect or faction" /></label></>}
    list={<div className="admin-object-list">{visible.map((item) => <button key={item.id} aria-pressed={selected?.id === item.id} onClick={() => choose(domain, item.id)}><strong>{item.label || pretty(item.id)}</strong><small>{item.factionId || "Shared engine contract"}</small></button>)}{!visible.length && <p>No matching rules.</p>}</div>}
    preview={<WorkshopSection title="Engine test harness" id="engine-test"><p className="admin-note">Use Live or Saved draft, configure a custom starting state, then execute legal engine commands.</p>{domain === "card-effects" && selected && <><label>Test using card<select value={usedBy.some((item) => item.id === target?.cardId) ? target.cardId : ""} disabled={!usedBy.length} onChange={(event) => onTarget?.({ domain, id: selected.id, cardId: event.target.value })}><option value="">Choose a card using this effect</option>{usedBy.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{!usedBy.length && <p className="admin-note">Assign this effect to a compatible card and save the draft before testing it.</p>}</>}{playtest}</WorkshopSection>}
  >{!metadata ? <p role="status">Workshop rules are not available yet. Refresh Admin after the server update completes.</p> : !selected ? <p role="status">This rule is not available in the deployed registry. Choose a supported rule from the list.</p> : <>
    <WorkshopSection title={selected.label || pretty(selected.id)} id="engine-rule"><p>{selected.description || (domain === "encounter-mechanics" ? "This ability is available in encounter setup. Edit the encounter that owns it." : "Supported by the deployed engine contract.")}</p>{domain !== "game" && <WorkshopFacts values={{ Version: selected.version || metadata.bindings?.encounterContractVersion, Faction: selected.factionId || "Encounter setup", ...(selected.cardType ? { "Card type": selected.cardType } : {}) }} />}
      {domain === "card-effects" && <><p className="admin-note">The registry definition is read-only. Edit a card to select this effect or change its parameters.</p><h5>Cards using this effect</h5>{usedBy.length ? <div className="admin-actions">{usedBy.map((item) => <button key={item.id} onClick={() => onInspect?.("cards", item.id)}>{item.name}</button>)}</div> : <><p>No cards currently use this effect in this source.</p><h5>Compatible cards to edit</h5><div className="admin-actions">{compatible.map((item) => <button key={item.id} onClick={() => onInspect?.("cards", item.id)}>{item.name}</button>)}</div></>}</>}
      {domain === "faction-effects" && (owner && Object.keys(selected.parameters || {}).length ? field("mechanics", { domain: "factions", row: owner }) : <p className="admin-note">This faction contract has no editable parameters.</p>)}
      {domain === "game" && <>{owner && field("handSize", { domain: "game", row: owner })}<WorkshopFacts values={{ "Starting life · fixed": config?.startingLife, "Deck size · derived": config?.deckSize, "Lanes · fixed": config?.laneCount, "Suits · fixed": config?.suits?.join(" · "), "Ranks · fixed": config?.values?.join(", ") }} /><p className="admin-note">Hand size applies to creation and refill. Payment, damage, targeting, priority, matchmaking, timers, progression and rewards remain engine-controlled.</p></>}
      {domain === "encounter-mechanics" && <><h5>Setup limits</h5><dl className="design-facts">{Object.entries(metadata.encounterRules || metadata.encounterMechanics?.rules || {}).map(([key, rule]) => <div key={key}><dt>{rule.label || pretty(key)}</dt><dd>{rule.min}–{rule.max}<small>{rule.help}</small></dd></div>)}</dl><div className="admin-actions">{(domains.encounters || []).filter((item) => item.setup?.bossAbility?.id === selected.id).map((item) => <button key={item.id} onClick={() => onInspect?.("encounters", item.id)}>{item.title}</button>)}</div></>}
    </WorkshopSection>
    {!!Object.keys(selected.parameters || {}).length && <WorkshopSection title="Parameter contract" id="engine-parameters"><table className="design-table"><thead><tr><th>Parameter</th><th>Range</th><th>Default</th></tr></thead><tbody>{Object.entries(selected.parameters).map(([key, rule]) => <tr key={key}><th scope="row">{rule.label || pretty(key)}</th><td>{rule.min}–{rule.max}</td><td>{rule.default}</td></tr>)}</tbody></table></WorkshopSection>}
    <WorkshopSection title="Related content" id="engine-related"><RelatedContent data={state.relationshipData} domain={domain} id={selected.id} onInspect={onInspect} /></WorkshopSection>
    <details className="admin-json"><summary>Technical · contract versions and boundaries</summary><pre>{JSON.stringify({ definition: selected, bindings: metadata.bindings, contentHash: metadata.hash, release: metadata.releaseId }, null, 2)}</pre></details>
  </>}</WorkshopShell>;
}
