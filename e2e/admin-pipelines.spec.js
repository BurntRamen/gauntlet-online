const { test, expect } = require('./admin-release-test');
const fs = require('node:fs'), path = require('node:path');
const AxeBuilder = require('@axe-core/playwright').default;
const origin = `http://127.0.0.1:${process.env.GAUNTLET_ADMIN_FIXTURE_PORT || '4188'}`;
const sessions = () => JSON.parse(fs.readFileSync(path.resolve(__dirname, '../.playwright-data/admin-redesign/sessions.json'), 'utf8'));
const headers = () => ({ Authorization: `Bearer ${sessions().simply}` });
const task = page => page.getByRole('region', { name: 'Active production task', exact: true });
async function state(request) { const response = await request.get(origin + '/api/admin/authoring', { headers: headers() }); expect(response.ok()).toBeTruthy(); return response.json(); }
async function clean(request) { const current = await state(request); if (current.draft) expect((await request.post(origin + '/api/admin/authoring/discard', { headers: headers(), data: { expectedRevision: current.revision } })).ok()).toBeTruthy(); }
async function continueTask(page) { await expect(task(page)).toBeVisible(); const button = task(page).getByRole('button', { name: 'Continue pipeline', exact: true }); if (await button.isVisible()) await button.click(); }
async function create(page, name, kind) { await page.getByLabel('New content name', { exact: true }).fill(name); await page.getByRole('button', { name: `Save new ${kind} to draft`, exact: true }).click(); }

test.beforeEach(async ({ context, request, baseURL }) => {
  await clean(request);
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['http:', 'https:'].includes(url.protocol) && ![origin, new URL(baseURL).origin].includes(url.origin) ? route.abort('blockedbyclient') : route.continue();
  });
  await context.addInitScript(token => localStorage.setItem('gauntlet_auth_token', token), sessions().simply);
});
test.afterEach(async ({ request }) => clean(request));

test('a set pipeline carries creation context through cards, artwork, reload and exact shared review', async ({ page, request }) => {
  await page.goto('/admin/gauntlet');
  await expect(page.getByRole('button', { name: 'Build a card set', exact: true })).toBeVisible();
  for (const [name, width, height] of [['laptop', 1366, 768], ['desktop', 1920, 1080], ['phone', 390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: `artifacts/admin-pipeline-home-${name}.png` });
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.getByRole('button', { name: 'Build a card set', exact: true }).click();
  await task(page).getByRole('button', { name: 'Create set', exact: true }).click();
  await create(page, 'Pipeline release set', 'set');
  await expect(task(page)).toContainText('Pipeline release set');
  const set = (await state(request)).draft.snapshot.domains.sets.find(row => row.name === 'Pipeline release set');
  await continueTask(page);
  await task(page).getByRole('button', { name: 'Add card to this set', exact: true }).click();
  await expect(page.getByLabel('Set', { exact: true })).toHaveValue(set.id);
  await create(page, 'Pipeline Sentry', 'card');
  await expect(page.getByLabel('Draft name', { exact: true })).toHaveValue('Pipeline Sentry');
  const current = await state(request), card = current.draft.snapshot.domains.cards.find(row => row.name === 'Pipeline Sentry');
  expect(current.draft.snapshot.domains.sets.find(row => row.id === set.id).members).toContain(card.id);
  await continueTask(page);
  await task(page).getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Artwork & printings', exact: true }) }).getByRole('button', { name: 'Pipeline Sentry', exact: true }).click();
  await expect(page).toHaveURL(/section=artwork/);
  await page.reload();
  await expect(task(page)).toContainText('Pipeline release set');
  await task(page).getByRole('button', { name: 'Open working set', exact: true }).click();
  await expect(page.getByLabel('Draft set name', { exact: true })).toHaveValue('Pipeline release set');
  await continueTask(page);
  expect((await new AxeBuilder({ page }).include('.admin-production-task').analyze()).violations).toEqual([]);
  await page.screenshot({ path: 'artifacts/admin-pipeline-set-laptop.png' });
  await task(page).getByRole('button', { name: 'Review shared release', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Shared release review' })).toContainText('Pipeline Sentry');
  await expect(page.getByRole('button', { name: 'Publish release', exact: true })).toBeDisabled();
});

test('campaign creation produces a real faction and connected chapter with a guarded return path', async ({ page, request }) => {
  await page.goto('/admin/gauntlet');
  await page.getByRole('button', { name: 'Build a campaign', exact: true }).click();
  await task(page).getByRole('button', { name: 'Create campaign faction', exact: true }).click();
  await create(page, 'Pipeline Expedition', 'faction');
  await expect(task(page)).toContainText('Pipeline Expedition');
  const faction = (await state(request)).draft.snapshot.domains.factions.find(row => row.name === 'Pipeline Expedition');
  await continueTask(page);
  await task(page).getByRole('button', { name: 'Add encounter to this campaign', exact: true }).click();
  await expect(page.getByLabel('Campaign', { exact: true })).toHaveValue(faction.id);
  await create(page, 'Pipeline Second Chapter', 'encounter');
  await expect(page.getByLabel('Draft title', { exact: true })).toHaveValue('Pipeline Second Chapter');
  await page.getByLabel('Draft title', { exact: true }).fill('Retained local chapter');
  await task(page).getByRole('button', { name: 'Open working campaign faction', exact: true }).click();
  await page.getByRole('dialog', { name: 'Unsaved local changes' }).getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page.getByLabel('Draft title', { exact: true })).toHaveValue('Retained local chapter');
  const snapshot = (await state(request)).draft.snapshot;
  expect(snapshot.domains.campaigns.some(row => row.factionId === faction.id)).toBeTruthy();
  expect(snapshot.domains.encounters.filter(row => row.factionId === faction.id)).toHaveLength(2);
  await page.getByRole('button', { name: /^Save changes to/ }).click();
  await expect(page.locator('.admin-record-save')).toHaveCount(0);
  await continueTask(page);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  const bar = await page.locator('.admin-topbar').boundingBox(), status = await page.locator('.admin-save-context').boundingBox();
  expect(status.y + status.height).toBeLessThanOrEqual(bar.y + bar.height);
  const firstStep = task(page).getByRole('listitem').first(), heading = await firstStep.getByRole('heading').boundingBox(), stepBox = await firstStep.boundingBox();
  expect(heading.x - stepBox.x).toBeGreaterThanOrEqual(45);
  expect((await new AxeBuilder({ page }).include('.admin-production-task').analyze()).violations).toEqual([]);
  await page.screenshot({ path: 'artifacts/admin-pipeline-campaign-phone.png' });
});

test('event pipelines open the event registry and retain the created definition as their working object', async ({ page, request }) => {
  await page.goto('/admin/gauntlet');
  await page.getByRole('button', { name: 'Plan an event', exact: true }).click();
  await task(page).getByRole('button', { name: 'Open definitions', exact: true }).click();
  await page.getByRole('button', { name: 'Create event draft', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save competition draft', exact: true })).toBeVisible();
  const event = (await state(request)).draft.snapshot.competition.events.at(-1);
  await continueTask(page);
  await expect(task(page).getByRole('combobox', { name: 'Working event', exact: true })).toHaveValue(event.id);
  await expect(task(page)).toContainText(event.name);
  await page.reload();
  await expect(task(page)).toContainText(event.name);
  await expect(page.getByRole('region', { name: 'Managed competition definitions' })).toContainText(event.name);
  await task(page).getByRole('button', { name: 'Open working event', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Managed competition definitions' })).toContainText(event.name);
});

test('a mechanic pipeline creates its missing set and a card bound to the saved mechanic', async ({ page, request }) => {
  await page.goto('/admin/gauntlet');
  await page.getByRole('button', { name: 'Define a reusable mechanic', exact: true }).click();
  await task(page).getByRole('button', { name: 'Open definitions', exact: true }).click();
  await page.getByRole('button', { name: 'Create mechanic', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Mechanic name', exact: true })).toBeVisible();
  const mechanic = (await state(request)).draft.snapshot.studio.mechanics.at(-1);
  await expect(task(page)).toContainText(mechanic.name);
  await continueTask(page);
  await expect(task(page)).toContainText('0 saved uses');
  await task(page).getByRole('button', { name: "Create a set for this mechanic's cards", exact: true }).click();
  await create(page, 'Pipeline mechanics set', 'set');
  await expect(page.getByLabel('Draft set name', { exact: true })).toHaveValue('Pipeline mechanics set');
  await continueTask(page);
  await task(page).getByRole('button', { name: 'Create a card using this mechanic', exact: true }).click();
  await expect(page.getByLabel('Mechanical effect', { exact: true })).toHaveValue(mechanic.id);
  await create(page, 'Pipeline mechanic consumer', 'card');
  await expect(page.getByLabel('Draft name', { exact: true })).toHaveValue('Pipeline mechanic consumer');
  const card = (await state(request)).draft.snapshot.domains.cards.find(row => row.name === 'Pipeline mechanic consumer');
  expect(card.effect.mechanicId).toBe(mechanic.id);
  await continueTask(page);
  await expect(task(page)).toContainText('1 saved uses');
  await expect(task(page).getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Test its consumers', exact: true }) }).getByRole('button', { name: card.name, exact: true })).toBeVisible();
});

test('card modules save, reload, navigate dependencies and execute ordered effects with captured revisions', async ({ page, request }) => {
  test.setTimeout(180000);
  const { workspaceSection, saveRecord } = require('./admin-navigation');
  const { waitForBufferedAdminResponse } = require('./buffered-admin-response');
  const contract = require('../shared/duel-rules/mechanicContract');
  const save = async (operation, data) => {
    const current = await state(request), response = await request.post(origin + '/api/admin/authoring/' + operation, { headers: headers(), data: { expectedRevision: current.revision, ...data } });
    expect(response.ok()).toBeTruthy(); return response.json();
  };
  const definitions = [];
  for (const [name, kind, amount] of [['Module Draw', 'draw', 1], ['Module Heal', 'gainLife', 2]]) {
    const created = await save('studio-draft', { operation: 'create', interpreter: 2 });
    const definition = created.draft.snapshot.studio.mechanics.at(-1);
    Object.assign(definition, { name, cardTypes: ['armament'], abilities: [{ ...contract.ability('placed', 2), label: name, effects: [{ kind, amount, duration: 'instant' }] }] });
    await save('studio-draft', { operation: 'update', id: definition.id, value: definition }); definitions.push(definition);
  }
  const cardId = 'rumin-coin-scale-spear';
  await save('create', { domain: 'sets', name: 'Modular duplication set' });
  await page.goto('/admin/gauntlet?workshop=cards&object=' + cardId + '&section=mechanics');
  await page.getByLabel('Execution model', { exact: true }).selectOption('composition');
  await page.getByRole('button', { name: 'Combine effect modules', exact: true }).click();
  await expect(page.getByLabel('Include arming effects')).toBeChecked();
  await page.getByRole('combobox', { name: 'Add effect module', exact: true }).selectOption(definitions[0].id);
  await page.getByRole('combobox', { name: 'Add effect module', exact: true }).selectOption(definitions[1].id);
  await page.getByRole('button', { name: 'Move module 2 up', exact: true }).click();
  await saveRecord(page);
  await expect(page.locator('.admin-save-context')).toHaveText('Saved to shared draft');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Edit module 1', exact: true })).toHaveText('Module Heal');
  const saved = (await state(request)).draft.snapshot.domains.cards.find(c => c.id === cardId);
  expect(saved.effect.mechanics.map(ref => ref.mechanicId)).toEqual([definitions[1].id, definitions[0].id]);
  expect(saved.effect.armament.abilities[0].effects[0].amount).toBe(2);
  await page.getByRole('button', { name: 'Edit module 1', exact: true }).click();
  await expect(page.getByLabel('Mechanic name', { exact: true })).toHaveValue('Module Heal');
  await page.getByRole('button', { name: 'Test Dividend Yield Blade in engine', exact: true }).click();
  const harness = page.getByRole('region', { name: 'Real engine playtest', exact: true });
  await harness.getByRole('combobox', { name: 'Test content', exact: true }).selectOption('draft');
  await harness.getByRole('button', { name: 'Configure custom starting state', exact: true }).click();
  const scenario = harness.getByRole('region', { name: 'Custom starting state', exact: true });
  await scenario.getByRole('button', { name: 'Add to player 1 hand', exact: true }).click();
  await scenario.getByLabel('Player 1 hand 2 value', { exact: true }).fill('14');
  let pending = waitForBufferedAdminResponse(page, r => r.url().endsWith('/authoring/playtest'));
  await harness.getByRole('button', { name: 'Start draft duel playtest', exact: true }).click();
  const session = (await (await pending).json()).playtest;
  const action = session.legalActions.find(a => a.type === 'playSupport' && a.laneIndex === 0);
  expect(action).toBeTruthy();
  await harness.getByRole('combobox', { name: 'Action', exact: true }).selectOption(action.id);
  await harness.getByRole('group', { name: /^Payment cards/ }).getByRole('checkbox', { name: /Ace|A of|14/ }).check();
  pending = waitForBufferedAdminResponse(page, r => r.url().endsWith('/playtest/preview-command'));
  await harness.getByRole('button', { name: 'Calculate command preview', exact: true }).click();
  const preview = (await (await pending).json()).preview; expect(preview.accepted).toBe(true);
  pending = waitForBufferedAdminResponse(page, r => r.url().endsWith('/playtest/command'));
  await harness.getByRole('button', { name: 'Execute selected action', exact: true }).click();
  const result = (await (await pending).json()).playtest;
  expect(result.game.players[1].life).toBe(session.game.players[1].life + 2);
  expect(result.lastCommand.events.filter(e => e.type === 'mechanic.effect').map(e => e.operation)).toEqual(['gainLife', 'draw']);
  expect(result.lastCommand.changes).toEqual(preview.changes);
  expect(result.game.lanes[0].support[1].effect.mechanics.every(ref => /^[a-f0-9]{64}$/.test(ref.revision))).toBe(true);
  await page.screenshot({ path: 'artifacts/admin-modular-effects-engine.png', fullPage: true });
  await workspaceSection(page, 'Card Workshop', 'Mechanics');
  for (const [name, width, height] of [['laptop', 1366, 768], ['phone', 390, 844]]) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).include('.mechanics-editor').analyze()).violations).toEqual([]);
    await page.screenshot({ path: `artifacts/admin-modular-effects-${name}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await workspaceSection(page, 'Card Workshop', 'Details');
  await page.getByRole('button', { name: 'Back to list', exact: true }).click();
  await page.getByRole('button', { name: 'Duplicate card', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Mechanical effect', exact: true })).toHaveValue('mechanic-program');
  await page.getByLabel('New content name', { exact: true }).fill('Copied modular blade');
  await page.getByRole('button', { name: 'Save new card to draft', exact: true }).click();
  await expect(page.getByLabel('Draft name', { exact: true })).toHaveValue('Copied modular blade');
  expect((await state(request)).draft.snapshot.domains.cards.find(c => c.name === 'Copied modular blade').effect).toEqual(saved.effect);
});

test('native 200 percent browser zoom retains reflow, keyboard focus and accessible review views', async () => {
  test.setTimeout(180000);
  const { execFile } = require('node:child_process');
  await new Promise((resolve, reject) => execFile(process.execPath, [path.resolve(__dirname, 'admin-native-zoom.cjs')], {
    cwd: path.resolve(__dirname, '..'), windowsHide: true,
    env: { ...process.env, GAUNTLET_NATIVE_MATRIX: 'true', GAUNTLET_NATIVE_EVIDENCE_DIR: path.resolve(__dirname, '../docs/reviews/admin-pipelines/native-zoom') }
  }, (error, stdout, stderr) => {
    fs.writeFileSync(path.resolve(__dirname, '../artifacts/admin-native-zoom.log'), stdout + stderr);
    error ? reject(error) : resolve();
  }));
});
