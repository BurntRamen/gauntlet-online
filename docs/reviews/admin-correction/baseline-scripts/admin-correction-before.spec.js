const {test,expect}=require('./admin-release-test');
const {area,destination,workspaceView,workspaceSection,saveRecord,previewSavedDraft}=require('./admin-navigation');
const {waitForBufferedAdminResponse}=require('./buffered-admin-response');
const AxeBuilder=require('@axe-core/playwright').default;
const fs=require('node:fs'),path=require('node:path');
const origin='http://127.0.0.1:4300', output=path.resolve(__dirname,'../docs/reviews/admin-correction/before-journeys');
const token=()=>JSON.parse(fs.readFileSync(path.resolve(__dirname,'../.playwright-data/studio/sessions.json'))).simply;
const headers=()=>({Authorization:'Bearer '+token()});
async function state(request){const r=await request.get(origin+'/api/admin/authoring',{headers:headers()});expect(r.ok()).toBeTruthy();return r.json();}
async function mutate(request,action,data={}){const s=await state(request);const r=await request.post(origin+'/api/admin/authoring/'+action,{headers:headers(),data:{expectedRevision:s.revision,...data}});expect(r.ok(),await r.text()).toBeTruthy();return r.json();}
async function clean(request){if((await state(request)).draft)await mutate(request,'discard');}
async function home(page){await page.goto('/admin/gauntlet');await expect(page.getByRole('heading',{name:'Back to making great games.',exact:true})).toBeVisible();}
async function capture(page,id){fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,id+'.png')});const events=await page.evaluate(()=>window.workflowAudit);fs.writeFileSync(path.join(output,id+'.json'),JSON.stringify({id,events,clicks:events.filter(e=>e.type==='click').length,changes:events.filter(e=>e.type==='change').length,screens:[...new Set(events.map(e=>e.url))]},null,2));}
async function publish(page,name){await area(page,'Publishing');await page.getByRole('button',{name:'Validate draft',exact:true}).click();await expect(page.getByText('Draft validation completed.',{exact:true})).toBeVisible();await previewSavedDraft(page);await page.getByLabel('Release name',{exact:true}).fill(name);await page.getByRole('button',{name:'Publish release',exact:true}).click();await page.getByRole('button',{name:'Confirm publish',exact:true}).click();await expect(page.getByText('No saved changes to review.',{exact:true})).toBeVisible();}
async function rollback(page,request,before){const release=before.releases.find(r=>r.id===before.activeReleaseId);await page.getByRole('button',{name:'Restore '+release.label,exact:true}).click();await page.getByRole('button',{name:'Confirm rollback',exact:true}).click();await expect(page.getByText('Previous release restored for future games.',{exact:true})).toBeVisible();expect((await state(request)).live).toEqual(before.live);}
test.beforeEach(async({context,request,baseURL})=>{
 await clean(request);
 await context.route('**/*',r=>['http:','https:'].includes(new URL(r.request().url()).protocol)&&![origin,new URL(baseURL).origin].includes(new URL(r.request().url()).origin)?r.abort():r.continue());
 await context.addInitScript(t=>{localStorage.setItem('gauntlet_auth_token',t);window.workflowAudit=[];for(const type of ['click','change'])document.addEventListener(type,e=>{const el=e.target.closest('button,summary,input,select,textarea');if(el)window.workflowAudit.push({type,tag:el.tagName,control:(el.getAttribute('aria-label')||el.textContent||el.closest('label')?.textContent||'').trim().slice(0,100),url:location.search,forms:[...document.querySelectorAll('form')].filter(x=>x.getBoundingClientRect().height).length});});},token());
});
test.afterEach(async({request})=>clean(request));

test('Home creates a card in its chosen set with a real preview before save',async({page,request})=>{
 await mutate(request,'create',{domain:'sets',name:'Journey set'});
 const set=(await state(request)).draft.snapshot.domains.sets.at(-1);
 const reads=[];page.on('request',r=>reads.push(new URL(r.url()).pathname));
 await home(page);expect(reads).not.toContain('/api/admin/authoring');expect(reads).not.toContain('/api/admin/catalog');
 await capture(page,'home');
 await page.getByRole('button',{name:'Create a card',exact:true}).click();
 await page.getByLabel('New content name',{exact:true}).fill('Journey ember');
 await page.getByLabel('Set',{exact:true}).selectOption(set.id);

 await capture(page,'create-card');
 await page.getByRole('button',{name:'Save new card to draft',exact:true}).click();
 await expect(page.getByLabel('Draft name',{exact:true})).toHaveValue('Journey ember');
 const saved=await state(request),card=saved.draft.snapshot.domains.cards.find(c=>c.name==='Journey ember');
 expect(saved.draft.snapshot.domains.sets.find(s=>s.id===set.id).members).toContain(card.id);
 await workspaceView(page,'Preview');await expect(page.locator('.admin-card-preview .special-card-name')).toHaveText('Journey ember',{timeout:45000});await page.locator('.design-header').scrollIntoViewIfNeeded();await capture(page,'card-saved');await workspaceView(page,'Editor');await page.reload();await expect(page.getByLabel('Draft name',{exact:true})).toHaveValue('Journey ember');
});

test('create a mechanic, use it on an existing card and execute it in the real engine',async({page,request})=>{
 await home(page);await destination(page,'Engine / Rules');await page.getByLabel('Content type',{exact:true}).selectOption('mechanics');await page.getByRole('button',{name:'Create mechanic',exact:true}).click();
 await page.getByLabel('Mechanic name',{exact:true}).fill('Journey restoration');await page.getByRole('checkbox',{name:'armament',exact:true}).check();
 await page.getByLabel('Ability 1 effect 1',{exact:true}).selectOption('gainLife');
 await page.getByLabel('Effect 1.1 amount',{exact:true}).fill('2');
 const saving=waitForBufferedAdminResponse(page,r=>r.url().endsWith('/authoring/studio-draft'));
 await page.getByRole('button',{name:'Save mechanic to draft',exact:true}).click();expect((await saving).ok()).toBeTruthy();
 await expect(page.locator('.admin-save-context')).toHaveText('Saved to shared draft');
 const mechanic=(await state(request)).draft.snapshot.studio.mechanics.at(-1);
 await capture(page,'mechanic');await destination(page,'Cards');
 await page.locator('button[data-object="rumin-coin-scale-spear"]').waitFor({state:'attached'});
 if(!await page.locator('button[data-object="rumin-coin-scale-spear"]').isVisible()) await page.getByRole('button',{name:'Back to list',exact:true}).click();
 await page.locator('button[data-object="rumin-coin-scale-spear"]').click();await workspaceSection(page,'Card Workshop','Mechanics');
 await page.getByRole('button',{name:'Replace with modular effects',exact:true}).click();await page.getByRole('combobox',{name:'Add effect module',exact:true}).selectOption(mechanic.id);await saveRecord(page);await expect(page.locator('.admin-record-save')).toHaveCount(0);
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

test('Previous Website editor changes page copy and imagery through release and rollback; presentation controls were unavailable',async({page,request})=>{
 const before=await state(request);await home(page);await area(page,'Website');
 await page.getByLabel('Draft play landing · heading',{exact:true}).fill('An authored welcome');
 await page.getByLabel('Draft play landing · introduction',{exact:true}).fill('A real player page, reviewed in the studio.');
 await page.getByRole('button',{name:'Browse images',exact:true}).click();const picker=page.getByRole('dialog',{name:'Choose artwork'});await picker.locator('.asset-picker-tile').first().click();await picker.getByRole('button',{name:'Use selected artwork',exact:true}).click();
 const preview=page.locator('.admin-player-stage');await expect(preview.locator('h1')).toHaveText('An authored welcome');await expect(preview.locator('.cd-page-artwork')).toBeVisible();
 await saveRecord(page);await expect(page.locator('.admin-record-save')).toHaveCount(0);await capture(page,'website');
 const unchanged=await(await request.get(origin+'/api/game-content')).json();expect(unchanged.content.websiteProse.play.title).not.toBe('An authored welcome');
 await publish(page,'Website composition journey');
 const player=await page.context().newPage();await player.goto('/');await player.getByRole('navigation',{name:'Main navigation',exact:true}).getByRole('button',{name:'Play',exact:true}).click();
 await expect(player.locator('.cd-page-header h1')).toHaveText('An authored welcome');await expect(player.locator('.cd-page-artwork')).toBeVisible();
 await player.screenshot({path:path.join(output,'website-published.png')});await player.close();await rollback(page,request,before);await capture(page,'website-rolled-back');
});

test('product price and availability save through the same editor and resolve in the real storefront projection',async({page,request})=>{
 const deck=(await mutate(request,'create',{domain:'decks',name:'Journey recipe',factionId:'rumin'})).draft.snapshot.domains.decks.at(-1);
 await home(page);await destination(page,'Store');await page.getByRole('button',{name:'Create offer',exact:true}).click();await page.getByLabel('New content name',{exact:true}).fill('Journey product');await page.getByLabel('Recipe',{exact:true}).selectOption(deck.id);await page.getByRole('button',{name:'Save new offer to draft',exact:true}).click();
 await page.getByLabel('Price in gold',{exact:true}).fill('30');await page.getByLabel('Draft store availability',{exact:true}).selectOption('available');await saveRecord(page);await expect(page.locator('.admin-record-save')).toHaveCount(0);await capture(page,'product');
 await previewSavedDraft(page);const saved=await state(request);const offer=saved.draft.snapshot.domains.offers.find(o=>o.name==='Journey product');expect(offer.prices.gold).toBe(30);
 const projection=await mutate(request,'preview');expect(projection.preview.manifest.deckOffers.find(o=>o.id===offer.id).prices.gold).toBe(30);expect(projection.preview.manifest.deckOffers.find(o=>o.id===offer.id).status).toBe('available');await capture(page,'product-verified');
});

test('review changes from multiple workspaces, validate, publish and restore the exact original release',async({page,request})=>{
 const before=await state(request);await home(page);await destination(page,'Cards');await page.locator('button[data-object="rumin-coin-scale-spear"]').click();
 await page.getByLabel('Draft name',{exact:true}).fill('Shared review blade');await saveRecord(page);await expect(page.locator('.admin-record-save')).toHaveCount(0);
 await area(page,'Website');await page.getByLabel('Draft play landing · heading',{exact:true}).fill('Shared website review');await saveRecord(page);await expect(page.locator('.admin-record-save')).toHaveCount(0);
 await area(page,'Publishing');const review=page.getByRole('region',{name:'Shared release review'});await expect(review).toContainText('Shared review blade');await expect(review).toContainText('Shared website review');await capture(page,'publishing');
 await publish(page,'Across workspaces');const published=await(await request.get(origin+'/api/game-content')).json();expect(published.content.cards.find(c=>c.id==='rumin-coin-scale-spear').name).toBe('Shared review blade');expect(published.content.websiteProse.play.title).toBe('Shared website review');await rollback(page,request,before);await capture(page,'publication-rolled-back');
});
