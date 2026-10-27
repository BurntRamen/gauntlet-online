import { useMemo, useState } from "react";
import { FACTION_VISUALS, resolveVisualAsset } from "./GauntletVisuals";
import "./FactionLoreScreen.css";

const SET_NAMES = {
  initiative: "Initiative",
  legacies: "Legacies",
  frontiers: "Frontiers",
  "reath-beyond": "Reath Beyond",
  convergence: "Convergence"
};

function chapterText(chapter) {
  return [chapter.title, chapter.story, chapter.playableName, chapter.opponentName, chapter.ally, ...(chapter.dialogue || []), ...(chapter.endDialogue || [])]
    .join(" ")
    .toLowerCase();
}

function characterAliases(name) {
  const normalized = String(name || "").toLowerCase().replace(/[’']/g, "'").trim();
  const lastName = normalized.replace(/,.*/, "").split(/\s+/).at(-1);
  return [...new Set([normalized, lastName?.length >= 5 ? lastName : ""].filter(Boolean))];
}

function leaderEntries(faction, campaign) {
  const campaignCharacters = Object.entries(campaign?.characters || {}).map(([key, character]) => typeof character === "string"
    ? { name: key, role: "Archive figure", description: character }
    : { ...character, name: character.name || key });
  const leaders = campaignCharacters.length > 0 ? campaignCharacters : [faction?.commander, faction?.general].filter(Boolean).map((leader) => ({
    name: leader.name,
    role: leader === faction.commander ? "Commander" : "General",
    description: leader.text
  }));
  return leaders.map((leader) => {
    const aliases = characterAliases(leader.name);
    const appearances = (campaign?.chapters || []).filter((chapter) => aliases.some((alias) => chapterText(chapter).includes(alias)));
    return { ...leader, appearances };
  });
}

function storyActs(campaign) {
  const chapters = campaign?.chapters || [];
  if (!chapters.length) return [];
  const actNames = chapters.length >= 9 ? ["Foundations", "Transformation", "Convergence"] : ["Disturbance", "Revelation", "Aftermath"];
  const size = Math.ceil(chapters.length / 3);
  return actNames.map((name, index) => {
    const entries = chapters.slice(index * size, Math.min(chapters.length, (index + 1) * size));
    if (!entries.length) return null;
    const first = entries[0];
    const last = entries.at(-1);
    const summary = first === last
      ? first.story
      : `${first.story} By “${last.title},” ${String(last.story || "").replace(/^./, (letter) => letter.toLowerCase())}`;
    return { name, range: first === last ? first.title : `${first.title} — ${last.title}`, summary };
  }).filter(Boolean);
}

export default function FactionLoreScreen({ manifest, onBack, onOpenCampaign }) {
  const factions = useMemo(() => manifest?.factions || [], [manifest?.factions]);
  const campaigns = useMemo(() => manifest?.campaigns || {}, [manifest?.campaigns]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(factions[0]?.id || "rumin");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return factions;
    return factions.filter((faction) => {
      const campaign = campaigns[faction.id] || {};
      const characterText = leaderEntries(faction, campaign).map((character) => `${character.name} ${character.role} ${character.description}`).join(" ");
      const chapterTextValue = (campaign.chapters || []).map((chapter) => `${chapter.title} ${chapter.story}`).join(" ");
      return [faction.name, campaign.homeworld, campaign.origin, campaign.pitch, campaign.arrivalOnReath, characterText, chapterTextValue]
        .some((value) => String(value || "").toLowerCase().includes(needle));
    });
  }, [campaigns, factions, query]);
  const faction = filtered.find((entry) => entry.id === selectedId) || filtered[0] || factions.find((entry) => entry.id === selectedId) || factions[0];
  const campaign = campaigns[faction?.id] || {};
  const artwork = resolveVisualAsset(FACTION_VISUALS[faction?.id]?.art || campaign.coverImage || faction?.cardImage);
  const leaders = leaderEntries(faction, campaign);
  const acts = storyActs(campaign);
  const setName = manifest?.draftSets?.find((set) => set.factionIds?.includes(faction?.id))?.name || SET_NAMES[faction?.setId] || "Gauntlet";

  return (
    <main className="faction-lore-page menu-page area-journey">
      <div className="faction-lore-frame menu-frame">
        <header className="faction-lore-header" style={{ "--lore-art": `url("${artwork}")` }}>
          <div>
            <span>World Archive / Faction Records</span>
            <h1>Peoples of Gauntlet</h1>
            <p>Explore each faction on its own homeworld, the conflicts that shaped it, and the path that eventually brought its people to Reath.</p>
          </div>
          <button type="button" className="faction-lore-back" onClick={onBack}>Back to Journey</button>
        </header>

        <div className="faction-lore-layout">
          <aside className="faction-lore-index" aria-label="Faction lore index">
            <label htmlFor="faction-lore-search">Search the archive</label>
            <input id="faction-lore-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Faction, world, or subject" />
            <div role="list">
              {filtered.map((entry) => (
                <button key={entry.id} type="button" className={entry.id === faction?.id ? "is-active" : ""} aria-current={entry.id === faction?.id ? "page" : undefined} onClick={() => setSelectedId(entry.id)}>
                  <img src={resolveVisualAsset(FACTION_VISUALS[entry.id]?.art || campaigns[entry.id]?.coverImage || entry.cardImage)} alt="" loading="lazy" />
                  <span><strong>{entry.name}</strong><small>{campaigns[entry.id]?.homeworld || "Origin unconfirmed"}</small></span>
                </button>
              ))}
              {filtered.length === 0 && <p className="faction-lore-empty">No archive records match that search.</p>}
            </div>
          </aside>

          {faction && <article className="faction-lore-record">
            <section className="faction-lore-hero" style={{ "--lore-art": `url("${artwork}")` }}>
              <div>
                <span>{setName} faction</span>
                <h2>{faction.name}</h2>
                <p>{campaign.pitch}</p>
              </div>
              <dl>
                <div><dt>Homeworld</dt><dd>{campaign.homeworld || "Unknown"}</dd></div>
                <div><dt>Commander</dt><dd>{faction.commander?.name || campaign.commanderName}</dd></div>
                <div><dt>Chronicle</dt><dd>{campaign.chapters?.length || 0} chapters</dd></div>
              </dl>
            </section>

            <section className="faction-lore-prose" aria-labelledby="origin-heading">
              <span>Origin record</span>
              <h3 id="origin-heading">Before Reath</h3>
              <p>{campaign.origin || campaign.pitch}</p>
            </section>

            <section className="faction-lore-prose" aria-labelledby="convergence-heading">
              <span>Convergence record</span>
              <h3 id="convergence-heading">The path to Reath</h3>
              <p>{campaign.arrivalOnReath || "This faction's first verified contact with Reath remains classified in the archive."}</p>
            </section>

            <section className="faction-lore-doctrine" aria-labelledby="doctrine-heading">
              <div><span>Doctrine</span><h3 id="doctrine-heading">How they shape the world</h3></div>
              <blockquote>{faction.commander?.text || faction.city?.text}</blockquote>
              {faction.city && <p><strong>{faction.city.name}:</strong> {faction.city.text}</p>}
            </section>

            {acts.length > 0 && <section className="faction-lore-arc" aria-labelledby="arc-heading">
              <div className="faction-lore-section-heading"><span>Narrative overview</span><h3 id="arc-heading">The faction's story</h3></div>
              <div className="faction-lore-arc-grid">
                {acts.map((act) => <article key={act.name}><span>{act.name}</span><h4>{act.range}</h4><p>{act.summary}</p></article>)}
              </div>
            </section>}

            {leaders.length > 0 && <section className="faction-lore-figures" aria-labelledby="figures-heading">
              <div className="faction-lore-section-heading"><span>People and presences</span><h3 id="figures-heading">Major characters</h3><p>Each record follows the character's place in the campaign rather than reducing the faction to a single leader.</p></div>
              <div className="faction-lore-figure-grid">
                {leaders.map((leader, index) => <article key={`${leader.name}-${index}`}>
                  <span>{leader.role || "Archive subject"}</span><h4>{leader.name}</h4><p>{leader.description || "This figure's complete record remains contested."}</p>
                  {leader.appearances.length > 0 && <small>Campaign record: {leader.appearances.map((chapter) => chapter.title).join(" · ")}</small>}
                </article>)}
              </div>
            </section>}

            {campaign.chapters?.length > 0 && <section className="faction-lore-chronicle" aria-labelledby="chronicle-heading">
              <div className="faction-lore-section-heading"><span>Historical sequence</span><h3 id="chronicle-heading">Campaign chronicle</h3></div>
              <ol>{campaign.chapters.map((chapter) => <li key={chapter.id}><span>{chapter.title}</span><p>{chapter.story}</p></li>)}</ol>
            </section>}

            <footer className="faction-lore-actions">
              <button type="button" onClick={onOpenCampaign}>Open {faction.name} campaign</button>
            </footer>
          </article>}
        </div>
      </div>
    </main>
  );
}
