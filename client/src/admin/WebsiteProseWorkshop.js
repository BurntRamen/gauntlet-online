import {useHelp as useCreativeCopy} from "./AuthoringHelp";
import {useEffect,useRef,useState} from 'react';
import {pageLayout as getLayout} from './websiteConfig';
import WorkshopShell from './WorkshopShell';
import {PrivateImage, usePrivateImages} from './PrivateAsset';
import WebsitePreview from './WebsitePlayerPreview';

export default function WebsiteProseWorkshop({state,field,target,onTarget,context,onContext,busy,onReview,buffers={}}) {
  const creativeCopy=useCreativeCopy();

  const domains=(state.draft?.snapshot || state.live).domains;
  const [element,setElement]=useState('header'), [device,setDevice]=useState('desktop'), inspector=useRef(null);
  const selectElement=next=>{setElement(next);requestAnimationFrame(()=>inspector.current?.querySelector('select,input,textarea')?.focus());};
  const entries=[...state.guide.websiteSurfaces,...domains.game.filter(r=>r.id!=='shared-rules').map(r=>({id:'mode-'+r.id,owner:r.id,name:r.name+' · mode copy'}))];
  const selected=entries.find(s=>s.owner===target.id && (s.id===(/^(hero|menuDetail)/.test(target.field)?'mode-'+target.id:target.section) || target.field?.startsWith(s.id+'Page'))) || entries.find(s=>s.owner===target.id) || entries[0];
  const row=domains.game.find(r=>r.id===selected.owner), mode=selected.id.startsWith('mode-');
  const get=(owner,key,fallback=true)=>{const saved=domains.game.find(r=>r.id===owner); const v=buffers[`game:${owner}:${key}`] ?? saved?.[key] ?? (fallback?state.fields.game[owner]?.[key]?.defaultValue:undefined); if(state.fields.game[owner]?.[key]?.type?.startsWith('website-') && typeof v==='string') {try{return JSON.parse(v);}catch{return undefined;}} return v;};
  const definitions=state.fields.game[selected.owner] || {};
  const targetElement=target.field && (definitions[target.field]?.visual?.element || (target.field==='websiteNavigation'?'navigation':target.field.endsWith('PageLayout')?'presentation':'header'));
  useEffect(()=>{if(targetElement)setElement(targetElement);},[targetElement,target.field]);
  const pathFor=reference=>state.assetLibrary?.find(a=>[a.id,a.source,a.path].includes(reference))?.path;
  const imageFields=Object.keys(definitions).filter(key=>key.startsWith(selected.id+'Page') && definitions[key].type==='asset');
  const images=usePrivateImages(imageFields.map(key=>pathFor(get(selected.owner,key))));
  const imageFor=key=>images[pathFor(get(selected.owner,key))]?.src;
  const image=imageFor(selected.id+'PageImage'), visuals={tiles:{}};
  for(const [key,definition] of Object.entries(definitions)) if(key.startsWith(selected.id+'Page') && definition.visual) {
    const value=definition.type==='asset'?imageFor(key):get(selected.owner,key);
    if(value) {const {element,part}=definition.visual;if(element==='background')visuals.background=value;else (visuals.tiles[element] ||= {})[part]=value;}
  }
  const manifest=state.previewContent?.manifest || state.previewContent || {};
  const layoutField=state.fields.game[selected.owner]?.[selected.id+'PageLayout'];
  const pageLayout={...getLayout(layoutField,get(selected.owner,selected.id+'PageLayout'),(domains.campaigns||[]).map(c=>c.id)),visuals};
  const content={...manifest,modeMetadata:{...manifest.modeMetadata,[selected.owner]:{...row,...Object.fromEntries(Object.keys(state.fields.game[row.id]||{}).map(key=>[key,get(row.id,key)]))}},websiteProse:{...manifest.websiteProse,[selected.id]:{title:get(selected.owner,selected.id+'PageTitle'),description:get(selected.owner,selected.id+'PageDescription'),image}},websitePresentation:{version:1,navigation:get('practice','websiteNavigation',false),pages:{...manifest.websitePresentation?.pages,[selected.id]:pageLayout}}};
  const visualKeys=Object.keys(definitions).filter(key=>key.startsWith(selected.id+'Page') && definitions[key].visual?.element===element);
  const faction=element.startsWith('faction-')?element.slice(8):null;
  const fields=faction?[]:mode?Object.keys(definitions).filter(key=>!key.includes('Page') && key!=='websiteNavigation'):element==='navigation'?['websiteNavigation']:element==='header'?['Title','Description','Image'].map(part=>selected.id+'Page'+part):visualKeys.length?visualKeys:[selected.id+'PageLayout'];
  const owner=element==='navigation'&&!mode?domains.game.find(r=>r.id==='practice'):row;
  return <WorkshopShell busy={busy} name="Website Studio" title={selected.name} selectionId={selected.id} actions={<button disabled={busy} onClick={onReview}>Review release</button>}
    search={<label className="admin-search">Find a page<input type="search" value={context?.query||''} onChange={e=>onContext({query:e.target.value})}/></label>}
    list={<div className="admin-object-list website-pages">{entries.filter(e=>e.name.toLowerCase().includes((context?.query||'').toLowerCase())).map(e=><button key={e.id} aria-pressed={selected.id===e.id} onClick={()=>{setElement('header');onTarget({domain:'modes',id:e.owner,section:e.id});}}><strong>{e.name}</strong>{!e.id.startsWith('mode-')&&<span className="website-page-thumbnail"><PrivateImage src={state.assetLibrary?.find(a=>[a.id,a.source,a.path].includes(get(e.owner,e.id+'PageImage')))?.path || '/brand/suitfire-v14/crest.png'} alt="" loading="lazy"/><span>{get(e.owner,e.id+'PageTitle')}<small>{getLayout(state.fields.game[e.owner]?.[e.id+'PageLayout'],null,(domains.campaigns||[]).map(c=>c.id)).sections.length} registered sections</small></span></span>}</button>)}</div>}>
    <div className="website-studio">
      <section className="admin-website-preview" aria-label={creativeCopy.creativeWebsiteProseWorkshop1}><div className="website-preview-toolbar"><p>{Object.keys(buffers).some(k=>k.startsWith('game:'))?creativeCopy.creativeWebsiteProseWorkshop2:state.draft?'Saved draft presentation':'Live presentation'}</p><div role="group" aria-label="Preview device">{['desktop','mobile'].map(size=><button key={size} type="button" aria-pressed={device===size} onClick={()=>setDevice(size)}>{size==='desktop'?'Desktop':'Mobile'}</button>)}</div></div><p className="admin-note">{creativeCopy.creativeWebsiteProseWorkshop3}</p>{Object.values(images).some(image=>image.error)&&<p role="alert">{creativeCopy.creativeWebsiteProseWorkshop4}</p>}<WebsitePreview page={selected.id} content={content} selection={element} onSelect={selectElement} device={device}/></section>
      <section ref={inspector} className="website-inspector" aria-label="Website inspector">{!mode && <label>Edit element<select aria-label="Edit element" value={element} onChange={e=>setElement(e.target.value)}><option value="header">Heading & artwork</option><option value="background">Page background</option><option value="presentation">{creativeCopy.creativeWebsiteProseWorkshop5}</option><option value="navigation">Website navigation</option>{pageLayout.sections.map(section=><option key={section.id} value={section.id}>{layoutField?.labels?.[section.id] || domains.factions.find(f=>'faction-'+f.id===section.id)?.name || section.id}</option>)}</select></label>}{faction?<><p>{creativeCopy.creativeWebsiteProseWorkshop6}</p><button onClick={()=>onTarget({domain:'campaigns',id:faction})}>{creativeCopy.creativeWebsiteProseWorkshop7}</button><button onClick={()=>onTarget({domain:'factions',id:faction})}>{creativeCopy.creativeWebsiteProseWorkshop8}</button></>:fields.map(key=>field(key,{domain:'game',row:owner}))}</section>
    </div>
  </WorkshopShell>;
}
