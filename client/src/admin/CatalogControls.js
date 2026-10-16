import Help from "./AuthoringHelp";
import { useEffect, useRef, useState } from "react";

export function CatalogField({ definition, value, onChange, cards, editions = [], modifiers = [], disabled }) {
  const [query, setQuery] = useState("");
  if (["printing-edition", "choice", "modifier-reference"].includes(definition.type)) {
    const options = definition.type === "printing-edition" ? editions : definition.type === "modifier-reference" ? [{ id: "", name: "Standard encounter setup" }, ...modifiers] : definition.options;
    return <label>{definition.label}<select aria-label={definition.type === "printing-edition" ? "Draft digital set / edition" : "Draft " + definition.label.toLowerCase()} value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>{options.map(option => <option key={option.id ?? option} value={option.id ?? option} disabled={option.status === "archived" && option.id !== value}>{option.name ?? option}</option>)}</select></label>;
  }
  if (definition.type === "catalog-flags") return <fieldset disabled={disabled}><legend>{definition.label}</legend>{definition.keys.map(key => <label className="admin-catalog-check" key={key}><input type="checkbox" checked={value?.[key] === true} onChange={event => onChange({ ...value, [key]: event.target.checked })} />{definition.labels?.[key] || key}</label>)}<Help className="admin-note" topic="CatalogControls1" /></fieldset>;
  const selected = Array.isArray(value) ? value : [];
  return <fieldset disabled={disabled}><legend>Set membership · {selected.length} cards</legend><label>Find a member card<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label><div className="admin-catalog-members">{cards.filter(card => `${card.name} ${card.factionId}`.toLowerCase().includes(query.toLowerCase())).map(card => <label className="admin-catalog-check" key={card.id}><input type="checkbox" checked={selected.includes(card.id)} onChange={event => onChange(event.target.checked ? [...selected, card.id] : selected.filter(id => id !== card.id))} />{card.name} · {card.factionId} · {card.rarity}</label>)}</div><Help className="admin-note" topic="CatalogControls2" /></fieldset>;
}

export default function CatalogControls({ creation, value, onEdit, onCancel, onCreate, onOpen, onDuplicate, domain, row, state, effects, disabled }) {
  const form = useRef(null);
  useEffect(() => { if (creation) form.current?.querySelector("input")?.focus(); }, [creation]);
  const snapshot = state.draft?.snapshot || state.live;
  const sets = (snapshot.domains.sets || []).filter(set => set.status === "active");
  const nameOf = domain => domain === "assets" ? "printing" : domain?.slice(0, -1);
  const deckDomain = ["decks", "offers", "encounters", "factions"].includes(domain);
  if (!creation) return <div className="admin-actions">{(deckDomain ? [domain] : ["sets", "cards"]).map(d => <button key={d} disabled={disabled || (d === "cards" && !sets.length)} onClick={() => onOpen(d)}>Create {nameOf(d)}</button>)}{row && (deckDomain || ["cards", "sets"].includes(domain)) && <button disabled={disabled || (domain === "cards" && !sets.length)} onClick={onDuplicate}>Duplicate {nameOf(domain)}</button>}{!deckDomain && !sets.length && <span className="admin-note">Create an authored set to begin adding cards.</span>}</div>;
  const d = creation.domain, card = d === "cards", printing = d === "assets", deck = d === "decks", offer = d === "offers", encounter = d === "encounters", faction = d === "factions", name = nameOf(d);
  const source = creation.sourceId && snapshot.domains[d]?.find(item => item.id === creation.sourceId);
  const values = { family: state.factionFamilies?.[0]?.id || "", campaignId: source?.campaignId || snapshot.domains.campaigns?.[0]?.id || "", name: source ? (source.name || source.title) + " copy" : "", factionId: source?.factionId || "rumin", templateId: snapshot.domains.decks?.find(item => item.destinations?.player)?.id || "", setId: sets[0]?.id || "", effectId: source?.effect?.mechanicId || source?.effect?.id || "coin-scale-spear", value: source?.value || 4, suit: source?.suit || "spades", rarity: source?.rarity || "common", edition: sets[0]?.id || state.printingEditions?.[0]?.id || "", collectorNumber: "", ...value };
  const update = (key, next) => onEdit({ ...values, [key]: next });
  const mechanic = state.studio?.definitions.find(m => m.id === values.effectId);
  const effect = mechanic ? { factionId: values.factionId, cardType: values.cardType || source?.type || mechanic.cardTypes[0], description: mechanic.explanation } : effects?.find(item => item.id === values.effectId) || (source?.effect?.id === "composed-rumin-armament" && values.effectId === source.effect.id ? { factionId: source.factionId, cardType: source.type, description: "Preserve this structured ability on the new identity." } : null);
  const choose = (label, key, rows) => <label>{label}<select aria-label={label} value={values[key] ?? (key === "cardType" ? effect?.cardType : "")} disabled={disabled} onChange={event => update(key, event.target.value)}>{rows.map(item => <option key={item.id ?? item} value={item.id ?? item}>{item.name ?? item}</option>)}</select></label>;
  const submit = event => {
    event.preventDefault();
    onCreate({ domain: d, name: values.name, ...(creation.sourceId ? { sourceId: creation.sourceId } : {}),
      ...(deck && !source ? { factionId: values.factionId } : offer && !source ? { templateId: values.templateId } : {}),
      ...(faction && !source ? { family: values.family } : {}),
      ...(encounter && !source ? { campaignId: values.campaignId } : {}),
      ...(printing ? { gameplayCardId: creation.gameplayCardId, edition: values.edition, collectorNumber: values.collectorNumber } : {}),
      ...(card ? { setId: values.setId, effectId: values.effectId, factionId: effect?.factionId, type: effect?.cardType, value: Number(values.value), suit: values.suit, rarity: values.rarity } : {}) });
  };
  return <form ref={form} className="admin-preview admin-catalog-create" aria-label={deck || offer ? "Create deck content" : "Create " + name} onSubmit={submit}>
    <h4>{source ? "Duplicate" : "Create"} {name}</h4><Help className="admin-note" topic={faction ? "factionCreation" : encounter ? "encounterCreation" : deck || offer ? "CatalogControls3" : "CatalogControls4"} />
    <label>Name<input aria-label="New content name" maxLength={deck || offer ? 80 : 160} required value={values.name} disabled={disabled} onChange={event => update("name", event.target.value)} /></label>
    {faction && !source && choose("Rules family", "family", state.factionFamilies || [])}
    {encounter && !source && choose("Campaign", "campaignId", snapshot.domains.campaigns.map(c => ({ id: c.id, name: c.commanderName })))}
    {deck && !source && choose("Faction", "factionId", state.deckFactions || [])}
    {offer && !source && choose("Recipe", "templateId", [{ id: "", name: "Choose a player template" }, ...snapshot.domains.decks.filter(item => item.destinations?.player)])}
    {printing && <><Help topic="CatalogControls5" />{choose("New printing edition", "edition", state.printingEditions?.filter(set => set.status !== "archived") || [])}<label>Collector identifier<input aria-label="New collector identifier" maxLength={32} required value={values.collectorNumber} disabled={disabled} onChange={event => update("collectorNumber", event.target.value)} /></label></>}
    {card && <>{choose("Set", "setId", sets)}{choose("Mechanical effect", "effectId", [...(source?.effect?.id === "composed-rumin-armament" ? [{ id: source.effect.id, name: "Copy structured composition" }] : []), ...(state.studio?.definitions || []).filter(m => m.status === "active").map(m => ({ id: m.id, name: "Authored · " + m.name })), ...(effects || []).map(e => ({ id: e.id, name: e.factionId + " · " + e.cardType + " · " + e.label }))])}
      {mechanic && <>{choose("New card faction", "factionId", state.deckFactions?.filter(f => !f.campaignOnly || f.origin === "admin-faction-v1") || [])}{choose("New card type", "cardType", mechanic.cardTypes.map(type => ({ id: type, name: type })))}</>}<p>{effect?.description}</p><Help className="admin-note" topic="CatalogControls6" />
      <label>Printed value<input type="number" min={2} max={14} required value={values.value} disabled={disabled} onChange={event => update("value", event.target.value)} /></label>
      {choose("Fixed suit", "suit", ["spades", "hearts", "diamonds", "clubs"])}{choose("Rarity", "rarity", ["common", "uncommon", "rare", "mythic"])}</>}
    <div className="admin-actions"><button disabled={disabled || (card && !effect)} type="submit">Save new {name} to draft</button><button disabled={disabled} type="button" onClick={onCancel}>Cancel creation</button></div>
  </form>;
}
