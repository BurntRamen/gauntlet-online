// Release-owned presentation only. Routes, account controls, recovery and gameplay
// remain registered in code. Old snapshots omit these optional fields entirely.
const {navigation,labels}=require('./websiteRegistry.json');
const sections=require('./websiteSections.json');
const sectionIds = (page, factionIds = []) => page === 'campaign' ? [...new Set(factionIds)].map(id => 'faction-' + id).concat(sections.campaign) : [...(sections[page] || [])];
const defaultLayout = (page, factionIds) => ({ version:1, typography:'standard', arrangement:'tiles', sections:sectionIds(page,factionIds).map(id=>({id,visible:true})) });
const defaultNavigation = () => ({version:1,items:navigation.map(([id,label])=>({id,label}))});
const exact = (value, keys) => value && !Array.isArray(value) && typeof value === 'object' && Object.keys(value).sort().join() === [...keys].sort().join();
function errors(value, type, page, factionIds = []) {
  if(type === 'website-navigation') {
    if(!exact(value,['version','items']) || value.version!==1 || !Array.isArray(value.items) || value.items.length!==navigation.length) return ['Use the registered navigation version and all destinations.'];
    if(new Set(value.items.map(x=>x?.id)).size!==navigation.length || value.items.some(x=>!exact(x,['id','label']) || !navigation.some(([id])=>id===x.id) || typeof x.label!=='string' || !x.label.trim() || x.label.length>32 || /[\x00-\x1f]/.test(x.label))) return ['Use each registered destination once and labels of 1–32 characters.'];
    return [];
  }
  if(!exact(value,['version','typography','arrangement','sections']) || value.version!==1 || !['standard','editorial','plain'].includes(value.typography) || !['tiles','list','compact'].includes(value.arrangement) || !Array.isArray(value.sections)) return ['Choose an approved type style and section arrangement.'];
  const allowed=sectionIds(page,factionIds);
  if(value.sections.length>allowed.length || new Set(value.sections.map(x=>x?.id)).size!==value.sections.length || value.sections.some(x=>!exact(x,['id','visible']) || !allowed.includes(x.id) || typeof x.visible!=='boolean')) return ['Sections must be unique registered page components with a visibility choice.'];
  // New registered sections remain visible when an older release has no override.
  if(allowed.length && value.sections.length===allowed.length && value.sections.every(x=>!x.visible)) return ['Keep at least one page section visible.'];
  return [];
}
function layoutFor(page, value, factionIds=[]) {
  const base=defaultLayout(page,factionIds);
  if(!value || errors(value,'website-layout',page,factionIds).length) return base;
  return {...value,sections:[...value.sections,...base.sections.filter(x=>!value.sections.some(y=>y.id===x.id))]};
}
module.exports={navigation,sections,labels,sectionIds,defaultLayout,defaultNavigation,errors,layoutFor};
