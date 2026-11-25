const test = require("node:test");
const assert = require("node:assert/strict");
const { createAuthoredBaseline, validateAuthoredContent, hash } = require("../authoredContent");
const { createContentPublication } = require("../contentPublication");
const { releaseReview } = require("../adminReleaseReview");
const { proseFields } = require("../websiteProse");
const presentation = require('../../shared/websitePresentation');
const fixture = require("./fixtures/content-v2/authored-baseline-v1.json");
const baseline = createAuthoredBaseline({ domains: { decks: fixture.domains.decks }, game: { modes: fixture.domains.game } });

test('menu artwork, approved icons and backgrounds reach the real projection with retained asset dependencies',()=>{
  const store=createContentPublication({baseline,memory:true}), original=store.status().activeReleaseId;
  const asset=require('../contentAssets').assetManifest.entries.find(row=>row.mediaType==='image/webp');
  const changes=[{field:'playPageTile-basic-ai-Image',value:asset.id},{field:'playPageTile-basic-ai-Icon',value:'learn'},{field:'playPageBackground',value:asset.id}];
  const saved=store.patchRecord({expectedRevision:0,domain:'game',id:'practice',changes},'admin');
  assert.equal(store.active().manifest.websitePresentation.pages.play.visuals,undefined);
  assert.equal(releaseReview(saved).readiness.engineTestRequired,false);
  assert.ok(require('../adminContentRelationships').contentRelationships(saved.draft.snapshot).edges.some(edge=>edge.from==='game:practice'&&edge.to===`asset-library:${asset.id}`));
  const preview=store.preview({expectedRevision:saved.revision}).preview.manifest.websitePresentation.pages.play.visuals;
  assert.deepEqual(preview,{background:asset.path,tiles:{'basic-ai':{artwork:asset.path,icon:'learn'}}});
  store.publish({expectedRevision:store.status().revision,label:'Reviewed menu imagery'},'admin');
  assert.deepEqual(store.active().manifest.websitePresentation.pages.play.visuals,preview);
  store.rollback({expectedRevision:store.status().revision,releaseId:original},'admin');
  assert.equal(store.active().manifest.websitePresentation.pages.play.visuals,undefined);
  for(const [field,value] of [['playPageTile-basic-ai-Image','https://outside.invalid/image'],['playPageTile-basic-ai-Icon','<svg/>'],['playPageBackground','unknown-version']]) {
    const before=store.status();assert.throws(()=>store.patchRecord({expectedRevision:before.revision,domain:'game',id:'practice',changes:[{field,value}]},'admin'));
    assert.equal(store.status().revision,before.revision);assert.equal(store.status().draft,null);
  }
});

test('registered navigation and page composition publish together, invalidate previews and roll back exactly',()=>{
  const store=createContentPublication({baseline,memory:true}), before=store.status();
  assert.equal(store.active().manifest.websitePresentation.navigation,undefined,"Unedited releases retain registered mobile shortcuts and compact labels");
  const layout=presentation.defaultLayout('play'); layout.typography='editorial'; layout.arrangement='list'; layout.sections.reverse(); layout.sections.find(x=>x.id==='basic-ai').visible=false;
  const nav=presentation.defaultNavigation(); nav.items[0].label='Start playing'; [nav.items[0],nav.items[1]]=[nav.items[1],nav.items[0]];
  const save=changes=>store.patchRecord({expectedRevision:store.status().revision,domain:'game',id:'practice',changes},'admin');
  save([{field:'playPageLayout',value:layout},{field:'websiteNavigation',value:nav}]);
  assert.equal(store.status().validation.valid,true);
  assert.equal(releaseReview(store.status()).readiness.engineTestRequired,false);
  const preview=store.preview({expectedRevision:store.status().revision}).preview.manifest.websitePresentation;
  assert.deepEqual(preview.pages.play,layout); assert.deepEqual(preview.navigation,nav);
  assert.notDeepEqual(store.active().manifest.websitePresentation,preview);
  save([{field:'playPageTitle',value:'Reviewed page'}]);
  assert.throws(()=>store.publish({expectedRevision:store.status().revision,label:'Stale'},'admin'),/preview/i);
  store.preview({expectedRevision:store.status().revision});
  store.publish({expectedRevision:store.status().revision,label:'Page composition'},'admin');
  assert.deepEqual(store.active().manifest.websitePresentation,preview);
  store.rollback({expectedRevision:store.status().revision,releaseId:before.activeReleaseId},'admin');
  assert.deepEqual(store.status().live,before.live); assert.equal(hash(store.status().live),hash(baseline));
});

test('presentation rejects arbitrary routes, styles, duplicate sections and hidden entire pages atomically',()=>{
  const store=createContentPublication({baseline,memory:true});
  const valid=presentation.defaultLayout('play');
  for(const value of [null,{...valid,version:2},{...valid,typography:'script'},{...valid,css:'body{}'},{...valid,sections:[{id:'account',visible:false}]},{...valid,sections:[valid.sections[0],valid.sections[0]]},{...valid,sections:valid.sections.map(x=>({...x,visible:false}))}]) {
    const before=store.status();
    assert.throws(()=>store.patchRecord({expectedRevision:before.revision,domain:'game',id:'practice',changes:[{field:'playPageTitle',value:'Must not persist'},{field:'playPageLayout',value}]},'admin'),/presentation|registered|section|style|visible/i);
    assert.equal(store.status().revision,before.revision); assert.equal(store.status().draft,null);
  }
  const nav=presentation.defaultNavigation(); nav.items[0].route='https://untrusted.invalid';
  assert.throws(()=>store.patchRecord({expectedRevision:0,domain:'game',id:'practice',changes:[{field:'websiteNavigation',value:nav}]},'admin'),/registered/);
});

test('older page overrides retain newly registered sections without modifying source snapshots',()=>{
  const config={...presentation.defaultLayout('campaign'),sections:[{id:'tutorial',visible:false}]};
  const result=presentation.layoutFor('campaign',config,['rumin','custom-faction']);
  assert.equal(result.sections.find(x=>x.id==='faction-custom-faction').visible,true);
  assert.equal(config.sections.length,1);
});

test("every registered website surface has an authored owner, preview, exact release and rollback", () => {
  const store = createContentPublication({ baseline, memory: true }), original = store.status().activeReleaseId;
  for (const surface of require("../websiteProse").surfaces) {
    for (const part of ["Title", "Description"]) store.patch({ expectedRevision: store.status().revision, domain: "game", id: surface.owner, field: `${surface.id}Page${part}`, value: `Reviewed ${surface.name} ${part}` }, "admin");
  }
  const review = releaseReview(store.status()); assert.equal(review.readiness.engineTestRequired, false);
  const preview = store.preview({ expectedRevision: store.status().revision }).preview;
  for (const surface of require("../websiteProse").surfaces) {
    assert.equal(preview.manifest.websiteProse[surface.id].title, `Reviewed ${surface.name} Title`);
    assert.equal(store.active().manifest.websiteProse[surface.id].title, surface.title);
  }
  store.publish({ expectedRevision: store.status().revision, label: "Landing copy" }, "admin");
  assert.deepEqual(store.active().manifest.websiteProse, preview.manifest.websiteProse);
  store.rollback({ expectedRevision: store.status().revision, releaseId: original }, "admin");
  assert.equal(store.active().manifest.websiteProse.play.title, "Ready to play?");
});

test("page prose location notes point editors to the current player destinations", () => {
  for (const [mode, location] of Object.entries({ practice: "Learn & Rules → Practice", freeForAll: "Play → Join a Table", ranked: "Compete → Ranked", draft: "Draft", campaign: "Campaign" })) {
    for (const field of ["heroTitle", "heroDescription"]) {
      assert.ok(proseFields(mode)[field].note.startsWith(`Shown in ${location}.`));
    }
  }
});

test("optional page prose preserves older snapshots and flows through preview, exact-hash publishing and rollback", () => {
  const store = createContentPublication({ baseline, memory: true });
  const before = store.status(), id = before.activeReleaseId;
  assert.equal(baseline.domains.game.find(row => row.id === "practice").heroTitle, undefined);
  assert.equal(hash(store.status().live), hash(baseline));
  const patch = (field, value, revert = false) => store.patch({ expectedRevision: store.status().revision, domain: "game", id: "practice", field, value, revert }, "admin");
  const next = patch("heroTitle", "A new heading");
  assert.equal(next.validation.valid, true);
  assert.equal(next.changes[0].live, "Master your next move.");
  assert.equal(releaseReview(next).groups[0].changes[0].before, "Master your next move.");
  assert.equal(releaseReview(next).readiness.engineTestRequired, false);
  assert.equal(store.active().manifest.modeMetadata.practice.heroTitle, "Master your next move.");
  assert.equal(store.preview({ expectedRevision: next.revision }).preview.manifest.modeMetadata.practice.heroTitle, "A new heading");
  patch("heroTitle", "Changed after preview");
  assert.throws(() => store.publish({ expectedRevision: store.status().revision, label: "Stale preview" }, "admin"), /preview/i);
  store.preview({ expectedRevision: store.status().revision });
  store.publish({ expectedRevision: store.status().revision, label: "Page copy" }, "admin");
  assert.equal(store.active().manifest.modeMetadata.practice.heroTitle, "Changed after preview");
  store.rollback({ expectedRevision: store.status().revision, releaseId: id }, "admin");
  assert.equal(store.status().activeReleaseId, id);
  patch("heroTitle", "Another draft");
  const reverted = patch("heroTitle", undefined, true);
  assert.equal(reverted.changes.length, 0);
  assert.equal(hash(reverted.draft.snapshot), hash(baseline));
});

test("new prose is bounded plain text with explicit owners; arbitrary fields and mechanics remain protected", () => {
  const store = createContentPublication({ baseline, memory: true });
  for (const value of [null, {}, "", "x".repeat(161), "bad\u0000text"]) {
    const state = store.patch({ expectedRevision: store.status().revision, domain: "game", id: "practice", field: "heroTitle", value }, "admin");
    assert.equal(state.validation.valid, false);
    assert.deepEqual(state.changes[0].draft, value);
    assert.deepEqual(releaseReview(state).groups[0].changes[0].after, value);
  }
  assert.throws(() => store.patch({ expectedRevision: store.status().revision, domain: "game", id: "shared-rules", field: "heroTitle", value: "No" }), /engine-controlled/);
  assert.throws(() => store.patch({ expectedRevision: store.status().revision, domain: "game", id: "practice", field: "html", value: "No" }), /engine-controlled/);
  assert.equal(validateAuthoredContent(baseline, baseline).valid, true);
});

test("website artwork uses validated immutable references, real player projection, dependency evidence and rollback", () => {
  const store = createContentPublication({ baseline, memory: true }), original = store.status().activeReleaseId;
  const asset = require("../contentAssets").assetManifest.entries.find(row => row.mediaType === "image/webp");
  const saved = store.patch({ expectedRevision: 0, domain: "game", id: "practice", field: "playPageImage", value: asset.id }, "admin");
  assert.equal(saved.validation.valid, true);
  assert.equal(store.active().manifest.websiteProse.play.image, undefined);
  assert.equal(releaseReview(saved).readiness.engineTestRequired, false);
  const graph = require("../adminContentRelationships").contentRelationships(saved.draft.snapshot);
  assert.ok(graph.edges.some(edge => edge.from === "game:practice" && edge.to === `asset-library:${asset.id}` && edge.kind === "uses-asset"));
  const preview = store.preview({ expectedRevision: saved.revision }).preview;
  assert.equal(preview.manifest.websiteProse.play.image, asset.path);
  store.publish({ expectedRevision: store.status().revision, label: "Website image fixture" }, "admin");
  assert.equal(store.active().manifest.websiteProse.play.image, asset.path);
  store.rollback({ expectedRevision: store.status().revision, releaseId: original }, "admin");
  assert.equal(store.active().manifest.websiteProse.play.image, undefined);
  for (const value of ["https://untrusted.invalid/art.png", "javascript:alert(1)", "missing-version"]) {
    const invalid = store.patch({ expectedRevision: store.status().revision, domain: "game", id: "practice", field: "playPageImage", value }, "admin");
    assert.equal(invalid.validation.valid, false);
    assert.throws(() => store.preview({ expectedRevision: invalid.revision }), /validation|invalid|correct/i);
  }
});

test("website release validates theme templates, box dimensions and menu membership",()=>{
 const store=createContentPublication({baseline,memory:true});
 const layout={...presentation.defaultLayout("play"),version:2,style:{theme:"forest",tileWidth:360,gap:18,rounding:6},templates:[]};
 layout.sections[0].width="full";
 layout.templates.push({name:"League night",style:{...layout.style},arrangement:"tiles",typography:"editorial"});
 const menu={...presentation.defaultNavigation(),theme:"midnight"};menu.items[1].visible=false;menu.items[2].placement="primary";
 const saved=store.patchRecord({domain:"game",id:"practice",expectedRevision:0,changes:[
   {field:"playPageLayout",value:layout},{field:"websiteNavigation",value:menu}]},"admin");
 const result=store.preview({expectedRevision:saved.revision}).preview.manifest.websitePresentation;
 assert.deepEqual(result.pages.play.templates,layout.templates);
 assert.equal(result.pages.play.sections[0].width,"full");
 assert.deepEqual(result.navigation,menu);
 assert.ok(presentation.errors({...layout,style:{...layout.style,tileWidth:900}},"website-layout","play").length);
 assert.ok(presentation.errors({...layout,templates:[...layout.templates,...layout.templates]},"website-layout","play").length);
});
