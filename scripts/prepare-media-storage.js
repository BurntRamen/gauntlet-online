#!/usr/bin/env node
"use strict";
// Explicit operator command. Never make an existing public bucket private or
// erase an object automatically: a mismatched configuration needs inspection.
const { BUCKET } = require("../server/remoteMediaStore");
async function main() {
  const url = new URL(process.env.SUPABASE_URL), key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || !key) throw new Error("Configure server Supabase credentials in the environment.");
  async function request(route, options = {}) {
    const result = await fetch(`${url.origin}/storage/v1/${route}`, { ...options, redirect:"error",signal:AbortSignal.timeout(30000),headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"} });
    const value = await result.json();
    if (!result.ok) { if ([400,404].includes(result.status) && /not found/i.test(value.message || value.error || "")) return null; throw new Error("Storage configuration request failed."); }
    return value;
  }
  let bucket = await request(`bucket/${BUCKET}`), created = false;
  if (!bucket) { await request("bucket",{method:"POST",body:JSON.stringify({id:BUCKET,name:BUCKET,public:false,file_size_limit:10*1024*1024,allowed_mime_types:["image/webp","audio/wav"]})}); created=true; bucket=await request(`bucket/${BUCKET}`); }
  if (bucket?.public!==false || Number(bucket.file_size_limit)!==10*1024*1024 || !Array.isArray(bucket.allowed_mime_types) || bucket.allowed_mime_types.slice().sort().join()!=="audio/wav,image/webp") throw new Error("The existing media bucket differs from the required private, 10 MiB, WebP/WAV configuration. Inspect it before changing policy.");
  return {bucket:BUCKET,created,private:true,configured:true,recoveryVerified:false};
}
main().then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error.message);process.exitCode=1;});
