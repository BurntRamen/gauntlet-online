"use strict";
const crypto=require("node:crypto"),zlib=require("node:zlib");
const {CONTRACT:ROOMS}=require("./remoteRoomStateStore"),{CONTRACT:OPERATIONS}=require("./remoteOperationalStore");
const {createRemoteRuntimeStore}=require("./remoteRuntimeStore"),{isRecoverableRoom}=require("./roomStateStore");
const {hash}=require("./authoredContent");
const SCHEMA="gauntlet.remote-backup.v1",MAX=128*1024*1024;
const sha=body=>crypto.createHash("sha256").update(body).digest("hex");
function verifyRecords(records){
  if(!Array.isArray(records)||!records.length||new Set(records.map(row=>row.id)).size!==records.length)throw new Error("Missing or duplicate recovery scopes.");
  for(const row of records){
    if(!Number.isSafeInteger(row.revision)||row.revision<1)throw new Error("Invalid recovery revision.");
    if(row.id==="active-rooms"&&row.contract===ROOMS){if(row.state?.schemaVersion!==2||!Array.isArray(row.state.rooms)||row.state.rooms.some(room=>!isRecoverableRoom(room))||new Set(row.state.rooms.map(room=>room.roomCode)).size!==row.state.rooms.length)throw new Error("Invalid recovered rooms.");}
    else if(row.id==="operational-systems"&&row.contract===OPERATIONS) require("./remoteOperationalRecovery").verifyState(row.state);
    else throw new Error("Backup needs its compatible runtime contract.");
  }
}
function encode(records){verifyRecords(records);const createdAt=new Date().toISOString(),payload={schemaVersion:SCHEMA,createdAt,records};const json=Buffer.from(JSON.stringify(payload));if(json.length>MAX)throw new Error("Remote backup exceeds 128 MiB uncompressed.");const body=zlib.gzipSync(json);if(body.length>64*1024*1024)throw new Error("Remote backup exceeds the 64 MiB object limit.");return{body,key:`runtime/${createdAt.replace(/[:.]/g,"-")}-${crypto.randomUUID()}-${sha(body)}.json.gz`};}
function validate(key,body){const expected=/^runtime\/\d{4}-\d{2}-\d{2}T[\d-]+Z-[a-f0-9-]{36}-([a-f0-9]{64})\.json\.gz$/.exec(key);if(!expected||body.length>64*1024*1024||sha(body)!==expected[1])throw new Error("Remote backup integrity failed.");const value=JSON.parse(zlib.gunzipSync(body,{maxOutputLength:MAX}));if(value.schemaVersion!==SCHEMA)throw new Error("Use the restore tool matching this backup format.");verifyRecords(value.records);return value;}
async function capture(request){return encode(await request("gauntlet_runtime_states?id=in.(active-rooms,operational-systems)&select=id,revision,contract,state&order=id"));}
async function restore({request,key,body,prefix}){
  const value=validate(key,body);if(!/^[a-z0-9-]{1,20}$/.test(prefix||""))throw new Error("Supply a short isolated restore prefix.");const results=[];
  for(const row of value.records){const id=`restore-${prefix}-${row.id}`,store=createRemoteRuntimeStore({request,id,contract:row.contract}),prior=await store.load();if(prior&&hash(prior)!==hash(row.state))throw new Error("Isolated destination contains different state. Nothing was overwritten.");if(!prior)await store.save(row.state);if(hash(await store.load())!==hash(row.state))throw new Error("Isolated restore readback failed.");results.push({id,revision:row.revision,readbackVerified:true});}
  return{scopes:results,recoveryVerified:false};
}
function createRemoteRuntimeBackupService({request,storage,beforeSnapshot,run=work=>work(),maxBytes=128*1024*1024,intervalMs=3600000,logger=console}){
  if(!Number.isSafeInteger(maxBytes)||maxBytes<1048576||maxBytes>512*1024*1024)throw new Error("Invalid backup budget.");
  let state={enabled:!!storage,lastSuccessfulAt:null,lastError:null,source:"Remote committed rooms and operational records",recoveryVerified:false},pending=null,timer,initial;
  const statusStore=()=>createRemoteRuntimeStore({request,id:"remote-backup-status",contract:SCHEMA});
  async function initialize(){if(!storage)return;const store=statusStore(),prior=await store.load();if(prior)state={...state,...prior,enabled:true};}
  async function backup(){if(pending)return pending;if(!storage)throw new Error("Remote backups are not configured.");pending=(async()=>{
    state.lastAttemptAt=new Date().toISOString();const status=statusStore();await status.load();
    try{
      const bundle=await run(async()=>{await beforeSnapshot();return capture(request);});
      let used=0,count=0;for(let offset=0;;offset+=100){const rows=await storage.list(offset);if(!Array.isArray(rows)||rows.some(row=>!Number.isSafeInteger(Number(row.metadata?.size))))throw new Error("Backup capacity could not be measured.");used+=rows.reduce((sum,row)=>sum+Number(row.metadata.size),0);count+=rows.length;if(rows.length<100)break;}
      if(used+bundle.body.length>maxBytes||count>=48)throw new Error("Backup budget reached. Export and reconcile retained recovery points before rotating them; nothing was deleted.");
      await storage.put(bundle.key,bundle.body);validate(bundle.key,await storage.get(bundle.key));
      state={...state,lastSuccessfulAt:new Date().toISOString(),lastError:null,objectKey:bundle.key,storedBytes:used+bundle.body.length,maxBytes,fileCount:count+1};await status.save(state);return{...state};
    }catch(error){state.lastError=error.message;try{await status.save(state);}catch{}throw error;}
  })();try{return await pending;}finally{pending=null;}}
  const attempt=()=>backup().catch(error=>logger.error("[Backup] Remote recovery point failed:",error.message));
  return{initialize,run:backup,status:()=>({...state,running:!!pending}),start(){if(!storage||timer)return;initial=setTimeout(attempt,60000);initial.unref();timer=setInterval(attempt,Math.max(300000,intervalMs));timer.unref();},stop(){clearTimeout(initial);clearInterval(timer);timer=null;}};
}
module.exports={encode,validate,capture,restore,createRemoteRuntimeBackupService};
