import CurrencyWallet from "./CurrencyWallet";

export default function EconomyShop({ economy, pending, onBuyGameplayPack, onBuyTimetwisters }) {
  if (!economy) return <p className="economy-sign-in">Sign in to earn gold, complete daily quests, and use the shop.</p>;
  const quests = economy.daily?.quests || [];
  const prices = economy.gameplayPackPrices || { gold: 1000, timetwisters: 200 };
  return <div className="economy-shop">
    <CurrencyWallet economy={economy} />
    <section className="daily-quests" aria-labelledby="daily-quests-title">
      <div className="collection-view-heading"><div><h3 id="daily-quests-title">Daily Quests</h3><p>Quests refresh each UTC day. Gold is awarded as soon as a quest is completed.</p></div><strong>{economy.daily?.date || "Today"}</strong></div>
      <div className="daily-quest-grid">
        {quests.map((quest) => <article key={quest.id} className={quest.rewardClaimedAt ? "is-complete" : ""}>
          <span>{quest.rewardClaimedAt ? "Complete" : "Daily"}</span>
          <h4>{quest.name}</h4>
          <p>{quest.description}</p>
          <div className="quest-progress"><i style={{ width: `${Math.min(100, (quest.progress / quest.target) * 100)}%` }} /></div>
          <footer><strong>{quest.progress}/{quest.target}</strong><b>● {quest.gold} gold</b></footer>
        </article>)}
      </div>
    </section>
    <section className="currency-store" aria-labelledby="gameplay-pack-shop-title">
      <div className="collection-view-heading"><div><h3 id="gameplay-pack-shop-title">Gameplay Packs</h3><p>Buy one pack credit, then choose any available set or faction pack under Packs.</p></div></div>
      <div className="currency-product-grid">
        <article><span>Pack Credit</span><strong>1 Gameplay Pack</strong><p>Playable cards from the pack you choose.</p><button type="button" disabled={pending || economy.gold < prices.gold} onClick={() => onBuyGameplayPack("gold")}>● {Number(prices.gold).toLocaleString()} Gold</button></article>
        <article><span>Pack Credit</span><strong>1 Gameplay Pack</strong><p>Playable cards from the pack you choose.</p><button type="button" disabled={pending || economy.timetwisters < prices.timetwisters} onClick={() => onBuyGameplayPack("timetwisters")}>✦ {Number(prices.timetwisters).toLocaleString()} Timetwisters</button></article>
      </div>
    </section>
    <section className="currency-store" aria-labelledby="timetwister-shop-title">
      <div className="collection-view-heading"><div><h3 id="timetwister-shop-title">Buy Timetwisters</h3><p>Premium currency for packs and future shop items.</p></div><strong>{economy.checkoutConfigured ? "Checkout connected" : "Checkout pending"}</strong></div>
      <div className="currency-product-grid">
        {(economy.timetwisterProducts || []).map((product) => <article key={product.id} className="timetwister-product"><span>Premium Currency</span><strong>✦ {product.amount.toLocaleString()}</strong><p>{product.name}</p><button type="button" disabled={pending || !economy.checkoutConfigured} onClick={() => onBuyTimetwisters(product.id)}>${product.priceUsd.toFixed(2)}</button></article>)}
      </div>
    </section>
  </div>;
}
