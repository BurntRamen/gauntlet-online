import GameIcon from "./GameIcon";
import CollectorCardPresentation from "../CollectorCardPresentation";
import { formatMatchLogEntry, matchLogSequence } from "./matchLog";
import { visualMatchLog } from "./logVisualModel";

const imagePath = (path) => path?.startsWith("/") ? `${process.env.PUBLIC_URL || ""}${path}` : path;
const playerColor = (id) => Number(id) === 1 ? "blue" : Number(id) === 2 ? "red" : "neutral";

function LogToken({ token }) {
  const { kind, label, art } = token;
  if (kind === "symbol") return <span className="visual-log-operator">{token.value}</span>;
  if (kind === "card") return (
    <span className={`visual-log-card${token.hidden ? " is-hidden" : ""}${art ? " has-art" : ""}`}
      title={label} data-card-kind={token.hidden ? "hidden" : art ? "faction" : "playing"}>
      {art && <CollectorCardPresentation card={token}><img src={imagePath(art)} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true; }} /></CollectorCardPresentation>}
      {token.hidden ? <GameIcon name="draw" size={24} /> : (
        <span className={`visual-log-rank${["♥", "♦"].includes(token.suit) ? " is-red" : ""}`}>{token.rank}<span>{token.suit}</span></span>
      )}
    </span>
  );
  if (kind === "source") return (
    <span className="visual-log-source" title={`${label} · ${token.role}`}>
      <span className="visual-log-portrait">
        <GameIcon name={token.role} size={24} />
        {art && <img src={imagePath(art)} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />}
        {art && <GameIcon name={token.role} size={13} className="visual-log-role" />}
      </span>
      <span className="visual-log-source-name">{label}</span>
    </span>
  );
  if (kind === "player") return <span className="visual-log-player" data-player-color={playerColor(token.value)} title={label}>P{token.value}</span>;
  if (kind === "lane") return <span className="visual-log-lane" title={`Lane ${token.value}`}>Lane {token.value}</span>;
  if (kind === "bonus") return <span className={`visual-log-bonus${token.value < 0 ? " is-negative" : ""}`} title={label}>
    {token.value === "?" ? "?" : `${token.value >= 0 ? "+" : "−"}${Math.abs(token.value)}`}
  </span>;
  if (kind === "status") return <span className="visual-log-status" title={label}>
    {token.icon && <GameIcon name={token.icon} size={18} />}{label}
  </span>;
  return <span className="visual-log-value" data-value-kind={token.icon || "value"} title={label}>
    {token.icon && <GameIcon name={token.icon} size={18} />}<b>{token.value}</b>
    <span className="visual-log-value-label">{label}</span>
  </span>;
}

export function VisualLogSummary({ entry, players = {}, compact = false, sequence }) {
  const model = visualMatchLog(entry, players);
  const ownerName = players[model.owner]?.accountName || players[model.owner]?.name || `Player ${model.owner}`;
  return <span className={`visual-log-summary${compact ? " is-compact" : ""}`} aria-hidden="true">
    <span className="visual-log-heading">
      {sequence != null && <span className="visual-log-sequence">#{sequence}</span>}
      {model.owner != null && <span className="visual-log-player" data-player-color={playerColor(model.owner)} title={ownerName}>P{model.owner}</span>}
      <GameIcon name={model.icon} size={18} /><span className="visual-log-action">{model.label}</span>
      {model.lane != null && <span className="visual-log-lane">Lane {model.lane}</span>}
      {entry.turn != null && <span className="visual-log-turn">T{entry.turn}</span>}
    </span>
    {model.groups.length > 0 && <span className="visual-log-tokens">
      {model.groups.map((group, index) => <span className="visual-log-group" key={index}>
        {group.map((token, tokenIndex) => <LogToken key={tokenIndex} token={token} />)}
      </span>)}
    </span>}
  </span>;
}

export function MatchLogRow({ entry, index, players = {}, compact = false }) {
  const content = formatMatchLogEntry(entry, { players });
  const sequence = matchLogSequence(entry, index);
  return <li className={`visual-log-row${compact ? " is-compact" : ""}`}>
    <details>
      <summary aria-label={`Action ${sequence}: ${content.title}${content.detail ? `. ${content.detail}` : ""}`}>
        <VisualLogSummary entry={entry} players={players} compact={compact} sequence={sequence} />
        <span className="visual-log-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div className="visual-log-explanation">
        <strong>{content.title}</strong>
        {content.detail && <p>{content.detail}</p>}
      </div>
    </details>
  </li>;
}

export function MatchLogLegend() {
  return <div className="visual-log-legend">
    <span><GameIcon name="attack" size={18} /> Attack</span>
    <span><GameIcon name="block" size={18} /> Block</span>
    <span><GameIcon name="payment" size={18} /> Payment</span>
    <span><GameIcon name="life" size={18} /> Life</span>
    <span><b>+2</b> Bonus</span>
    <span>Select an entry for details.</span>
  </div>;
}
