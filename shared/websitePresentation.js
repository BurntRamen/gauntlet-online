// Release-owned presentation only. Routes, account controls, recovery and gameplay
// remain registered in code. Old snapshots omit these optional fields entirely.
const {navigation,labels}=require('./websiteRegistry.json');
const sections=require('./websiteSections.json');
const sectionIds = (page, factionIds = []) => page === 'campaign' ? [...new Set(factionIds)].map(id => 'faction-' + id).concat(sections.campaign) : [...(sections[page] || [])];
const defaultLayout = (page, factionIds) => ({ version:1, typography:'standard', arrangement:'tiles', sections:sectionIds(page,factionIds).map(id=>({id,visible:true})) });
const defaultNavigation = () => ({version:1,items:navigation.map(([id,label])=>({id,label}))});
const exact = (value, keys) => value && !Array.isArray(value) && typeof value === 'object' && Object.keys(value).sort().join() === [...keys].sort().join();
const styleDefaults = {theme:'original',tileWidth:300,gap:16,rounding:12};
const styleKeys = Object.keys(styleDefaults);
function validStyle(s) {
  return exact(s,styleKeys) && ['original','midnight','parchment','forest'].includes(s.theme)
    && [[s.tileWidth,160,600],[s.gap,0,48],[s.rounding,0,40]].every(([v,min,max])=>Number.isInteger(v) && v>=min && v<=max);
}
function validTemplate(t) {
  const savedSections = t?.sections;
  const hasSections = Array.isArray(savedSections) && savedSections.length <= 128
    && new Set(savedSections.map(row=>row?.id)).size===savedSections.length
    && savedSections.every(row=>row && typeof row.id==='string' && /^[a-z0-9-]{1,120}$/.test(row.id) &&
      typeof row.visible==='boolean' && (exact(row,['id','visible']) || (exact(row,['id','visible','width']) && ['standard','full'].includes(row.width))));
  return (exact(t,['name','style','arrangement','typography']) || (hasSections && exact(t,['name','style','arrangement','typography','sections']))) && typeof t.name==='string' && t.name.trim()===t.name && t.name.length>0 && t.name.length<=48
    && validStyle(t.style) && ['tiles','list','compact'].includes(t.arrangement) && ['standard','editorial','plain'].includes(t.typography);
}
function errors(value, type, page, factionIds = []) {
  if(type === 'website-navigation') {
    if(!exact(value,['version','items']) || value.version!==1 || !Array.isArray(value.items) || value.items.length!==navigation.length) return ['Use the registered navigation version and all destinations.'];
    if(new Set(value.items.map(x=>x?.id)).size!==navigation.length || value.items.some(x=>(!x || typeof x!=='object' || !exact(x,['id','label',...('visible' in x?['visible']:[]),...('placement' in x?['placement']:[])]) || ('visible' in x && typeof x.visible!=='boolean') || ('placement' in x && !['default','primary','more'].includes(x.placement))) || !navigation.some(([id])=>id===x.id) || typeof x.label!=='string' || !x.label.trim() || x.label.length>32 || /[\x00-\x1f]/.test(x.label))) return ['Use each registered destination once and labels of 1–32 characters.'];
    if (!value.items.some(i=>i.visible !== false)) return ['Keep at least one menu destination visible.'];
    return [];
  }
  if (value?.version === 2) {
    if (!exact(value,['version','typography','arrangement','sections','style','templates']) || !validStyle(value.style)
        || !Array.isArray(value.templates) || value.templates.length>12 || !value.templates.every(validTemplate)
        || new Set(value.templates.map(t=>t.name.toLowerCase())).size!==value.templates.length) return ['Check the presentation style, tile dimensions and saved template names.'];
    return errors({version:1,typography:value.typography,arrangement:value.arrangement,sections:value.sections},type,page,factionIds);
  }
  if(!exact(value,['version','typography','arrangement','sections']) || value.version!==1 || !['standard','editorial','plain'].includes(value.typography) || !['tiles','list','compact'].includes(value.arrangement) || !Array.isArray(value.sections)) return ['Choose an approved type style and section arrangement.'];
  const allowed=sectionIds(page,factionIds);
  if(value.sections.length>allowed.length || new Set(value.sections.map(x=>x?.id)).size!==value.sections.length || value.sections.some(x=>(!exact(x,['id','visible']) && !(exact(x,['id','visible','width']) && ['standard','full'].includes(x.width))) || !allowed.includes(x.id) || typeof x.visible!=='boolean')) return ['Sections must be unique registered page components with a visibility choice.'];
  // New registered sections remain visible when an older release has no override.
  if(allowed.length && value.sections.length===allowed.length && value.sections.every(x=>!x.visible)) return ['Keep at least one page section visible.'];
  return [];
}
function layoutFor(page, value, factionIds=[]) {
  const base=defaultLayout(page,factionIds);
  if(!value || errors(value,'website-layout',page,factionIds).length) return base;
  return {...value,sections:[...value.sections,...base.sections.filter(x=>!value.sections.some(y=>y.id===x.id))]};
}
module.exports={styleDefaults,navigation,sections,labels,sectionIds,defaultLayout,defaultNavigation,errors,layoutFor};
