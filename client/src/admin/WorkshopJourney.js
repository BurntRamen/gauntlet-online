import {useContext} from "react";
import {EditorSessionContext} from "./EditorSession";
import {useHelp} from "./AuthoringHelp";

export default function WorkshopJourney({selection, browsing, sections, section, onSection, preview, showPreview, onPreview, container}) {
  const session=useContext(EditorSessionContext), copy=useHelp().journey, journey=session?.journey;
  if(!copy || !journey || journey.saveShown) return null;
  const mode=!selection || browsing?'choose':journey.blocked?'blocked':journey.creating?'create':journey.dirty?'save':journey.issue?'fix':journey.draft?'saved':'edit';
  const next=sections?.[sections.findIndex(([id])=>id===section)+1];
  const describe=['edit','saved'].includes(mode);
  const detail=describe ? copy.domains[session.target.domain] || copy.sections[section] || copy[mode][1] : copy[mode][1];
  const goToSave=()=>{
    const root=container.current;
    const invalid=[...root.querySelectorAll('input,select,textarea')].find(el=>!el.disabled && el.getClientRects().length && !el.validity.valid);
    const submit=root.querySelector('button[type="submit"],form button:not([type])');
    const target=invalid || (submit?.disabled?submit.closest('form'):submit) || root.querySelector('form');
    if(target){if(target.tagName==='FORM')target.tabIndex=-1;target.scrollIntoView({block:'center'});target.focus();}
  };
  const action=mode==='save'?[copy.saveAction,goToSave]:mode==='fix'?[copy.fixAction,journey.fix]:describe && preview && !showPreview?[copy.preview,onPreview]:describe && next?[copy.next+' '+next[1],()=>onSection(next[0])]:describe && journey.draft?[copy.review,journey.review]:null;
  return <section className="admin-journey" data-state={mode} aria-label={copy.label}>
    <span className="admin-journey-symbol" aria-hidden="true">{mode==='saved'?'✓':['blocked','fix'].includes(mode)?'!':'◇'}</span>
    <div><small>{copy.label}</small><strong>{copy[mode][0]}</strong><p>{mode==='fix'?journey.issue.message:detail}</p></div>
    {action && <button type="button" disabled={journey.busy} className="admin-primary" onClick={action[1]}>{action[0]}</button>}
  </section>;
}
