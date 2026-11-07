"use strict";
const {DatabaseSync}=require("node:sqlite");
const {createSqliteRuntimeSnapshot,digest}=require("./sqliteRuntimeSnapshot");
const {createRemoteRuntimeStore}=require("./remoteRuntimeStore");
const {CONTRACT}=require("./remoteOperationalStore");
const SCHEMA="gauntlet.operations-export.v1";
function verifyState(state) {
  if(state?.schemaVersion!==CONTRACT || !state.stores || Object.keys(state.stores).some(name=>!["gold","para"].includes(name))) throw new Error("Unsupported operational export.");
  const publication={published:()=>({snapshot:{}})},verified={};
  for(const [name,snapshot] of Object.entries(state.stores)) {
    const runtime=name==="gold"?require("./goldEconomy").createGoldEconomy({filename:":memory:",publication}):require("./paraRuntime").createParaRuntime({filename:":memory:",publication});
    try{verified[name]=runtime.persistence.restore(snapshot);}finally{runtime.close();}
  }
  return verified;
}
function envelope(state,revision=0){verifyState(state);const value={schemaVersion:SCHEMA,contract:CONTRACT,exportedAt:new Date().toISOString(),revision,state};return{...value,sha256:digest(value)};}
function validate(value){const{sha256,...payload}=value||{};if(payload.schemaVersion!==SCHEMA || payload.contract!==CONTRACT || !Number.isSafeInteger(payload.revision) || digest(payload)!==sha256)throw new Error("Operational export failed its integrity check.");return verifyState(payload.state);}
function exportLocal(files){
  if(!Object.keys(files).length)throw new Error("Choose at least one existing operational SQLite source.");
  const stores={};
  for(const[name,filename]of Object.entries(files)){
    if(!["gold","para"].includes(name))throw new Error("Unknown operational store.");
    const db=new DatabaseSync(filename,{readOnly:true});
    try{if(db.prepare("PRAGMA integrity_check").get().integrity_check!=="ok")throw new Error("Source SQLite integrity failed.");stores[name]=createSqliteRuntimeSnapshot(db,name).snapshot();}finally{db.close();}
  }
  return envelope({schemaVersion:CONTRACT,stores});
}
async function exportRemote(request){const store=createRemoteRuntimeStore({request,id:"operational-systems",contract:CONTRACT});return envelope(await store.load(),store.status().revision);}
async function importState({request,value,targetId="operational-systems"}){
  const reconciliation=validate(value);
  if(targetId!=="operational-systems" && !/^restore-[a-z0-9-]+$/.test(targetId))throw new Error("Choose a new isolated restore-* scope.");
  const store=createRemoteRuntimeStore({request,id:targetId,contract:CONTRACT}),prior=await store.load();
  if(prior){if(digest(prior)!==digest(value.state))throw new Error("Destination contains different records. No balances, ownership or history were overwritten.");return{alreadyImported:true,targetId,reconciliation};}
  await store.save(value.state);if(digest(await store.load())!==digest(value.state))throw new Error("Operational import readback failed.");
  return{imported:true,targetId,reconciliation,readbackVerified:true,recoveryVerified:false};
}
module.exports={exportLocal,exportRemote,validate,verifyState,importState,envelope};
