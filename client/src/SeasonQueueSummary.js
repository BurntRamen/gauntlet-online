import "./SeasonZero.css";
export function SeasonQueueSummary({ season, bestOf = 1 }) {
  if (!season) return null;
  const scoring = season.scoring || { win: 3, draw: 1, loss: 0 };
  return (
    <div className="season-queue-summary">
      <span>{season.status === "active" ? "Active season" : season.status}</span>
      <strong>{season.displayName}</strong>
      <small>Ranked {Number(bestOf) === 3 ? "BO3" : "BO1"} · {Number(bestOf) === 3 ? "series result scores standings points" : "each completed match scores standings points"}</small>
      <small>Win {scoring.win ?? 3} · Draw {scoring.draw ?? 1} · Loss {scoring.loss ?? 0} points</small>
      <p>Live-player queue: during quiet periods your search waits for another player instead of creating a bot.</p>
    </div>
  );
}

