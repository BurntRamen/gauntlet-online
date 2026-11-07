#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),path=require("node:path"),recovery=require("../server/remoteOperationalRecovery");
async function main(){
  const[command,filename,targetId]=process.argv.slice(2);
  if(!["export-local","export","verify","import","restore-isolated"].includes(command)||!filename||!path.isAbsolute(filename))throw new Error("Usage: node scripts/remote-operations.js export-local|export|verify|import|restore-isolated ABSOLUTE_PRIVATE_FILE [restore-scope]");
  const read=()=>{if(fs.statSync(filename).size>64*1024*1024)throw new Error("Export exceeds 64 MiB.");return JSON.parse(fs.readFileSync(filename,"utf8"));};
  const write=value=>{fs.writeFileSync(filename,JSON.stringify(value),{flag:"wx",mode:0o600});return{exported:true,reconciliation:recovery.validate(read()),recoveryVerified:false};};
  if(command==="verify")return{reconciliation:recovery.validate(read()),recoveryVerified:false};
  if(command==="export-local")return write(recovery.exportLocal({...(process.env.GAUNTLET_IMPORT_GOLD_FILE?{gold:process.env.GAUNTLET_IMPORT_GOLD_FILE}:{}),...(process.env.GAUNTLET_IMPORT_PARA_FILE?{para:process.env.GAUNTLET_IMPORT_PARA_FILE}:{})}));
  const url=new URL(process.env.SUPABASE_URL),key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(url.protocol!=="https:"||url.username||url.password||url.pathname!=="/"||!key)throw new Error("Configure server Supabase credentials in the environment.");
  const request=async(route,options={})=>{const response=await fetch(`${url.origin}/rest/v1/${route}`,{...options,redirect:"error",signal:AbortSignal.timeout(20000),headers:{apikey:key,...(!key.startsWith("sb_secret_")?{Authorization:`Bearer ${key}`} : {}),"Content-Type":"application/json"}});const value=await response.json();if(!response.ok)throw Object.assign(new Error("Private operational request failed."),{code:value.code});return value;};
  if(command==="export")return write(await recovery.exportRemote(request));
  if(command==="restore-isolated"&&(!targetId||!targetId.startsWith("restore-")))throw new Error("Specify an isolated restore-* scope.");
  if(command==="import"&&targetId)throw new Error("Live import uses its fixed operational scope.");
  return recovery.importState({request,value:read(),...(targetId?{targetId}:{})});
}
main().then(value=>console.log(JSON.stringify(value))).catch(error=>{console.error(error.message);process.exitCode=1;});
