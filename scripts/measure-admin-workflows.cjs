// Local fixture audit. No external network or live publication is permitted.
const { chromium, expect: baseExpect } = require('@playwright/test');
const expect=baseExpect.configure({timeout:45000});
const fs = require('node:fs'), path = require('node:path');
const { area, destination, workspaceSection, saveRecord, saveDefinition, paraTab } = require('../e2e/admin-navigation');
const root = path.resolve(__dirname, '..'), after=process.env.AUDIT_STAGE==='after';
const server='http://127.0.0.1:'+(process.env.GAUNTLET_ADMIN_FIXTURE_PORT||'4188'), client='http://127.0.0.1:'+(process.env.GAUNTLET_ADMIN_CLIENT_PORT||'3188');
async function run() {
  const out = path.join(root, 'docs/reviews/admin-correction/'+(after?'after-activities':'before')); fs.mkdirSync(out, { recursive: true });
  const token = JSON.parse(fs.readFileSync(path.join(process.env.GAUNTLET_CORRECTION_ROOT||path.join(root,'.playwright-data/studio'),'sessions.json'))).simply;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route(url=>['http:','https:'].includes(url.protocol)&&![client,server].includes(url.origin),r=>r.abort());
  await context.addInitScript(t => { localStorage.setItem('gauntlet_auth_token', t); window.audit = []; for (const type of ['click', 'change']) document.addEventListener(type, e => { const el = e.target.closest('button,summary,select,input,textarea'); if (!el) return; window.audit.push({ type, tag: el.tagName, control: (el.getAttribute('aria-label') || el.textContent || el.closest('label')?.textContent || '').trim().slice(0, 100), url: location.search, forms: [...document.querySelectorAll('form')].filter(x => x.getBoundingClientRect().height).length }); }, true); }, token);
  const headers = { Authorization: 'Bearer ' + token, connection: 'close' }, api = server+'/api/admin/authoring';
  const state = async () => (await context.request.get(api, { headers })).json();
  const mutate = async (action, body) => { const s = await state(); const r = await context.request.post(api + '/' + action, { headers, data: { expectedRevision: s.revision, ...body } }); if (!r.ok()) throw new Error(await r.text()); return r.json(); };
  if ((await state()).draft) await mutate('discard', {});
  await mutate('create', { domain: 'sets', name: 'Workflow audit set' });
  await mutate('create', { domain: 'decks', name: 'Workflow audit deck', factionId: 'rumin' });
  const deck = (await state()).draft.snapshot.domains.decks.at(-1);
  await mutate('create', { domain: 'offers', name: 'Workflow audit product', templateId: deck.id });
  const setup=await state();
  if(!setup.draft.snapshot.paraLeague?.seasons.length) await mutate('para-draft',{operation:'create',domain:'seasons',id:'para-audit-season',value:{...require("../server/paraLeague").newDefinition("seasons"),id:'para-audit-season',name:'Audit season',formats:['faction-constructed'],publicRulesVersion:'audit-v1'}});
  const results = process.env.AUDIT_CASE ? JSON.parse(fs.readFileSync(path.join(out,'measurements.json'))).cases.filter(c=>c.id!==process.env.AUDIT_CASE) : [];
  const cases = [
    ['create-card', async p => { await p.getByRole('button', { name: after?'Card':'Create a card', exact: true }).click(); await p.getByLabel('New content name', { exact: true }).fill('Workflow audit card'); await p.getByRole('button', { name: 'Save new card to draft', exact: true }).click(); await expect(p.getByLabel('Draft name', { exact: true })).toHaveValue('Workflow audit card'); if(!after) await workspaceSection(p, 'Card Workshop', 'Artwork'); }],
    ['change-artwork', async p => { await destination(p, 'Cards'); await p.locator('button[data-object="rumin-coin-scale-spear"]').waitFor({state:'attached'}); if(!await p.locator('button[data-object="rumin-coin-scale-spear"]').isVisible()) await p.getByRole('button',{name:'Back to list',exact:true}).click(); await p.locator('button[data-object="rumin-coin-scale-spear"]').click(); await workspaceSection(p, 'Card Workshop', 'Artwork'); await p.getByRole('button', { name: 'Browse images', exact: true }).first().click(); const d=p.getByRole('dialog', {name:'Choose artwork'}); await d.locator('.asset-picker-tile').first().click(); await d.getByRole('button',{name:'Use selected artwork',exact:true}).click(); await saveRecord(p); }],
    ['design-mechanic', async p => { if(after) await p.getByRole('button',{name:'Mechanic',exact:true}).click(); else {await destination(p,'Engine / Rules'); await p.getByLabel('Content type',{exact:true}).selectOption('mechanics'); await p.getByRole('button',{name:'Create mechanic',exact:true}).click();} await p.getByLabel('Mechanic name',{exact:true}).fill('Workflow audit mechanic'); await p.getByRole('button',{name:'Save mechanic to draft',exact:true}).click(); }],
    ['build-set', async p => { await destination(p,'Sets'); await p.getByRole('button',{name:'Inspect Workflow audit set',exact:true}).click(); if(!after) await p.getByText('Related work & player destination',{exact:true}).click(); await p.getByRole('button',{name:after?'Create card in this set':/^Create card$/}).last().click(); await p.getByLabel('New content name',{exact:true}).fill('Card inside audit set'); await p.getByRole('button',{name:'Save new card to draft',exact:true}).click(); await expect(p.getByLabel('Draft name',{exact:true})).toHaveValue('Card inside audit set'); }],
    ['website-content', async p => { await area(p,'Website'); await p.getByLabel('Draft play landing · heading',{exact:true}).fill('Audit website'); await saveRecord(p); }],
    ['website-navigation', async p => { await area(p,'Website'); if(after){await p.getByLabel('Edit element',{exact:true}).selectOption('navigation');await p.getByLabel('Play navigation label',{exact:true}).fill('Begin playing');await saveRecord(p);}else{await p.getByText('Other website presentation',{exact:true}).click(); await expect(p.getByText(/Navigation destinations, interactive sections, typography/)).toBeVisible();} }],
    ['write-campaign', async p => { await destination(p,'Campaigns'); await p.locator('.admin-content-browser button[data-object]').first().click(); await p.getByLabel('Draft campaign introduction',{exact:true}).fill('Audit campaign introduction.'); await saveRecord(p); }],
    ['create-encounter', async p => { await destination(p,'Encounters'); await p.getByRole('button',{name:'Create encounter',exact:true}).click(); await p.getByLabel('New content name',{exact:true}).fill('Audit encounter'); await p.getByRole('button',{name:'Save new encounter to draft',exact:true}).click(); await expect(p.getByLabel('Draft title',{exact:true})).toHaveValue('Audit encounter'); }],
    ['configure-event', async p => { await area(p,'Events & Commerce'); if(!after) await paraTab(p,'Events'); await p.getByRole('button',{name:'New event',exact:true}).click(); await p.getByLabel('Name',{exact:true}).fill('Audit event'); await saveDefinition(p); }],
    ['product-price', async p => { await destination(p,'Store'); await p.getByRole('button',{name:'Inspect Workflow audit product',exact:true}).click(); await p.getByLabel('Price in gold',{exact:true}).fill('30'); await saveRecord(p); }],
    ['inspect-player', async p => { await area(p,'Operations'); await p.getByRole('button',{name:'View player simply',exact:true}).click(); await expect(p.getByRole('heading',{name:'simply',exact:true})).toBeVisible(); }],
    ['review-publish', async p => { await area(p,'Publishing'); await p.getByRole('button',{name:'Validate draft',exact:true}).click(); await expect(p.getByText('Draft validation completed.',{exact:true})).toBeVisible(); }],
  ];
  for(const [id, action] of cases.filter(([id])=>!process.env.AUDIT_CASE || id===process.env.AUDIT_CASE)) {
    const page=await context.newPage(); page.setDefaultTimeout(45000); await page.goto(client+'/admin/gauntlet');
    await page.locator('.admin-home-welcome').waitFor(); let error;
    try { if(!results.length) await page.screenshot({path:path.join(out,'home.png')}); await action(page); await expect(page.locator('.admin-save-context')).not.toHaveText('Working…'); } catch(e) {error=e.message;}
    await page.evaluate(()=>scrollTo(0,0)); await page.screenshot({path:path.join(out,id+'.png')});
    const events=await page.evaluate(()=>window.audit); const record={id,events,clicks:events.filter(e=>e.type==='click').length,changes:events.filter(e=>e.type==='change').length,screens:[...new Set(events.map(e=>e.url))],error};
    results.push(record); console.log(id,record.clicks,record.changes,error?.slice(0,150)||'complete'); await page.close();
    fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify({version:after?'correction working tree':'7d86cce0',method:'Captured browser click/change events; fixture seeding excluded. Screens are distinct route states. Form counts are observed visible form elements, not conceptual editor sections.',cases:results},null,2));
  }
  await mutate('discard',{}); await browser.close();
}
run().catch(e=>{console.error(e);process.exit(1);});
