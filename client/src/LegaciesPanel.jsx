import { useState } from "react";
import "./LegaciesPanel.css";

export default function LegaciesPanel({ set }) {
  const factions = set?.factions || [];
  const [factionId, setFactionId] = useState(factions[0]?.id || "");
  const faction = factions.find((entry) => entry.id === factionId) || factions[0];
  const [generalIds, setGeneralIds] = useState({});
  if (!faction) return null;
  const generalId = generalIds[faction.id] || faction.generals?.[0]?.id;
  const general = faction.generals?.find((entry) => entry.id === generalId) || faction.generals?.[0];
  const playable = faction.status === "playable";
  const gameplayHeadings = {
    mekan: "The discard pile is the guest list",
    jali: "Defeat begins the counterattack",
    gracus: "Every exchange raises the stakes",
    indela: "The omen shapes the turn"
  };
  const themeHeadings = {
    mekan: "A city that celebrates its ancestors",
    jali: "The Jali battle rhythm",
    gracus: "The roar of the giant coast",
    indela: "The Academy's readings"
  };
  return (
    <section className={`legacies-panel is-${faction.id}`} aria-labelledby="legacies-title">
      <header className="legacies-header">
        <div>
          <span className="legacies-eyebrow">Set {set.number} / {set.name}</span>
          <h3 id="legacies-title">{faction.name}</h3>
          <p className="legacies-tagline">{faction.tagline}</p>
        </div>
        <span className="legacies-status">{playable ? "Playable in ranked · Draft abilities" : "Faction preview · Draft abilities"}</span>
      </header>
      {factions.length > 1 && <nav className="legacies-faction-tabs" aria-label="Legacies factions">
        {factions.map((entry) => <button key={entry.id} type="button" aria-current={entry.id === faction.id ? "page" : undefined} onClick={() => setFactionId(entry.id)}>{entry.name}<small>{entry.identity}</small></button>)}
      </nav>}
      <p className="legacies-identity">{faction.identity}</p>
      <p>{faction.introduction}</p>
      <blockquote>{faction.philosophy}</blockquote>
      <details className="legacies-details">
        <summary>Explore {faction.name} lore and abilities</summary>
        <div className="legacies-story">
          {(faction.story || []).map((chapter) => <article key={chapter.title}><h4>{chapter.title}</h4><p>{chapter.text}</p></article>)}
        </div>
        <section aria-label={`${faction.name} gameplay identity`}>
          <h4>{gameplayHeadings[faction.id] || `${faction.name} gameplay`}</h4>
          <p>{faction.gameplay}</p>
          <p className="legacies-draft-note">{playable ? `Choose ${faction.name} in Play → Ranked, Practice, or a two-player Faction table. Every faction receives a complete standard 52-card deck; saved constructed replacements are optional. These playable abilities are draft rules and may be balanced in future updates.` : `${faction.name} is not yet available for matches or saved decks.`}</p>
        </section>
        <div className="legacies-leaders">
          {[["Commander", faction.commander], ["City", faction.city]].filter(([, leader]) => leader).map(([role, leader]) => (
            <article key={role}>
              <span className="legacies-eyebrow">{role}</span>
              <h4>{leader.name}</h4>
              {leader.ability && <strong>{leader.ability}</strong>}
              <p>{leader.text}</p>
            </article>
          ))}
        </div>
        {general && <section className="legacies-generals" aria-labelledby={`${faction.id}-generals-title`}>
          <h4 id={`${faction.id}-generals-title`}>One General. Your choice.</h4>
          <p>{faction.generalRule}</p>
          <label htmlFor={`${faction.id}-general-preview`}>Explore a General</label>
          <select id={`${faction.id}-general-preview`} value={general.id} onChange={(event) => setGeneralIds((current) => ({ ...current, [faction.id]: event.target.value }))}>
            {faction.generals.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
          </select>
          <article className="legacies-general" aria-live="polite">
            <h4>{general.name}</h4>
            <p className="legacies-identity">{general.identity}</p>
            <strong>{general.ability}</strong>
            <p>{general.text}</p>
          </article>
          <p className="legacies-draft-note">{faction.generalDraftNote} This selector previews the ability; choose the General in your ranked loadout or deck.</p>
        </section>}
        {(faction.festivals || []).length > 0 && <section aria-label={`${faction.name} themes`}>
          <h4>{themeHeadings[faction.id] || `${faction.name} themes`}</h4>
          <div className="legacies-festivals">
            {faction.festivals.map((item) => <article key={item.name}><h5>{item.name}</h5><p>{item.text}</p></article>)}
          </div>
        </section>}
      </details>
    </section>
  );
}
