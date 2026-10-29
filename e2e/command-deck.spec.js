const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { io } = require('socket.io-client');
const fs = require('node:fs');

const SERVER_URL = 'http://127.0.0.1:4110';
const ACTION_IDS = ['basic-ai', 'faction-ai', 'private-duel', 'join-table', 'ranked', 'draft', 'campaign', 'competition'];
const GUEST_LAYOUT_KEY = 'gauntlet_player_layouts_guest_v1';

async function openPlay(page, url = '/') {
  await page.goto(url);
  await expect(page.getByRole('heading', { name: 'Ready to play?', exact: true })).toBeVisible();
  await expect(page.locator('.cd-action-tile[data-action-id="basic-ai"]')).toBeVisible();
}

async function editPage(page) {
  await page.getByRole('button', { name: 'More', exact: true }).filter({ visible: true }).click();
  const sheet = page.getByRole('dialog', { name: 'More destinations' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Customize this page', exact: true }).click();
  await expect(page.getByLabel('Panel options for Basic vs AI')).toBeVisible();
}

async function doneEditing(page) {
  await page.getByRole('button', { name: 'Done Editing', exact: true }).first().click();
  await expect(page.getByLabel('Panel options for Basic vs AI')).toHaveCount(0);
}

async function layoutOrder(page) {
  return page.locator('[data-layout-module]').evaluateAll((nodes) => nodes.map((node) => node.dataset.layoutModule));
}

async function expectNoOverflow(page) {
  const dimensions = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth }));
  expect(dimensions.documentWidth, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.width + 1);
}

async function expectAccessible(page) {
  const result = await new AxeBuilder({ page }).include('.cd-shell').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(result.violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map((node) => node.target) }))).toEqual([]);
}

function waitForEvent(socket, eventName) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(eventName, onEvent); reject(new Error(`Timed out waiting for ${eventName}`)); }, 12000);
    function onEvent(value) { clearTimeout(timer); socket.off(eventName, onEvent); resolve(value); }
    socket.on(eventName, onEvent);
  });
}

async function seedRoom() {
  const socket = io(SERVER_URL, { autoConnect: false, forceNew: true, transports: ['websocket'] });
  const connected = waitForEvent(socket, 'connect');
  socket.connect();
  await connected;
  const assigned = waitForEvent(socket, 'assign');
  socket.emit('createRoom', { guestName: 'Command Deck host' });
  return { socket, roomCode: (await assigned).roomCode };
}

test('all eight core actions fit above the fold at both target desktop sizes', async ({ page }, testInfo) => {
  const measurements = [];
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(viewport);
    await openPlay(page);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    for (const id of ACTION_IDS) {
      const tile = page.locator(`.cd-action-tile[data-action-id="${id}"]`);
      await expect(tile).toBeVisible();
      const bounds = await tile.boundingBox();
      measurements.push({ viewport, id, bounds });
      expect(bounds.y, `${id} starts above viewport`).toBeGreaterThanOrEqual(0);
      expect(bounds.y + bounds.height, `${id} should fit at ${viewport.width}×${viewport.height}`).toBeLessThanOrEqual(viewport.height);
      await expect(tile.locator('.cd-action-description')).toHaveCount(0);
      const imageBounds = await tile.locator('.cd-action-art').boundingBox();
      expect(Math.abs(imageBounds.width - bounds.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(imageBounds.height - bounds.height)).toBeLessThanOrEqual(2);
      await expect(tile.locator('.cd-action-outcome')).not.toHaveText('');
      expect(await tile.locator('.cd-action-art img').evaluate(async (image) => {
        await image.decode().catch(() => {});
        return image.naturalWidth > 0;
      }), `${id} artwork loads`).toBe(true);
    }
    await expectNoOverflow(page);
    await page.screenshot({ path: `artifacts/command-deck/after-desktop-${viewport.width}.png`, fullPage: true });
  }
  await testInfo.attach('above-the-fold-measurements', { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' });
  fs.writeFileSync('artifacts/command-deck/above-the-fold.json', JSON.stringify(measurements, null, 2));
  await expectAccessible(page);
  await page.getByRole('button', { name: 'More', exact: true }).filter({ visible: true }).click();
  await page.screenshot({ path: 'artifacts/command-deck/after-more.png', fullPage: true });
});

test('mobile, tablet and equivalent 200 percent zoom reflow retain visible controls without overflow', async ({ page }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 700 }, { width: 820, height: 1180 }, { width: 683, height: 384 }]) {
    await page.setViewportSize(viewport);
    await openPlay(page);
    await expectNoOverflow(page);
    if (viewport.width < 761) await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
    if (viewport.width === 390) {
      const navigation = await page.getByRole('navigation', { name: 'Mobile navigation' }).boundingBox();
      for (const id of ACTION_IDS) {
        const tile = await page.locator(`.cd-action-tile[data-action-id="${id}"]`).boundingBox();
        expect(tile.y + tile.height, `${id} is above the mobile navigation`).toBeLessThanOrEqual(navigation.y);
      }
    }
    await page.screenshot({ path: `artifacts/command-deck/after-reflow-${viewport.width}.png`, fullPage: true });
    await editPage(page);
    if (viewport.width < 601) {
      const first = await page.locator('[data-layout-module]').nth(0).boundingBox();
      const second = await page.locator('[data-layout-module]').nth(1).boundingBox();
      expect(second.y).toBeGreaterThan(first.y);
      expect(Math.abs(first.x - second.x)).toBeLessThan(2);
    }
    const options = page.getByLabel('Panel options for Basic vs AI');
    expect((await options.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await expectNoOverflow(page);
    if (viewport.width === 390) {
      await page.screenshot({ path: 'artifacts/command-deck/after-mobile-editing.png', fullPage: true });
      await expectAccessible(page);
    }
    await doneEditing(page);
  }
});

test('layout editing supports keyboard movement, native handle dragging, hide restore, confirmed resets and guest reload', async ({ page }) => {
  await openPlay(page);
  await editPage(page);
  const ranked = page.getByLabel('Panel options for Ranked Match');
  await ranked.focus();
  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await layoutOrder(page)).indexOf('ranked')).toBe(3);
  await ranked.selectOption('first');
  await expect(ranked).toBeFocused();
  expect((await layoutOrder(page))[0]).toBe('ranked');
  const basicButton = page.locator('.cd-action-tile[data-action-id="basic-ai"]');
  await expect(basicButton.locator('..')).toHaveAttribute('inert', '');
  await page.getByRole('button', { name: /Drag Draft & Sealed to reorder/ }).dragTo(page.locator('[data-layout-module="ranked"]'));
  await expect.poll(async () => (await layoutOrder(page))[0]).toBe('draft');
  expect(await page.evaluate(() => localStorage.getItem('gauntlet_room_code'))).toBeNull();
  await page.getByLabel('Panel options for Basic vs AI').selectOption('hide');
  await expect(page.getByText('Hidden in normal view')).toBeVisible();
  await doneEditing(page);
  await expect(page.locator('.cd-action-tile[data-action-id="basic-ai"]')).toHaveCount(0);
  await page.getByText('All play actions', { exact: true }).click();
  await expect(page.locator('.cd-directory').getByRole('button', { name: 'Basic vs AI', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ready to play?', exact: true })).toBeVisible();
  expect((await layoutOrder(page))[0]).toBe('draft');
  await editPage(page);
  await page.getByRole('button', { name: 'Show panel', exact: true }).click();
  await expect(page.getByLabel('Panel options for Basic vs AI')).toBeFocused();
  await page.getByRole('button', { name: 'Reset this page', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Reset Play layout?' });
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Escape');
  expect((await layoutOrder(page))[0]).toBe('draft');
  await page.getByRole('button', { name: 'Reset this page', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm reset' }).click();
  expect((await layoutOrder(page))[0]).toBe('basic-ai');
  await doneEditing(page);
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('switch', { name: 'Customize Mode' }).check();
  await expect(page.getByLabel('Panel options for Competitive Record')).toBeVisible();
  await page.getByLabel('Panel options for Gold & Library').selectOption('first');
  await page.getByRole('button', { name: 'Reset all page layouts', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Reset all page layouts?' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm reset' }).click();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).pages, GUEST_LAYOUT_KEY)).toEqual({});
  await page.getByRole('switch', { name: 'Customize Mode' }).uncheck();
});

test('primary destinations, focused setup outcomes and browser navigation remain direct', async ({ page }) => {
  await openPlay(page);
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  for (const [label, title] of [['Campaign', 'Campaign'], ['Decks & Cards', 'Decks & Cards'], ['Draft', 'Draft & Sealed'], ['Compete', 'Compete'], ['Matches', 'Matches'], ['Community', 'Community'], ['Learn & Rules', 'Learn & Rules']]) {
    await nav.getByRole('button', { name: label, exact: true }).click();
    await expect(page.getByRole('heading', { name: title, exact: true, level: 1 })).toBeVisible();
    await expectNoOverflow(page);
    await page.screenshot({ path: `artifacts/command-deck/after-${label.toLowerCase().replace(/[^a-z]+/g, '-')}.png`, fullPage: true });
  }
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Community', exact: true, level: 1 })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Learn & Rules', exact: true, level: 1 })).toBeVisible();
  await nav.getByRole('button', { name: 'Play', exact: true }).click();
  await page.locator('.cd-action-tile[data-action-id="ranked"]').click();
  await expect(page.getByLabel('Ranked format')).toBeVisible();
  await expect(page.getByLabel('Match length')).toBeVisible();
  await page.getByLabel('Match length').selectOption('3');
  await expect(page.getByRole('button', { name: 'Find Ranked Match' })).toBeDisabled();
  await page.getByRole('button', { name: 'More', exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole('button', { name: 'Customize this page' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await nav.getByRole('button', { name: 'Draft', exact: true }).click();
  await page.getByRole('navigation', { name: 'Limited formats' }).getByRole('button', { name: 'Sealed', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open Sealed Pool', exact: true })).toBeVisible();
  await expect(page.getByLabel('Limited set')).toBeVisible();
  await page.getByRole('navigation', { name: 'Limited formats' }).getByRole('button', { name: 'Bot Draft', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start Bot Draft' })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true, level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: /Admin workspace/ })).toHaveCount(0);
  await expectNoOverflow(page);
  await page.screenshot({ path: 'artifacts/command-deck/after-settings.png', fullPage: true });
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your Profile', exact: true, level: 1 })).toBeVisible();
  await expectNoOverflow(page);
  await page.screenshot({ path: 'artifacts/command-deck/after-profile.png', fullPage: true });
});

test('header mute persists, follows Settings and remains accessible on mobile while editing', async ({ page }) => {
  await openPlay(page);
  const mute = page.getByRole('button', { name: 'Mute menu audio', exact: true });
  await expect(mute).toHaveAttribute('aria-pressed', 'false');
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('gauntlet_menu_audio_settings')).masterMuted)).toBe(true);
  await page.reload();
  await expect(mute).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unmute all', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Unmute all', exact: true }).click();
  await expect(mute).toHaveAttribute('aria-pressed', 'false');
  await mute.click();
  await expect(page.getByRole('button', { name: 'Unmute all', exact: true })).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Music volume', exact: true })).toBeDisabled();
  await page.getByRole('navigation', { name: 'Main navigation', exact: true }).getByRole('button', { name: 'Play', exact: true }).click();
  await page.setViewportSize({ width: 320, height: 700 });
  await expect(mute).toBeInViewport();
  await expectNoOverflow(page);
  await editPage(page);
  await expect(mute).toBeInViewport();
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'false');
  await expectNoOverflow(page);
  await expectAccessible(page);
  await doneEditing(page);
});

test('new guests start Basic vs AI directly and recovery survives reload', async ({ page }) => {
  await openPlay(page);
  await page.locator('.cd-action-tile[data-action-id="basic-ai"]').click();
  await expect(page.getByTestId('production-babylon-match')).toBeVisible({ timeout: 30000 });
  const roomCode = await page.evaluate(() => localStorage.getItem('gauntlet_room_code'));
  expect(roomCode).toMatch(/^[A-Z0-9]+$/);
  await page.reload();
  await expect(page.getByTestId('production-babylon-match')).toBeVisible({ timeout: 30000 });
  expect(await page.evaluate(() => localStorage.getItem('gauntlet_room_code'))).toBe(roomCode);
});

test('private Duel and Free-for-All enter the existing room lobbies', async ({ browser }) => {
  for (const freeForAll of [false, true]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await openPlay(page, 'http://127.0.0.1:3110/');
      if (freeForAll) {
        await page.locator('.cd-action-tile[data-action-id="join-table"]').click();
        await page.getByRole('button', { name: /Create Free-for-All/ }).click();
      } else await page.locator('.cd-action-tile[data-action-id="private-duel"]').click();
      await expect(page.getByText('Table Command', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Main Menu', exact: true })).toBeVisible();
      if (freeForAll) await expect(page.locator('.lobby-command-meta').getByText('Free-for-all', { exact: true })).toBeVisible();
      else await expect(page.getByRole('button', { name: 'Basic Mode', exact: true })).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem('gauntlet_room_code'))).toBeTruthy();
      await expect(page.getByLabel('Panel options for Basic vs AI')).toHaveCount(0);
    } finally { await context.close(); }
  }
});

test('published Live Draft, Bot Draft and Sealed options enter their existing workflows', async ({ browser }) => {
  for (const [format, action, heading] of [['Live Draft', 'Create Draft Room', 'Gauntlet Draft'], ['Bot Draft', 'Start Bot Draft', 'Gauntlet Bot Draft'], ['Sealed', 'Open Sealed Pool', 'Gauntlet Sealed']]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await openPlay(page, 'http://127.0.0.1:3110/');
      await page.locator('.cd-action-tile[data-action-id="draft"]').click();
      await page.getByRole('navigation', { name: 'Limited formats' }).getByRole('button', { name: format, exact: true }).click();
      await expect(page.getByLabel('Limited set')).toBeVisible();
      await expect(page.getByRole('button', { name: action, exact: true })).toBeEnabled();
      await page.getByRole('button', { name: action, exact: true }).click();
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      if (format === 'Sealed') await expect(page.getByRole('heading', { name: 'Your Sealed Pool (78)', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Customize this page' })).toHaveCount(0);
    } finally { await context.close(); }
  }
});

test('invitation codes survive navigation and support both player and spectator entry', async ({ browser }) => {
  const { socket, roomCode } = await seedRoom();
  try {
    for (const spectator of [false, true]) {
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await page.goto(`http://127.0.0.1:3110/?join=${roomCode}`);
        await expect(page.getByLabel('Room code', { exact: true })).toHaveValue(roomCode);
        await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Campaign', exact: true }).click();
        expect(new URL(page.url()).searchParams.get('join')).toBe(roomCode);
        await page.getByRole('button', { name: 'Open Invitation', exact: true }).click();
        await expect(page.getByLabel('Room code', { exact: true })).toHaveValue(roomCode);
        await page.getByRole('button', { name: spectator ? 'Spectate' : 'Join as Player', exact: true }).click();
        await expect(page.getByText('Table Command', { exact: true })).toBeVisible();
        expect(await page.evaluate(() => localStorage.getItem('gauntlet_role'))).toBe(spectator ? 'spectator' : 'player');
      } finally { await context.close(); }
    }
  } finally { socket.disconnect(); }
});

async function getAccount(request, name) {
  const data = { name, password: 'Command-Deck-Test-Password-42' };
  let result = await request.post(`${SERVER_URL}/api/auth/login`, { data });
  if (!result.ok()) result = await request.post(`${SERVER_URL}/api/auth/register`, { data });
  expect(result.ok()).toBeTruthy();
  return result.json();
}

test('account layouts sync across browser contexts and remain isolated between accounts', async ({ browser, request }) => {
  const first = await getAccount(request, 'CommandDeckLayoutAlpha');
  const second = await getAccount(request, 'CommandDeckLayoutBeta');
  for (const account of [first, second]) {
    const current = await (await request.get(`${SERVER_URL}/api/account/layouts`, { headers: { Authorization: `Bearer ${account.token}` } })).json();
    const reset = await request.put(`${SERVER_URL}/api/account/layouts`, { headers: { Authorization: `Bearer ${account.token}` }, data: { revision: current.revision, preferences: { version: 1, pages: {} } } });
    expect(reset.ok()).toBeTruthy();
  }
  const contexts = [];
  async function accountPage(token) {
    const context = await browser.newContext();
    contexts.push(context);
    await context.addInitScript((value) => localStorage.setItem('gauntlet_auth_token', value), token);
    const page = await context.newPage();
    await openPlay(page, 'http://127.0.0.1:3110/');
    await expect(page.getByText('Account layouts loaded.', { exact: true })).toBeAttached();
    return page;
  }
  try {
    const firstDevice = await accountPage(first.token);
    await editPage(firstDevice);
    await firstDevice.getByLabel('Panel options for Ranked Match').selectOption('first');
    await expect(firstDevice.getByText('Layout saved to your account.', { exact: true })).toBeVisible();
    await doneEditing(firstDevice);
    await firstDevice.locator('.cd-action-tile[data-action-id="ranked"]').click();
    await firstDevice.getByLabel('Ranked format').selectOption('basic');
    await firstDevice.getByLabel('Match length').selectOption('3');
    await firstDevice.getByRole('button', { name: 'Find Ranked Match', exact: true }).click();
    await expect(firstDevice.getByRole('region', { name: 'Ranked queue' })).toBeVisible();
    await firstDevice.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Play', exact: true }).click();
    await editPage(firstDevice);
    await firstDevice.getByLabel('Panel options for Ranked Match').selectOption('hide');
    await expect(firstDevice.getByRole('region', { name: 'Ranked queue' })).toBeVisible();
    await firstDevice.getByRole('region', { name: 'Ranked queue' }).getByRole('button', { name: 'Leave Queue', exact: true }).click();
    await firstDevice.getByLabel('Panel options for Ranked Match').selectOption('show');
    await expect(firstDevice.getByText('Layout saved to your account.', { exact: true })).toBeVisible();
    const secondDevice = await accountPage(first.token);
    expect((await layoutOrder(secondDevice))[0]).toBe('ranked');
    const otherAccount = await accountPage(second.token);
    expect((await layoutOrder(otherAccount))[0]).toBe('basic-ai');
    const isolated = await (await request.get(`${SERVER_URL}/api/account/layouts`, { headers: { Authorization: `Bearer ${second.token}` } })).json();
    expect(isolated.preferences.pages).toEqual({});
  } finally { await Promise.all(contexts.map((context) => context.close())); }
});

test('Campaign faction selection opens its real chapter briefing and Factions AI opens the lobby', async ({ page, request }) => {
  const { content } = await (await request.get(`${SERVER_URL}/api/game-content`)).json();
  const [factionId, campaign] = Object.entries(content.campaigns)[0];
  await openPlay(page);
  await page.locator('.cd-action-tile[data-action-id="campaign"]').click();
  await expect(page.locator('.cd-action-tile[data-action-id^="faction-"]')).toHaveCount(Object.keys(content.campaigns).length);
  await page.locator(`.cd-action-tile[data-action-id="faction-${factionId}"]`).click();
  await expect(page.getByRole('tab', { name: new RegExp(`^${campaign.factionName}`) })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'View Briefing', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: campaign.chapters[0].title, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Begin Battle', exact: true }).first()).toBeEnabled();
  await page.screenshot({ path: 'artifacts/command-deck/after-campaign-briefing.png', fullPage: true });
  await page.getByRole('button', { name: /Back to Chapter Map/ }).click();
  await expect(page.getByRole('button', { name: 'View Briefing', exact: true }).first()).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Play', exact: true }).click();
  await page.locator('.cd-action-tile[data-action-id="faction-ai"]').click();
  await expect(page.getByText('Table Command', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Select Your Faction', exact: true })).toBeVisible();
  await expect(page.getByTestId('production-babylon-match')).toHaveCount(0);
});

test('signed-in deck changes are guarded and returning restores the Ranked setup', async ({ page, request }) => {
  const account = await getAccount(request, 'CommandDeckLayoutAlpha');
  await page.addInitScript((token) => localStorage.setItem('gauntlet_auth_token', token), account.token);
  await openPlay(page);
  await expect(page.getByText('Account layouts loaded.', { exact: true })).toBeAttached();
  await page.locator('.cd-action-tile[data-action-id="ranked"]').click();
  await page.getByLabel('Ranked format').selectOption('factions');
  await page.getByLabel('Match length').selectOption('3');
  const factionId = await page.getByRole('combobox', { name: 'Faction', exact: true }).inputValue();
  const generalId = await page.getByRole('combobox', { name: 'General', exact: true }).inputValue();
  await page.screenshot({ path: 'artifacts/command-deck/after-ranked-setup.png', fullPage: true });
  await page.getByRole('button', { name: 'Edit Deck · return here afterward', exact: true }).click();
  const editor = page.getByRole('region', { name: '52-card deck workshop' });
  await expect(editor).toBeVisible();
  const deckName = editor.getByRole('textbox', { name: 'Deck name', exact: true });
  const name = `Command Review ${Date.now().toString(36)}`;
  await deckName.fill(name);
  await expect(page.getByText(/Unsaved deck changes\. Save in the Deck Editor/)).toBeVisible();
  page.once('dialog', async (dialog) => { expect(dialog.message()).toContain('Discard unsaved deck changes'); await dialog.dismiss(); });
  await page.getByRole('button', { name: 'Return to Ranked Setup', exact: true }).click();
  await expect(deckName).toHaveValue(name);
  await page.screenshot({ path: 'artifacts/command-deck/after-deck-editor.png', fullPage: true });
  await editor.getByRole('button', { name: /^(Create Deck|Save New Version)$/ }).click();
  await expect(page.getByText(/Unsaved deck changes\. Save in the Deck Editor/)).toHaveCount(0);
  await deckName.fill(`${name} unsaved`);
  page.once('dialog', async (dialog) => { expect(dialog.message()).toContain('Discard unsaved deck changes'); await dialog.accept(); });
  await page.getByRole('button', { name: 'Return to Ranked Setup', exact: true }).click();
  await expect(page.getByLabel('Ranked format')).toHaveValue('factions');
  await expect(page.getByLabel('Match length')).toHaveValue('3');
  await expect(page.getByRole('combobox', { name: 'Faction', exact: true })).toHaveValue(factionId);
  await expect(page.getByRole('combobox', { name: 'General', exact: true })).toHaveValue(generalId);
});

test('blocked browser storage keeps the whole app usable and guest layout survives a lobby round trip', async ({ page }) => {
  await page.addInitScript(() => {
    for (const method of ['getItem', 'setItem', 'removeItem']) Storage.prototype[method] = () => { throw new DOMException('Storage blocked', 'SecurityError'); };
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openPlay(page);
  await editPage(page);
  await page.getByLabel('Panel options for Ranked Match').selectOption('first');
  await expect(page.getByText(/Browser storage is unavailable/)).toBeVisible();
  await doneEditing(page);
  await page.locator('.cd-action-tile[data-action-id="private-duel"]').click();
  await expect(page.getByText('Table Command', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Main Menu', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ready to play?', exact: true })).toBeVisible();
  expect((await layoutOrder(page))[0]).toBe('ranked');
  expect(errors).toEqual([]);
});
