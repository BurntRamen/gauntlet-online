// Only optional landing-page modules belong here. Recovery, queue, invitations,
// account controls and gameplay workflows must remain outside a LayoutGrid.
import sections from '../../../shared/websiteSections.json';
export const LAYOUT_VERSION = 1;
export const MAX_LAYOUT_MODULES = 64;

const staticModules = Object.fromEntries(Object.entries(sections).filter(([page])=>page!=="settings"));

export const LAYOUT_PAGE_LABELS = {
  play: 'Play', campaign: 'Campaign', decks: 'Decks & Cards', compete: 'Compete',
  matches: 'Matches', community: 'Community', learn: 'Learn & Rules', profile: 'Profile',
};
export const LAYOUT_PAGES = Object.freeze(Object.keys(staticModules));
let campaignModules = [];

// Call with published faction IDs, never with IDs supplied by saved preferences.
export function registerCampaignLayoutModules(factionIds = []) {
  campaignModules = [...new Set(factionIds.filter((id) => typeof id === 'string' && /^[a-z0-9_-]{1,48}$/.test(id)))].slice(0, MAX_LAYOUT_MODULES - 3).map((id) => `faction-${id}`);
}

export function getLayoutModuleIds(pageId) {
  if (!Object.prototype.hasOwnProperty.call(staticModules, pageId)) return [];
  return pageId === 'campaign' ? [...campaignModules, ...staticModules.campaign] : [...staticModules[pageId]];
}

export function isCustomizablePage(pageId) {
  return Object.prototype.hasOwnProperty.call(staticModules, pageId);
}

export function isAllowedLayoutModule(pageId, moduleId) {
  return getLayoutModuleIds(pageId).includes(moduleId);
}
