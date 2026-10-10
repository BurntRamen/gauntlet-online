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
  const areas = showStudio ? [...AREAS, { id: "studio", label: "Admin", detail: "Content and operations", sigil: "◆" }] : AREAS;
  const activeLabel = areas.find((area) => area.id === activeArea)?.label || "Journey";

  return (
    <div className={`home-navigation home-navigation-${activeArea}`}>
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
          {children}
        </div>
      </section>
      {nextStep && <NextStepNotice nextStep={nextStep} activeArea={activeArea} onSound={onSound} />}
    </div>
  );
}

function NextStepNotice({ nextStep, activeArea, onSound }) {
  return (
    <section className={"journey-next-step" + (activeArea !== "journey" ? " is-contextual" : "")} aria-labelledby="journey-next-title">
      {<FactionArtwork factionId={nextStep.factionId || "basic"} decorative className="journey-next-art">
        {nextStep.image && <img src={resolveVisualAsset(nextStep.image)} alt="" loading="lazy" decoding="async" />}
      </FactionArtwork>}
      <div className="journey-next-copy">
        <div className="journey-next-label">{nextStep.eyebrow || "Continue Journey"}</div>
        <h2 id="journey-next-title">{nextStep.title}</h2>
        <div id="journey-next-details">
          <p>{nextStep.description}</p>
          {nextStep.progress && <span className="journey-next-progress">{nextStep.progress}</span>}
        </div>
      </div>
      <div className="journey-next-actions">
        <button type="button" className="journey-next-action" onClick={() => { onSound("commit"); nextStep.onClick(); }}>
          {nextStep.actionLabel}
        </button>
        {nextStep.onMinimize && <button type="button" className="journey-next-toggle" aria-expanded="true" aria-controls="journey-next-details" onClick={() => { nextStep.onMinimize(); onSound("tab"); }}>
          Minimize reward
        </button>}
      </div>
    </section>
  );
}

export function useVaultRewardPreference(playerId) {
  const key = "gauntlet:vault-reward-minimized:" + (playerId || "guest");
  const [changes, setChanges] = useState({});
  let saved = false;
  try { saved = localStorage.getItem(key) === "true"; } catch {}
  return [changes[key] ?? saved, (value) => {
    setChanges(previous => ({ ...previous, [key]: value }));
    try { localStorage.setItem(key, String(value)); } catch {}
  }];
}

export function VaultCreditBadge({ credits, onRestore }) {
  if (credits <= 0) return null;
  const label = credits + " unused pack credit" + (credits === 1 ? "" : "s") + ". Show vault reward";
  return <button type="button" className="vault-credit-badge" aria-label={label} title={label} onClick={onRestore}>
    <img src={resolveVisualAsset("/assets/gauntlet/ui/vault-pack-credits-v1.webp")} alt="" width="32" height="32" />
    <strong>{credits}</strong>
  </button>;
}
