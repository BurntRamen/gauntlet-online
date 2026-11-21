import {useHelp as useCreativeCopy} from "./AuthoringHelp";
import {additional,ordered} from '../../../shared/admin/campaignSequence';
import {PrivateImage} from './PrivateAsset';

export default function CampaignChapters({campaign,snapshot,assets,busy,onInspect,onCreate,onReorder}) {
  const creativeCopy=useCreativeCopy();

  const active=additional(snapshot,campaign).filter(row=>row.status==='active');
  const ids=[...ordered(snapshot,campaign),...additional(snapshot,campaign).filter(row=>row.status==='archived').map(row=>row.id)];
  const move=(id,delta)=>{const next=active.map(row=>row.id),index=next.indexOf(id);[next[index],next[index+delta]]=[next[index+delta],next[index]];onReorder(next);};
  return <section className="campaign-sequence" aria-label="Campaign chapters"><div className="admin-title-row"><h4>Campaign journey</h4><button disabled={busy} onClick={()=>onCreate({domain:'encounters',defaults:{campaignId:campaign.id}})}>{creativeCopy.creativeCampaignChapters1}</button></div><p className="admin-note">{creativeCopy.creativeCampaignChapters2}</p><ol>{ids.map((id,index)=>{
    const row=snapshot.domains.encounters.find(row=>row.id===id);if(!row)return null;
    const path=assets?.find(asset=>[asset.id,asset.path,asset.source].includes(row.image))?.path;
    const position=active.findIndex(row=>row.id===id);
    return <li key={id} data-archived={row.status==='archived'||undefined}><span className="campaign-chapter-number">{row.status==='archived'?'—':String(index+1).padStart(2,'0')}</span>{path&&<PrivateImage src={path} alt="" loading="lazy"/>}<div><button disabled={busy} onClick={()=>onInspect('encounters',id)}>{row.title}</button><small>{snapshot.domains.characters.find(character=>character.id===row.opponentId)?.name} · {row.origin==='admin-encounter-v1'?row.status==='archived'?'Archived':'Additional chapter':'Original chapter'}</small></div><div className="admin-actions"><button disabled={busy} onClick={()=>onCreate({domain:'encounters',sourceId:id})} aria-label={`Duplicate ${row.title}`}>Duplicate</button>{position>=0&&<><button disabled={busy||position===0} aria-label={`Move ${row.title} earlier`} onClick={()=>move(id,-1)}>Earlier</button><button disabled={busy||position===active.length-1} aria-label={`Move ${row.title} later`} onClick={()=>move(id,1)}>Later</button></>}</div></li>;
  })}</ol></section>;
}
