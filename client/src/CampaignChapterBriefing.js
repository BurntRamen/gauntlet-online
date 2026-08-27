import { useEffect, useRef, useState } from "react";
import { resolveVisualAsset } from "./GauntletVisuals";

function splitDialogueLine(line) {
  const text = String(line || "");
  const separator = text.indexOf(":");
  if (separator <= 0) return { speaker: "Narrator", text };
  return {
    speaker: text.slice(0, separator).trim(),
    text: text.slice(separator + 1).trim()
  };
}

export function CampaignBriefingDialogue({ title, lines = [], audio = [] }) {
  const activeAudioRef = useRef(null);
  const [playingIndex, setPlayingIndex] = useState(-1);
  const dialogueLines = (Array.isArray(lines) ? lines : []).filter(Boolean);
  const audioLines = Array.isArray(audio) ? audio : [];

  useEffect(() => () => {
    if (!activeAudioRef.current) return;
    activeAudioRef.current.pause();
    activeAudioRef.current.currentTime = 0;
  }, []);

  function playVoice(index) {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.currentTime = 0;
      activeAudioRef.current = null;
    }
    if (playingIndex === index) {
      setPlayingIndex(-1);
      return;
    }
    const source = audioLines[index];
    if (!source || typeof window === "undefined" || typeof window.Audio !== "function") return;
    const clip = new window.Audio(resolveVisualAsset(source));
    clip.onended = () => setPlayingIndex(-1);
    clip.onerror = () => setPlayingIndex(-1);
    activeAudioRef.current = clip;
    setPlayingIndex(index);
    clip.play().catch(() => setPlayingIndex(-1));
  }

  if (dialogueLines.length === 0) return null;

  return (
    <section className="campaign-briefing-section campaign-dialogue-transcript" aria-label={title}>
      <div className="campaign-briefing-section-heading">
        <span>Dialogue archive</span>
        <h3>{title}</h3>
      </div>
      <div className="campaign-dialogue-lines">
        {dialogueLines.map((line, index) => {
          const entry = splitDialogueLine(line);
          const hasAudio = Boolean(audioLines[index]);
          return (
            <article className="campaign-dialogue-line" key={`${entry.speaker}-${index}`}>
              <span className="campaign-dialogue-speaker-mark" aria-hidden="true">{entry.speaker.slice(0, 1)}</span>
              <div>
                <div className="campaign-dialogue-speaker">
                  <strong>{entry.speaker}</strong>
                  {hasAudio && (
                    <button type="button" onClick={() => playVoice(index)} aria-label={`${playingIndex === index ? "Stop" : "Play"} ${entry.speaker} voice`}>
                      {playingIndex === index ? "Stop Voice" : "Play Voice"}
                    </button>
                  )}
                </div>
                <p>{entry.text}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function CampaignChapterBriefing({
  campaign,
  factionId,
  theme,
  chapter,
  chapterIndex,
  difficulty,
  complexity = [],
  unlocked,
  completed,
  current,
  canPlayAsPlayer,
  onBack,
  onStartChapter,
  onPrevious,
  onNext
}) {
  if (!campaign || !chapter) return null;
  const chapterNumber = chapterIndex + 1;
  const stateLabel = completed ? "Cleared" : current ? "Next Battle" : unlocked ? "Available" : "Locked";
  const art = resolveVisualAsset(chapter.image || campaign.coverImage || `/assets/gauntlet/${factionId}-card.webp`);
  const battleLabel = unlocked ? "Begin Battle" : `Clear Chapter ${chapterIndex} First`;

  return (
    <section className="campaign-briefing" style={{ "--faction-accent": theme.primary, "--faction-border": theme.border }} aria-labelledby="campaign-briefing-title">
      <header className="campaign-briefing-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(3,7,12,.96) 0%, rgba(3,7,12,.72) 48%, rgba(3,7,12,.2) 100%), url(${art})` }}>
        <button type="button" className="campaign-briefing-back" onClick={onBack}>← Back to Chapter Map</button>
        <div className="campaign-briefing-hero-copy">
          <span>{campaign.factionName} archive · Chapter {chapterNumber} of {campaign.chapters.length}</span>
          <h2 id="campaign-briefing-title">{chapter.title}</h2>
          <p>{chapter.story}</p>
        </div>
        <div className="campaign-briefing-state">
          <span>{stateLabel}</span>
          <strong>{chapter.opponentName}</strong>
          <small>{difficulty.bossLife} life · {difficulty.attacksPerTurn} attacks per turn</small>
        </div>
      </header>

      <div className="campaign-briefing-body">
        <main className="campaign-briefing-main">
          <section className="campaign-briefing-section">
            <div className="campaign-briefing-section-heading">
              <span>Situation report</span>
              <h3>Mission briefing</h3>
            </div>
            <p className="campaign-briefing-lede">{chapter.beforeBattle || chapter.story}</p>
            <p>{chapter.story}</p>
          </section>

          <CampaignBriefingDialogue title="Voices before the battle" lines={chapter.dialogue} audio={chapter.dialogueAudio} />

          {completed ? (
            <>
              <section className="campaign-briefing-section campaign-after-action">
                <div className="campaign-briefing-section-heading">
                  <span>Cleared archive</span>
                  <h3>After-action record</h3>
                </div>
                <p className="campaign-briefing-lede">{chapter.afterBattle}</p>
              </section>
              <CampaignBriefingDialogue title="Voices after the battle" lines={chapter.endDialogue} audio={chapter.endDialogueAudio} />
            </>
          ) : (
            <section className="campaign-briefing-section campaign-after-action is-classified">
              <div className="campaign-briefing-section-heading">
                <span>Classified</span>
                <h3>After-action record</h3>
              </div>
              <p>Clear this chapter to unlock its outcome and closing dialogue.</p>
            </section>
          )}
        </main>

        <aside className="campaign-briefing-dossier" aria-label="Encounter dossier">
          <div className="campaign-briefing-section-heading">
            <span>Battle intelligence</span>
            <h3>Encounter dossier</h3>
          </div>
          <dl>
            <div><dt>Playable</dt><dd>{chapter.playableName || campaign.commanderName}</dd></div>
            <div><dt>Opponent</dt><dd>{chapter.opponentName}</dd></div>
            <div><dt>Boss life</dt><dd>{difficulty.bossLife}</dd></div>
            <div><dt>Attack tempo</dt><dd>{difficulty.attacksPerTurn} per turn</dd></div>
            <div><dt>Attack values</dt><dd>{difficulty.minAttackValue}–{difficulty.maxAttackValue}</dd></div>
            <div><dt>First-clear reward</dt><dd>Faction pack credit</dd></div>
          </dl>
          <div className="campaign-briefing-notes">
            <strong>Encounter notes</strong>
            {complexity.length > 0 ? complexity.map((note) => <p key={note}>{note}</p>) : <p>Core campaign rules; no additional advanced modifier is previewed for this chapter.</p>}
          </div>
          {!unlocked && <p className="campaign-briefing-lock-note">Clear Chapter {chapterIndex} to unlock this battle.</p>}
          {!canPlayAsPlayer && <p className="campaign-briefing-lock-note">Sign in or enable guest play to begin.</p>}
          <button type="button" className="campaign-briefing-start" onClick={() => onStartChapter(factionId, chapter.id)} disabled={!canPlayAsPlayer || !unlocked}>{battleLabel}</button>
        </aside>
      </div>

      <nav className="campaign-briefing-pagination" aria-label="Chapter briefing navigation">
        <button type="button" onClick={onPrevious} disabled={!onPrevious}>← Previous Chapter</button>
        <button type="button" onClick={onBack}>All Chapters</button>
        <button type="button" onClick={onNext} disabled={!onNext}>Next Chapter →</button>
      </nav>
    </section>
  );
}
