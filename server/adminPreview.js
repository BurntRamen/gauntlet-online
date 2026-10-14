// Read-only presentation projection of the exact validated draft. No executable
// templates or browser code cross the publication boundary.
function buildAdminPreview(snapshot, preview) {
  const { manifest } = preview;
  return Object.fromEntries(Object.entries(snapshot.domains).map(([domain, rows]) => [domain, Object.fromEntries(rows.map((row) => {
    const metadata = domain === "factions" ? preview.factions?.[row.id] || row
      : domain === "characters" && row.kind === "faction-role" ? preview.factions?.[row.factionId]?.[row.role] || row : row;
    let factionId = row.factionId || row.id, chapter;
    if (domain === "encounters") chapter = manifest.campaigns[factionId]?.chapters.find((entry) => entry.id === row.id);
    if (domain === "campaigns") chapter = manifest.campaigns[factionId]?.chapters[0];
    if (domain === "characters" && row.encounterId) chapter = manifest.campaigns[factionId]?.chapters.find((entry) => entry.id === row.encounterId);
    if (domain === "decks") {
      const match = Object.entries(manifest.campaigns).find(([, campaign]) => campaign.chapters.some((entry) => entry.deckTemplate?.id === row.id));
      if (match) { factionId = match[0]; chapter = match[1].chapters.find((entry) => entry.deckTemplate?.id === row.id); }
    }
    let card = domain === "cards" ? manifest.cards.find((entry) => entry.id === row.id) : domain === "assets" ? manifest.cards.find((entry) => entry.id === row.gameplayCardId) : null;
    if (domain === "assets" && card) card = { ...card, presentation: manifest.collectorVariants.find((entry) => entry.variantId === row.id)?.presentation || card.presentation };
    return [row.id, { card, art: domain === "assets" ? card?.presentation?.illustration || row.art : manifest.collectorVariants.find((entry) => entry.variantId === card?.defaultVariantId)?.art,
      title: metadata.name || metadata.title || metadata.commanderName || metadata.id, image: metadata.cardImage || metadata.image || metadata.art || metadata.coverImage,
      description: metadata.description || metadata.pitch || metadata.text,
      chapterProps: chapter ? { campaign: manifest.campaigns[factionId], factionId, chapter, chapterIndex: manifest.campaigns[factionId].chapters.indexOf(chapter), theme: { primary: "#efc06e", border: "#73613e" }, difficulty: chapter.setup || snapshot.domains.encounters.find((e) => e.id === chapter.id)?.runtime?.difficulty || {} } : null }];
  }))]));
}
module.exports = { buildAdminPreview };
