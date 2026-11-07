"use strict";
// JSON/buffer HTTP responses join the same serialized unit as rooms and ledger
// writes. Headers and bytes are held until commit. Never buffer a live stream.
function durableHttpMiddleware(boundary) {
  return (req,res,next)=>{
    const originalEnd=res.end.bind(res), originalWrite=res.write.bind(res), originalHead=res.writeHead.bind(res);
    const chunks=[]; let settle, sent=false;
    const ready=new Promise(resolve=>{settle=resolve;});
    res.write=(chunk,encoding,callback)=>{if(chunk) chunks.push(Buffer.isBuffer(chunk)?Buffer.from(chunk):Buffer.from(chunk,typeof encoding==="string"?encoding:undefined));if(typeof encoding==="function") encoding();else callback?.();return true;};
    res.writeHead=(status,reason,headers)=>{res.statusCode=status; if(typeof reason==="string") res.statusMessage=reason; for(const [key,value] of Object.entries(headers || (typeof reason==="object"?reason:{}))) res.setHeader(key,value);return res;};
    res.flushHeaders=()=>{throw new Error("Streaming responses are unavailable inside durable operations.");};
    res.end=(chunk,encoding,callback)=>{
      if(sent) return res; sent=true;
      if(chunk) chunks.push(Buffer.isBuffer(chunk)?Buffer.from(chunk):Buffer.from(chunk,typeof encoding==="string"?encoding:undefined));
      boundary.output(()=>{res.write=originalWrite;res.writeHead=originalHead;res.end=originalEnd;originalEnd(Buffer.concat(chunks),typeof encoding==="function"?encoding:callback);});
      settle();return res;
    };
    boundary.run(async()=>{next();await ready;}).catch(()=>{
      res.write=originalWrite;res.writeHead=originalHead;res.end=originalEnd;
      if(!res.destroyed && !res.headersSent){for(const key of res.getHeaderNames()) if(!key.startsWith("access-control-") && key!=="vary") res.removeHeader(key);res.statusCode=503;res.setHeader("Content-Type","application/json");res.setHeader("Cache-Control","no-store");originalEnd(JSON.stringify({error:"Durable storage did not confirm this operation. Reconnect and retry with the same request key after recovery.",code:"RUNTIME_UNAVAILABLE"}));}
    });
  };
}
module.exports={durableHttpMiddleware};
