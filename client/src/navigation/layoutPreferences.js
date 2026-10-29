import { getLayoutModuleIds, isCustomizablePage, LAYOUT_PAGES, LAYOUT_VERSION, MAX_LAYOUT_MODULES } from './layoutRegistry';

export const GUEST_LAYOUT_STORAGE_KEY = 'gauntlet_player_layouts_guest_v1';
export const emptyLayoutPreferences = () => ({ version: LAYOUT_VERSION, pages: {} });
const isRecord = (value) => value && typeof value === 'object' && !Array.isArray(value);
// Guest-only session memory survives menu unmounts when browser persistence is
// blocked. Account preferences never enter this fallback.
let guestSessionFallback = null;
export function clearGuestSessionFallback() { guestSessionFallback = null; }

export function normalizeLayoutPreferences(input) {
  const result = emptyLayoutPreferences();
  if (!isRecord(input) || input.version !== LAYOUT_VERSION || !isRecord(input.pages)) return result;
  for (const pageId of LAYOUT_PAGES) {
    const page = input.pages[pageId];
    if (!isRecord(page)) continue;
    const allowed = getLayoutModuleIds(pageId);
    const clean = (value) => Array.isArray(value) ? [...new Set(value.slice(0, MAX_LAYOUT_MODULES).filter((id) => typeof id === 'string' && allowed.includes(id)))] : [];
    // Append new modules instead of leaving them undiscoverable after an upgrade.
    const order = clean(page.order);
    result.pages[pageId] = { order: [...order, ...allowed.filter((id) => !order.includes(id))], hidden: clean(page.hidden) };
  }
  return result;
}

export function getPageLayout(preferences, pageId) {
  const clean = normalizeLayoutPreferences(preferences);
  return clean.pages[pageId] || { order: getLayoutModuleIds(pageId), hidden: [] };
}

export function updatePageLayout(preferences, pageId, updater) {
  const clean = normalizeLayoutPreferences(preferences);
  if (!isCustomizablePage(pageId)) return clean;
  return normalizeLayoutPreferences({ ...clean, pages: { ...clean.pages, [pageId]: updater(getPageLayout(clean, pageId)) } });
}

export function moveLayoutModule(preferences, pageId, moduleId, destinationIndex) {
  return updatePageLayout(preferences, pageId, (page) => {
    if (!page.order.includes(moduleId)) return page;
    const order = page.order.filter((id) => id !== moduleId);
    order.splice(Math.max(0, Math.min(order.length, destinationIndex)), 0, moduleId);
    return { ...page, order };
  });
}

export function setLayoutModuleHidden(preferences, pageId, moduleId, hidden) {
  return updatePageLayout(preferences, pageId, (page) => ({
    ...page,
    hidden: hidden ? [...page.hidden, moduleId] : page.hidden.filter((id) => id !== moduleId),
  }));
}

export function resetLayoutPage(preferences, pageId) {
  const clean = normalizeLayoutPreferences(preferences);
  delete clean.pages[pageId];
  return clean;
}

export function hasSavedLayout(preferences) {
  return Object.keys(normalizeLayoutPreferences(preferences).pages).length > 0;
}

export function sameLayoutPreferences(first, second) {
  return JSON.stringify(normalizeLayoutPreferences(first)) === JSON.stringify(normalizeLayoutPreferences(second));
}

export function readGuestLayout(storage) {
  if (storage === undefined && guestSessionFallback) return { preferences: normalizeLayoutPreferences(guestSessionFallback), available: false };
  try {
    const source = storage === undefined ? window.localStorage : storage;
    const raw = source.getItem(GUEST_LAYOUT_STORAGE_KEY);
    return { preferences: normalizeLayoutPreferences(raw ? JSON.parse(raw) : null), available: true };
  } catch {
    return { preferences: emptyLayoutPreferences(), available: false };
  }
}

export function writeGuestLayout(preferences, storage) {
  const clean = normalizeLayoutPreferences(preferences);
  try {
    const source = storage === undefined ? window.localStorage : storage;
    source.setItem(GUEST_LAYOUT_STORAGE_KEY, JSON.stringify(clean));
    if (storage === undefined) guestSessionFallback = null;
    return true;
  } catch {
    if (storage === undefined) guestSessionFallback = clean;
    return false;
  }
}
