import {useState} from "react";

import {useHelp as useCreativeCopy} from "./AuthoringHelp";
import {pageLayout} from './websiteConfig';
export default function WebsiteControls({definition, value, onChange, disabled, state}) {
  const creativeCopy=useCreativeCopy();
  const [templateName,setTemplateName]=useState("");
  const [selected,setSelected]=useState("");

  const nav=definition.type==='website-navigation';
  const factionIds=(state.draft?.snapshot || state.live).domains.campaigns.map(c=>c.id);
  const config=nav ? value : pageLayout(definition,value,factionIds);
  const style=config.style || {theme:"original",tileWidth:300,gap:16,rounding:12};
  const templates=config.templates || [];
  const templateKey=templateName.trim();
  const savedPages=(state.draft?.snapshot || state.live).domains.game || [];
  const library=savedPages.flatMap(row=>Object.entries(row).filter(([key])=>key.endsWith("PageLayout")).flatMap(([key,layout])=>
    (key===definition.page+"PageLayout" ? templates : layout?.templates || []).map(t=>({id:key+"/"+t.name, page:key.replace(/PageLayout$/,""), t}))));
  for(const t of templates) {
    const id=definition.page+"PageLayout/"+t.name;
    if(!library.some(item=>item.id===id)) library.push({id,page:definition.page,t});
  }
  const apply=patch=>onChange({...config,version:2,style,templates,...patch});
  const matching=templates.some(t=>t.name.toLowerCase()===templateKey.toLowerCase());
  const key=nav?'items':'sections', rows=config[key];
  const change=(index,patch)=>onChange({...config,[key]:rows.map((row,i)=>i===index?{...row,...patch}:row)});
  const move=(index,delta)=>{const next=[...rows]; [next[index],next[index+delta]]=[next[index+delta],next[index]]; onChange({...config,[key]:next});};
  return <fieldset disabled={disabled} className="website-controls"><legend>{nav?creativeCopy.creativeWebsiteControls1:'Page presentation'}</legend>
    {nav && <label>Site-wide theme<select value={config.theme || "original"} onChange={e=>onChange({...config,theme:e.target.value})}>
      {["original","midnight","parchment","forest"].map(name=><option key={name}>{name}</option>)}</select></label>}
    {!nav && <div className="admin-form-grid"><label>Type style<select aria-label="Type style" value={config.typography} onChange={e=>onChange({...config,typography:e.target.value})}><option value="standard">SuitFire standard</option><option value="editorial">Editorial headings</option><option value="plain">Plain reading</option></select></label>{rows.length>0 && <label>Section arrangement<select aria-label="Section arrangement" value={config.arrangement} onChange={e=>onChange({...config,arrangement:e.target.value})}><option value="tiles">Tiles</option><option value="list">List</option><option value="compact">Compact tiles</option></select></label>}</div>}
    {!nav && <fieldset><legend>Theme and sizing</legend>
      <label>Theme<select value={style.theme} onChange={e=>apply({style:{...style,theme:e.target.value}})}>{["original","midnight","parchment","forest"].map(name=><option key={name}>{name==="original"?"Use site theme":name}</option>)}</select></label>
      {[["tileWidth","Tile width",160,600],["gap","Tile spacing",0,48],["rounding","Corner radius",0,40]].map(([key,label,min,max])=>
        <label key={key}>{label} ({style[key]} px)<input type="range" aria-label={label} min={min} max={max} value={style[key]} onChange={e=>apply({style:{...style,[key]:Number(e.target.value)}})}/></label>)}
      <label>Template name<input value={templateName} maxLength={48} onChange={e=>setTemplateName(e.target.value)}/></label>
      <button type="button" disabled={!templateKey || (!matching && templates.length>=12)} onClick={()=>{
        apply({templates:[...templates.filter(t=>t.name.toLowerCase()!==templateKey.toLowerCase()),{name:templateKey,style,typography:config.typography,arrangement:config.arrangement,sections:config.sections.map(section=>({...section}))}]});
        setTemplateName("");
      }}>{matching?"Update template":"Save template"}</button>
      {library.length>0 && <><label>Saved templates<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose a template</option>{library.map(item=><option value={item.id} key={item.id}>{item.t.name} ({item.page})</option>)}</select></label>
      <button type="button" disabled={!library.some(x=>x.id===selected)} onClick={()=>{const {style,typography,arrangement,sections=[]}=library.find(x=>x.id===selected).t;
        const matches=sections.filter(section=>config.sections.some(row=>row.id===section.id));
        const next=[...matches,...config.sections.filter(row=>!matches.some(section=>section.id===row.id))];
        apply({style,typography,arrangement,sections:next.length && next.every(section=>!section.visible) ? config.sections : next});}}>Apply template</button>
      {library.some(x=>x.id===selected && x.page===definition.page) && <button type="button" onClick={()=>{apply({templates:templates.filter(t=>definition.page+"PageLayout/"+t.name!==selected)});setSelected("");}}>Remove template</button>}</>}
    </fieldset>}
    <ol>{rows.map((row,index)=>{const name=nav?definition.defaultValue.items.find(item=>item.id===row.id)?.label:definition.labels?.[row.id] || (state.draft?.snapshot || state.live).domains.factions.find(f=>'faction-'+f.id===row.id)?.name || row.id; return <li key={row.id}>
      {nav?<label>{name} navigation label<input maxLength={32} value={row.label} onChange={e=>change(index,{label:e.target.value})}/></label>:<label><input type="checkbox" checked={row.visible} disabled={disabled || row.visible && rows.filter(r=>r.visible).length===1} onChange={e=>change(index,{visible:e.target.checked})}/>{name}</label>}
      {nav && <label><input type="checkbox" checked={row.visible!==false} disabled={disabled || (row.visible!==false && rows.filter(i=>i.visible!==false).length===1)} onChange={e=>change(index,{visible:e.target.checked})}/>Show {name} in navigation</label>}
      {nav ? <label>{name} menu position<select value={row.placement || "default"} onChange={e=>change(index,{placement:e.target.value})}><option value="default">Default</option><option value="primary">Main menu</option><option value="more">More menu</option></select></label>
        : <label>{name} width<select value={row.width || "standard"} onChange={e=>change(index,{width:e.target.value})}><option value="standard">Standard tile</option><option value="full">Full row</option></select></label>}
      <span className="admin-actions"><button type="button" aria-label={`Move ${name} earlier`} disabled={disabled || index===0} onClick={()=>move(index,-1)}>Earlier</button><button type="button" aria-label={`Move ${name} later`} disabled={disabled || index===rows.length-1} onClick={()=>move(index,1)}>Later</button></span>
    </li>;})}</ol>{!rows.length && <p>{creativeCopy.creativeWebsiteControls2}</p>}
  </fieldset>;
}
