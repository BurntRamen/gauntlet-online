import {useState} from 'react';
import useAdminData from './useAdminData';

export function ArchiveActions({request,id,verified,environment}) {
  const [message,setMessage]=useState('');
  const act=async(download)=>{try{
    const result=await request(download?`/api/matches/${encodeURIComponent(id)}/archive`:`/api/admin/match-archive/${encodeURIComponent(id)}/verify`,download?{download:`gauntlet-match-${id}.json`}:{method:'POST',body:'{}'});
    setMessage(download?'Canonical archive downloaded.':`Verified · SHA ${result.sha256}`);
  }catch(error){setMessage(error.message);}};
  return <div className="admin-actions"><a href={`/?match=${encodeURIComponent(id)}`} target="_blank" rel="noreferrer">Match Record</a><a href={`${environment}/api/matches/${encodeURIComponent(id)}/export/para?version=2`} target="_blank" rel="noreferrer">Para Export</a>{verified&&<><button onClick={()=>act(true)}>Download JSON</button><button onClick={()=>act(false)}>Verify Integrity</button></>}{message&&<p role="status">{message}</p>}</div>;
}

export default function Recovery({request,State,Facts,Json,date}) {
  const [revision,refresh]=useState(0), [record,setRecord]=useState(null), [preview,setPreview]=useState(null), [message,setMessage]=useState(''), [busy,setBusy]=useState(false);
  const state=useAdminData(request,'/api/admin/overview',revision);
  const act=async(file)=>{setBusy(true);setMessage('');try{
    const next=file?JSON.parse(await file.text()):record;
    const result=await request('/api/admin/match-archive/import/'+(file?'preview':'commit'),{method:'POST',body:JSON.stringify({record:next,...(!file?{expectedSha256:preview.sha256}:{})})});
    setRecord(file?next:null);setPreview(file?result:null);
    if(!file){setMessage(result.status==='already-archived'?'Already archived · no changes made.':'Archive imported.');refresh(value=>value+1);}
  }catch(error){setRecord(null);setPreview(null);setMessage(error instanceof SyntaxError?'The selected archive is not valid JSON.':error.message);}finally{setBusy(false);}};
  return <section aria-label="Recovery and active play"><button disabled={busy} onClick={()=>refresh(value=>value+1)}>Refresh operations</button><State state={state}>{data=><>
    <h4>Active rooms</h4><Facts values={{rooms:data.activePlay.rooms.length,rankedQueue:data.activePlay.rankedQueue,...data.activePlay.draftQueues}} />{data.activePlay.rooms.map(room=><article key={room.roomCode}><strong>{room.roomCode} · {room.mode}{room.ranked?' · ranked':''}</strong><p>{room.players.map(player=>player.displayName||`P${player.playerNum}`).join(' vs ')} · {room.phase||room.lifecycleStatus||'lobby'} · {room.spectatorCount||0} spectators</p></article>)}
    <details><summary>Collector receipts</summary><Facts values={{issued:data.collector.issuedCount,redeemed:data.collector.redeemedCount,pending:data.collector.pendingCount}} />{(data.collector.issuances||[]).slice(0,10).map(receipt=><p key={receipt.entitlementId}>{receipt.productId} · {receipt.account?.name||receipt.account?.id} · {receipt.redeemed?'redeemed':'pending'} · {date(receipt.issuedAt)}</p>)}</details>
  </>}</State><h4>Owner recovery import</h4><p>Select canonical record-v2 JSON, validate it, then confirm its import.</p><label>Select JSON<input type="file" accept="application/json,.json" disabled={busy} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)act(file);}} /></label>
    {preview&&<><p>{preview.status==='already-archived'?'Already archived':'Verified · Ready to import'} · {(preview.preview?.participants||[]).map(row=>row.displayName).join(' vs ')} · {date(preview.preview?.completedAt)}</p><Facts values={{sha256:preview.sha256,bytes:preview.byteSize}} /><Json value={record} title="Inspect JSON" /><button disabled={busy} onClick={()=>act()}>{preview.status==='already-archived'?'Confirm No-op':'Commit Import'}</button><button disabled={busy} onClick={()=>{setRecord(null);setPreview(null);}}>Cancel</button></>}{message&&<p role="status">{message}</p>}
  </section>;
}
