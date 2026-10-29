import React from "react";
import { DestinationIcon } from "./PlayerShell";
import { resolveVisualAsset } from "../GauntletVisuals";
import { ACTION_ART, ACTION_ART_POSITIONS } from "./menuArtwork";

/** One short action cue keeps the whole-card destination clear. */
export default function ActionTile({ id, title, description, outcome, onClick, disabled = false, icon, artwork = ACTION_ART[id], tone = typeof icon === "string" ? icon : "campaign", className = "" }) {
  return (
    <button
      type="button"
      className={`cd-action-tile${artwork ? " has-artwork" : ""} ${className}`.trim()}
      data-action-id={id}
      data-tone={tone}
      onClick={onClick}
      disabled={disabled}
    >
      {(artwork || icon) && <span className="cd-action-visual" aria-hidden="true">
        {artwork && <span className="cd-action-art"><img src={resolveVisualAsset(artwork)} style={{ objectPosition: ACTION_ART_POSITIONS[id] }} alt="" loading="lazy" decoding="async" draggable={false} /></span>}
        {icon && <span className="cd-action-icon">{typeof icon === "string" ? <DestinationIcon name={icon} /> : icon}</span>}
      </span>}
      <span className="cd-action-copy">
        <span className="cd-action-title">{title}</span>
        <span className="cd-action-outcome">{outcome || description}</span>
      </span>
      <span className="cd-action-arrow" aria-hidden="true">↗</span>
    </button>
  );
}
