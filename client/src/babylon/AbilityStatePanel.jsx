import { formatMatchLogEntry } from './matchLog';

export default function AbilityStatePanel({ viewModel, commands }) {
  const local = viewModel?.players?.[viewModel?.perspective?.player];
  const cards = [...(viewModel?.hand || []), ...(viewModel?.lanes || []).map(l => l.localCard), ...(viewModel?.attacks || []).map(a => a.card)]
    .filter(c => c?.visible && c.valueBreakdown?.modifiers?.length);
  const distinct = [...new Map(cards.map(c => [c.id, c])).values()];
  const events = (viewModel?.effectHistory || []).filter(e => !e.private || e.source || e.card).slice(-8).reverse();
  return <section className="ability-state-panel" aria-label="Effects and private knowledge">
    <h3>Effects and private knowledge</h3>
    {local && <p>Attacks this turn: {local.progress?.attacks || 0} · Blocks: {local.progress?.blocks || 0}
      {local.progress?.previousValue != null && ` · Last printed value: ${local.progress.previousValue}`}
      {local.progress?.previousSuit && ` · Previous attack suit: ${local.progress.previousSuit}`}
      {local.factionId === 'bizi' && ` · Acceleration: ${local.accelerationCounters}`}
      {local.factionId === 'jali' && ` · Revenants: ${local.revenants}`}</p>}
    <div className="ability-state-columns">
      <section aria-label="Current card effects"><h4>Current card effects</h4>
        {distinct.length === 0 && <p>No temporary card modifiers.</p>}
        {distinct.map(card => <article key={card.id}><button type="button" onClick={() => commands.inspectCard?.(card.raw)}>{card.raw?.name || card.label}</button>
          <strong>{card.valueBreakdown.equation}</strong><small>Printed eligibility: {card.printedValue ?? card.value} · payment has its own modifiers</small>
          {card.valueBreakdown.modifiers.map(e => <small key={e.id}>{e.source.name} {e.amount >= 0 ? '+' : ''}{e.amount} · {e.duration?.kind === 'combat' ? 'this combat' : 'until turn end'}</small>)}
        </article>)}
        {(local?.pendingEffects || []).map(e => <article key={e.key}><strong>{e.source}: {e.label}</strong><small>{typeof e.value === 'number' ? `Amount ${e.value} · ` : ''}{e.duration}</small></article>)}
        {(local?.guests || []).map(g => <p key={g.id}>{g.label} · Guest{g.invited ? ' · invited for next matching value' : ''}</p>)}
      </section>
      <section aria-label="Private inspections"><h4>Private inspections</h4>
        {!viewModel?.privatePeeks?.length && <p>No private inspection recorded.</p>}
        {(viewModel?.privatePeeks || []).slice(-6).reverse().map(e => <article key={e.id}><button type="button" onClick={() => commands.inspectCard?.(e.card)}>{e.card.name || `${e.card.rank}${e.card.suit}`}</button><small>Turn {e.turn} · {e.source || 'Private peek'} · only you can see this recorded result; the card may have moved since.</small></article>)}
      </section>
      <section aria-label="Ability history"><h4>Recent effects</h4>{events.map(e => { const text = formatMatchLogEntry(e); return <article key={e.id}><strong>{text.title}</strong><small>{text.detail}</small></article>; })}</section>
    </div>
  </section>;
}
