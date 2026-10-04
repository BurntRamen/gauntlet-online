const SET_THEMES = {
  initiative: { accent: "#f6c453", glow: "rgba(246,196,83,.36)", background: "linear-gradient(145deg, #020617, #111827 48%, #172554 100%)", art: "radial-gradient(circle at 50% 20%, rgba(246,196,83,.22), transparent 32%)" },
  legacies: { accent: "#c4b5fd", glow: "rgba(196,181,253,.34)", background: "linear-gradient(145deg, #1e1b4b, #581c87 52%, #172554 100%)" },
  "fractured-realms": { accent: "#fb923c", glow: "rgba(251,146,60,.28)", background: "linear-gradient(145deg, #431407, #7c2d12 45%, #1f2937 100%)" }
};

const FACTION_NAMES = {
  rumin: "Rumin", sheen: "Sheen", frumo: "Frumo", bizi: "Bizi",
  mekan: "Mekan", jali: "Jali", gracus: "Gracus", indela: "Indela",
  mtano: "M'Tano", mercaw: "Mercaw", engles: "Engles", russo: "Russo"
};

export default function CollectorSetPackTile({ product, checkoutConfigured, onBuyPack }) {
  const theme = SET_THEMES[product.setId] || SET_THEMES.initiative;
  const available = product.available !== false;
  const canPurchase = available && checkoutConfigured;
  const plannedNames = (product.plannedFactionIds || product.factionIds || []).map((id) => FACTION_NAMES[id] || id);
  const backgroundImage = product.artPath
    ? `linear-gradient(180deg, rgba(2,6,23,0.02), rgba(2,6,23,0.34)), url(${product.artPath})`
    : theme.art;
  return (
    <article className="booster-pack-tile collector-set-pack" style={{ "--pack-accent": theme.accent, "--pack-glow": theme.glow, background: theme.background, opacity: available ? 1 : 0.72 }}>
      <span className="booster-pack-shine" />
      <span className="booster-pack-crimp booster-pack-crimp-top" />
      <span className="booster-pack-crimp booster-pack-crimp-bottom" />
      <span className="booster-pack-topline">Gauntlet Collector Store</span>
      <span className="booster-pack-set">Set {product.setNumber} · Animated Styles</span>
      <strong>{product.displayName || product.setName}</strong>
      <span className="booster-pack-subtitle">{product.subtitle}</span>
      <span className={`booster-pack-art ${product.artPath ? "booster-pack-art-featured" : ""}`} style={{ backgroundImage }}>
        {!product.artPath && <span className="booster-pack-sigil">{product.setNumber}</span>}
      </span>
      <span className="booster-pack-count">{product.variantCount} collector styles · ${Number(product.priceUsd || 0).toFixed(2)}</span>
      <span className="booster-pack-slots"><span>{plannedNames.join(" · ")}</span></span>
      <button
        type="button"
        className="booster-pack-open"
        onClick={() => onBuyPack(product.id)}
        disabled={!canPurchase}
        title={!available ? product.unavailableReason : !checkoutConfigured ? "Checkout needs to be connected by the site owner." : `Buy ${product.name}`}
      >
        {!available ? "Catalog in Development" : checkoutConfigured ? `Buy for $${Number(product.priceUsd || 0).toFixed(2)}` : "Checkout Setup Required"}
      </button>
      <small style={{ zIndex: 2, color: available ? "#fde68a" : "#fed7aa", lineHeight: 1.3 }}>{available ? product.description : product.unavailableReason}</small>
    </article>
  );
}
