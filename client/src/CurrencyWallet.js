export default function CurrencyWallet({ economy, compact = false }) {
  if (!economy) return null;
  return <div className={`currency-wallet ${compact ? "is-compact" : ""}`} aria-label="Currency balances">
    <span><i className="currency-gold" aria-hidden="true">●</i><small>Gold</small><strong>{Number(economy.gold || 0).toLocaleString()}</strong></span>
    <span><i className="currency-timetwister" aria-hidden="true">✦</i><small>Timetwisters</small><strong>{Number(economy.timetwisters || 0).toLocaleString()}</strong></span>
    {(economy.gemsEnabled || economy.gems > 0 || economy.gemDebt > 0) && <span><i aria-hidden="true">◆</i><small>Gems</small><strong>{Number(economy.gems || 0).toLocaleString()}</strong>{economy.gemDebt > 0 && <small>{economy.gemDebt} pending reconciliation</small>}</span>}
  </div>;
}
