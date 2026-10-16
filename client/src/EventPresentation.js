export function Reward({ tier, earned }) {
  const parts = [];
  if (tier.gold) parts.push(`${Number(tier.gold).toLocaleString()} gold`);
  if (tier.boosterCredits) parts.push(`${tier.boosterCredits} booster credit${tier.boosterCredits === 1 ? "" : "s"}`);
  if (tier.cardStyleId) parts.push("animated collector card style");
  return <li className={earned ? "is-earned" : ""}>
    <strong>{tier.wins} win{tier.wins === 1 ? "" : "s"}</strong>
    <span>{parts.join(" + ")}</span>
    <small>{earned ? "Earned" : "Upcoming"}</small>
  </li>;
}

export function localDate(value, options = {}) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", ...options
  }).format(new Date(value));
}

export function scheduleSummary(event) {
  if (!event?.schedule) return "Always available";
  return `${localDate(event.schedule.startsAt)} – ${localDate(event.schedule.endsAt, { year: undefined })}`;
}


export function EventHeader({ event }) { const entryAmount = Number(event.entryCost?.amount || 0); return (<header>
      <div><span className="event-eyebrow">{event.scale === "major" ? "Featured major" : "Gauntlet Events"}</span><h2>{event.name}</h2><p>{event.description}</p>{event.schedule && <p className="event-selected-schedule"><strong>{event.availability?.label}</strong> · {scheduleSummary(event)}<br /><small>Registration closes {localDate(event.schedule.entryClosesAt)}.</small></p>}</div>
      <div className="event-entry-cost"><small>Entry</small><strong>{entryAmount === 0 ? "Free" : `${entryAmount} booster credits`}</strong></div>
    </header>); }
