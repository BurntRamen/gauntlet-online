import { useEffect, useMemo, useRef, useState } from "react";
import { dialogueEntries, useDialoguePlayback } from "./dialoguePlayback";
import DialoguePlaybackControls from "./DialoguePlaybackControls";
import { getCampaignSpeakerImage } from "./CampaignDialogueBlock";
import "./CampaignCinematic.css";

function assetUrl(source) {
  if (!source || /^(?:[a-z]+:|\/\/)/i.test(source)) return source;
  return `${process.env.PUBLIC_URL || ""}${source.startsWith("/") ? source : `/${source}`}`;
}

export default function CampaignCinematic({ cinematic, lines = [], audio = [], audioEnabled = true, autoPlayKey = "" }) {
  const entries = useMemo(() => dialogueEntries(lines, audio), [lines, audio]);
  const playback = useDialoguePlayback({ lines, audio, scopeKey: autoPlayKey, enabled: audioEnabled });
  const [manualIndex, setManualIndex] = useState(0);
  const [silentPlaying, setSilentPlaying] = useState(false);
  const autoPlayed = useRef("");
  const activeIndex = playback.playingIndex ?? manualIndex;
  const entry = entries[Math.min(activeIndex, Math.max(0, entries.length - 1))] || { speaker: "Narrator", text: cinematic?.subtitle || "" };
  const isSpeaking = playback.playingIndex !== null && !playback.paused;
  const narrator = entry.speaker.toLowerCase() === "narrator";

  useEffect(() => {
    if (!autoPlayKey || autoPlayed.current === autoPlayKey || !audioEnabled || !playback.hasAudio) return;
    const timer = window.setTimeout(() => {
      autoPlayed.current = autoPlayKey;
      playback.play(0, true);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [autoPlayKey, audioEnabled, playback]);

  useEffect(() => {
    if (!silentPlaying || playback.hasAudio || entries.length < 2) return undefined;
    const timer = window.setTimeout(() => {
      setManualIndex((current) => {
        if (current >= entries.length - 1) {
          setSilentPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 4200);
    return () => window.clearTimeout(timer);
  }, [silentPlaying, playback.hasAudio, entries.length, manualIndex]);

  const playSilent = () => {
    setManualIndex(0);
    setSilentPlaying(true);
  };

  return (
    <section className="campaign-cinematic" aria-label={`${cinematic.title} story cinematic`}>
      <div className="campaign-cinematic-backdrop" style={{ backgroundImage: `url(${assetUrl(cinematic.image)})` }} />
      <div className="campaign-cinematic-vignette" />
      <header>
        <span>{cinematic.kicker || "Story Cinematic"}</span>
        <h2>{cinematic.title}</h2>
        <p>{cinematic.subtitle}</p>
      </header>
      {!narrator && (
        <div className={`campaign-cinematic-character${isSpeaking ? " is-speaking" : ""}`} aria-hidden="true">
          <img src={assetUrl(getCampaignSpeakerImage(entry.speaker))} alt="" />
          <i />
        </div>
      )}
      <div className="campaign-cinematic-caption" aria-live="polite">
        <strong>{entry.speaker}</strong>
        <p>{entry.text}</p>
        <div className="campaign-cinematic-progress" aria-label={`Scene ${activeIndex + 1} of ${entries.length}`}>
          {entries.map((scene, index) => <button type="button" key={`${scene.speaker}-${index}`} aria-label={`Show scene ${index + 1}`} aria-current={index === activeIndex ? "step" : undefined} onClick={() => { playback.stop(""); setSilentPlaying(false); setManualIndex(index); }} />)}
        </div>
      </div>
      <div className="campaign-cinematic-controls">
        {playback.hasAudio
          ? <DialoguePlaybackControls playback={playback} enabled={audioEnabled} />
          : <button type="button" onClick={playSilent}>{silentPlaying ? "Restart cutscene" : "Play cutscene"}</button>}
        <div>
          <button type="button" disabled={activeIndex <= 0} onClick={() => { playback.stop(""); setSilentPlaying(false); setManualIndex(Math.max(0, activeIndex - 1)); }}>Previous</button>
          <button type="button" disabled={activeIndex >= entries.length - 1} onClick={() => { playback.stop(""); setSilentPlaying(false); setManualIndex(Math.min(entries.length - 1, activeIndex + 1)); }}>Next</button>
        </div>
      </div>
    </section>
  );
}
