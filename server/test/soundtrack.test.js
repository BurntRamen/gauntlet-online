const test = require("node:test");
const assert = require("node:assert/strict");
const catalog = require("../../shared/duel-rules/soundtrack.json");
const {proseFields, projectPresentation} = require("../websiteProse");
const {assetEntry} = require("../contentAssets");
const {resolveDelivery} = require("../digitalDelivery");
test("each shipped recording is downloadable and available to soundtrack entitlements", () => {
  for (const track of catalog.filter(row => row.source)) {
    const entry = assetEntry(track.source);
    assert.equal(resolveDelivery({category:"faction-soundtrack",asset:entry.id}).sha256,track.sha256);
  }
});
test("an edited slot projects its chosen title and exact recording", () => {
  const [a,b] = catalog;
  const owner = {id:"practice",[a.key+"Title"]:"Tournament Night",[a.key+"Audio"]:assetEntry(b.source).id};
  const fields = proseFields(owner.id);
  assert.equal(fields[a.key+"Audio"].media,"audio");
  const render = game => projectPresentation({game, factions:[], campaigns:[]}).soundtrack;
  assert.deepEqual(render([]),{});
  assert.deepEqual(render([owner]),{[a.key]:{title:"Tournament Night",source:b.source}});
});

test("an uploaded recording stays private through preview and can be distributed after publication", async () => {
  const {createContentPublication}=require("../contentPublication");
  const {createAuthoredBaseline}=require("../authoredContent");
  const fixture=require("./fixtures/content-v2/authored-baseline-v1.json");
  const baseline=createAuthoredBaseline({domains:{decks:fixture.domains.decks},game:{modes:fixture.domains.game}});
  const store=createContentPublication({baseline,memory:true});
  const original=store.status().activeReleaseId;
  const wav=require("../contentAssets").assetManifest.entries.find(row=>row.mediaType==="audio/wav");
  const bytes=require("node:fs").readFileSync(require("node:path").join(__dirname,"../../client/public",wav.path));
  const uploaded=(await store.uploadAsset({title:"Club night",description:"",notes:"",data:bytes.toString("base64"),expectedRevision:0},"admin")).uploaded;
  const edit=store.patchRecord({expectedRevision:store.status().revision,domain:"game",id:"practice",changes:[
    {field:"music_menu_1Title",value:"Club night"},{field:"music_menu_1Audio",value:uploaded.id}]}, "admin");
  const preview=store.preview({expectedRevision:edit.revision}).preview.manifest.websitePresentation.soundtrack.music_menu_1;
  assert.match(preview.source,/^\/api\/admin\//);
  assert.throws(()=>store.publicAsset(uploaded.id,uploaded.sha256));
  await store.publish({expectedRevision:store.status().revision,label:"Club night music"},"admin");
  const publicTrack=store.active().manifest.websitePresentation.soundtrack.music_menu_1;
  assert.equal(publicTrack.title,"Club night");
  assert.equal(store.status().assetLibrary.find(row=>row.id===uploaded.id).publicUrl,publicTrack.source);
  assert.equal(store.publicAsset(uploaded.id,uploaded.sha256).mediaType,"audio/wav");
  await store.rollback({expectedRevision:store.status().revision,releaseId:original},"admin");
  assert.deepEqual(store.active().manifest.websitePresentation.soundtrack,{});
});
