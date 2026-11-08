// Manual companion to the automated reflow suite. Set browser zoom through
// Edge's native UI, then capture the rendered page with `capture <name>`.
// This creates only synthetic local fixture content and never reads a user profile.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const readline = require('node:readline');
const { chromium, expect } = require('@playwright/test');
const root = path.resolve(__dirname, '..');
const fixture = process.env.GAUNTLET_NATIVE_FIXTURE_ROOT || path.join(root, '.playwright-data', 'admin-native-zoom-' + Date.now());
const destination = path.join(root, 'docs/reviews/admin-pipelines/native-zoom');
const children = [];
function launch(script, env, name) {
  const fd = fs.openSync(path.join(root, 'artifacts', name + '.log'), 'w');
  const child = spawn(process.execPath, [path.join(root, script)], { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', fd, fd], windowsHide: true });
  fs.closeSync(fd); children.push(child); return child;
}
async function ready(url, child) {
  for (let i = 0; i < 160; i++) {
    if (child.exitCode !== null) throw Error('Fixture stopped before readiness');
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw Error('Fixture readiness timed out');
}
(async () => {
  let browser;
  try {
    fs.mkdirSync(destination, { recursive: true });
    const backend = launch('e2e/admin-server.js', { GAUNTLET_ADMIN_FIXTURE_PORT: '4188', GAUNTLET_ADMIN_CLIENT_PORT: '3188', GAUNTLET_ASSET_FIXTURE_ROOT: fixture, GAUNTLET_PHASE2_FIXTURE: 'true' }, 'admin-native-zoom-backend');
    const frontend = launch('scripts/serve-client-build.js', { PORT: '3188', REBUILD_CLIENT: 'false' }, 'admin-native-zoom-client');
    await Promise.all([ready('http://127.0.0.1:4188/api/game-content', backend), ready('http://127.0.0.1:3188', frontend)]);
    const token = JSON.parse(fs.readFileSync(path.join(fixture, 'sessions.json'), 'utf8')).simply;
    browser = await chromium.launch({ headless: false, channel: 'msedge', args: ['--window-size=1382,855'] });
    const context = await browser.newContext({ viewport: null });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      return ['http:', 'https:'].includes(url.protocol) && !['http://127.0.0.1:3188', 'http://127.0.0.1:4188'].includes(url.origin) ? route.abort('blockedbyclient') : route.continue();
    });
    await context.addInitScript(value => localStorage.setItem('gauntlet_auth_token', value), token);
    const page = await context.newPage();
    const headers = { Authorization: `Bearer ${token}` };
    const api = async (method, route, data) => {
      const response = await context.request[method]('http://127.0.0.1:4188/api/admin/authoring' + route, { headers, ...(data ? { data } : {}) });
      if (!response.ok()) throw Error('Fixture request failed: ' + response.status());
      return response.json();
    };
    await page.goto('http://127.0.0.1:3188/admin/gauntlet');
    await page.getByRole('button', { name: 'Build a card set', exact: true }).waitFor();
    const initial = await page.evaluate(() => ({ innerWidth, innerHeight, outerWidth, outerHeight }));
    const sizing = await context.newCDPSession(page);
    const { windowId } = await sizing.send('Browser.getWindowForTarget');
    await sizing.send('Browser.setWindowBounds', { windowId, bounds: { width: initial.outerWidth + 1366 - initial.innerWidth, height: initial.outerHeight + 768 - initial.innerHeight } });
    await expect.poll(() => page.evaluate(() => innerWidth)).toBe(1366);
    await expect.poll(() => page.evaluate(() => innerHeight)).toBe(768);
    await sizing.detach();
    console.log('Ready. Use native browser zoom. Commands: measure, home, collection, editor, preview, invalid, review, capture <name>, exit.');
    for await (const line of readline.createInterface({ input: process.stdin })) {
      const [command, name] = line.trim().split(/\s+/);
      let captureSize;
      if (command === 'exit') break;
      if (['home', 'collection', 'editor'].includes(command)) {
        await page.goto('http://127.0.0.1:3188/admin/gauntlet' + (command === 'home' ? '' : command === 'collection' ? '?workshop=cards' : '?workshop=cards&object=rumin-vault-shield-bearer'));
        if (command === 'home') await page.getByRole('button', { name: 'Build a card set', exact: true }).waitFor();
        else if (command === 'editor') await page.getByLabel('Draft name', { exact: true }).waitFor();
        else await page.getByRole('region', { name: 'Card Workshop', exact: true }).waitFor();
      } else if (command === 'preview') {
        await page.getByRole('button', { name: 'Preview', exact: true }).click();
        await page.getByRole('region', { name: 'Card Workshop preview and test', exact: true }).waitFor();
      } else if (['invalid', 'review'].includes(command)) {
        const state = await api('get', '');
        await api('patch', '/draft', { expectedRevision: state.revision, domain: 'cards', id: 'rumin-vault-shield-bearer', field: 'name', value: command === 'invalid' ? '' : 'Zoom review candidate' });
        await page.goto('http://127.0.0.1:3188/admin/gauntlet?area=Publishing');
        await page.getByRole('region', { name: 'Shared release review' }).waitFor();
      } else if (command === 'capture' && /^[a-z0-9-]+$/.test(name || '')) {
        await page.evaluate(async () => {
          await document.fonts.ready;
          await Promise.all([...document.images].filter(img => { const box = img.getBoundingClientRect(); return box.width && box.height && box.top < innerHeight && box.bottom > 0; }).map(img => img.decode().catch(() => {})));
        });
        // Match the existing zoom test: no CSS clip, which crops native zoom.
        const captureSession = await context.newCDPSession(page);
        const capture = await captureSession.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
        await captureSession.detach();
        const pixels = Buffer.from(capture.data, 'base64');
        fs.writeFileSync(path.join(destination, name + '.png'), pixels);
        captureSize = { width: pixels.readUInt32BE(16), height: pixels.readUInt32BE(20) };
      }
      const measurement = await page.evaluate(() => ({ url: location.href, innerWidth, innerHeight, devicePixelRatio, visualScale: visualViewport.scale, scrollWidth: document.documentElement.scrollWidth }));
      console.log(JSON.stringify({ command, name, ...measurement }));
      if (command === 'capture' && /^[a-z0-9-]+$/.test(name || '')) fs.writeFileSync(path.join(destination, name + '.json'), JSON.stringify({ browser: 'Microsoft Edge ' + await browser.version(), captureSize, ...measurement }, null, 2));
    }
  } finally {
    await browser?.close();
    for (const child of children) if (child.exitCode === null) child.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
