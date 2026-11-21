// Defaults and labels come from the same field schema that validates publication.
export function pageLayout(definition,value,factions=[]) {
  const base=definition?.defaultValue || {version:1,typography:'standard',arrangement:'tiles',sections:[]};
  const sections=[...(definition?.page==='campaign'?factions.map(id=>({id:'faction-'+id,visible:true})):[]),...base.sections];
  return value?{...value,sections:[...value.sections,...sections.filter(x=>!value.sections.some(y=>y.id===x.id))]}:{...base,sections};
}
