export function findCollectorVariant(gameplayCardId, collectorCatalog = [], selectedVariantId = "") {
  const candidates = collectorCatalog.filter((variant) => variant?.gameplayCardId === gameplayCardId);
  return candidates.find((variant) => variant.variantId === selectedVariantId)
    || candidates.find((variant) => variant.paid === false)
    || candidates[0]
    || null;
}

export function getGameplayCardArt(gameplayCardId, collectorCatalog = [], selectedVariantId = "") {
  return findCollectorVariant(gameplayCardId, collectorCatalog, selectedVariantId)?.art || "";
}

export function getCurrentDeckVersion(deck) {
  if (!deck) return null;
  const versions = Array.isArray(deck.versions) ? deck.versions : [];
  return versions.find((version) => version.id === deck.currentVersionId)
    || versions[versions.length - 1]
    || deck;
}

export function getDeckFeaturedArt(deck, collectorCatalog = [], limit = 3) {
  if (Array.isArray(deck?.featuredArt) && deck.featuredArt.length > 0) {
    return [...new Set(deck.featuredArt.filter(Boolean))].slice(0, limit);
  }

  const version = getCurrentDeckVersion(deck) || {};
  const quantities = version.gameplayCardQuantities || version.cardQuantities || {};
  const selectedVariants = version.collectorVariantSelections || {};
  const ids = Object.entries(quantities)
    .filter(([, count]) => Number(count || 0) > 0)
    .map(([gameplayCardId]) => gameplayCardId);

  if (ids.length === 0 && Array.isArray(version.cards)) {
    ids.push(...version.cards.map((card) => card?.gameplayCardId || card?.definitionId || card?.id).filter(Boolean));
  }

  return [...new Set(ids
    .map((gameplayCardId) => getGameplayCardArt(gameplayCardId, collectorCatalog, selectedVariants[gameplayCardId]))
    .filter(Boolean))]
    .slice(0, limit);
}

export function getNextCampaignChapter(campaigns = {}, progress = {}, preferredFactionId = "") {
  const factionIds = [preferredFactionId, ...Object.keys(campaigns)].filter((value, index, all) => value && all.indexOf(value) === index);
  for (const factionId of factionIds) {
    const campaign = campaigns[factionId];
    const completed = Array.isArray(progress[factionId]) ? progress[factionId] : [];
    const chapterIndex = campaign?.chapters?.findIndex((chapter) => !completed.includes(chapter.id)) ?? -1;
    if (chapterIndex >= 0) return { factionId, campaign, chapter: campaign.chapters[chapterIndex], chapterIndex };
  }
  return null;
}
