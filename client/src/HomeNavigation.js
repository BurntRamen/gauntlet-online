import "./HomeNavigation.css";

const AREAS = [
  { id: "play", label: "Play", detail: "Games and tables" },
  { id: "journey", label: "Journey", detail: "Learn and campaign" },
  { id: "matches", label: "Matches", detail: "Records and replays" },
  { id: "build", label: "Build", detail: "Collection and decks" },
  { id: "identity", label: "Identity", detail: "Profile and community" }
];

export default function HomeNavigation({ activeArea, onSelectArea, nextStep, showStudio = false, children }) {
  const areas = showStudio ? [...AREAS, { id: "studio", label: "Studio", detail: "Owner operations" }] : AREAS;
  const activeLabel = areas.find((area) => area.id === activeArea)?.label || "Journey";

  return (
    <>
      <section className="journey-next-step" aria-labelledby="journey-next-title">
        <div>
          <div className="journey-next-label">Continue Journey</div>
          <h2 id="journey-next-title">{nextStep.title}</h2>
          <p>{nextStep.description}</p>
        </div>
        <button type="button" className="journey-next-action" onClick={nextStep.onClick}>
          {nextStep.actionLabel}
        </button>
      </section>

      <nav className="home-area-nav" aria-label="Gauntlet areas">
        {areas.map((area) => (
          <button
            key={area.id}
            type="button"
            data-area={area.id}
            className={activeArea === area.id ? "active" : ""}
            aria-current={activeArea === area.id ? "page" : undefined}
            onClick={() => onSelectArea(area.id)}
          >
            <strong>{area.label}</strong>
            <span>{area.detail}</span>
          </button>
        ))}
      </nav>

      <section className="home-area-content" aria-labelledby="home-area-title">
        <div className="home-area-heading">
          <span>Command Area</span>
          <h2 id="home-area-title">{activeLabel}</h2>
        </div>
        {children}
      </section>
    </>
  );
}
