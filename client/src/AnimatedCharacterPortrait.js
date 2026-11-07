import { CHARACTER_PORTRAIT_FRAME, portraitAssetUrl, resolveCharacterPortrait } from "./characterPortraits";
import "./AnimatedCharacterPortrait.css";

export default function AnimatedCharacterPortrait({
  speaker,
  factionId,
  image = "",
  speaking = false,
  animated = true,
  compact = false,
  decorative = false,
  className = ""
}) {
  const source = portraitAssetUrl(resolveCharacterPortrait(speaker, factionId, image));
  const classes = [
    "animated-character-portrait",
    speaking && animated ? "is-speaking" : "",
    animated ? "is-animated" : "is-static",
    compact ? "is-compact" : "",
    className
  ].filter(Boolean).join(" ");
  return (
    <span className={classes} role={decorative ? undefined : "img"} aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : `${speaker || "Character"} portrait`}>
      <span className="animated-character-portrait-window">
        <img className="animated-character-portrait-art" src={source} alt="" draggable={false} />
        <span className="animated-character-portrait-breath" aria-hidden="true" />
        <span className="animated-character-portrait-mouth" aria-hidden="true" />
        <span className="animated-character-portrait-scan" aria-hidden="true" />
      </span>
      <img className="animated-character-portrait-frame" src={portraitAssetUrl(CHARACTER_PORTRAIT_FRAME)} alt="" draggable={false} />
      {animated && <span className="animated-character-portrait-live" aria-hidden="true" />}
    </span>
  );
}
