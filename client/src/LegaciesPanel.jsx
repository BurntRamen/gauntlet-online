import { useState } from "react";
import "./LegaciesPanel.css";

export default function LegaciesPanel({ set }) {
  const faction = set?.factions?.find((entry) => entry.id === "mekan");
  const [generalId, setGeneralId] = useState("monti");
  if (!faction) return null;
  const general = faction.generals.find((entry) => entry.id === generalId) || faction.generals[0];
  return (
    <section className="legacies-panel" aria-labelledby="legacies-title">
      <header className="legacies-header">
        <div>
          <span className="legacies-eyebrow">Set {set.number} / {set.name}</span>
          <h3 id="legacies-title">{faction.name}</h3>
          <p className="legacies-tagline">{faction.tagline}</p>
        </div>
        <span className="legacies-status">{faction.status === "playable" ? "Playable in ranked · Draft abilities" : "Faction preview · Draft abilities"}</span>
      </header>
      <p className="legacies-identity">{faction.identity}</p>
      <p>{faction.introduction}</p>
      <blockquote>{faction.philosophy}</blockquote>
      <details className="legacies-details">
        <summary>Explore Mekan lore and abilities</summary>
        <div className="legacies-story">
          {faction.story.map((chapter) => <article key={chapter.title}><h4>{chapter.title}</h4><p>{chapter.text}</p></article>)}
        </div>
        <section aria-label="Mekan gameplay identity">
          <h4>The discard pile is the guest list</h4>
          <p>{faction.gameplay}</p>
          <p className="legacies-draft-note">{faction.status === "playable" ? "Choose Mekan in Play → Ranked, or save a Mekan deck in Build. These playable abilities are draft rules and may be balanced in future updates." : "These abilities are near-final drafts. Mekan is not yet available for matches or saved decks."}</p>
        </section>
        <div className="legacies-leaders">
          {[['Commander', faction.commander], ['City', faction.city]].map(([role, leader]) => (
            <article key={role}>
              <span className="legacies-eyebrow">{role}</span>
              <h4>{leader.name}</h4>
              <strong>{leader.ability}</strong>
              <p>{leader.text}</p>
            </article>
          ))}
        </div>
        <section className="legacies-generals" aria-labelledby="mekan-generals-title">
          <h4 id="mekan-generals-title">One General. Your choice.</h4>
          <p>{faction.generalRule}</p>
          <label htmlFor="mekan-general-preview">Explore a General</label>
          <select id="mekan-general-preview" value={general.id} onChange={(event) => setGeneralId(event.target.value)}>
            {faction.generals.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
          </select>
          <article className="legacies-general" aria-live="polite">
            <h4>{general.name}</h4>
            <p className="legacies-identity">{general.identity}</p>
            <strong>{general.ability}</strong>
            <p>{general.text}</p>
          </article>
          <p className="legacies-draft-note">{faction.generalDraftNote} This selector previews their abilities; it does not change your deck.</p>
        </section>
        <section aria-label="Festivals of San Mikal">
          <h4>A city that celebrates its ancestors</h4>
          <div className="legacies-festivals">
            {faction.festivals.map((festival) => <article key={festival.name}><h5>{festival.name}</h5><p>{festival.text}</p></article>)}
          </div>
        </section>
      </details>
    </section>
  );
}
