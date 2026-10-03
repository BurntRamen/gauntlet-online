import CampaignChapterBriefing from "../CampaignChapterBriefing";
import SpecialCardFace from "../SpecialCardFace";
const title = row => row.name || row.title || row.commanderName || row.id;

export default function WorkshopPreview({ preview, domain, row, catalog, onClose, guide, suit = "spades", variantId, source = "draft" }) {
  const manifest = preview.manifest;
  const metadata = domain === "factions" ? preview.factions?.[row.id] || row
    : domain === "characters" && row.kind === "faction-role" ? preview.factions?.[row.factionId]?.[row.role] || row : row;
  let factionId = row.factionId || row.id;
  let chapter;
  if (domain === "encounters") chapter = manifest.campaigns[factionId]?.chapters.find((entry) => entry.id === row.id);
  if (domain === "campaigns") chapter = manifest.campaigns[factionId]?.chapters[0];
  if (domain === "characters" && row.encounterId) chapter = manifest.campaigns[factionId]?.chapters.find((entry) => entry.id === row.encounterId);
  if (domain === "decks") {
    const match = Object.entries(manifest.campaigns).find(([, campaign]) => campaign.chapters.some((entry) => entry.deckTemplate?.id === row.id));
    if (match) { factionId = match[0]; chapter = match[1].chapters.find((entry) => entry.deckTemplate?.id === row.id); }
  }
  let card = domain === "cards" ? manifest.cards.find((entry) => entry.id === row.id) : domain === "assets" ? manifest.cards.find((entry) => entry.id === row.gameplayCardId) : null;
  if (domain === "assets" && card) {
    const variant = manifest.collectorVariants.find((entry) => entry.variantId === row.id);
    card = { ...card, collector: variant, presentation: variant?.presentation || card.presentation };
  }
  if (card) {
    const selectedVariant = manifest.collectorVariants.find((entry) => entry.variantId === (variantId || card.defaultVariantId));
    card = { ...card, suit, ...(selectedVariant ? { collector: selectedVariant, presentation: selectedVariant.presentation || card.presentation } : {}) };
  }
  const art = domain === "assets" ? card?.presentation?.illustration || row.art : manifest.collectorVariants.find((entry) => entry.variantId === card?.defaultVariantId)?.art;
  return <section className="admin-preview" aria-label="Isolated draft preview">
    <div className="admin-title-row"><h4>{source === "live" ? "Live presentation" : "Saved draft preview"}</h4><button onClick={onClose}>Close preview</button></div>
    <p className="admin-note">{guide.previewPurpose}</p>
    {chapter ? <CampaignChapterBriefing campaign={manifest.campaigns[factionId]} factionId={factionId} chapter={chapter} chapterIndex={manifest.campaigns[factionId].chapters.indexOf(chapter)} theme={{ primary: "#efc06e", border: "#73613e" }} difficulty={chapter.setup || catalog?.domains.encounters.find((entry) => entry.id === chapter.id)?.definition.runtime.difficulty || {}} completed unlocked canPlayAsPlayer={false} previewOnly audioEnabled={false} musicEnabled={false} onBack={onClose} />
      : card ? <><div className="admin-card-preview"><SpecialCardFace card={card} art={art} /></div><h4>{card.name}</h4><p>{card.text}</p><p className="admin-note">{guide.cardPreview}</p>{art && <img className="admin-art-preview" src={art} alt="Selected draft illustration" />}</>
      : <article><h4>{title(metadata)}</h4>{(metadata.cardImage || metadata.image || metadata.art || metadata.coverImage) && <img className="admin-art-preview" src={metadata.cardImage || metadata.image || metadata.art || metadata.coverImage} alt={title(metadata)} />}<p>{metadata.description || metadata.pitch || metadata.text}</p><p className="admin-note">{guide.metadataPreview}</p></article>}
  </section>;
}
