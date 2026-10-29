const { expect } = require('@playwright/test');

const labels = {
  play: 'Play', campaign: 'Campaign', decks: 'Decks & Cards', draft: 'Draft',
  compete: 'Compete', matches: 'Matches', community: 'Community', learn: 'Learn & Rules',
  profile: 'Profile', settings: 'Settings',
};

// Use the same visible controls a player uses. No injected route state or retired
// data-area selectors: these helpers exercise both desktop and mobile navigation.
async function navigatePlayer(page, pageId, view = '') {
  await expect(page.locator('.cd-shell')).toBeVisible();
  const label = labels[pageId];
  if (!label) throw new Error(`Unknown player destination: ${pageId}`);
  const rail = page.getByRole('navigation', { name: 'Main navigation', exact: true });
  if (await rail.isVisible() && !['profile', 'settings'].includes(pageId)) {
    await rail.getByRole('button', { name: label, exact: true }).click();
  } else if (pageId === 'profile') {
    await page.locator('.cd-header-actions').getByRole('button', { name: /^Profile(?: —|$)/ }).click();
  } else {
    const mobile = page.getByRole('navigation', { name: 'Mobile navigation', exact: true });
    const mobileLabel = pageId === 'decks' ? 'Decks' : label;
    if (['play', 'campaign', 'decks', 'compete'].includes(pageId) && await mobile.isVisible()) {
      await mobile.getByRole('button', { name: mobileLabel, exact: true }).click();
    } else {
      await page.getByRole('button', { name: 'More', exact: true }).filter({ visible: true }).click();
      await page.getByRole('dialog', { name: 'More destinations' }).getByRole('button', { name: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} `) }).click();
    }
  }
  if (!view) return;
  if (pageId === 'draft') {
    await page.getByRole('navigation', { name: 'Limited formats' }).getByRole('button', { name: { live: 'Live Draft', bot: 'Bot Draft', sealed: 'Sealed', league: 'Limited League' }[view], exact: true }).click();
  } else if (pageId === 'community') {
    await page.getByRole('navigation', { name: 'Community actions' }).getByRole('button', { name: view[0].toUpperCase() + view.slice(1), exact: true }).click();
  } else if (pageId === 'play' && view === 'practice') {
    await navigatePlayer(page, 'learn');
    await page.locator('.cd-action-tile[data-action-id="practice"]').click();
  } else {
    const id = ({ 'play:tables': 'join-table', 'decks:library': 'draft-library' })[`${pageId}:${view}`] || view;
    await page.locator(`.cd-action-tile[data-action-id="${id}"]`).click();
  }
}

async function setGuestName(page, name) {
  await navigatePlayer(page, 'profile');
  await page.getByLabel('Guest name', { exact: true }).fill(name);
}

async function openCollection(page, tab = 'catalog') {
  await navigatePlayer(page, 'decks');
  const id = tab === 'decks' ? 'editor' : tab === 'packs' ? 'packs' : 'collection';
  await page.locator(`.cd-action-tile[data-action-id="${id}"]`).click();
  await page.getByRole('tab', { name: { decks: 'Decks', catalog: 'Cards', packs: 'Packs', shop: 'Shop', collector: 'Collector Styles' }[tab], exact: true }).click();
}

async function openCampaign(page, factionName) {
  await navigatePlayer(page, 'campaign');
  const escaped = factionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await page.locator('.cd-action-tile').filter({ has: page.locator('.cd-action-title').filter({ hasText: new RegExp(`^${escaped}$`) }) }).click();
}

async function openProfileExtras(page) {
  await navigatePlayer(page, 'profile');
  const panel = page.locator('.cd-profile-extras');
  if ((await panel.getAttribute('open')) === null) await panel.locator(':scope > summary').click();
}

module.exports = { navigatePlayer, setGuestName, openCollection, openCampaign, openProfileExtras };
