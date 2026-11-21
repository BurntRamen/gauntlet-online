import React from "react";
import { DestinationIcon } from "./PlayerShell";
import { resolveVisualAsset } from "../GauntletVisuals";
import { ACTION_ART, ACTION_ART_POSITIONS } from "./menuArtwork";

/** The whole illustrated tile is one destination; its outcome remains available to assistive technology. */
export default function ActionTile({ id, title, description, outcome, badge, onClick, disabled = false, icon, artwork = ACTION_ART[id], tone = typeof icon === "string" ? icon : "campaign", className = "" }) {
  return (
    <button
      type="button"
      className={`cd-action-tile${artwork ? " has-artwork" : ""} ${className}`.trim()}
      data-action-id={id}
      data-tone={tone}
      onClick={onClick}
      disabled={disabled}
      aria-description={outcome || description}
    >
      {(artwork || icon) && <span className="cd-action-visual" aria-hidden="true">
        {artwork && <span className="cd-action-art"><img src={resolveVisualAsset(artwork)} style={{ objectPosition: ACTION_ART_POSITIONS[id] }} alt="" loading="lazy" decoding="async" draggable={false} /></span>}
        {icon && <span className="cd-action-icon">{typeof icon === "string" ? <DestinationIcon name={icon} /> : icon}</span>}
      </span>}
      <span className="cd-action-copy">
        {badge && <span className="cd-action-badge">{badge}</span>}
        <span className="cd-action-title">{title}</span>
        {description && <span className="cd-action-description">{description}</span>}
      </span>
      <span className="cd-action-arrow" aria-hidden="true">↗</span>
    </button>
  );
}
