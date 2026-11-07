const test=require("node:test"), assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {PGlite}=require("@electric-sql/pglite");
const {createGoldEconomy}=require("../goldEconomy"),{createParaRuntime}=require("../paraRuntime");
const {createRemoteOperationalStore}=require("../remoteOperationalStore"),{createDurableRoomBoundary}=require("../durableRoomBoundary"),{durableHttpMiddleware}=require("../durableHttpBoundary");
const para=require("../paraLeague"),{ANALYSIS}=require("../digitalDelivery"),{hash}=require("../authoredContent");
const account={id:"test-account",createdAt:"2026-01-01T00:00:00.000Z"},key=()=>crypto.randomUUID();
function config() {
  const c=para.seedSeasonZero(),window={startsAt:"2026-01-01T00:00:00.000Z",endsAt:"2027-01-01T00:00:00.000Z"};
  Object.assign(c.seasons[0],window,{status:"active",goldBudget:1000});
  c.events.forEach(e=>Object.assign(e,window,{status:"scheduled",registrationOpensAt:window.startsAt,registrationClosesAt:window.endsAt}));
  c.awards=[{...para.newDefinition("awards"),id:"welcome",name:"Fixture",seasonId:c.seasons[0].id,status:"active",condition:"welcome",amount:500,minimumOccurrences:1,claimLimit:1,...window}];
  c.entitlements=[{...para.newDefinition("entitlements"),id:"analysis-access",name:"Analysis",category:"analytics",provenance:"commercial",fulfillment:"available",asset:ANALYSIS,rightsReference:"First-party calculation"}];
  c.products=[{...para.newDefinition("products"),id:"analysis",name:"Analysis",category:"analytics",status:"active",entitlements:["analysis-access"],pricing:"gold",goldPrice:300,...window}];
  return c;
}
async function fixture(t) {
  const db=new PGlite();t.after(()=>db.close());await db.exec("create role anon;create role authenticated;create role service_role bypassrls;");
  await db.exec(fs.readFileSync(path.join(__dirname,"../../supabase/migrations/20261029211614_authoritative_runtime_state.sql"),"utf8"));
  let held=null,failed=false;const configuration=config(),publication={published:()=>({id:hash(configuration),snapshot:{paraLeague:configuration}})};
  const request=async(route,options={})=>{
    if(!options.body)return(await db.query("select revision::int,contract,state,updated_at from public.gauntlet_runtime_states where id=$1",[new URLSearchParams(route.split("?")[1]).get("id").slice(3)])).rows;
    if(held)await held;if(failed)throw new Error("Database unavailable");const p=JSON.parse(options.body);
    return(await db.query("select public.commit_gauntlet_runtime($1,$2,$3,$4,$5) result",[p.p_id,p.p_expected_revision,p.p_request_id,p.p_contract,p.p_state])).rows[0].result;
  };
  function make() {
    const gold=createGoldEconomy({filename:":memory:",publication,now:()=>"2026-10-12T12:00:00.000Z"}),league=createParaRuntime({filename:":memory:",publication,now:()=>"2026-10-12T12:00:00.000Z"});
    t.after(()=>{gold.close();league.close();});
    const store=createRemoteOperationalStore({request,stores:{gold:gold.persistence,para:league.persistence}}),rooms=new Map();
    const boundary=createDurableRoomBoundary({rooms,store:{saveRooms:async()=>({})},additionalState:store.snapshot,beforeCommit:store.save});
    return{gold,league,store,boundary};
  }
  return{db,request,make,publication,configuration,fail:value=>{failed=value;},hold:value=>{held=value;}};
}
test("remote ledger preserves exact purchase, grants, refund, balances and request receipts across fresh projections",async t=>{
  const f=await fixture(t),first=f.make();await first.store.load();
  const claim={key:key(),awardId:"welcome"};await first.boundary.run(()=>first.gold.claim(account,claim));
  const quote=await first.boundary.run(()=>first.gold.quote(account,{key:key(),productId:"analysis"}));
  const buy={key:key(),quoteId:quote.id};
  const [a,b]=await Promise.all([first.boundary.run(()=>first.gold.purchase(account,buy)),first.boundary.run(()=>first.gold.purchase(account,buy))]);assert.deepEqual(a,b);
  assert.equal(first.gold.wallet(account).gold,200);assert.equal(first.gold.accountGrants(account.id).length,1);
  const second=f.make();await second.store.load();
  assert.equal(second.gold.wallet(account).gold,200);assert.deepEqual(second.gold.purchase(account,buy),a);
  const refund={key:key(),operation:"refund",purchaseId:a.id,reason:"Isolated recovery test"};
  await second.boundary.run(()=>second.gold.operate({id:"test-admin"},refund));
  const third=f.make();await third.store.load();
  assert.equal(third.gold.wallet(account).gold,500);assert.equal(third.gold.accountGrants(account.id)[0].state,"revoked");
  await third.boundary.run(()=>third.gold.operate({id:"test-admin"},refund));assert.equal(third.gold.wallet(account).gold,500);
  assert.equal(third.gold.admin().refunds.length,1);
  await assert.rejects(first.boundary.run(()=>first.gold.quote(account,{key:key(),productId:"analysis"})),{code:"RUNTIME_UNAVAILABLE"});
  assert.equal(first.boundary.status().blocked,true);
});

test("Para remote settlement preserves pinned scoring and prevents duplicate rewards after recovery",async t=>{
  const f=await fixture(t),first=f.make();await first.store.load();
  let last;
  await first.boundary.run(()=>{
    first.league.sync();const event=f.configuration.events[0],rules=f.publication.published().id;
    const enroll=id=>first.league.enroll(id,{eventId:event.id,acceptedRules:rules,eligibilityConfirmed:true});
    const a=enroll(account.id);
    for(let i=0;i<event.winTarget;i++){
      const b=enroll(`opponent-${i}`),matchId=key();first.league.reserve(matchId,a.id,b.id);
      last={matchId,contentVersion:rules,ranked:false,para:{eventId:event.id,releaseId:rules,attemptIds:[a.id,b.id]},completedAt:"2026-10-12T12:00:00.000Z",participants:[{accountId:a.accountId,identityType:"account",result:"win"},{accountId:b.accountId,identityType:"account",result:"loss"}],completion:{status:"finalized"}};
      first.league.settle(last);first.league.settle(last);
    }
  });
  const second=f.make();await second.store.load();await second.boundary.run(()=>second.league.settle(last));
  const view=second.league.view(account.id);assert.equal(view.awards.length,1);assert.equal(view.lifetimePrestige,30);assert.equal(second.league.inspect().receipts.length,7);
  const broken=structuredClone(second.gold.persistence.snapshot());broken.schema="unknown";assert.throws(()=>f.make().gold.persistence.restore(broken),/compatible/);
});

test("actual HTTP success waits for remote commit and database failure returns 503 with no success body",async t=>{
  const f=await fixture(t),first=f.make();await first.store.load();const express=require("express"),app=express();
  app.use(durableHttpMiddleware(first.boundary));app.use(express.json());app.post("/claim",(req,res)=>res.json(first.gold.claim(account,req.body)));
  const server=app.listen(0,"127.0.0.1");await new Promise(resolve=>server.once("listening",resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  let release;f.hold(new Promise(resolve=>{release=resolve;}));let received=false;
  const pending=fetch(`http://127.0.0.1:${server.address().port}/claim`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:key(),awardId:"welcome"})}).then(r=>{received=true;return r;});
  await new Promise(resolve=>setTimeout(resolve,50));assert.equal(received,false);release();f.hold(null);assert.equal((await pending).status,200);
  const other={id:"second-account",createdAt:account.createdAt};app.post("/other",(req,res)=>res.json(first.gold.claim(other,req.body)));
  f.fail(true);const failed=await fetch(`http://127.0.0.1:${server.address().port}/other`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:key(),awardId:"welcome"})});
  assert.equal(failed.status,503);assert.equal((await failed.json()).code,"RUNTIME_UNAVAILABLE");
  f.fail(false);const second=f.make();await second.store.load();assert.equal(second.gold.inspectAccount(other.id).balance,null);
});

test("operational export/import reconciles exact records, is idempotent and refuses overwrite",async t=>{
  const f=await fixture(t),source=f.make(),recovery=require("../remoteOperationalRecovery");
  source.gold.claim(account,{key:key(),awardId:"welcome"});source.league.sync();
  const state={schemaVersion:require("../remoteOperationalStore").CONTRACT,stores:{gold:source.gold.persistence.snapshot(),para:source.league.persistence.snapshot()}};
  const value=recovery.envelope(state);
  assert.ok(recovery.validate(value).gold.rows>0);
  assert.equal((await recovery.importState({request:f.request,value})).readbackVerified,true);
  assert.equal((await recovery.importState({request:f.request,value})).alreadyImported,true);
  const exported=await recovery.exportRemote(f.request);assert.deepEqual(exported.state,value.state);
  assert.equal((await recovery.importState({request:f.request,value:exported,targetId:"restore-operations-test"})).readbackVerified,true);
  const altered=structuredClone(exported);altered.state.stores.gold.tables.gold_accounts[0].body="{}";
  assert.throws(()=>recovery.validate(altered),/integrity/);
  source.gold.quote(account,{key:key(),productId:"analysis"});
  const changed=recovery.envelope({...state,stores:{...state.stores,gold:source.gold.persistence.snapshot()}});
  await assert.rejects(recovery.importState({request:f.request,value:changed}),/different records/);
});
