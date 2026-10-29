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

function chapterText(chapter) {
  return [chapter.title, chapter.story, chapter.playableName, chapter.opponentName, chapter.ally, ...(chapter.dialogue || []), ...(chapter.endDialogue || [])].join(" ").toLowerCase();
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
    description: leader.text,
    image: leader.image
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
  const names = chapters.length >= 9 ? ["Foundations", "Transformation", "Convergence"] : ["Disturbance", "Revelation", "Aftermath"];
  const size = Math.ceil(chapters.length / 3);
  return names.map((name, index) => {
    const entries = chapters.slice(index * size, Math.min(chapters.length, (index + 1) * size));
    if (!entries.length) return null;
    const first = entries[0];
    const last = entries.at(-1);
    const summary = first === last ? first.story : `${first.story} By “${last.title},” ${String(last.story || "").replace(/^./, (letter) => letter.toLowerCase())}`;
    return { name, range: first === last ? first.title : `${first.title} — ${last.title}`, summary };
  }).filter(Boolean);
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
      const characterText = leaderEntries(faction, campaign).map((character) => `${character.name} ${character.role} ${character.description}`).join(" ");
      const chapterTextValue = (campaign.chapters || []).map((chapter) => `${chapter.title} ${chapter.story}`).join(" ");
      return [faction.name, campaign.homeworld, campaign.origin, campaign.pitch, campaign.arrivalOnReath, characterText, chapterTextValue]
        .some((value) => String(value || "").toLowerCase().includes(needle));
    });
  }, [campaigns, factions, query]);
  const faction = filtered.find((entry) => entry.id === selectedId) || filtered[0] || factions.find((entry) => entry.id === selectedId) || factions[0];
  const campaign = campaigns[faction?.id] || {};
  const artwork = resolveVisualAsset(campaign.coverImage || faction?.city?.image || FACTION_VISUALS[faction?.id]?.art || faction?.cardImage);
  const leaders = leaderEntries(faction, campaign);
  const acts = storyActs(campaign);
  const setName = manifest?.draftSets?.find((set) => set.factionIds?.includes(faction?.id))?.name || SET_NAMES[faction?.setId] || "Gauntlet";

  return (
    <Page className={embedded ? "faction-lore-page is-embedded" : "faction-lore-page menu-page area-journey"} aria-labelledby={headingId} style={{ "--lore-accent": FACTION_VISUALS[faction?.id]?.accent || "#d6b884" }}>
      <div className={embedded ? "faction-lore-frame" : "faction-lore-frame menu-frame"}>
        <header className="faction-lore-header" style={{ "--lore-art": `url("${artwork}")` }}>
          <div>
            <span>World Archive</span>
            <PageHeading id={headingId}>Peoples of Gauntlet</PageHeading>
            <p>Homeworlds, defining figures, and the journeys that brought them to Reath.</p>
          </div>
          <button type="button" className="faction-lore-back" onClick={onBack}>{embedded ? "Back to Campaign" : "Back to Journey"}</button>
        </header>

        <div className="faction-lore-layout">
          <aside className="faction-lore-index" aria-label="Faction lore index">
            <label htmlFor="faction-lore-search">Search the archive</label>
            <input id="faction-lore-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Faction, world, or subject" />
            <p className="faction-lore-count" role="status">{filtered.length} {filtered.length === 1 ? "faction" : "factions"}</p>
            <div className="faction-lore-index-list">
              {filtered.map((entry) => (
                <button key={entry.id} type="button" className={entry.id === faction?.id ? "is-active" : ""} aria-current={entry.id === faction?.id ? "page" : undefined} onClick={() => setSelectedId(entry.id)}>
                  <img src={resolveVisualAsset(campaigns[entry.id]?.coverImage || FACTION_VISUALS[entry.id]?.art || entry.cardImage)} alt="" loading="lazy" draggable={false} />
                  <span><strong>{entry.name}</strong><small>{campaigns[entry.id]?.homeworld || "Origin unconfirmed"}</small></span>
                </button>
              ))}
              {filtered.length === 0 && <p className="faction-lore-empty">No archive records match that search.</p>}
            </div>
          </aside>

          {faction && <article className="faction-lore-record">
            <section className="faction-lore-hero">
              {artwork && <img className="faction-lore-hero-art" src={artwork} alt="" decoding="async" draggable={false} />}
              <div className="faction-lore-hero-copy">
                <span>{setName} faction</span>
                <FactionHeading>{faction.name}</FactionHeading>
                <p>{campaign.pitch}</p>
                <button type="button" className="faction-lore-start" onClick={() => onOpenCampaign(faction.id)}>Open {faction.name} campaign <span aria-hidden="true">↗</span></button>
              </div>
            </section>
              <dl className="faction-lore-facts">
                <div><dt>Homeworld</dt><dd>{campaign.homeworld || "Unknown"}</dd></div>
                <div><dt>Commander</dt><dd>{faction.commander?.name || campaign.commanderName}</dd></div>
                <div><dt>Chronicle</dt><dd>{campaign.chapters?.length || 0} chapters</dd></div>
              </dl>

            <nav className="faction-lore-sections" aria-label="In this faction record">
              <a href={`#${headingId}-origin`}>Origin</a>
              <a href={`#${headingId}-convergence`}>Path to Reath</a>
              <a href={`#${headingId}-doctrine`}>Doctrine</a>
              {acts.length > 0 && <a href={`#${headingId}-arc`}>Story</a>}
              {leaders.length > 0 && <a href={`#${headingId}-figures`}>Key figures</a>}
              {campaign.chapters?.length > 0 && <a href={`#${headingId}-chronicle`}>Chapters</a>}
            </nav>

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

            {acts.length > 0 && <section className="faction-lore-arc" aria-labelledby={`${headingId}-arc`}>
              <div className="faction-lore-section-heading"><span>Narrative overview</span><SectionHeading id={`${headingId}-arc`}>The faction's story</SectionHeading></div>
              <div className="faction-lore-arc-grid">{acts.map((act) => <article key={act.name}><span>{act.name}</span><FigureHeading>{act.range}</FigureHeading><p>{act.summary}</p></article>)}</div>
            </section>}

            {leaders.length > 0 && <section className="faction-lore-figures" aria-labelledby={`${headingId}-figures`}>
              <div className="faction-lore-section-heading"><span>People and presences</span><SectionHeading id={`${headingId}-figures`}>Major characters</SectionHeading><p>Each record follows the character's place in the campaign.</p></div>
              <div className="faction-lore-figure-grid">
                {leaders.map((leader, index) => {
                  const portrait = leader.image || [faction.commander, faction.general].find((entry) => entry?.name === leader.name)?.image;
                  return <article key={`${leader.name}-${index}`}>
                    {portrait && <img className="faction-lore-portrait" src={resolveVisualAsset(portrait)} alt="" loading="lazy" draggable={false} />}
                    <div><span>{leader.role || "Archive subject"}</span><FigureHeading>{leader.name}</FigureHeading><p>{leader.description || "This figure's complete record remains contested."}</p>
                    {leader.appearances.length > 0 && <small>Campaign record: {leader.appearances.map((chapter) => chapter.title).join(" · ")}</small>}</div>
                  </article>;
                })}
              </div>
            </section>}

            {campaign.chapters?.length > 0 && <section className="faction-lore-chronicle" aria-labelledby={`${headingId}-chronicle`}>
              <div className="faction-lore-section-heading"><span>Historical sequence</span><SectionHeading id={`${headingId}-chronicle`}>Campaign chronicle</SectionHeading></div>
              <ol>{campaign.chapters.map((chapter, index) => <li key={chapter.id}>
                {chapter.image && <img src={resolveVisualAsset(chapter.image)} alt="" loading="lazy" draggable={false} />}
                <div><small>Chapter {String(index + 1).padStart(2, "0")}</small><span>{chapter.title}</span><p>{chapter.story}</p></div>
              </li>)}</ol>
            </section>}

            <footer className="faction-lore-actions">
              <a href={`#${headingId}`}>Back to archive top ↑</a>
            </footer>
          </article>}
        </div>
      </div>
    </Page>
  );
}
