import {lazy,Suspense,useRef,useState} from 'react';
import {pageLayout as getLayout} from './websiteConfig';
import WorkshopShell from './WorkshopShell';
import {PrivateImage, usePrivateImage} from './PrivateAsset';
const WebsitePreview=lazy(()=>import(/* webpackChunkName: "gauntlet-admin-website-preview" */ './WebsitePlayerPreview'));

export default function WebsiteProseWorkshop({state,field,target,onTarget,context,onContext,busy,onReview,buffers={}}) {
  const domains=(state.draft?.snapshot || state.live).domains;
  const [element,setElement]=useState('header'), inspector=useRef(null);
  const selectElement=next=>{setElement(next);requestAnimationFrame(()=>inspector.current?.querySelector('select,input,textarea')?.focus());};
  const entries=[...state.guide.websiteSurfaces,...domains.game.filter(r=>r.id!=='shared-rules').map(r=>({id:'mode-'+r.id,owner:r.id,name:r.name+' · mode copy'}))];
  const selected=entries.find(s=>s.owner===target.id && (s.id===(/^(hero|menuDetail)/.test(target.field)?'mode-'+target.id:target.section) || target.field?.startsWith(s.id+'Page'))) || entries.find(s=>s.owner===target.id) || entries[0];
  const row=domains.game.find(r=>r.id===selected.owner), mode=selected.id.startsWith('mode-');
  const get=(owner,key,fallback=true)=>{const saved=domains.game.find(r=>r.id===owner); const v=buffers[`game:${owner}:${key}`] ?? saved?.[key] ?? (fallback?state.fields.game[owner]?.[key]?.defaultValue:undefined); if(state.fields.game[owner]?.[key]?.type?.startsWith('website-') && typeof v==='string') {try{return JSON.parse(v);}catch{return undefined;}} return v;};
  const reference=get(selected.owner,selected.id+'PageImage');
  const path=state.assetLibrary?.find(a=>[a.id,a.source,a.path].includes(reference))?.path;
  const image=usePrivateImage(path).src;
  const manifest=state.previewContent?.manifest || state.previewContent || {};
  const layoutField=state.fields.game[selected.owner]?.[selected.id+'PageLayout'];
  const pageLayout=getLayout(layoutField,get(selected.owner,selected.id+'PageLayout'),(domains.campaigns||[]).map(c=>c.id));
  const content={...manifest,modeMetadata:{...manifest.modeMetadata,[selected.owner]:{...row,...Object.fromEntries(Object.keys(state.fields.game[row.id]||{}).map(key=>[key,get(row.id,key)]))}},websiteProse:{...manifest.websiteProse,[selected.id]:{title:get(selected.owner,selected.id+'PageTitle'),description:get(selected.owner,selected.id+'PageDescription'),image}},websitePresentation:{version:1,navigation:get('practice','websiteNavigation',false),pages:{...manifest.websitePresentation?.pages,[selected.id]:pageLayout}}};
  const fields=mode?Object.keys(state.fields.game[row.id]).filter(key=>!key.includes('Page') && key!=='websiteNavigation'):element==='navigation'?['websiteNavigation']:element==='header'?['Title','Description','Image'].map(part=>selected.id+'Page'+part):[selected.id+'PageLayout'];
  const owner=element==='navigation'&&!mode?domains.game.find(r=>r.id==='practice'):row;
  return <WorkshopShell busy={busy} name="Website Studio" title={selected.name} selectionId={selected.id} actions={<button disabled={busy} onClick={onReview}>Review release</button>}
    search={<label className="admin-search">Find a page<input type="search" value={context?.query||''} onChange={e=>onContext({query:e.target.value})}/></label>}
    list={<div className="admin-object-list website-pages">{entries.filter(e=>e.name.toLowerCase().includes((context?.query||'').toLowerCase())).map(e=><button key={e.id} aria-pressed={selected.id===e.id} onClick={()=>{setElement('header');onTarget({domain:'modes',id:e.owner,section:e.id});}}><strong>{e.name}</strong>{!e.id.startsWith('mode-')&&<span className="website-page-thumbnail"><PrivateImage src={state.assetLibrary?.find(a=>[a.id,a.source,a.path].includes(get(e.owner,e.id+'PageImage')))?.path || '/brand/suitfire-v14/crest.png'} alt="" loading="lazy"/><span>{get(e.owner,e.id+'PageTitle')}<small>{getLayout(state.fields.game[e.owner]?.[e.id+'PageLayout'],null,(domains.campaigns||[]).map(c=>c.id)).sections.length} registered sections</small></span></span>}</button>)}</div>}>
    <div className="website-studio">
      <section className="admin-website-preview" aria-label="Website presentation preview"><p>{Object.keys(buffers).some(k=>k.startsWith('game:'))?'Local preview · unsaved changes':state.draft?'Saved draft presentation':'Live presentation'} · Guest preview · click an outlined element to edit it.</p><Suspense fallback={<p role="status">Loading player page…</p>}><WebsitePreview page={selected.id} content={content} selection={element} onSelect={selectElement}/></Suspense></section>
      <section ref={inspector} className="website-inspector" aria-label="Website inspector">{!mode && <label>Edit element<select aria-label="Edit element" value={element} onChange={e=>setElement(e.target.value)}><option value="header">Heading & artwork</option><option value="presentation">Sections & presentation</option><option value="navigation">Website navigation</option>{!['header','presentation','navigation'].includes(element)&&<option value={element}>{layoutField?.labels?.[element] || element}</option>}</select></label>}{fields.map(key=>field(key,{domain:'game',row:owner}))}</section>
    </div>
  </WorkshopShell>;
}
