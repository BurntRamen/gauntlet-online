const {test,expect}=require('./admin-release-test');
const {workspaceSection,saveRecord,previewSavedDraft}=require('./admin-navigation');
const fs=require('node:fs'),path=require('node:path');
const AxeBuilder=require('@axe-core/playwright').default;
const output=path.resolve(__dirname,'../docs/reviews/admin-guidance');
const origin=`http://127.0.0.1:${process.env.GAUNTLET_ADMIN_FIXTURE_PORT||'4188'}`;
const token=()=>JSON.parse(fs.readFileSync(path.join(process.env.GAUNTLET_CORRECTION_ROOT,'sessions.json'))).simply;
const headers=()=>({Authorization:'Bearer '+token()});
async function state(request){const response=await request.get(origin+'/api/admin/authoring',{headers:headers(),maxRetries:2});expect(response.ok()).toBeTruthy();return response.json();}
async function clean(request){const s=await state(request);if(s.draft)expect((await request.post(origin+'/api/admin/authoring/discard',{headers:headers(),data:{expectedRevision:s.revision}})).ok()).toBeTruthy();}
async function capture(page,name){fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,name+'.png')});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();expect((await new AxeBuilder({page}).include('.gauntlet-admin').analyze()).violations).toEqual([]);}
test.beforeEach(async({context,request,baseURL})=>{
 await clean(request);await context.route(url=>['http:','https:'].includes(url.protocol)&&![origin,new URL(baseURL).origin].includes(url.origin),r=>r.abort());
 await context.addInitScript(t=>localStorage.setItem('gauntlet_auth_token',t),token());
});
test.afterEach(async({request})=>clean(request));

test('visual guidance follows editing, saving, sections and the next release action',async({page,request})=>{
 await page.goto('/admin/gauntlet?workshop=cards&object=rumin-coin-scale-spear');
 const cue=page.getByLabel('Your next step',{exact:true});await expect(cue).toContainText('Make it yours');
 await page.getByLabel('Draft name',{exact:true}).fill('Guided card');
 await expect(cue).toHaveCount(0);await expect(page.locator('.admin-record-save')).toContainText('Next: save your changes');await capture(page,'card-save');
 await saveRecord(page);await expect(cue).toContainText('Shared draft available');
 await cue.getByRole('button',{name:'Continue to Artwork',exact:true}).click();
 await expect(page.getByLabel('Card Workshop section',{exact:true})).toHaveValue('artwork');
 await expect(page.getByRole('navigation',{name:'Card Workshop sections',includeHidden:true}).getByRole('button',{name:'Artwork',exact:true,includeHidden:true})).toHaveAttribute('aria-current','step');
 await page.locator('.design-header').scrollIntoViewIfNeeded();await capture(page,'card-next');
 await workspaceSection(page,'Card Workshop','Related content');
 if(await cue.getByRole('button',{name:'Check the preview',exact:true}).isVisible())await cue.getByRole('button',{name:'Check the preview',exact:true}).click();
 await cue.getByRole('button',{name:'Review saved changes',exact:true}).click();
 await expect(page.getByRole('button',{name:'Preview saved draft',exact:true})).toHaveClass(/admin-primary/);
 await expect(page.getByLabel('Release readiness')).toContainText('Preview this saved revision');await capture(page,'release-next');
 await previewSavedDraft(page);await expect(page.getByLabel('Release name',{exact:true})).toHaveAttribute('data-next','true');
 await page.getByLabel('Release name',{exact:true}).fill('Guided release');await expect(page.getByRole('button',{name:'Publish release',exact:true})).toBeEnabled();
 expect((await state(request)).live.domains.cards.find(c=>c.id==='rumin-coin-scale-spear').name).not.toBe('Guided card');
});

test('website sections give visual editing cues and keep the selected section outlined',async({page})=>{
 await page.goto('/admin/gauntlet?area=Website&workshop=modes&object=practice&section=play');
 await expect(page.locator('.website-render h1')).toBeVisible();
 const module=page.locator('.website-render [data-layout-module="basic-ai"]');await module.hover();
 expect(await module.evaluate(e=>getComputedStyle(e).outlineStyle)).toBe('solid');await module.click();
 await expect(page.getByLabel('Edit element',{exact:true})).toHaveValue('basic-ai');await expect(page.getByLabel('Edit element',{exact:true})).toBeFocused();
 await expect(module).toHaveAttribute('data-studio-selected','');await page.locator('.design-header').scrollIntoViewIfNeeded();await capture(page,'website-selection');
 await page.getByLabel('Edit element',{exact:true}).selectOption('navigation');
 await expect(page.locator('.website-render .cd-rail nav')).toHaveAttribute('data-studio-selected','');
});

test('phone guidance finds the real form save and preview without submitting on behalf of the operator',async({page,request})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/admin/gauntlet');await page.getByRole('button',{name:'Mechanic',exact:true}).click();
 await page.getByLabel('Mechanic name',{exact:true}).fill('Guided mechanic');const before=await state(request);
 const cue=page.getByLabel('Your next step',{exact:true});await expect(cue).toContainText('Save your changes');
 await cue.getByRole('button',{name:'Go to save controls',exact:true}).click();
 await expect(page.getByRole('button',{name:'Save mechanic to draft',exact:true})).toBeFocused();expect((await state(request)).revision).toBe(before.revision);
 await page.getByRole('button',{name:'Save mechanic to draft',exact:true}).click();await expect(cue).toContainText('Shared draft available');
 await cue.getByRole('button',{name:'Check the preview',exact:true}).click();await expect(page.locator('.design-preview')).toBeFocused();
 await capture(page,'phone-preview');await page.locator('.design-header').scrollIntoViewIfNeeded();await capture(page,'phone-next');
});

test('guided views retain native browser 200 percent zoom and keyboard access',async()=>{
 const {execFile}=require('node:child_process');await new Promise((resolve,reject)=>execFile(process.execPath,[path.resolve(__dirname,'admin-native-zoom.cjs')],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,GAUNTLET_NATIVE_MATRIX:'true',GAUNTLET_NATIVE_EVIDENCE_DIR:path.join(output,'native-zoom')}},(error,stdout,stderr)=>{fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.resolve(__dirname,'../artifacts/admin-guidance-zoom.log'),stdout+stderr);error?reject(error):resolve();}));
});
