// Creation controls use the same limits and choices as the saved contracts.
// This describes forms only; createObject remains the mutation authority.
function creationForms(snapshot, {families=[],factions=[],editions=[],effects=[]}={}) {
  const {domains}=snapshot, sets=(domains.sets||[]).filter(row=>row.status==='active');
  const options=rows=>rows.map(row=>[row.id,row.name||row.commanderName]);
  const choice=(label,rows,defaultValue,extra={})=>({label,options:rows,defaultValue:defaultValue??rows[0]?.[0]??'',...extra});
  const text=(label,maxLength,extra={})=>({label,maxLength,required:true,defaultValue:'',...extra});
  const cardFields=require('./adminCatalog').cardFields;
  const forms={
    cards:{help:'CatalogControls4',fields:{
      setId:choice('Set',options(sets)),effectId:choice('Mechanical effect',effects.map(row=>[row.id,`${row.factionId} · ${row.cardType} · ${row.label}`]),'coin-scale-spear'),
      value:{...cardFields.value,type:'number',required:true,defaultValue:4},
      suit:choice('Fixed suit',cardFields.suit.options.map(value=>[value,value]),'spades'),
      rarity:choice('Rarity',cardFields.rarity.options.map(value=>[value,value]),'common')
    }},
    sets:{help:'CatalogControls4',fields:{}},
    assets:{name:'printing',help:'CatalogControls5',fields:{edition:choice('New printing edition',options(editions.filter(row=>row.status!=='archived')),sets[0]?.id),collectorNumber:text('Collector identifier',32,{'aria-label':'New collector identifier'})}},
    decks:{help:'CatalogControls3',fields:{factionId:choice('Faction',options(factions),'rumin',{createOnly:true})}},
    offers:{help:'CatalogControls3',fields:{templateId:choice('Recipe',[['','Choose a player template'],...options((domains.decks||[]).filter(row=>row.destinations?.player))],domains.decks?.find(row=>row.destinations?.player)?.id,{createOnly:true})}},
    encounters:{help:'encounterCreation',fields:{campaignId:choice('Campaign',options(domains.campaigns||[]),undefined,{createOnly:true})}},
    factions:{help:'factionCreation',fields:{family:choice('Rules family',options(families),undefined,{createOnly:true})}}
  };
  for(const [domain,form] of Object.entries(forms)) {
    form.name ||= domain.slice(0,-1);
    form.fields={name:text('Name',['decks','offers'].includes(domain)?80:160,{'aria-label':'New content name'}),...form.fields};
  }
  return forms;
}
function cardSets(snapshot) {
  return require('./adminPrintings').editions(snapshot).map(set => ({
    id:set.id, name:set.name,
    members:set.members || snapshot.domains.cards.filter(card => card.origin !== 'admin-v1' && set.factionIds?.includes(card.factionId)).map(card => card.id)
  }));
}
module.exports={creationForms,cardSets};
