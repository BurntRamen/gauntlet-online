"use strict";

const art = require("./initiativeCampaignArt.json");

function hasInitiativeArt(factionId) {
  return Object.hasOwn(art, factionId);
}

function isDefaultImage(image, aliases = []) {
  return !image || (typeof image === "string" && aliases.includes(image.replace(/\?v=[a-f0-9]+$/i, "")));
}

function resolveChapter(chapter, catalog) {
  const entry = catalog[chapter.id];
  if (!entry) return chapter;
  const image = isDefaultImage(chapter.image, entry.replaces) ? entry.image : chapter.image;
  let cinematic = chapter.cinematic;
  if (cinematic && isDefaultImage(cinematic.image, [...(entry.replaces || []), ...(entry.previousCinematic || [])]) && cinematic.image !== image) {
    cinematic = { ...cinematic, image };
  }
  return image === chapter.image && cinematic === chapter.cinematic ? chapter : { ...chapter, image, ...(cinematic && { cinematic }) };
}

function applyInitiativeCampaignArt(campaigns) {
  const revised = { ...campaigns };
  for (const [id, campaign] of Object.entries(campaigns || {})) {
    if (!hasInitiativeArt(id) || !Array.isArray(campaign?.chapters)) continue;
    const catalog = art[id];
    const coverImage = isDefaultImage(campaign.coverImage, catalog.previousCover) ? catalog.cover : campaign.coverImage;
    revised[id] = { ...campaign, coverImage, chapters: campaign.chapters.map(chapter => resolveChapter(chapter, catalog.chapters)) };
  }
  return revised;
}

module.exports = { applyInitiativeCampaignArt, hasInitiativeArt };
