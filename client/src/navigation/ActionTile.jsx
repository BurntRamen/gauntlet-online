import React from "react";
import { DestinationIcon } from "./PlayerShell";

/** The outcome stays visible: players should know what the button does before clicking. */
export default function ActionTile({ id, title, description, outcome, onClick, disabled = false, icon, className = "" }) {
  return (
    <button
      type="button"
      className={`cd-action-tile ${className}`.trim()}
      data-action-id={id}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <span className="cd-action-icon" aria-hidden="true">{typeof icon === "string" ? <DestinationIcon name={icon} /> : icon}</span>}
      <span className="cd-action-copy">
        <span className="cd-action-title">{title}</span>
        <span className="cd-action-description">{description}</span>
        <span className="cd-action-outcome">{outcome}</span>
      </span>
      <span className="cd-action-arrow" aria-hidden="true">↗</span>
    </button>
  );
}
