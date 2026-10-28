import { resolveVisualAsset } from "./GauntletVisuals";
import { dossierMusicSource, useDialoguePlayback } from "./dialoguePlayback";
import DialoguePlaybackControls, { DialogueVoiceButton } from "./DialoguePlaybackControls";

export function CampaignBriefingDialogue({ title, lines = [], audio = [], factionId, scopeKey, audioEnabled = true, musicEnabled = true, musicVolume = 0.18 }) {
  const playback = useDialoguePlayback({ lines, audio, factionId, scopeKey, enabled: audioEnabled, musicSource: dossierMusicSource(factionId), musicEnabled, musicVolume });
  if (playback.entries.length === 0) return null;

  return (
    <section className="campaign-briefing-section campaign-dialogue-transcript" aria-label={title}>
      <div className="campaign-briefing-section-heading">
        <span>Dialogue archive</span>
        <h3>{title}</h3>
      </div>
      <DialoguePlaybackControls playback={playback} enabled={audioEnabled} />
      <div className="campaign-dialogue-lines">
        {playback.entries.map((entry, index) => {
          const isPlaying = playback.playingIndex === index;
          return (
            <article className={`campaign-dialogue-line${isPlaying ? " is-playing" : ""}`} key={`${entry.speaker}-${index}`}>
              <span className="campaign-dialogue-speaker-mark" aria-hidden="true">{entry.speaker.slice(0, 1)}</span>
              <div>
                <div className="campaign-dialogue-speaker">
                  <strong>{entry.speaker}</strong>
                  <DialogueVoiceButton playback={playback} index={index} enabled={audioEnabled} />
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
  factionCards = [],
  unlocked,
  completed,
  current,
  canPlayAsPlayer,
  previewOnly = false,
  audioEnabled = true,
  musicEnabled = true,
  musicVolume = 0.18,
  onBack,
  onStartChapter,
  onEnableGuest,
  onPrevious,
  onNext
}) {
  if (!campaign || !chapter) return null;
  const Narrative = previewOnly ? "section" : "main", Dossier = previewOnly ? "section" : "aside";
  const chapterNumber = chapterIndex + 1;
  const stateLabel = completed ? "Cleared" : current ? "Next Battle" : unlocked ? "Available" : "Locked";
  const art = resolveVisualAsset(chapter.image || campaign.coverImage || `/assets/gauntlet/${factionId}-card.webp`);
  const battleLabel = unlocked ? "Begin Battle" : `Clear Chapter ${chapterIndex} First`;

  return (
    <section className="campaign-briefing" style={{ "--faction-accent": theme.primary, "--faction-border": theme.border }} aria-labelledby="campaign-briefing-title">
      <header className="campaign-briefing-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(3,7,12,.84) 0%, rgba(3,7,12,.56) 48%, rgba(3,7,12,.08) 100%), url(${art})` }}>
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
        <Narrative className="campaign-briefing-main">
          <section className="campaign-briefing-section">
            <div className="campaign-briefing-section-heading">
              <span>Situation report</span>
              <h3>Mission briefing</h3>
            </div>
            {chapter.sceneStarter && (
              <aside className="campaign-scene-card" aria-label="Scene setting">
                <span>Perspective shift</span>
                <dl>
                  <div><dt>Where</dt><dd>{chapter.sceneStarter.where}</dd></div>
                  <div><dt>When</dt><dd>{chapter.sceneStarter.when}</dd></div>
                  <div><dt>Perspective</dt><dd>{chapter.sceneStarter.perspective}</dd></div>
                </dl>
              </aside>
            )}
            <p className="campaign-briefing-lede">{chapter.beforeBattle || chapter.story}</p>
            <p>{chapter.story}</p>
          </section>

          <CampaignBriefingDialogue title="Voices before the battle" lines={chapter.dialogue} audio={chapter.dialogueAudio} factionId={factionId} scopeKey={chapter.id} audioEnabled={audioEnabled} musicEnabled={musicEnabled} musicVolume={musicVolume} />

          {completed ? (
            <>
              <section className="campaign-briefing-section campaign-after-action">
                <div className="campaign-briefing-section-heading">
                  <span>Cleared archive</span>
                  <h3>After-action record</h3>
                </div>
                <p className="campaign-briefing-lede">{chapter.afterBattle}</p>
              </section>
              <CampaignBriefingDialogue title="Voices after the battle" lines={chapter.endDialogue} audio={chapter.endDialogueAudio} factionId={factionId} scopeKey={chapter.id} audioEnabled={audioEnabled} musicEnabled={musicEnabled} musicVolume={musicVolume} />
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
        </Narrative>

        <Dossier className="campaign-briefing-dossier" aria-label="Encounter dossier">
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
            <div><dt>Faction cards</dt><dd>{factionCards.length} in your deck</dd></div>
            <div><dt>First-clear reward</dt><dd>Faction pack credit</dd></div>
          </dl>
          {factionCards.length > 0 && <section className="campaign-briefing-card-plan" aria-label="Faction cards in this battle">
            <strong>Faction cards in this battle</strong>
            <p>These replace matching cards in the standard 52-card deck. Later chapters add more of the faction’s arsenal.</p>
            <ul>{factionCards.map((card) => <li key={card.id}><span>{card.name}</span><small>{card.value === 14 ? "A" : card.value === 13 ? "K" : card.value === 12 ? "Q" : card.value === 11 ? "J" : card.value} {({ spades: "♠", hearts: "♥", clubs: "♣", diamonds: "♦" })[card.suit] || card.suit}</small></li>)}</ul>
          </section>}
          <div className="campaign-briefing-notes">
            <strong>Encounter notes</strong>
            {complexity.length > 0 ? complexity.map((note) => <p key={note}>{note}</p>) : <p>Core campaign rules; no additional advanced modifier is previewed for this chapter.</p>}
          </div>
          {chapter.deckTemplate && <div className="campaign-briefing-notes"><strong>{chapter.deckTemplate.name}</strong><p>{chapter.deckTemplate.description}</p></div>}
          {!unlocked && <p className="campaign-briefing-lock-note">Clear Chapter {chapterIndex} to unlock this battle.</p>}
          {!canPlayAsPlayer && <div className="campaign-briefing-guest-entry"><p className="campaign-briefing-lock-note">{previewOnly ? "Admin preview: battle launch is disabled." : "Play immediately as a guest, or sign in to save progress and rewards."}</p>{!previewOnly && <button type="button" onClick={onEnableGuest}>Enable Guest Play</button>}</div>}
          <button type="button" className="campaign-briefing-start" onClick={() => onStartChapter(factionId, chapter.id)} disabled={previewOnly || !canPlayAsPlayer || !unlocked}>{battleLabel}</button>
        </Dossier>
      </div>

      <nav className="campaign-briefing-pagination" aria-label="Chapter briefing navigation">
        <button type="button" onClick={onPrevious} disabled={!onPrevious}>← Previous Chapter</button>
        <button type="button" onClick={onBack}>All Chapters</button>
        <button type="button" onClick={onNext} disabled={!onNext}>Next Chapter →</button>
      </nav>
    </section>
  );
}
