const {test,expect}=require('./admin-release-test');
const {area,workspaceSection,saveRecord,previewSavedDraft}=require('./admin-navigation');
const {waitForBufferedAdminResponse}=require('./buffered-admin-response');
const AxeBuilder=require('@axe-core/playwright').default;
const fs=require('node:fs'),path=require('node:path');
const origin=`http://127.0.0.1:${process.env.GAUNTLET_ADMIN_FIXTURE_PORT||'4188'}`, output=path.resolve(__dirname,'../docs/reviews/admin-correction/after');
const token=()=>JSON.parse(fs.readFileSync(path.join(process.env.GAUNTLET_CORRECTION_ROOT,'sessions.json'))).simply;
const headers=()=>({Authorization:'Bearer '+token()});
async function state(request){const r=await request.get(origin+'/api/admin/authoring',{headers:headers()});expect(r.ok()).toBeTruthy();return r.json();}
async function mutate(request,action,data={}){const s=await state(request);const r=await request.post(origin+'/api/admin/authoring/'+action,{headers:headers(),data:{expectedRevision:s.revision,...data}});expect(r.ok(),await r.text()).toBeTruthy();return r.json();}
async function clean(request){if((await state(request)).draft)await mutate(request,'discard');}
async function home(page){await page.goto('/admin/gauntlet');await expect(page.getByRole('heading',{name:'Create something',exact:true})).toBeVisible();}
async function capture(page,id){fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,id+'.png')});const events=await page.evaluate(()=>window.workflowAudit);fs.writeFileSync(path.join(output,id+'.json'),JSON.stringify({id,events,clicks:events.filter(e=>e.type==='click').length,changes:events.filter(e=>e.type==='change').length,screens:[...new Set(events.map(e=>e.url))]},null,2));}
async function publish(page,name){await area(page,'Publishing');await page.getByRole('button',{name:'Validate draft',exact:true}).click();await expect(page.getByText('Draft validation completed.',{exact:true})).toBeVisible({timeout:45000});await previewSavedDraft(page);await page.getByLabel('Release name',{exact:true}).fill(name);await page.getByRole('button',{name:'Publish release',exact:true}).click();await page.getByRole('button',{name:'Confirm publish',exact:true}).click();await expect(page.getByText('No saved changes to review.',{exact:true})).toBeVisible();}
async function rollback(page,request,before){const release=before.releases.find(r=>r.id===before.activeReleaseId);await page.getByRole('button',{name:'Restore '+release.label,exact:true}).click();await page.getByRole('button',{name:'Confirm rollback',exact:true}).click();await expect(page.getByText('Previous release restored for future games.',{exact:true})).toBeVisible();expect((await state(request)).live).toEqual(before.live);}
test.beforeEach(async({context,request,baseURL})=>{
 await clean(request);
 await context.route(url=>['http:','https:'].includes(url.protocol)&&![origin,new URL(baseURL).origin].includes(url.origin),r=>r.abort());
 await context.addInitScript(t=>{localStorage.setItem('gauntlet_auth_token',t);window.workflowAudit=[];for(const type of ['click','change'])document.addEventListener(type,e=>{const el=e.target.closest('button,summary,input,select,textarea');if(el)window.workflowAudit.push({type,tag:el.tagName,control:(el.getAttribute('aria-label')||el.textContent||el.closest('label')?.textContent||'').trim().slice(0,100),url:location.search,forms:[...document.querySelectorAll('form')].filter(x=>x.getBoundingClientRect().height).length});});},token());
});
test.afterEach(async({request})=>clean(request));

test('Home creates a card in its chosen set with a real preview before save',async({page,request})=>{
 await mutate(request,'create',{domain:'sets',name:'Journey set'});
 const set=(await state(request)).draft.snapshot.domains.sets.at(-1);
 const reads=[];page.on('request',r=>reads.push(new URL(r.url()).pathname));
 await home(page);expect(reads).not.toContain('/api/admin/authoring');expect(reads).not.toContain('/api/admin/catalog');
 await capture(page,'home');
 await page.getByRole('button',{name:'Card',exact:true}).click();
 await page.getByLabel('New content name',{exact:true}).fill('Journey ember');
 await page.getByLabel('Set',{exact:true}).selectOption(set.id);
 await expect(page.getByRole('region',{name:'New card preview'})).toContainText('Journey ember');
 await capture(page,'create-card');
 await page.getByRole('button',{name:'Save new card to draft',exact:true}).click();
 await expect(page.getByLabel('Draft name',{exact:true})).toHaveValue('Journey ember');
 const saved=await state(request),card=saved.draft.snapshot.domains.cards.find(c=>c.name==='Journey ember');
 expect(saved.draft.snapshot.domains.sets.find(s=>s.id===set.id).members).toContain(card.id);
 await expect(page.locator('.admin-card-preview .special-card-name')).toHaveText('Journey ember',{timeout:45000});await page.locator('.design-header').scrollIntoViewIfNeeded();await capture(page,'card-saved');await page.reload();await expect(page.getByLabel('Draft name',{exact:true})).toHaveValue('Journey ember');
});

test('create a mechanic, use it on an existing card and execute it in the real engine',async({page,request})=>{
 await home(page);await page.getByRole('button',{name:'Mechanic',exact:true}).click();
 await page.getByLabel('Mechanic name',{exact:true}).fill('Journey restoration');await page.getByRole('checkbox',{name:'armament',exact:true}).check();
 await page.getByLabel('Ability 1 effect 1',{exact:true}).selectOption('gainLife');
 await page.getByLabel('Effect 1.1 amount',{exact:true}).fill('2');
 const saving=waitForBufferedAdminResponse(page,r=>r.url().endsWith('/authoring/studio-draft'));
 await page.getByRole('button',{name:'Save mechanic to draft',exact:true}).click();expect((await saving).ok()).toBeTruthy();
 await expect(page.locator('.admin-save-context')).toHaveText('Saved to shared draft');
 await page.getByLabel('Use on card',{exact:true}).selectOption('rumin-coin-scale-spear');
 await capture(page,'mechanic');await page.getByRole('button',{name:'Use mechanic on card',exact:true}).click();
 await saveRecord(page);await expect(page.locator('.admin-record-save')).toHaveCount(0);
 const saved=await state(request);expect(saved.draft.snapshot.domains.cards.find(c=>c.id==='rumin-coin-scale-spear').effect.mechanicId).toBe(saved.draft.snapshot.studio.mechanics.at(-1).id);
 await workspaceSection(page,'Card Workshop','Test');
 const harness=page.getByRole('region',{name:'Real engine playtest',exact:true});
 await harness.getByRole('combobox',{name:'Test content',exact:true}).selectOption('draft');
 await harness.getByRole('button',{name:'Configure custom starting state',exact:true}).click();
 const setup=harness.getByRole('region',{name:'Custom starting state',exact:true});
 await setup.getByRole('button',{name:'Add to player 1 hand',exact:true}).click();await setup.getByLabel('Player 1 hand 2 value',{exact:true}).fill('14');
 let pending=waitForBufferedAdminResponse(page,r=>r.url().endsWith('/authoring/playtest'));
 await harness.getByRole('button',{name:'Start draft duel playtest',exact:true}).click();const initial=(await(await pending).json()).playtest;
 const action=initial.legalActions.find(a=>a.type==='playSupport');expect(action).toBeTruthy();
 await harness.getByRole('combobox',{name:'Action',exact:true}).selectOption(action.id);
 await harness.getByRole('group',{name:/^Payment cards/}).getByRole('checkbox',{name:/Ace|A of|14/}).check();
 pending=waitForBufferedAdminResponse(page,r=>r.url().endsWith('/playtest/command'));await harness.getByRole('button',{name:'Execute selected action',exact:true}).click();const executed=(await(await pending).json()).playtest;
 expect(executed.game.players[1].life).toBe(initial.game.players[1].life+2);expect(executed.lastCommand.events.some(e=>e.type==='mechanic.effect'&&e.operation==='gainLife')).toBeTruthy();
 const tested=await state(request);expect(tested.draft.playtestedHash).toBe(tested.draft.hash);await capture(page,'engine');
});

test('Website Studio changes actual page content, imagery, navigation, section order and typography through release and rollback',async({page,request})=>{
 const before=await state(request);await home(page);await area(page,'Website');
 await page.getByLabel('Draft play landing · heading',{exact:true}).fill('An authored welcome');
 await page.getByLabel('Draft play landing · introduction',{exact:true}).fill('A real player page, reviewed in the studio.');
 await page.getByRole('button',{name:'Browse images',exact:true}).click();const picker=page.getByRole('dialog',{name:'Choose artwork'});await picker.locator('.asset-picker-tile').first().click();await picker.getByRole('button',{name:'Use selected artwork',exact:true}).click();
 const preview=page.frameLocator('.website-render iframe');await expect(preview.locator('h1')).toHaveText('An authored welcome');await expect(preview.locator('.cd-page-artwork')).toBeVisible();
 await page.getByLabel('Edit element',{exact:true}).selectOption('presentation');
 await page.getByLabel('Type style',{exact:true}).selectOption('editorial');await page.getByLabel('Section arrangement',{exact:true}).selectOption('list');
 await page.getByLabel('Basic vs AI',{exact:true}).uncheck();await page.getByRole('button',{name:'Move Factions vs AI earlier',exact:true}).click();
 await expect(preview.locator('[data-layout-module="basic-ai"]')).toHaveCount(0);await expect(preview.locator('[data-layout-module]').first()).toHaveAttribute('data-layout-module','faction-ai');
 await expect(preview.locator('.cd-shell')).toHaveAttribute('data-typography','editorial');await expect(preview.locator('h1')).toHaveCSS('font-family',/Georgia/);await expect(preview.locator('.player-layout-grid').first()).toHaveCSS('grid-template-columns',/^\d+(?:\.\d+)?px$/);
 await page.getByLabel('Edit element',{exact:true}).selectOption('navigation');await page.getByLabel('Play navigation label',{exact:true}).fill('Start playing');await page.getByRole('button',{name:'Move Campaign earlier',exact:true}).click();
 await expect(preview.getByRole('navigation',{name:'Main navigation'}).getByRole('button').first()).toHaveText('Campaign');
 await saveRecord(page);await expect(page.locator('.admin-record-save')).toHaveCount(0);await capture(page,'website');
 const unchanged=await(await request.get(origin+'/api/game-content')).json();expect(unchanged.content.websiteProse.play.title).not.toBe('An authored welcome');
 await publish(page,'Website composition journey');
 const player=await page.context().newPage();await player.goto('/');await player.getByRole('navigation',{name:'Main navigation',exact:true}).getByRole('button',{name:'Start playing',exact:true}).click();
 await expect(player.locator('.cd-page-header h1')).toHaveText('An authored welcome');await expect(player.locator('.cd-page-artwork')).toBeVisible();
 await expect(player.locator('.cd-page-header h1')).toHaveCSS('font-family',/Georgia/);await expect(player.locator('.player-layout-grid').first()).toHaveCSS('grid-template-columns',/^\d+(?:\.\d+)?px$/);await expect(player.locator('.cd-shell')).toHaveAttribute('data-arrangement','list');await expect(player.locator('.cd-shell')).toHaveAttribute('data-typography','editorial');
 await expect(player.locator('[data-layout-module="basic-ai"]')).toHaveCount(0);await expect(player.locator('[data-layout-module]').first()).toHaveAttribute('data-layout-module','faction-ai');
 await expect(player.getByRole('navigation',{name:'Main navigation'}).getByRole('button').first()).toHaveText('Campaign');
 await player.screenshot({path:path.join(output,'website-published.png')});await player.close();await rollback(page,request,before);await capture(page,'website-rolled-back');
});

test('product price and availability save through the same editor and resolve in the real storefront projection',async({page,request})=>{
 const deck=(await mutate(request,'create',{domain:'decks',name:'Journey recipe',factionId:'rumin'})).draft.snapshot.domains.decks.at(-1);
 await home(page);await page.getByRole('button',{name:'Product',exact:true}).click();await page.getByLabel('New content name',{exact:true}).fill('Journey product');await page.getByLabel('Recipe',{exact:true}).selectOption(deck.id);await page.getByRole('button',{name:'Save new offer to draft',exact:true}).click();
 await page.getByLabel('Price in gold',{exact:true}).fill('30');await page.getByLabel('Draft store availability',{exact:true}).selectOption('available');await saveRecord(page);await expect(page.locator('.admin-record-save')).toHaveCount(0);await capture(page,'product');
 await previewSavedDraft(page);const saved=await state(request);const offer=saved.draft.snapshot.domains.offers.find(o=>o.name==='Journey product');expect(offer.prices.gold).toBe(30);
 const projection=await mutate(request,'preview');expect(projection.preview.manifest.deckOffers.find(o=>o.id===offer.id).prices.gold).toBe(30);expect(projection.preview.manifest.deckOffers.find(o=>o.id===offer.id).status).toBe('available');await capture(page,'product-verified');
});

test('review changes from multiple workspaces, validate, publish and restore the exact original release',async({page,request})=>{
 const before=await state(request);await home(page);await area(page,'Create & Edit');await page.locator('button[data-object="rumin-coin-scale-spear"]').click();
 await page.getByLabel('Draft name',{exact:true}).fill('Shared review blade');await saveRecord(page);await expect(page.locator('.admin-record-save')).toHaveCount(0);
 await area(page,'Website');await page.getByLabel('Draft play landing · heading',{exact:true}).fill('Shared website review');await saveRecord(page);await expect(page.locator('.admin-record-save')).toHaveCount(0);
 await area(page,'Publishing');const review=page.getByRole('region',{name:'Shared release review'});await expect(review).toContainText('Shared review blade');await expect(review).toContainText('Shared website review');await capture(page,'publishing');
 await publish(page,'Across workspaces');const published=await(await request.get(origin+'/api/game-content')).json();expect(published.content.cards.find(c=>c.id==='rumin-coin-scale-spear').name).toBe('Shared review blade');expect(published.content.websiteProse.play.title).toBe('Shared website review');await rollback(page,request,before);await capture(page,'publication-rolled-back');
});

test('phone editing preserves unsaved work, keyboard focus and accessible controls',async({page})=>{
 await page.setViewportSize({width:390,height:844});await home(page);await area(page,'Website');
 await page.getByLabel('Draft play landing · heading',{exact:true}).fill('Local phone heading');
 await page.keyboard.press('Control+k');const search=page.getByRole('dialog',{name:'Search Admin'});await expect(search.getByRole('searchbox')).toBeFocused();await search.getByRole('searchbox').fill('Dividend');await search.getByLabel('Search in').selectOption('records');await search.locator('.admin-search-results button').first().click();
 const guard=page.getByRole('dialog',{name:'Unsaved local changes'});await guard.getByRole('button',{name:'Keep editing',exact:true}).click();if(await search.isVisible())await search.getByRole('button',{name:'Close search'}).click();
 await expect(page.getByLabel('Draft play landing · heading',{exact:true})).toHaveValue('Local phone heading');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();expect((await new AxeBuilder({page}).include('.gauntlet-admin').analyze()).violations).toEqual([]);await capture(page,'website-phone');
});


test('measure the twelve operator activities using visible controls',async()=>{
 test.setTimeout(600000);
 fs.mkdirSync(path.resolve(__dirname,'../artifacts'),{recursive:true});
 const {execFile}=require('node:child_process');
 await new Promise((resolve,reject)=>execFile(process.execPath,[path.resolve(__dirname,'../scripts/measure-admin-workflows.cjs')],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,AUDIT_STAGE:'after'}},(error,stdout,stderr)=>{fs.writeFileSync(path.resolve(__dirname,'../artifacts/admin-correction-activities.log'),stdout+stderr);error?reject(error):resolve();}));
 const report=JSON.parse(fs.readFileSync(path.join(output,'../after-activities/measurements.json')));
 expect(report.cases).toHaveLength(12);expect(report.cases.filter(c=>c.error)).toEqual([]);
});


test('native 200 percent browser zoom preserves website and authoring workflows',async()=>{
 test.setTimeout(240000);
 fs.mkdirSync(path.resolve(__dirname,'../artifacts'),{recursive:true});
 const {execFile}=require('node:child_process');
 await new Promise((resolve,reject)=>execFile(process.execPath,[path.resolve(__dirname,'admin-native-zoom.cjs')],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,GAUNTLET_NATIVE_MATRIX:'true',GAUNTLET_NATIVE_EVIDENCE_DIR:path.resolve(__dirname,'../docs/reviews/admin-correction/native-zoom')}},(error,stdout,stderr)=>{fs.writeFileSync(path.resolve(__dirname,'../artifacts/admin-correction-zoom.log'),stdout+stderr);error?reject(error):resolve();}));
});


test('create a set inside card creation without losing the local card',async({page,request})=>{
 await home(page);await page.getByRole('button',{name:'Card',exact:true}).click();
 await page.getByLabel('New content name',{exact:true}).fill('Nested creation card');
 const panel=page.locator('details').filter({has:page.getByText('Create a set here',{exact:true})});
 if(!await panel.getAttribute('open').then(v=>v!==null))await panel.locator('summary').click();
 await page.getByLabel('New set name',{exact:true}).fill('Nested creation set');
 await page.getByRole('button',{name:'Save set and use it',exact:true}).click();
 await expect(page.getByLabel('Set',{exact:true}).locator('option:checked')).toHaveText('Nested creation set');
 await expect(page.getByLabel('New content name',{exact:true})).toHaveValue('Nested creation card');
 await page.getByRole('button',{name:'Save new card to draft',exact:true}).click();
 await expect(page.getByLabel('Draft name',{exact:true})).toHaveValue('Nested creation card');
 const snapshot=(await state(request)).draft.snapshot;
 expect(snapshot.domains.sets.find(s=>s.name==='Nested creation set').members).toContain(snapshot.domains.cards.find(c=>c.name==='Nested creation card').id);
});
