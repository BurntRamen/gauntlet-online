import {pageLayout} from './websiteConfig';
export default function WebsiteControls({definition, value, onChange, disabled, state}) {
  const nav=definition.type==='website-navigation';
  const factionIds=(state.draft?.snapshot || state.live).domains.campaigns.map(c=>c.id);
  const config=nav ? value : pageLayout(definition,value,factionIds);
  const key=nav?'items':'sections', rows=config[key];
  const change=(index,patch)=>onChange({...config,[key]:rows.map((row,i)=>i===index?{...row,...patch}:row)});
  const move=(index,delta)=>{const next=[...rows]; [next[index],next[index+delta]]=[next[index+delta],next[index]]; onChange({...config,[key]:next});};
  return <fieldset disabled={disabled} className="website-controls"><legend>{nav?'Navigation labels & order':'Page presentation'}</legend>
    {!nav && <div className="admin-form-grid"><label>Type style<select aria-label="Type style" value={config.typography} onChange={e=>onChange({...config,typography:e.target.value})}><option value="standard">SuitFire standard</option><option value="editorial">Editorial headings</option><option value="plain">Plain reading</option></select></label>{rows.length>0 && <label>Section arrangement<select aria-label="Section arrangement" value={config.arrangement} onChange={e=>onChange({...config,arrangement:e.target.value})}><option value="tiles">Tiles</option><option value="list">List</option><option value="compact">Compact tiles</option></select></label>}</div>}
    <ol>{rows.map((row,index)=>{const name=nav?definition.defaultValue.items.find(item=>item.id===row.id)?.label:definition.labels?.[row.id] || (state.draft?.snapshot || state.live).domains.factions.find(f=>'faction-'+f.id===row.id)?.name || row.id; return <li key={row.id}>
      {nav?<label>{name} navigation label<input maxLength={32} value={row.label} onChange={e=>change(index,{label:e.target.value})}/></label>:<label><input type="checkbox" checked={row.visible} disabled={disabled || row.visible && rows.filter(r=>r.visible).length===1} onChange={e=>change(index,{visible:e.target.checked})}/>{name}</label>}
      <span className="admin-actions"><button type="button" aria-label={`Move ${name} earlier`} disabled={disabled || index===0} onClick={()=>move(index,-1)}>Earlier</button><button type="button" aria-label={`Move ${name} later`} disabled={disabled || index===rows.length-1} onClick={()=>move(index,1)}>Later</button></span>
    </li>;})}</ol>{!rows.length && <p>This page contains protected account controls. Its heading, artwork and type style can be edited.</p>}
  </fieldset>;
}
