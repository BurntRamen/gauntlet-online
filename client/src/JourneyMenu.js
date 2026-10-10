import { resolveVisualAsset } from "./GauntletVisuals";
import "./JourneyMenu.css";

export const JOURNEY_ART = "/assets/gauntlet/menus/journey-expedition-v1.webp";
export const TUTORIAL_ART = "/assets/gauntlet/menus/tutorial-table-v1.webp";

export default function JourneyIntroduction({ campaigns = {}, completedChapters = 0 }) {
  const factions = Object.values(campaigns);
  const chapterCount = factions.reduce((total, faction) => total + (faction.chapters?.length || 0), 0);
  return (
    <header className="journey-introduction" style={{ "--journey-art": `url("${resolveVisualAsset(JOURNEY_ART)}")` }}>
      <div className="journey-introduction-copy">
        <span className="journey-eyebrow">The academy &amp; the archives</span>
        <h3>Begin your journey.</h3>
        <p>Learn the rhythm of Gauntlet, then follow a commander through their campaign. Your next chapter is waiting.</p>
        <dl className="journey-introduction-stats">
          <div><dt>Factions</dt><dd>{factions.length}</dd></div>
          <div><dt>Chapters</dt><dd>{chapterCount}</dd></div>
          <div><dt>Chapters cleared</dt><dd>{completedChapters}</dd></div>
        </dl>
      </div>
    </header>
  );
}
