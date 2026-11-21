const additional = (snapshot, campaign) => snapshot.domains.encounters.filter(row => row.origin === 'admin-encounter-v1' && row.campaignId === campaign.id).sort((a,b)=>a.order-b.order);
const ordered = (snapshot, campaign) => [...campaign.encounterIds, ...additional(snapshot,campaign).filter(row=>row.status==='active').map(row=>row.id)];
module.exports={additional,ordered};
