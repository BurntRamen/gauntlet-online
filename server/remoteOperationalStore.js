"use strict";
const {createRemoteRuntimeStore}=require("./remoteRuntimeStore");
const {digest}=require("./sqliteRuntimeSnapshot");
const CONTRACT="gauntlet.operational-systems.v1";
function createRemoteOperationalStore({request,stores,id="operational-systems"}) {
  const remote=createRemoteRuntimeStore({request,id,contract:CONTRACT});
  let retained={}, committed=null, initialized=false;
  const snapshot=()=>({schemaVersion:CONTRACT,stores:{...retained,...Object.fromEntries(Object.entries(stores).map(([name,store])=>[name,store.snapshot()]))}});
  async function load() {
    if (initialized) throw new Error("Operational recovery is already initialized.");
    const value=await remote.load();
    if (value) {
      if (value.schemaVersion!==CONTRACT || !value.stores || Object.keys(value.stores).some(name=>!["gold","para"].includes(name))) throw new Error("Unsupported remote operational state.");
      retained=value.stores;
      for(const [name,store] of Object.entries(stores)) if(retained[name]) store.restore(retained[name]);
      committed=digest(value);
    }
    initialized=true;
    return {restored:!!value,scopes:Object.keys(retained),recoveryVerified:false};
  }
  async function save() {
    if(!initialized) throw new Error("Load authoritative operational state before accepting work.");
    const value=snapshot(), fingerprint=digest(value);
    if(fingerprint===committed) return {unchanged:true};
    const receipt=await remote.save(value); committed=fingerprint; retained=value.stores; return receipt;
  }
  return {load,save,snapshot,status:()=>({...remote.status(),configured:true,initialized,provider:"supabase",scopes:Object.keys(stores),recoveryVerified:false,description:"Remote committed operational records; SQLite is a disposable in-memory projection."})};
}
module.exports={createRemoteOperationalStore,CONTRACT};
