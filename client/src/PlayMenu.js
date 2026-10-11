import { useRef } from "react";
import { resolveVisualAsset } from "./GauntletVisuals";
import "./PlayMenu.css";

const SCENES = [
  { id: "practice", label: "Practice", detail: "Learn & experiment", mark: "01", title: "Master your next move.", eyebrow: "The training grounds", description: "Find your rhythm at the table. Learn the core game or put a faction through its paces against AI.", image: "play" },
  { id: "tables", label: "Tables", detail: "Play with friends", mark: "02", title: "A seat at your table.", eyebrow: "Private matches", description: "Challenge a friend to a duel, bring a group together, or watch a match unfold.", image: "play" },
  { id: "ranked", label: "Ranked", detail: "Enter the competition", mark: "03", title: "Make your mark.", eyebrow: "The ranked arena", description: "Bring your best game. Find an opponent, build your record, and climb the seasonal standings.", image: "matches" },
  { id: "events", label: "Events", detail: "Scheduled competition", mark: "04", title: "Rise to the occasion.", eyebrow: "The tournament hall", description: "Find your next event, choose your lineup, and compete alongside the Gauntlet community.", image: "matches" },
  { id: "draft", label: "Draft", detail: "Draft & sealed", mark: "05", title: "Every pick is a possibility.", eyebrow: "The drafting room", description: "Draft your picks or open a Sealed pool. Build a deck that is yours, one card at a time.", image: "build" }
];

export function PlayMenu({ view, onSelectView, children }) {
  const tabs = useRef([]);
  const scene = SCENES.find(({ id }) => id === view) || SCENES[0];
  const image = `/assets/gauntlet/backgrounds/gauntlet-menu-${scene.image}-${scene.image === "matches" ? "v2" : "v1"}.jpg`;

  function moveTab(event, index) {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % SCENES.length;
    else if (event.key === "ArrowLeft") next = (index + SCENES.length - 1) % SCENES.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = SCENES.length - 1;
    else return;
    event.preventDefault();
    onSelectView(SCENES[next].id);
    tabs.current[next]?.focus();
  }

  return (
    <div className={`play-menu scene-${scene.id}`}>
      <header className="play-scene-hero" style={{ "--scene-art": `url("${resolveVisualAsset(image)}")` }}>
        <div className="play-scene-copy">
          <span className="play-eyebrow">{scene.eyebrow}</span>
          <h3>{scene.title}</h3>
          <p>{scene.description}</p>
        </div>
        <span className="play-scene-inscription" aria-hidden="true">GAUNTLET <span> / </span> {scene.mark}</span>
      </header>
      <div className="play-scene-tabs" role="tablist" aria-label="Play formats">
        {SCENES.map((item, index) => (
          <button key={item.id} ref={(element) => { tabs.current[index] = element; }} type="button" role="tab"
            id={`play-tab-${item.id}`} aria-label={item.label} aria-controls={`play-panel-${item.id}`} aria-selected={view === item.id}
            tabIndex={view === item.id ? 0 : -1} onKeyDown={(event) => moveTab(event, index)} onClick={() => onSelectView(item.id)}>
            <span className="play-tab-number" aria-hidden="true">{item.mark}</span>
            <span><strong>{item.label}</strong><small>{item.detail}</small></span>
            <span className="play-tab-arrow" aria-hidden="true">↗</span>
          </button>
        ))}
      </div>
      <div className="play-scene-panel" role="tabpanel" id={`play-panel-${scene.id}`} aria-labelledby={`play-tab-${scene.id}`} tabIndex={0}>
        {children}
      </div>
    </div>
  );
}

export function PlayModeCard({ title, eyebrow, description, image, action, accent = "brass", disabled, onClick }) {
  return (
    <button type="button" className={`play-mode-card accent-${accent}`} onClick={onClick} disabled={disabled}>
      <img className="play-mode-art" src={resolveVisualAsset(image)} alt="" loading="lazy" decoding="async" />
      <span className="play-mode-shade" aria-hidden="true" />
      <span className="play-mode-copy">
        <span className="play-eyebrow">{eyebrow}</span>
        <strong>{title}</strong>
        <span className="play-mode-description">{description}</span>
        <span className="play-mode-action">{action}<span aria-hidden="true">↗</span></span>
      </span>
    </button>
  );
}
