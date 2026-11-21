const {test,expect}=require('./admin-release-test');
const {area,workspaceSection,saveRecord,previewSavedDraft}=require('./admin-navigation');
const {waitForBufferedAdminResponse}=require('./buffered-admin-response');
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const AxeBuilder=require('@axe-core/playwright').default;
const origin=`http://127.0.0.1:${process.env.GAUNTLET_ADMIN_FIXTURE_PORT||4188}`;
const output=path.resolve(__dirname,'../docs/reviews/admin-creative');
const token=()=>JSON.parse(fs.readFileSync(path.join(process.env.GAUNTLET_CORRECTION_ROOT,'sessions.json'))).simply;
const headers=()=>({Authorization:'Bearer '+token()});
async function status(request){const response=await request.get(origin+'/api/admin/authoring',{headers:headers()});expect(response.ok()).toBeTruthy();return response.json();}
async function capture(page,name){fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,name+'.png')});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();}
async function save(page){await saveRecord(page);await expect(page.locator('.admin-record-save')).toHaveCount(0);}
async function upload(page,name){
 const picker=page.getByRole('dialog',{name:'Choose artwork',exact:true});await picker.getByText('Upload artwork',{exact:true}).click();
 await picker.getByLabel('Artwork title',{exact:true}).fill(name);await picker.getByLabel('Attribution / source notes').fill('Isolated acceptance fixture · existing SuitFire Rumin artwork, reuploaded for acceptance');
 const image=await sharp(path.resolve(__dirname,'../client/public/assets/gauntlet/rumin-card.webp')).resize(640,480,{fit:'cover'}).webp().toBuffer();
 await picker.getByLabel('Image file',{exact:true}).setInputFiles({name:name+'.webp',mimeType:'image/webp',buffer:image});
 const pending=waitForBufferedAdminResponse(page,response=>response.url().endsWith('/assets/upload'));
 await picker.getByRole('button',{name:'Upload new artwork',exact:true}).click();const response=await pending;expect(response.ok()).toBeTruthy();const result=await response.json();
 await picker.getByRole('button',{name:'Use selected artwork',exact:true}).click();return result.uploaded;
}
async function publish(page,label,screenshot){await area(page,'Publishing');await page.getByRole('button',{name:'Validate draft',exact:true}).click();await expect(page.getByText('Draft validation completed.',{exact:true})).toBeVisible({timeout:45000});await previewSavedDraft(page);await page.getByLabel('Release name',{exact:true}).fill(label);await expect(page.getByRole('button',{name:'Publish release',exact:true})).toBeEnabled();if(screenshot){await page.getByRole('heading',{name:'Review saved changes',exact:true}).scrollIntoViewIfNeeded();await capture(page,screenshot);}await page.getByRole('button',{name:'Publish release',exact:true}).click();await page.getByRole('button',{name:'Confirm publish',exact:true}).click();await expect(page.getByText('Release published. Future games use this content.',{exact:true})).toBeVisible({timeout:45000});}
test.beforeEach(async({context,request})=>{
 const before=await status(request);if(before.draft){const response=await request.post(origin+'/api/admin/authoring/discard',{headers:headers(),data:{expectedRevision:before.revision}});expect(response.ok()).toBeTruthy();}
 await context.addInitScript(token=>localStorage.setItem('gauntlet_auth_token',token),token());
});

test('uploaded card and menu artwork, device previews, navigation and shared publication roll back exactly',async({page,request,restoreRelease})=>{
 const before=await status(request);restoreRelease(headers(),before,origin);
 await page.goto('/admin/gauntlet?workshop=cards&object=rumin-coin-scale-spear&section=artwork');
 await page.getByRole('button',{name:'Browse images',exact:true}).click();const cardImage=await upload(page,'Creative card artwork');await capture(page,'01-card-artwork-local');await save(page);
 let state=await status(request);expect(state.draft.snapshot.domains.assets.find(row=>row.id==='rumin-coin-scale-spear:standard').art).toBe(cardImage.id);
 await area(page,'Website');const desktop=page.frameLocator('.website-render iframe');await expect(desktop.locator('h1')).toBeVisible();
 await desktop.locator('[data-layout-module="basic-ai"]').click();await expect(page.getByLabel('Edit element',{exact:true})).toHaveValue('basic-ai');
 await page.getByRole('button',{name:'Browse images',exact:true}).click();const menuImage=await upload(page,'Creative menu artwork');
 await page.getByRole('button',{name:'learn',exact:true}).click();await expect(desktop.locator('[data-action-id="basic-ai"] .cd-action-art img')).toHaveAttribute('src',/^data:image/);
 await capture(page,'03-menu-artwork-desktop');
 await page.getByRole('button',{name:'Mobile',exact:true}).click();await expect(page.getByTitle('Mobile player page preview')).toBeVisible();
 await expect(desktop.locator('.cd-mobile-nav')).toBeVisible();expect(await desktop.locator('body').evaluate(()=>innerWidth)).toBe(390);await capture(page,'03-menu-artwork-mobile');
 await page.getByLabel('Edit element',{exact:true}).selectOption('header');await page.getByLabel('Draft play landing · heading',{exact:true}).fill('Your next SuitFire story');
 await page.getByLabel('Edit element',{exact:true}).selectOption('navigation');await page.getByLabel('Play navigation label',{exact:true}).fill('Start playing');await page.getByRole('button',{name:'Move Campaign earlier',exact:true}).click();
 await page.getByLabel('Edit element',{exact:true}).selectOption('presentation');await page.getByLabel('Type style',{exact:true}).selectOption('editorial');await page.getByLabel('Section arrangement',{exact:true}).selectOption('compact');
 await page.getByLabel('Edit element',{exact:true}).selectOption('background');await page.getByRole('button',{name:'Browse images',exact:true}).click();const picker=page.getByRole('dialog',{name:'Choose artwork'});await picker.getByRole('textbox',{name:/Search/}).fill('Creative menu artwork');await picker.locator('.asset-picker-tile').first().click();await picker.getByRole('button',{name:'Use selected artwork',exact:true}).click();
 await save(page);state=await status(request);expect(state.draft.snapshot.domains.game.find(row=>row.id==='practice')['playPageTile-basic-ai-Image']).toBe(menuImage.id);
 await capture(page,'04-website-saved');await area(page,'Publishing');await expect(page.getByRole('region',{name:'Shared release review'})).toContainText('Practice privately');await capture(page,'08-shared-review');
 await publish(page,'Creative imagery acceptance');state=await status(request);expect(state.activeReleaseId).not.toBe(before.activeReleaseId);
 const publicResult=await(await request.get(origin+'/api/game-content')).json(), visuals=publicResult.content.websitePresentation.pages.play.visuals;
 expect(visuals.tiles['basic-ai'].icon).toBe('learn');expect(visuals.tiles['basic-ai'].artwork).toContain(menuImage.id);expect(visuals.background).toBe(visuals.tiles['basic-ai'].artwork);
 const player=await page.context().newPage();await player.goto('/');await expect(player.locator('[data-action-id="basic-ai"] .cd-action-art img')).toHaveAttribute('src',visuals.tiles['basic-ai'].artwork);await player.screenshot({path:path.join(output,'09-published-player.png')});await player.close();
 const baseline=before.releases.find(row=>row.id===before.activeReleaseId);await page.getByRole('button',{name:'Restore '+baseline.label,exact:true}).click();await page.getByRole('button',{name:'Confirm rollback',exact:true}).click();await expect(page.getByText('Previous release restored for future games.',{exact:true})).toBeVisible();expect((await status(request)).activeReleaseId).toBe(before.activeReleaseId);await capture(page,'09-rolled-back');
 fs.writeFileSync(path.join(output,'imagery-publication.json'),JSON.stringify({cardVersion:cardImage.id,menuVersion:menuImage.id,published:state.activeReleaseId,restored:before.activeReleaseId,visuals},null,2));
});

test('card catalog and phone navigation keep local work while the operator chooses the next step',async({page,request,restoreRelease})=>{
 restoreRelease(headers(),await status(request),origin);await page.goto('/admin/gauntlet?workshop=cards');await expect(page.locator('.catalog-open')).toBeVisible();await capture(page,'02-card-catalog');
 await page.getByLabel('Filter cards by faction').selectOption('rumin');await page.locator('button[data-object="rumin-coin-scale-spear"]').click();await page.getByLabel('Draft name',{exact:true}).fill('Retained local card');
 await page.getByRole('button',{name:'Back to list',exact:true}).click();await page.getByRole('button',{name:'Return to editor',exact:true}).click();await expect(page.getByLabel('Draft name',{exact:true})).toHaveValue('Retained local card');
 await page.setViewportSize({width:390,height:844});await area(page,'Website');const dialog=page.getByRole('dialog',{name:'Unsaved local changes'});await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(page.getByLabel('Draft name',{exact:true})).toHaveValue('Retained local card');await capture(page,'10-phone-unsaved');
 expect((await new AxeBuilder({page}).include('.gauntlet-admin').analyze()).violations).toEqual([]);await save(page);await workspaceSection(page,'Card Workshop','Test');await expect(page.getByLabel('Your next step')).toContainText('Test your saved changes');await capture(page,'10-phone-test-guidance');
});


test('campaign chapters retain their links across story, rules, cards, media, reordering and an actual engine test',async({page,request,restoreRelease})=>{
 restoreRelease(headers(),await status(request),origin);await page.goto('/admin/gauntlet?workshop=campaigns&object=rumin');
 await page.getByRole('button',{name:'Add chapter encounter',exact:true}).click();await page.getByLabel('New content name',{exact:true}).fill('The Emberwatch gate');await page.getByRole('button',{name:'Save new encounter to draft',exact:true}).click();
 await page.getByLabel('Draft story',{exact:true}).fill('At the gate, a sentinel tests the commander’s resolve.');await page.getByLabel('Draft opening dialogue',{exact:true}).fill('Sentinel: Show me what you have learned.');
 await workspaceSection(page,'Encounter Workshop','Opponent');await page.getByLabel('Boss Life',{exact:true}).fill('28');await page.getByLabel('Draft opponent ai profile',{exact:true}).selectOption('support-first');
 await workspaceSection(page,'Encounter Workshop','Rules');await page.getByLabel('Attacks Per Turn',{exact:true}).fill('1');
 await workspaceSection(page,'Encounter Workshop','Cards');await page.getByRole('region',{name:'Encounter card additions controls'}).getByRole('button',{name:'Add card',exact:true}).first().click();
 await save(page);await workspaceSection(page,'Encounter Workshop','Media');await page.getByRole('button',{name:'Browse images',exact:true}).click();const image=await upload(page,'Emberwatch encounter');await save(page);
 let state=await status(request);const encounter=state.draft.snapshot.domains.encounters.find(row=>row.title==='The Emberwatch gate');expect(encounter.setup.bossLife).toBe(28);expect(encounter.setup.attacksPerTurn).toBe(1);expect(encounter.setup.playerAdditions.length).toBeGreaterThan(0);expect(encounter.image).toBe(image.id);expect(encounter.dialogue).toContain('Sentinel: Show me what you have learned.');
 await capture(page,'05-encounter-media');await page.goto('/admin/gauntlet?workshop=campaigns&object=rumin');await page.getByRole('button',{name:'Duplicate The Emberwatch gate',exact:true}).click();await page.getByLabel('New content name',{exact:true}).fill('The return to Emberwatch');await page.getByRole('button',{name:'Save new encounter to draft',exact:true}).click();
 await expect(page.getByLabel('Draft title',{exact:true})).toHaveValue('The return to Emberwatch');state=await status(request);const duplicate=state.draft.snapshot.domains.encounters.find(row=>row.title==='The return to Emberwatch');expect(duplicate.opponentId).not.toBe(encounter.opponentId);expect(duplicate.image).toBe(image.id);
 await page.goto('/admin/gauntlet?workshop=campaigns&object=rumin');const reordered=waitForBufferedAdminResponse(page,response=>response.url().endsWith('/reorder-encounters'));await page.getByRole('button',{name:'Move The return to Emberwatch earlier',exact:true}).click();expect((await reordered).ok()).toBeTruthy();await capture(page,'05-campaign-journey');
 await page.goto('/admin/gauntlet?workshop=encounters&object='+encounter.id+'&section=test');const harness=page.getByRole('region',{name:'Real engine playtest',exact:true});await expect(harness).toBeVisible({timeout:60000});await harness.getByRole('combobox',{name:'Test content',exact:true}).selectOption('draft');
 let pending=waitForBufferedAdminResponse(page,response=>response.url().endsWith('/authoring/playtest'));await harness.getByRole('button',{name:/Start .*playtest/}).click();const session=(await(await pending).json()).playtest;expect(session.game.players[2].life).toBe(28);expect(session.context.encounterId).toBe(encounter.id);
 const action=session.legalActions.find(row=>row.type==='passPriority');expect(action).toBeTruthy();await harness.getByRole('combobox',{name:'Action',exact:true}).selectOption(action.id);pending=waitForBufferedAdminResponse(page,response=>response.url().endsWith('/playtest/command'));await harness.getByRole('button',{name:'Execute selected action',exact:true}).click();expect((await(await pending).json()).playtest.acceptedCommands).toBeGreaterThan(0);await capture(page,'05-encounter-tested');
 state=await status(request);expect(state.draft.playtestedHash).toBe(state.draft.hash);fs.writeFileSync(path.join(output,'campaign-test.json'),JSON.stringify({encounter,duplicate,hash:state.draft.hash,tested:state.draft.playtestedHash,gameLife:session.game.players[2].life},null,2));
});

test('supported format settings reach the real engine and publish for future games',async({page,request,restoreRelease})=>{
 restoreRelease(headers(),await status(request),origin);await page.goto('/admin/gauntlet?workshop=game&object=ranked');await page.getByRole('button',{name:'Configure shared rules',exact:true}).click();
 await page.getByLabel('Draft hand size',{exact:true}).fill('5');await save(page);await capture(page,'06-format-settings');await page.goto('/admin/gauntlet?workshop=game&object=shared-rules&section=test');
 const harness=page.getByRole('region',{name:'Real engine playtest',exact:true});await expect(harness).toBeVisible({timeout:60000});await harness.getByRole('combobox',{name:'Test content',exact:true}).selectOption('draft');let pending=waitForBufferedAdminResponse(page,response=>response.url().endsWith('/authoring/playtest'));await harness.getByRole('button',{name:'Start draft duel playtest',exact:true}).click();const session=(await(await pending).json()).playtest;
 expect(session.game.players[1].hand).toHaveLength(5);expect(session.game.config.handSize).toBe(5);
 const action=session.legalActions.find(row=>row.type==='passPriority');await harness.getByRole('combobox',{name:'Action',exact:true}).selectOption(action.id);pending=waitForBufferedAdminResponse(page,response=>response.url().endsWith('/playtest/command'));await harness.getByRole('button',{name:'Execute selected action',exact:true}).click();expect((await pending).ok()).toBeTruthy();await capture(page,'06-format-engine');
 await publish(page,'Five-card opening acceptance');const published=await(await request.get(origin+'/api/game-content')).json();expect(published.content.gameConfig.handSize).toBe(5);fs.writeFileSync(path.join(output,'format-test.json'),JSON.stringify({session:session.id,handSize:session.game.config.handSize,initialHand:session.game.players[1].hand.length,release:published.contentVersion},null,2));
});


test('an event keeps its format, entry terms, schedule and rewards together through eligibility testing',async({page,request,restoreRelease})=>{
 const {paraTab,saveDefinition}=require('./admin-navigation');restoreRelease(headers(),await status(request),origin);
 await page.goto('/admin/gauntlet');await area(page,'Events & Commerce');await paraTab(page,'Seasons');await page.getByRole('button',{name:'New season',exact:true}).click();
 await page.getByLabel('Name',{exact:true}).fill('Emberwatch season');await page.getByLabel('faction-constructed',{exact:true}).check();await page.getByLabel('Public rules version',{exact:true}).fill('emberwatch-v1');await page.getByLabel('Invitational Prestige threshold',{exact:true}).fill('75');await page.getByLabel('Gold cap per eligible account',{exact:true}).fill('4000');await saveDefinition(page);
 const season=(await status(request)).draft.snapshot.paraLeague.seasons.find(row=>row.name==='Emberwatch season');expect(season.invitationalThreshold).toBe(75);
 await paraTab(page,'Events');await page.getByRole('button',{name:'New event',exact:true}).click();await page.getByLabel('Name',{exact:true}).fill('Emberwatch open');await page.getByLabel('Season',{exact:true}).selectOption(season.id);await page.getByLabel('Planned format',{exact:true}).selectOption('faction-constructed');await page.getByLabel('Official attempts',{exact:true}).fill('2');
 await page.getByLabel('Start',{exact:true}).fill('2027-01-15T12:00');await page.getByLabel('End',{exact:true}).fill('2027-01-17T12:00');await page.getByLabel('Registration opens',{exact:true}).fill('2027-01-14T12:00');await page.getByLabel('Registration closes',{exact:true}).fill('2027-01-16T12:00');await page.getByLabel('Prestige for 7 wins',{exact:true}).fill('35');await saveDefinition(page,true);
 const state=await status(request),event=state.draft.snapshot.paraLeague.events.find(row=>row.name==='Emberwatch open');expect(event.format).toBe('faction-constructed');expect(event.scoringAttempts).toBe(2);expect(event.prestige[7]).toBe(35);expect(event.startsAt).toContain('2027-01-15');expect(state.live.paraLeague?.events?.some(row=>row.id===event.id)).not.toBeTruthy();
 await expect(page.getByRole('complementary',{name:'Competition overview'})).toContainText('Saved draft definition');await expect(page.getByRole('button',{name:'Operate this event',exact:true})).toBeDisabled();await page.getByRole('complementary',{name:'Competition overview'}).scrollIntoViewIfNeeded();await capture(page,'07-event-overview');
 const simulator=page.getByRole('region',{name:'Para eligibility simulator'});await expect(simulator.getByRole('combobox',{name:'Target event',exact:true})).toHaveValue(event.id);let pending=waitForBufferedAdminResponse(page,response=>response.url().endsWith('/para-simulate'));await simulator.getByRole('button',{name:'Simulate saved rules',exact:true}).click();expect((await pending).ok()).toBeTruthy();await expect(simulator.getByRole('status')).toContainText('Requirement: met');await capture(page,'07-event-tested');
 await page.getByRole('button',{name:'Review publication',exact:true}).click();await expect(page.getByRole('region',{name:'Shared release review'})).toContainText('Emberwatch open');fs.writeFileSync(path.join(output,'event-test.json'),JSON.stringify({season,event,live:false},null,2));
});

// Run last in this disposable provider: publishing a new identity deliberately
// prevents rollback to a release that would erase it. The service is discarded
// when this suite finishes; ordinary release rollback is verified above.
test('create a card with a set, mechanic and artwork, reload it, test it and publish it',async({page,request})=>{
await page.goto('/admin/gauntlet');await page.getByRole('button',{name:'Card',exact:true}).click();
 await page.getByLabel('New content name',{exact:true}).fill('Emberwatch blade');await page.getByLabel('New set name',{exact:true}).fill('Emberwatch collection');
 await page.getByRole('button',{name:'Save set and use it',exact:true}).click();await expect(page.getByLabel('Set',{exact:true})).not.toHaveValue('');
 await page.getByLabel('Mechanical effect',{exact:true}).selectOption('coin-scale-spear');await capture(page,'02-new-card');
 await page.getByRole('button',{name:'Save new card to draft',exact:true}).click();await expect(page.getByLabel('Draft name',{exact:true})).toHaveValue('Emberwatch blade');
 await workspaceSection(page,'Card Workshop','Artwork');await page.getByRole('button',{name:'Browse images',exact:true}).click();const image=await upload(page,'Emberwatch artwork');await save(page);
 const state=await status(request),card=state.draft.snapshot.domains.cards.find(row=>row.name==='Emberwatch blade');
 expect(state.draft.snapshot.domains.sets.find(row=>row.name==='Emberwatch collection').members).toContain(card.id);expect(card.effect.id).toBe('coin-scale-spear');expect(state.draft.snapshot.domains.assets.find(row=>row.id===card.defaultVariantId).art).toBe(image.id);
 await page.reload();await expect(page.locator('.admin-field-artwork')).toBeVisible();await page.locator('[aria-label="Workspace view"]').getByRole('button',{name:'Preview',exact:true}).click();await expect(page.locator('.design-preview .admin-card-preview')).toBeVisible();await page.setViewportSize({width:1440,height:1000});await page.locator('#workshop-context').scrollIntoViewIfNeeded();await capture(page,'02-new-card-saved');
 await workspaceSection(page,'Card Workshop','Test');const harness=page.getByRole('region',{name:'Real engine playtest',exact:true});await harness.getByRole('combobox',{name:'Test content',exact:true}).selectOption('draft');
 let pending=waitForBufferedAdminResponse(page,response=>response.url().endsWith('/authoring/playtest'));await harness.getByRole('button',{name:'Start draft duel playtest',exact:true}).click();const session=(await(await pending).json()).playtest;
 expect(session.subject.id).toBe(card.id);expect(session.game.players[1].hand.some(row=>(row.gameplayCardId||row.definitionId)===card.id)).toBe(true);
 const action=session.legalActions.find(row=>row.type==='passPriority');await harness.getByRole('combobox',{name:'Action',exact:true}).selectOption(action.id);pending=waitForBufferedAdminResponse(page,response=>response.url().endsWith('/playtest/command'));await harness.getByRole('button',{name:'Execute selected action',exact:true}).click();expect((await pending).ok()).toBeTruthy();await expect(harness.getByText('Accepted by the engine',{exact:true})).toBeVisible();await page.locator('#workshop-context').scrollIntoViewIfNeeded();await capture(page,'02-new-card-tested');
 const tested=await status(request);expect(tested.draft.playtestedHash).toBe(tested.draft.hash);await publish(page,'Emberwatch card acceptance','02-new-card-release');
 const released=await(await request.get(origin+'/api/game-content')).json();expect(released.content.cards.find(row=>row.id===card.id).name).toBe('Emberwatch blade');expect(released.content.collectorVariants.find(row=>row.variantId===card.defaultVariantId).presentation.illustration).toContain(image.id);
 fs.writeFileSync(path.join(output,'created-card.json'),JSON.stringify({id:card.id,effect:card.effect,set:state.draft.snapshot.domains.sets.find(row=>row.members.includes(card.id)),artwork:image.id,testedHash:tested.draft.hash,release:released.contentVersion},null,2));
});
