const { spawn } = require('node:child_process');
const path = require('node:path');
const cwd = path.resolve(__dirname, '..');
const env = { ...process.env, GAUNTLET_ADMIN_FIXTURE_PORT: '4188', GAUNTLET_ADMIN_CLIENT_PORT: '3188', GAUNTLET_ASSET_FIXTURE_ROOT: path.join(cwd, '.playwright-data/studio'), GAUNTLET_PHASE2_FIXTURE: 'true', PORT: '3188' };
const children = ['e2e/admin-server.js', 'scripts/serve-client-build.js'].map(file => spawn(process.execPath, [file], { cwd, env, stdio: 'inherit', windowsHide: true }));
const stop = () => children.forEach(child => child.kill());
process.on('exit', stop); process.on('SIGINT', () => process.exit()); process.on('SIGTERM', () => process.exit());
async function run() {
  for (const port of [4188, 3188]) {
    let ready = false;
    for (let attempt = 0; attempt < 60 && !ready; attempt++) {
      try { ready = (await fetch(`http://127.0.0.1:${port}/${port === 4188 ? 'api/game-content' : ''}`, { signal: AbortSignal.timeout(3000) })).ok; } catch {}
      if (!ready) await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!ready) throw new Error('Local preview failed to start: ' + port);
  }
  console.log('Isolated studio ready at http://127.0.0.1:3188');
  if (process.argv[2]) {
    const capture = spawn(process.execPath, ['scripts/capture-admin-studio.cjs', process.argv[2]], { cwd, env, stdio: 'inherit', windowsHide: true });
    capture.on('exit', code => { stop(); process.exit(code); });
  }
}
run().catch(error => { console.error(error); stop(); process.exit(1); });
