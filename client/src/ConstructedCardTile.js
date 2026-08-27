import { FactionArtwork, resolveVisualAsset } from "./GauntletVisuals";
import "./ConstructedCardTile.css";

export default function ConstructedCardTile({
  card,
  rarity,
  count,
  owned,
  availableVariants,
  selectedVariantId,
  valueCount,
  maxReplacementsPerValue,
  canAdd,
  suitChoices,
  replacementSuits,
  onQuantityChange,
  onVariantChange,
  onSuitChange
}) {
  const selectedVariant = availableVariants.find((variant) => variant.variantId === selectedVariantId)
    || availableVariants[0]
    || null;
  const art = resolveVisualAsset(selectedVariant?.art);
  const selected = count > 0;
  const presentationName = selectedVariant?.paid
    ? `${selectedVariant.edition} ${selectedVariant.finish}`
    : "Standard earned presentation";

  return (
    <article
      className={`constructed-card-tile ${selected ? "is-selected" : ""} rarity-${card.rarity}`}
      style={{ "--rarity-color": rarity.color, "--rarity-border": rarity.border }}
      data-art-state={art ? "integrated" : "faction-fallback"}
    >
      <div className="constructed-card-art">
        {art ? (
          <img src={art} alt="" loading="lazy" />
        ) : (
          <FactionArtwork factionId={card.factionId} decorative />
        )}
        <span className="constructed-card-art-shade" />
        <span className="constructed-card-value" aria-label={`Value ${card.value}`}>{card.value}</span>
        <span className="constructed-card-art-status">{art ? selectedVariant?.finish || "Art" : `${card.factionId} archive`}</span>
      </div>

      <div className="constructed-card-content">
        <header>
          <div>
            <span className="constructed-card-kicker">{rarity.label} · {card.type}</span>
            <h5>{card.name}</h5>
          </div>
          <span className="constructed-card-owned" aria-label={`${count} used of ${owned} owned`}>
            <strong>{count}</strong> / {owned}
          </span>
        </header>

        <p className="constructed-card-rules">{card.text}</p>

        <div className="constructed-card-usage">
          <span>{valueCount}/{maxReplacementsPerValue} value-{card.value} slots used</span>
          <div className="constructed-card-quantity" aria-label={`${card.name} quantity controls`}>
            <button type="button" onClick={() => onQuantityChange(count - 1)} disabled={count <= 0} aria-label={`Remove ${card.name}`}>−</button>
            <strong>{count}</strong>
            <button type="button" onClick={() => onQuantityChange(count + 1)} disabled={!canAdd} aria-label={`Add ${card.name}`}>+</button>
          </div>
        </div>

        {selected && (
          <div className="constructed-card-suits">
            <span>Replacing</span>
            <div>
              {Array.from({ length: count }, (_, copyIndex) => (
                <label key={`${card.id}-suit-${copyIndex}`}>
                  <span className="sr-only">{card.name} replacement suit {copyIndex + 1}</span>
                  <select
                    value={suitChoices[copyIndex]}
                    onChange={(event) => onSuitChange(copyIndex, event.target.value)}
                    aria-label={`${card.name} replacement suit ${copyIndex + 1}`}
                  >
                    {replacementSuits.map((suit) => <option key={suit.id} value={suit.id}>{suit.label}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </div>
        )}

        {availableVariants.length > 0 && (
          <details className="constructed-card-presentation">
            <summary>
              <span>Presentation</span>
              <strong>{presentationName}</strong>
            </summary>
            <label>
              <span>Owned collector presentation</span>
              <select value={selectedVariantId} onChange={(event) => onVariantChange(event.target.value)}>
                {availableVariants.map((variant) => (
                  <option key={variant.variantId} value={variant.variantId}>
                    {variant.paid ? `${variant.edition} ${variant.finish}` : "Standard earned presentation"}
                  </option>
                ))}
              </select>
              <small>Presentation only. Rules use {card.gameplayCardId || card.id}.</small>
            </label>
          </details>
        )}
      </div>
    </article>
  );
}
