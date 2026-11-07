#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),path=require("node:path"),backups=require("../server/remoteRuntimeBackups");
async function main(){
  const[command,key,filename,prefix]=process.argv.slice(2);
  if(!["download","verify","restore-isolated"].includes(command)||!key||!filename||!path.isAbsolute(filename))throw new Error("Usage: node scripts/remote-backups.js download|verify|restore-isolated OBJECT_KEY ABSOLUTE_PRIVATE_FILE [restore-prefix]");
  const read=()=>{if(fs.statSync(filename).size>64*1024*1024)throw new Error("Backup exceeds 64 MiB.");return fs.readFileSync(filename);};
  if(command==="verify"){const value=backups.validate(key,read());return{scopes:value.records.map(row=>row.id),integrityVerified:true,recoveryVerified:false};}
  const url=new URL(process.env.SUPABASE_URL),secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(url.protocol!=="https:"||url.username||url.password||url.pathname!=="/"||!secret)throw new Error("Configure server Supabase credentials.");
  if(command==="download"){const storage=require("../server/runtimeBackups").createBackupStorage({url:url.origin,key:secret}),body=await storage.get(key);backups.validate(key,body);fs.writeFileSync(filename,body,{flag:"wx",mode:0o600});return{downloaded:true,integrityVerified:true};}
  const request=async(route,options={})=>{const response=await fetch(`${url.origin}/rest/v1/${route}`,{...options,redirect:"error",signal:AbortSignal.timeout(30000),headers:{apikey:secret,...(!secret.startsWith("sb_secret_")?{Authorization:`Bearer ${secret}`} : {}),"Content-Type":"application/json"}});const value=await response.json();if(!response.ok)throw Object.assign(new Error("Restore request failed."),{code:value.code});return value;};
  return backups.restore({request,key,body:read(),prefix});
}
main().then(value=>console.log(JSON.stringify(value))).catch(error=>{console.error(error.message);process.exitCode=1;});
