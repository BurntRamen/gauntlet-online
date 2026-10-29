import { useId, useMemo, useState } from "react";
import { FACTION_VISUALS, resolveVisualAsset } from "./GauntletVisuals";
import "./FactionLoreScreen.css";

const SET_NAMES = {
  initiative: "Initiative",
  legacies: "Legacies",
  frontiers: "Frontiers",
  "reath-beyond": "Reath Beyond",
  convergence: "Convergence"
};

function leaderEntries(faction, campaign) {
  const campaignCharacters = Object.entries(campaign?.characters || {}).map(([key, character]) => typeof character === "string"
    ? { name: key, role: "Archive figure", description: character }
    : { ...character, name: character.name || key });
  if (campaignCharacters.length > 0) return campaignCharacters;
  return [faction?.commander, faction?.general].filter(Boolean).map((leader) => ({
    name: leader.name,
    role: leader === faction.commander ? "Commander" : "General",
    description: leader.text
  }));
}

export default function FactionLoreScreen({ manifest, onBack, onOpenCampaign, embedded = false }) {
  const headingId = useId();
  const Page = embedded ? "section" : "main";
  const PageHeading = embedded ? "h2" : "h1";
  const FactionHeading = embedded ? "h3" : "h2";
  const SectionHeading = embedded ? "h4" : "h3";
  const FigureHeading = embedded ? "h5" : "h4";
  const factions = useMemo(() => manifest?.factions || [], [manifest?.factions]);
  const campaigns = useMemo(() => manifest?.campaigns || {}, [manifest?.campaigns]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(factions[0]?.id || "rumin");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return factions;
    return factions.filter((faction) => {
      const campaign = campaigns[faction.id] || {};
      return [faction.name, campaign.homeworld, campaign.origin, campaign.pitch, campaign.arrivalOnReath]
        .some((value) => String(value || "").toLowerCase().includes(needle));
    });
  }, [campaigns, factions, query]);
  const faction = filtered.find((entry) => entry.id === selectedId) || filtered[0] || factions.find((entry) => entry.id === selectedId) || factions[0];
  const campaign = campaigns[faction?.id] || {};
  const artwork = resolveVisualAsset(FACTION_VISUALS[faction?.id]?.art || campaign.coverImage || faction?.cardImage);
  const leaders = leaderEntries(faction, campaign);
  const setName = manifest?.draftSets?.find((set) => set.factionIds?.includes(faction?.id))?.name || SET_NAMES[faction?.setId] || "Gauntlet";

  return (
    <Page className={embedded ? "faction-lore-page is-embedded" : "faction-lore-page menu-page area-journey"} aria-labelledby={headingId}>
      <div className={embedded ? "faction-lore-frame" : "faction-lore-frame menu-frame"}>
        <header className="faction-lore-header" style={{ "--lore-art": `url("${artwork}")` }}>
          <div>
            <span>World Archive / Faction Records</span>
            <PageHeading id={headingId}>Peoples of Gauntlet</PageHeading>
            <p>Explore each faction on its own homeworld, the conflicts that shaped it, and the path that eventually brought its people to Reath.</p>
          </div>
          <button type="button" className="faction-lore-back" onClick={onBack}>{embedded ? "Back to Campaign" : "Back to Journey"}</button>
        </header>

        <div className="faction-lore-layout">
          <aside className="faction-lore-index" aria-label="Faction lore index">
            <label htmlFor="faction-lore-search">Search the archive</label>
            <input id="faction-lore-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Faction, world, or subject" />
            <div className="faction-lore-index-list">
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
                <FactionHeading>{faction.name}</FactionHeading>
                <p>{campaign.pitch}</p>
              </div>
              <dl>
                <div><dt>Homeworld</dt><dd>{campaign.homeworld || "Unknown"}</dd></div>
                <div><dt>Commander</dt><dd>{faction.commander?.name || campaign.commanderName}</dd></div>
                <div><dt>Chronicle</dt><dd>{campaign.chapters?.length || 0} chapters</dd></div>
              </dl>
            </section>

            <section className="faction-lore-prose" aria-labelledby={`${headingId}-origin`}>
              <span>Origin record</span>
              <SectionHeading id={`${headingId}-origin`}>Before Reath</SectionHeading>
              <p>{campaign.origin || campaign.pitch}</p>
            </section>

            <section className="faction-lore-prose" aria-labelledby={`${headingId}-convergence`}>
              <span>Convergence record</span>
              <SectionHeading id={`${headingId}-convergence`}>The path to Reath</SectionHeading>
              <p>{campaign.arrivalOnReath || "This faction's first verified contact with Reath remains classified in the archive."}</p>
            </section>

            <section className="faction-lore-doctrine" aria-labelledby={`${headingId}-doctrine`}>
              <div><span>Doctrine</span><SectionHeading id={`${headingId}-doctrine`}>How they shape the world</SectionHeading></div>
              <blockquote>{faction.commander?.text || faction.city?.text}</blockquote>
              {faction.city && <p><strong>{faction.city.name}:</strong> {faction.city.text}</p>}
            </section>

            {leaders.length > 0 && <section className="faction-lore-figures" aria-labelledby={`${headingId}-figures`}>
              <div className="faction-lore-section-heading"><span>People and presences</span><SectionHeading id={`${headingId}-figures`}>Key figures</SectionHeading></div>
              <div className="faction-lore-figure-grid">
                {leaders.map((leader, index) => <article key={`${leader.name}-${index}`}><span>{leader.role || "Archive subject"}</span><FigureHeading>{leader.name}</FigureHeading><p>{leader.description || "This figure's complete record remains contested."}</p></article>)}
              </div>
            </section>}

            {campaign.chapters?.length > 0 && <section className="faction-lore-chronicle" aria-labelledby={`${headingId}-chronicle`}>
              <div className="faction-lore-section-heading"><span>Historical sequence</span><SectionHeading id={`${headingId}-chronicle`}>Campaign chronicle</SectionHeading></div>
              <ol>{campaign.chapters.map((chapter) => <li key={chapter.id}><span>{chapter.title}</span><p>{chapter.story}</p></li>)}</ol>
            </section>}

            <footer className="faction-lore-actions">
              <button type="button" onClick={() => onOpenCampaign(faction.id)}>Open {faction.name} campaign</button>
            </footer>
          </article>}
        </div>
      </div>
    </Page>
  );
}
