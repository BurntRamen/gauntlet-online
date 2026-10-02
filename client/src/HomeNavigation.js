import { useState } from "react";
import "./HomeNavigation.css";
import { FactionArtwork, resolveVisualAsset } from "./GauntletVisuals";

const AREAS = [
  { id: "play", label: "Play", detail: "Games and tables", sigil: "✦" },
  { id: "journey", label: "Journey", detail: "Learn and campaign", sigil: "⌁" },
  { id: "matches", label: "Matches", detail: "Records and replays", sigil: "◫" },
  { id: "build", label: "Build", detail: "Collection and decks", sigil: "◇" },
  { id: "identity", label: "Identity", detail: "Profile and community", sigil: "◉" }
];

export default function HomeNavigation({ activeArea, onSelectArea, onPreloadArea = () => {}, nextStep, showStudio = false, onSound = () => {}, children }) {
  const areas = showStudio ? [...AREAS, { id: "studio", label: "Studio", detail: "Owner operations", sigil: "◆" }] : AREAS;
  const activeLabel = areas.find((area) => area.id === activeArea)?.label || "Journey";

  return (
    <>
      <nav className="home-area-nav" aria-label="Gauntlet areas">
        {areas.map((area) => (
          <button
            key={area.id}
            type="button"
            data-area={area.id}
            className={activeArea === area.id ? "active" : ""}
            aria-current={activeArea === area.id ? "page" : undefined}
            onPointerEnter={() => onPreloadArea(area.id)}
            onFocus={() => onPreloadArea(area.id)}
            onClick={() => {
              if (area.id === activeArea) {
                onSelectArea(area.id);
                return;
              }
              onSelectArea(area.id);
              onSound("area");
            }}
          >
            <span className="home-area-sigil" aria-hidden="true">{area.sigil}</span>
            <span className="home-area-nav-copy"><strong>{area.label}</strong><small>{area.detail}</small></span>
          </button>
        ))}
      </nav>

      <section className="home-area-content" aria-labelledby="home-area-title">
        <div className="home-area-heading">
          <span>Command Area</span>
          <h2 id="home-area-title">{activeLabel}</h2>
        </div>
        <div className="home-area-content-inner" key={activeArea}>
          {nextStep && <NextStepNotice key={nextStep.minimizeKey || "recommendation"} nextStep={nextStep} activeArea={activeArea} onSound={onSound} />}
          {children}
        </div>
      </section>
    </>
  );
}

function NextStepNotice({ nextStep, activeArea, onSound }) {
  const [minimized, setMinimized] = useState(() => {
    if (!nextStep.minimizeKey) return false;
    try { return localStorage.getItem(nextStep.minimizeKey) === "true"; }
    catch { return false; }
  });
  function toggleMinimized() {
    const value = !minimized;
    setMinimized(value);
    try { localStorage.setItem(nextStep.minimizeKey, String(value)); }
    catch { /* Keep the control usable when browser storage is unavailable. */ }
    onSound("tab");
  }
  return (
    <section className={"journey-next-step" + (activeArea !== "journey" ? " is-contextual" : "") + (minimized ? " is-minimized" : "")} aria-labelledby="journey-next-title">
      {!minimized && <FactionArtwork factionId={nextStep.factionId || "basic"} decorative className="journey-next-art">
        {nextStep.image && <img src={resolveVisualAsset(nextStep.image)} alt="" loading="lazy" decoding="async" />}
      </FactionArtwork>}
      <div className="journey-next-copy">
        <div className="journey-next-label">{nextStep.eyebrow || "Continue Journey"}</div>
        <h2 id="journey-next-title">{minimized ? nextStep.compactTitle || nextStep.title : nextStep.title}</h2>
        <div id="journey-next-details" hidden={minimized}>
          <p>{nextStep.description}</p>
          {nextStep.progress && <span className="journey-next-progress">{nextStep.progress}</span>}
        </div>
      </div>
      <div className="journey-next-actions">
        <button type="button" className="journey-next-action" onClick={() => { onSound("commit"); nextStep.onClick(); }}>
          {nextStep.actionLabel}
        </button>
        {nextStep.minimizeKey && <button type="button" className="journey-next-toggle" aria-expanded={!minimized} aria-controls="journey-next-details" onClick={toggleMinimized}>
          {minimized ? "Show reward" : "Minimize reward"}
        </button>}
      </div>
    </section>
  );
}
