import { useEffect, useRef } from "react";
import { useDialoguePlayback } from "./dialoguePlayback";
import DialoguePlaybackControls, { DialogueVoiceButton } from "./DialoguePlaybackControls";
import AnimatedCharacterPortrait from "./AnimatedCharacterPortrait";
import { resolveCharacterPortrait } from "./characterPortraits";
import "./CampaignDialogueBlock.css";

export function getCampaignSpeakerImage(speaker, factionId) {
  return resolveCharacterPortrait(speaker, factionId);
}

export default function CampaignDialogueBlock({ title = "Dialogue", lines = [], audio = [], track = null, factionId = "default", compact = false, light = false, autoPlayKey = "", audioOnly = false, audioEnabled = true }) {
  const playback = useDialoguePlayback({ lines, audio, track, factionId, scopeKey: autoPlayKey, enabled: audioEnabled });
  const { play, hasAudio } = playback;
  const autoPlayedRef = useRef("");
  useEffect(() => {
    if (!autoPlayKey || !hasAudio || !audioEnabled || autoPlayedRef.current === autoPlayKey) return;
    const timer = window.setTimeout(() => {
      autoPlayedRef.current = autoPlayKey;
      play(0, true);
    }, 50);
    return () => window.clearTimeout(timer);
  }, [autoPlayKey, hasAudio, audioEnabled, play]);

  if (audioOnly) {
    if (!playback.mode && !playback.status.includes("blocked")) return null;
    return <div className="campaign-dialogue-audio-only"><DialoguePlaybackControls playback={playback} enabled={audioEnabled} /></div>;
  }
  if (playback.entries.length === 0) return null;

  const themeClass = light ? " is-light" : "";
  const sizeClass = compact ? " is-compact" : "";
  return (
    <section className={`campaign-dialogue-block${themeClass}${sizeClass}`}>
      <div className="campaign-dialogue-title">{title}</div>
      <DialoguePlaybackControls playback={playback} enabled={audioEnabled} />
      <div className="campaign-dialogue-exchange">
        {playback.entries.map((entry, index) => {
          const isPlaying = playback.playingIndex === index && !playback.paused;
          return (
            <article className={`campaign-dialogue-entry${isPlaying ? " is-speaking" : ""}`} key={`${entry.speaker}-${index}`}>
              <AnimatedCharacterPortrait speaker={entry.speaker} factionId={factionId} speaking={isPlaying}
                compact decorative className="campaign-dialogue-portrait-shell" />
              <span className="campaign-dialogue-copy">
                <span className="campaign-dialogue-byline">
                  <strong>{entry.speaker}</strong>
                  <DialogueVoiceButton playback={playback} index={index} enabled={audioEnabled} />
                </span>
                <span>{entry.text}</span>
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
