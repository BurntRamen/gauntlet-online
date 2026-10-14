import { useEffect, useRef } from "react";
import { useDialoguePlayback } from "./dialoguePlayback";
import DialoguePlaybackControls, { DialogueVoiceButton } from "./DialoguePlaybackControls";
import "./CampaignDialogueBlock.css";

const SPEAKER_IMAGES = {
  augustus: "/assets/gauntlet/kaiser-gauntlet.webp",
  bark: "/assets/gauntlet/sheen-card.webp",
  blackthorn: "/assets/gauntlet/sheen-card.webp",
  bobei: "/assets/gauntlet/kaiser-gauntlet.webp",
  brutus: "/assets/gauntlet/rumin-card.webp",
  cassius: "/assets/gauntlet/rumin-card.webp",
  crowd: "/assets/gauntlet/rumie.webp",
  den: "/assets/gauntlet/sheen-card.webp",
  dowan: "/assets/gauntlet/sheen-card.webp",
  focus: "/assets/gauntlet/factions/bizi/focus-conductor-of-progress.webp",
  guardian: "/assets/gauntlet/rumin-card.webp",
  hera: "/assets/gauntlet/factions/bizi/hera-general.webp",
  hushan: "/assets/gauntlet/sheen-card.webp",
  kaiser: "/assets/gauntlet/kaiser-gauntlet.webp",
  arel: "/assets/gauntlet/bizi-card.webp",
  elias: "/assets/gauntlet/rumin-card.webp",
  krauth: "/assets/gauntlet/bizi-card.webp",
  nulth: "/assets/gauntlet/frumo-card.webp",
  syllith: "/assets/gauntlet/sheen-card.webp",
  thrallmaker: "/assets/gauntlet/bizi-card.webp",
  lafayette: "/assets/gauntlet/lafayette.webp",
  leafen: "/assets/gauntlet/leafen-gao.png",
  leshan: "/assets/gauntlet/sheen-card.webp",
  marcell: "/assets/gauntlet/rumin-card.webp",
  merchant: "/assets/gauntlet/rumie.webp",
  alden: "/assets/gauntlet/factions/astral-vanguard/high-marshal-alden.webp",
  "myra cross": "/assets/gauntlet/factions/astral-vanguard/sergeant-myra-cross.webp",
  polea: "/assets/gauntlet/polea.webp",
  reane: "/assets/gauntlet/sheen-card.webp",
  remex: "/assets/gauntlet/rumin-card.webp",
  rolmus: "/assets/gauntlet/kaiser-gauntlet.webp",
  senator: "/assets/gauntlet/rumie.webp",
  severan: "/assets/gauntlet/rumin-card.webp",
  tang: "/assets/gauntlet/tang.webp",
  vercan: "/assets/gauntlet/rumin-card.webp",
  zalara: "/assets/gauntlet/frumo-card.webp"
};

function assetUrl(source) {
  if (!source || /^(?:[a-z]+:|\/\/)/i.test(source)) return source;
  return `${process.env.PUBLIC_URL || ""}${source.startsWith("/") ? source : `/${source}`}`;
}

export function getCampaignSpeakerImage(speaker) {
  const normalized = String(speaker || "").toLowerCase();
  const alias = Object.keys(SPEAKER_IMAGES).find((key) => normalized.includes(key));
  if (alias) return SPEAKER_IMAGES[alias];
  if (["ironbark", "rootlash", "goldroot", "hollowvine", "drought", "blight", "ash"].some((key) => normalized.includes(key))) return "/assets/gauntlet/sheen-card.webp";
  if (["admiral", "captain", "tide", "pirate", "corsair", "deep", "sunken"].some((key) => normalized.includes(key))) return "/assets/gauntlet/frumo-card.webp";
  if (["voltari", "silicon", "conductor", "regnum", "engine", "machine"].some((key) => normalized.includes(key))) return "/assets/gauntlet/bizi-card.webp";
  if (["xendra", "sovereign", "thrall", "conduit", "eclipse", "defender"].some((key) => normalized.includes(key))) return "/assets/gauntlet/bizi-card.webp";
  return "/assets/gauntlet/rumin-card.webp";
}

export default function CampaignDialogueBlock({ title = "Dialogue", lines = [], audio = [], compact = false, light = false, autoPlayKey = "", audioOnly = false, audioEnabled = true }) {
  const playback = useDialoguePlayback({ lines, audio, scopeKey: autoPlayKey, enabled: audioEnabled });
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
              <span className="campaign-dialogue-portrait-shell" aria-hidden="true">
                <img src={assetUrl(getCampaignSpeakerImage(entry.speaker))} alt="" />
                <i className="campaign-dialogue-mouth" />
              </span>
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
