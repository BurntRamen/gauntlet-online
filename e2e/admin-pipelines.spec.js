const { test, expect } = require('./admin-release-test');
const fs = require('node:fs'), path = require('node:path');
const AxeBuilder = require('@axe-core/playwright').default;
const origin = `http://127.0.0.1:${process.env.GAUNTLET_ADMIN_FIXTURE_PORT || '4188'}`;
const sessions = () => JSON.parse(fs.readFileSync(path.resolve(__dirname, '../.playwright-data/admin-redesign/sessions.json'), 'utf8'));
const headers = () => ({ Authorization: `Bearer ${sessions().simply}` });
async function state(request) { const response = await request.get(origin + '/api/admin/authoring', { headers: headers() }); expect(response.ok()).toBeTruthy(); return response.json(); }
async function clean(request) { const current = await state(request); if (current.draft) expect((await request.post(origin + '/api/admin/authoring/discard', { headers: headers(), data: { expectedRevision: current.revision } })).ok()).toBeTruthy(); }
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

const { area, destination } = require('./admin-navigation');


test('direct set creation carries membership through contextual card creation, reload and shared review', async ({ page, request }) => {
  await page.goto('/admin/gauntlet');
  await page.getByRole('button', { name: 'Set', exact: true }).click();
  await create(page, 'Studio release set', 'set');
  await expect(page.getByLabel('Draft set name', { exact: true })).toHaveValue('Studio release set');
  const set = (await state(request)).draft.snapshot.domains.sets.find(row => row.name === 'Studio release set');
  await page.getByRole('button', { name: 'Create card in this set', exact: true }).click();
  await expect(page.getByLabel('Set', { exact: true })).toHaveValue(set.id);
  await create(page, 'Studio Sentry', 'card');
  await expect(page.getByLabel('Draft name', { exact: true })).toHaveValue('Studio Sentry');
  const current = await state(request), card = current.draft.snapshot.domains.cards.find(row => row.name === 'Studio Sentry');
  expect(current.draft.snapshot.domains.sets.find(row => row.id === set.id).members).toContain(card.id);
  await page.reload();
  await expect(page.getByLabel('Draft name', { exact: true })).toHaveValue('Studio Sentry');
  await area(page, 'Publishing');
  await expect(page.getByRole('region', { name: 'Shared release review' })).toContainText('Studio Sentry');
  await expect(page.getByRole('button', { name: 'Publish release', exact: true })).toBeDisabled();
});

test('faction and campaign creation connects a chapter and guards cross-record departure', async ({ page, request }) => {
  await page.goto('/admin/gauntlet?workshop=factions&section=create');
  await create(page, 'Studio Expedition', 'faction');
  await expect(page.getByLabel('Draft name', { exact: true })).toHaveValue('Studio Expedition');
  const faction = (await state(request)).draft.snapshot.domains.factions.find(row => row.name === 'Studio Expedition');
  await page.locator('.design-related').getByRole('button', { name: 'Studio Expedition',exact:true }).last().click();
  await page.getByRole('button', { name: 'Add chapter encounter', exact: true }).click();
  await expect(page.getByLabel('Campaign', { exact: true })).toHaveValue(faction.id);
  await create(page, 'Studio Second Chapter', 'encounter');
  await expect(page.getByLabel('Draft title', { exact: true })).toHaveValue('Studio Second Chapter');
  await page.getByLabel('Draft title', { exact: true }).fill('Retained local chapter');
  await page.getByRole('button', { name: 'Studio Expedition', exact: true }).first().click();
  await page.getByRole('dialog', { name: 'Unsaved local changes' }).getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page.getByLabel('Draft title', { exact: true })).toHaveValue('Retained local chapter');
  const snapshot = (await state(request)).draft.snapshot;
  expect(snapshot.domains.campaigns.some(row => row.factionId === faction.id)).toBeTruthy();
  expect(snapshot.domains.encounters.filter(row => row.factionId === faction.id)).toHaveLength(2);
  await page.getByRole('button', { name: /^Save changes to/ }).click();
  await expect(page.locator('.admin-record-save')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  expect((await new AxeBuilder({ page }).include('.gauntlet-admin').analyze()).violations).toEqual([]);
});

test('events have one home and a reload restores their authoritative definition', async ({ page, request }) => {
  await page.goto('/admin/gauntlet?workshop=competition:events');
  await page.getByRole('button', { name: 'Create event draft', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save competition draft', exact: true })).toBeVisible();
  const event = (await state(request)).draft.snapshot.competition.events.at(-1);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Managed competition definitions' })).toContainText(event.name);
  await expect(page.getByRole('navigation', { name: 'Administration sections' }).getByRole('button', { name: 'Events & Commerce', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('a reusable mechanic can be created, attached and executed through ordinary content editors', async ({ page, request }) => {
  test.setTimeout(180000);
  await page.goto('/admin/gauntlet?workshop=mechanics');
  await page.getByRole('button', { name: 'Create mechanic', exact: true }).click();
  await expect(page.getByLabel('Mechanic name', { exact: true })).toBeVisible();
  await page.getByLabel('Mechanic name', { exact: true }).fill('Studio restoration');
  await page.getByLabel('Ability 1 effect 1', { exact: true }).selectOption('gainLife');
  await page.getByLabel('Effect 1.1 amount', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Save mechanic to draft', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save mechanic to draft', exact: true })).toBeDisabled();
  await expect(page.locator('.admin-save-context')).toHaveText('Saved to shared draft');
  const mechanic = (await state(request)).draft.snapshot.studio.mechanics.at(-1);
  await destination(page, 'Sets');
  await page.getByRole('button', { name: 'Create set', exact: true }).click();
  await create(page, 'Studio mechanics set', 'set');
  await expect(page.getByLabel('Draft set name', { exact: true })).toHaveValue('Studio mechanics set');
  await page.getByRole('button', { name: 'Create card in this set', exact: true }).click();
  await page.getByLabel('Mechanical effect', { exact: true }).selectOption(mechanic.id);
  await create(page, 'Studio mechanic consumer', 'card');
  await expect(page.getByLabel('Draft name', { exact: true })).toHaveValue('Studio mechanic consumer');
  const card = (await state(request)).draft.snapshot.domains.cards.find(row => row.name === 'Studio mechanic consumer');
  expect(card.effect.mechanicId).toBe(mechanic.id);
  await page.keyboard.press('Control+k');
  const finder=page.getByRole('dialog',{name:'Search Admin'});
  await finder.getByRole('searchbox').fill(mechanic.name);
  await finder.getByLabel('Search in').selectOption('records');
  await finder.getByRole('button').filter({ hasText: mechanic.name }).last().click();
  await expect(page.getByLabel('Mechanic name', { exact: true })).toHaveValue(mechanic.name);
  await page.getByRole('button', { name: 'Test Studio mechanic consumer in engine', exact: true }).click();
  const harness = page.getByRole('region', { name: 'Real engine playtest', exact: true });
  await harness.getByRole('combobox', { name: 'Test content', exact: true }).selectOption('draft');
  await harness.getByRole('button', { name: 'Configure custom starting state', exact: true }).click();
  const setup = harness.getByRole('region', { name: 'Custom starting state', exact: true });
  await setup.getByLabel('Player 1 hand 1 card', { exact: true }).selectOption(card.id);
  await setup.getByLabel('Player 1 hand 1 suit', { exact: true }).selectOption(card.suit);
  await setup.getByRole('button', { name: 'Add to player 1 hand', exact: true }).click();
  await setup.getByLabel('Player 1 hand 2 value', { exact: true }).fill('14');
  const { waitForBufferedAdminResponse } = require('./buffered-admin-response');
  let pending = waitForBufferedAdminResponse(page, r => r.url().endsWith('/authoring/playtest'));
  await harness.getByRole('button', { name: 'Start draft duel playtest', exact: true }).click();
  const session = (await (await pending).json()).playtest;
  const action = session.legalActions.find(a => a.type === 'playSupport');
  expect(action).toBeTruthy();
  await harness.getByRole('combobox', { name: 'Action', exact: true }).selectOption(action.id);
  await harness.getByRole('group', { name: /^Payment cards/ }).getByRole('checkbox', { name: /Ace|A of|14/ }).check();
  pending = waitForBufferedAdminResponse(page, r => r.url().endsWith('/playtest/command'));
  await harness.getByRole('button', { name: 'Execute selected action', exact: true }).click();
  const executed = (await (await pending).json()).playtest;
  expect(executed.game.players[1].life).toBe(session.game.players[1].life + 2);
  expect(executed.lastCommand.events.some(e => e.type === 'mechanic.effect' && e.operation === 'gainLife')).toBeTruthy();
  expect((await state(request)).draft.playtestedHash).toBe((await state(request)).draft.hash);
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
  await page.getByLabel('Ability type', { exact: true }).selectOption('composition');
  await page.getByRole('button', { name: 'Combine with saved mechanics', exact: true }).click();
  await expect(page.getByLabel('Also include custom arming effects')).toBeChecked();
  await page.getByRole('combobox', { name: 'Add a saved mechanic', exact: true }).selectOption(definitions[0].id);
  await page.getByRole('combobox', { name: 'Add a saved mechanic', exact: true }).selectOption(definitions[1].id);
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
  if(await page.getByRole('button', { name: 'Back to list', exact: true }).isVisible()) await page.getByRole('button', { name: 'Back to list', exact: true }).click();
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
    env: { ...process.env, GAUNTLET_NATIVE_MATRIX: 'true', GAUNTLET_NATIVE_EVIDENCE_DIR: path.resolve(__dirname, '../docs/reviews/admin-correction/native-zoom') }
  }, (error, stdout, stderr) => {
    fs.writeFileSync(path.resolve(__dirname, '../artifacts/admin-native-zoom.log'), stdout + stderr);
    error ? reject(error) : resolve();
  }));
});
