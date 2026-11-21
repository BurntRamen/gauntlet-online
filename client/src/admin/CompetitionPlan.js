import {useHelp as useCreativeCopy} from "./AuthoringHelp";
const groupFor=key=>/At$/.test(key)?2:/prestige|rewards|Points|goldBudget|tiebreak|finalizationPolicy/i.test(key)?3:/Target|Limit|Attempts|Threshold|Qualif|countedResults/i.test(key)?1:0;
const groups=[['Overview & format','Name the competition and choose its supported format.'],['Entry & eligibility','Set the terms for joining and completing a run.'],['Schedule','Set registration and play times in your local timezone.'],['Rewards & scoring','Review exactly what a completed result earns.']];
export function CompetitionFields({fields,renderField,children}) {
  return <div className="competition-fields">{groups.map(([title,detail],index)=>{
    const entries=Object.entries(fields).filter(([key])=>key!=='id' && groupFor(key)===index);
    if(!entries.length && !(index===3&&children))return null;
    return <section key={title} className="competition-field-group" aria-label={title}><div className="competition-step"><span aria-hidden="true">{index+1}</span><div><h4>{title}</h4><p className="admin-note">{detail}</p></div></div><div className="competition-group-fields">{entries.map(([key,field])=>renderField(key,field))}{index===3&&children}</div></section>;
  })}</div>;
}
export function CompetitionOverview({row,dirty,draft,config,published,onInspect}) {
  const creativeCopy=useCreativeCopy();

  const season=config?.seasons?.find(item=>item.id===row.seasonId);
  const time=value=>value?new Date(value).toLocaleString(): 'Not scheduled';
  return <aside className="competition-overview" aria-label={creativeCopy.creativeCompetitionPlan1}><span className="admin-eyebrow">{dirty?'Local changes · unsaved':draft?'Saved draft definition':'Published definition'}</span><h3>{row.name || 'Your next event'}</h3><p>{row.description}</p><div className="admin-tags"><span>{row.format || row.formats?.join(' · ')}</span><span>{row.status}</span></div>{season&&<p>Season: <button type="button" onClick={()=>onInspect?.('para:seasons',season.id)}>{season.name}</button></p>}<ol className="competition-timeline">{[['Registration opens',row.registrationOpensAt],['Play starts',row.startsAt],['Entry closes',row.registrationClosesAt || row.entryClosesAt],['Play ends',row.endsAt]].map(([label,date])=><li key={label}><small>{label}</small><strong>{time(date)}</strong></li>)}</ol>{row.winTarget&&<p>{row.winTarget} wins or {row.lossLimit}{creativeCopy.creativeCompetitionPlan2}{row.scoringAttempts || row.attemptLimit}{creativeCopy.creativeCompetitionPlan3}</p>}{row.prestige&&<div className="competition-reward-ladder" aria-label="Prestige preview">{row.prestige.map((value,wins)=><span key={wins}><small>{wins} wins</small><strong>{value}</strong></span>)}</div>}<p className="admin-note">{published?creativeCopy.creativeCompetitionPlan4:creativeCopy.creativeCompetitionPlan5}</p></aside>;
}
