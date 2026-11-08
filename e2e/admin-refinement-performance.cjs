const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { spawn } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const { chromium } = require('@playwright/test');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts');
const fixture = process.env.ADMIN_PERF_FIXTURE || path.join(root, '.playwright-data', 'admin-performance-' + Date.now());
const clientOrigin = process.env.ADMIN_PERF_CLIENT || 'http://127.0.0.1:3188', serverOrigin = process.env.ADMIN_PERF_SERVER || 'http://127.0.0.1:4188';
const children = [];
function launch(script, env, name) {
  const fd = fs.openSync(path.join(output, name + '.log'), 'w');
  const child = spawn(process.execPath, [path.join(root, script)], { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', fd, fd], windowsHide: true });
  fs.closeSync(fd); children.push(child); return child;
}
async function ready(url, child) {
  const end = Date.now() + 60000;
  while (Date.now() < end) {
    if (child.exitCode !== null) throw Error('Fixture exited before readiness: ' + child.exitCode);
    try { const response = await fetch(url); await response.arrayBuffer(); if (response.ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw Error('Fixture readiness timed out: ' + url);
}
async function painted(page) { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
async function section(page, name) {
  const select = page.getByRole('combobox', { name: 'Card Workshop section', exact: true });
  if (await select.isVisible()) await select.selectOption({ label: name });
  else await page.getByRole('navigation', { name: 'Card Workshop sections', exact: true }).getByRole('button', { name, exact: true }).click();
}
function resources(records) {
  return [...records.values()].filter(row => row.response).map(row => ({ path: row.url.replace(clientOrigin, '').replace(serverOrigin, '[api]'), mime: row.mime, status: row.status, encodedBytes: row.encodedBytes || 0, finished: !!row.finished, durationMs: row.finishedAt ? Math.round((row.finishedAt - row.started) * 1000) : null }));
}
function jsSummary(rows) {
  const scripts = rows.filter(row => row.mime?.includes('javascript'));
  return { count: scripts.length, rawTransferBytes: scripts.reduce((total, row) => total + row.encodedBytes, 0), gzipBuildBytes: scripts.reduce((total, row) => {
    const file = path.join(process.env.ADMIN_PERF_BUILD || path.join(root, 'client/build'), row.path.replace(/^\//, '').split('?')[0]);
    return total + (fs.existsSync(file) ? zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length : 0);
  }, 0), paths: scripts.map(row => row.path) };
}
(async () => {
  let browser;
  try {
    if (process.env.ADMIN_PERF_EXTERNAL !== 'true') {
    const backend = launch('e2e/admin-server.js', { GAUNTLET_ADMIN_FIXTURE_PORT: '4188', GAUNTLET_ADMIN_CLIENT_PORT: '3188', GAUNTLET_ASSET_FIXTURE_ROOT: fixture, GAUNTLET_PHASE2_FIXTURE: 'true' }, 'admin-performance-backend');
    const frontend = launch('scripts/serve-client-build.js', { PORT: '3188', REBUILD_CLIENT: 'false' }, 'admin-performance-client');
    await Promise.all([ready(serverOrigin + '/api/game-content', backend), ready(clientOrigin, frontend)]);
    }
    const token = JSON.parse(fs.readFileSync(path.join(fixture, 'sessions.json'), 'utf8')).simply;
    browser = await chromium.launch({ channel: 'chromium', headless: true });
    const samples = [];
    for (const cpuRate of [1, 1, 1, 4]) {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
      const blocked = [];
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (['http:', 'https:'].includes(url.protocol) && ![clientOrigin, serverOrigin].includes(url.origin)) { blocked.push(url.origin); return route.abort('blockedbyclient'); }
        return route.continue();
      });
      await context.addInitScript(token => {
        localStorage.setItem('gauntlet_auth_token', token);
        window.__loadEvidence = { longTasks: [], inputFrames: [], events: [], shifts: [] };
        new PerformanceObserver(list => window.__loadEvidence.longTasks.push(...list.getEntries().map(entry => ({ start: entry.startTime, duration: entry.duration })))).observe({ type: 'longtask', buffered: true });
        new PerformanceObserver(list => window.__loadEvidence.events.push(...list.getEntries().map(entry => ({ name: entry.name, duration: entry.duration, interactionId: entry.interactionId })))).observe({ type: 'event', buffered: true, durationThreshold: 16 });
        new PerformanceObserver(list => window.__loadEvidence.shifts.push(...list.getEntries().filter(entry => !entry.hadRecentInput).map(entry => entry.value))).observe({ type: 'layout-shift', buffered: true });
        document.addEventListener('input', () => { const start = performance.now(); requestAnimationFrame(() => requestAnimationFrame(() => window.__loadEvidence.inputFrames.push(performance.now() - start))); }, true);
      }, token);
      const page = await context.newPage();
      page.setDefaultTimeout(60000);
      const cdp = await context.newCDPSession(page); await cdp.send('Network.enable'); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
      const records = new Map();
      cdp.on('Network.requestWillBeSent', data => records.set(data.requestId, { url: data.request.url, started: data.timestamp }));
      cdp.on('Network.responseReceived', data => Object.assign(records.get(data.requestId) || {}, { response: true, mime: data.response.mimeType, status: data.response.status }));
      cdp.on('Network.loadingFinished', data => Object.assign(records.get(data.requestId) || {}, { encodedBytes: data.encodedDataLength, finished: true, finishedAt: data.timestamp }));
      const failures = []; page.on('pageerror', error => failures.push(error.message));
      await page.goto(clientOrigin + '/admin/gauntlet?area=Home', { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: /Make your next move\.|Your production workspace/, exact: true }).waitFor({ state: 'visible' }); await painted(page);
      const home = await page.evaluate(() => ({ readyMs: performance.now(), fcpMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime, domContentLoadedMs: performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd }));
      const homeResources = resources(records), homeScripts = jsSummary(homeResources);
      const homeRequestPaths = [...records.values()].map(row => row.url.replace(clientOrigin, "").replace(serverOrigin, "[api]"));
      if (process.env.GAUNTLET_EXPECT_DEFERRED_CATALOG === "true" && homeRequestPaths.some(path => path.startsWith("[api]/api/admin/catalog"))) throw Error("Catalog was requested before first Content/Players use");
      let start = performance.now();
      await page.getByRole('navigation', { name: 'Administration sections', exact: true }).getByRole('button', { name: 'Content', exact: true }).click();
      const recordButton = page.locator('.admin-content-browser button[title="rumin-coin-scale-spear"]');
      await recordButton.waitFor({ state: 'visible' }); await painted(page);
      const contentReadyMs = performance.now() - start, contentResources = resources(records), contentScripts = jsSummary(contentResources);
      start = performance.now(); await recordButton.click();
      const input = page.getByLabel('Draft name', { exact: true }); await input.waitFor({ state: 'visible' }); await painted(page);
      const editorReadyMs = performance.now() - start;
      const original = await input.inputValue();
      await input.focus(); await page.keyboard.press('End');
      const beforeTyping = await page.evaluate(() => ({ at: performance.now(), inputs: window.__loadEvidence.inputFrames.length }));
      await page.keyboard.type(' QA', { delay: 35 }); await painted(page);
      const typing = await page.evaluate(before => ({ inputToTwoFramesMs: window.__loadEvidence.inputFrames.slice(before.inputs), longTasks: window.__loadEvidence.longTasks.filter(task => task.start >= before.at) }), beforeTyping);
      await input.fill(original); await painted(page);
      start = performance.now(); await section(page, 'Mechanics'); await page.getByLabel('Reusable mechanic', { exact: true }).waitFor({ state: 'visible' }); await painted(page);
      const mechanicsReadyMs = performance.now() - start;
      start = performance.now(); await section(page, 'Details'); await input.waitFor({ state: 'visible' }); await painted(page);
      const detailsReadyMs = performance.now() - start;
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      const finalResources = resources(records), observed = await page.evaluate(() => window.__loadEvidence);
      const sample = { cpuRate, home, contentReadyMs, editorReadyMs, mechanicsReadyMs, detailsReadyMs, typing, homeRequestPaths, homeScripts, contentScripts, finalScripts: jsSummary(finalResources), resources: finalResources, homeResources, contentResources, observed, blockedOrigins: [...new Set(blocked)], pageErrors: failures };
      samples.push(sample);
      fs.writeFileSync(path.join(output, 'admin-refinement-perf-' + (process.env.ADMIN_PERF_PHASE || 'after') + '.json'), JSON.stringify({ measuredAt: new Date().toISOString(), clientOrigin, serverOrigin, fixture, conditions: 'Production build; isolated local fixture; fresh browser context; route guard disables HTTP cache; local server sends uncompressed assets with no-store; no network throttling. CPU rate1 is host speed; rate4 is Chromium simulation. Times are local QA, not production measurements.', samples }, null, 2));
      console.log(JSON.stringify({ sample: samples.length, cpuRate, homeReadyMs: Math.round(home.readyMs), contentReadyMs: Math.round(contentReadyMs), editorReadyMs: Math.round(editorReadyMs), mechanicsReadyMs: Math.round(mechanicsReadyMs), detailsReadyMs: Math.round(detailsReadyMs), typingFramesMs: typing.inputToTwoFramesMs.map(Math.round), typingLongTasks: typing.longTasks.length, homeGzipJS: homeScripts.gzipBuildBytes, contentGzipJS: contentScripts.gzipBuildBytes, errors: failures }));
      await context.close();
    }
  } finally {
    await browser?.close();
    for (const child of children) if (child.exitCode === null) child.kill();
    await Promise.all(children.map(child => child.exitCode === null ? new Promise(resolve => child.once('exit', resolve)) : undefined));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
