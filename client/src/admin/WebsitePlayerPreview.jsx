import PlayerMenus from '../navigation/PlayerMenus';
import {StaticLayoutProvider} from '../navigation/PlayerLayoutStudio';

// Same rendering tree as the player. Representative guest data never invokes
// account, matchmaking or payment services. Clicking a component selects it.
export default function WebsitePreview({page, content, onSelect}) {
  const route=({"mode-practice":["play","practice"],"mode-freeForAll":["play","tables"],"mode-ranked":["compete","ranked"],"mode-draft":["draft",""],"mode-campaign":["campaign",""]})[page] || [page,""];
  const choose = event => {
    const node=event.target.closest('[data-layout-module],.cd-page-header,nav');
    if(event.target.closest('button,a,input,select') || node) { event.preventDefault(); event.stopPropagation(); onSelect(node?.dataset.layoutModule || (node?.tagName==='NAV' ? 'navigation' : 'header')); }
  };
  const noop=()=>{};
  const actions={basicAi:noop,factionAi:noop,createDuel:noop,createFreeForAll:noop,collection:noop,campaign:noop,tutorial:noop,resume:noop,roomCode:''};
  const state={ranked:{},draftQueue:{},savedDraftDecks:[],constructedDecks:[],invitations:[],completedChapters:0,packCredits:0,unread:0};
  return <div className="website-render" onClickCapture={choose} aria-label="Representative player page">
    <StaticLayoutProvider factionIds={Object.keys(content.campaigns || {})}><PlayerMenus embedded route={{page:route[0],view:route[1]}} onNavigate={()=>onSelect('navigation')} content={content} actions={actions} state={state} slots={{}} account={null} /></StaticLayoutProvider>
  </div>;
}
