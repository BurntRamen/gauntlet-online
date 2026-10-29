import { getLayoutModuleIds, registerCampaignLayoutModules } from './layoutRegistry';
import {
  emptyLayoutPreferences, getPageLayout, GUEST_LAYOUT_STORAGE_KEY, moveLayoutModule,
  normalizeLayoutPreferences, readGuestLayout, resetLayoutPage, setLayoutModuleHidden, writeGuestLayout,
} from './layoutPreferences';

afterEach(() => { localStorage.clear(); registerCampaignLayoutModules([]); });

test('validates the version, page and module allowlists and appends newly introduced modules', () => {
  expect(normalizeLayoutPreferences({ version: 99, pages: { play: {} } })).toEqual(emptyLayoutPreferences());
  const clean = normalizeLayoutPreferences({ version: 1, pages: {
    admin: { order: ['accounts'], hidden: ['queue'] },
    play: { order: ['ranked', 'ranked', 'retired', 'resume', 'basic-ai'], hidden: ['ranked', 'invitation', 'queue'] },
  } });
  expect(Object.keys(clean.pages)).toEqual(['play']);
  expect(clean.pages.play.order.slice(0, 2)).toEqual(['ranked', 'basic-ai']);
  expect(clean.pages.play.order).toHaveLength(getLayoutModuleIds('play').length);
  expect(clean.pages.play.hidden).toEqual(['ranked']);
});

test('only actual registered faction identifiers can be customized', () => {
  registerCampaignLayoutModules(['sheen', 'rumin', '../unsafe']);
  const page = getPageLayout({ version: 1, pages: { campaign: { order: ['faction-rumin', 'faction-invented'], hidden: ['faction-sheen', 'faction-invented'] } } }, 'campaign');
  expect(page.order).toEqual(['faction-rumin', 'faction-sheen', 'tutorial', 'lore', 'rulebook']);
  expect(page.hidden).toEqual(['faction-sheen']);
});

test('reordering, hide/show and resetting a page preserve other page preferences', () => {
  let prefs = moveLayoutModule(emptyLayoutPreferences(), 'play', 'ranked', 0);
  prefs = setLayoutModuleHidden(prefs, 'play', 'basic-ai', true);
  prefs = moveLayoutModule(prefs, 'decks', 'collection', 0);
  expect(getPageLayout(prefs, 'play').order[0]).toBe('ranked');
  expect(getPageLayout(prefs, 'play').hidden).toEqual(['basic-ai']);
  prefs = setLayoutModuleHidden(prefs, 'play', 'basic-ai', false);
  expect(getPageLayout(prefs, 'play').hidden).toEqual([]);
  const reset = resetLayoutPage(prefs, 'play');
  expect(reset.pages.play).toBeUndefined();
  expect(reset.pages.decks).toEqual(prefs.pages.decks);
});

test('guest preferences survive a storage round trip with a versioned key', () => {
  const prefs = moveLayoutModule(emptyLayoutPreferences(), 'play', 'ranked', 0);
  expect(writeGuestLayout(prefs)).toBe(true);
  expect(JSON.parse(localStorage.getItem(GUEST_LAYOUT_STORAGE_KEY)).version).toBe(1);
  expect(readGuestLayout().preferences).toEqual(prefs);
});

test('blocked or malformed browser storage returns safe defaults without throwing', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  expect(readGuestLayout(blocked)).toEqual({ preferences: emptyLayoutPreferences(), available: false });
  expect(writeGuestLayout(emptyLayoutPreferences(), blocked)).toBe(false);
  localStorage.setItem(GUEST_LAYOUT_STORAGE_KEY, 'not json');
  expect(readGuestLayout().preferences).toEqual(emptyLayoutPreferences());
});
