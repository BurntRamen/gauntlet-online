"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { COLLECTION_CARDS, COLLECTOR_VARIANTS, CONTENT_VERSION } = require("../server/gameContent");

function buildConstructedCardArtInventory() {
  const variantsByCard = COLLECTOR_VARIANTS.reduce((index, variant) => {
    if (!index[variant.gameplayCardId]) index[variant.gameplayCardId] = [];
    index[variant.gameplayCardId].push(variant);
    return index;
  }, {});

  const cards = COLLECTION_CARDS.map((card) => {
    const variants = variantsByCard[card.id] || [];
    const standard = variants.find((variant) => variant.variantId === card.defaultVariantId || !variant.paid) || null;
    const collector = variants.find((variant) => variant.paid) || null;
    return {
      gameplayCardId: card.id,
      faction: card.factionId,
      name: card.name,
      type: card.type,
      rarity: card.rarity,
      value: card.value,
      standardVariantId: standard?.variantId || null,
      collectorVariantId: collector?.variantId || null,
      currentArt: {
        standard: standard?.art ?? null,
        collector: collector?.art ?? null
      }
    };
  });

  const variantsWithArt = COLLECTOR_VARIANTS.filter((variant) => Boolean(variant.art));
  return {
    schemaVersion: 1,
    contentVersion: CONTENT_VERSION,
    generatedFrom: "server/gameContent.js collectorVariants[].art",
    summary: {
      gameplayCardCount: cards.length,
      collectorVariantCount: COLLECTOR_VARIANTS.length,
      variantsWithArt: variantsWithArt.length,
      variantsMissingArt: COLLECTOR_VARIANTS.length - variantsWithArt.length,
      gameplayCardsWithAnyDedicatedArt: cards.filter((card) => card.currentArt.standard || card.currentArt.collector).length,
      gameplayCardsMissingAllDedicatedArt: cards.filter((card) => !card.currentArt.standard && !card.currentArt.collector).length
    },
    cards
  };
}

function writeConstructedCardArtInventory(outputPath = path.resolve(__dirname, "../docs/constructed-card-art-inventory.json")) {
  const inventory = buildConstructedCardArtInventory();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
  return { inventory, outputPath };
}

if (require.main === module) {
  const { inventory, outputPath } = writeConstructedCardArtInventory(process.argv[2] ? path.resolve(process.argv[2]) : undefined);
  process.stdout.write(`Constructed-card art inventory: ${inventory.summary.gameplayCardCount} gameplay cards, ${inventory.summary.variantsWithArt}/${inventory.summary.collectorVariantCount} variants with art.\n${outputPath}\n`);
}

module.exports = { buildConstructedCardArtInventory, writeConstructedCardArtInventory };
