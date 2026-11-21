import {useHelp as useCreativeCopy} from "./AuthoringHelp";
import {useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import PlayerMenus from '../navigation/PlayerMenus';
import {StaticLayoutProvider} from '../navigation/PlayerLayoutStudio';

// Same rendering tree as the player. Representative guest data never invokes
// account, matchmaking or payment services. Clicking a component selects it.
export default function WebsitePreview({page, content, selection, onSelect, device='desktop'}) {
const creativeCopy=useCreativeCopy();

  const root=useRef(null), host=useRef(null), [frame,setFrame]=useState(null), [available,setAvailable]=useState(700);
  const width=device==='mobile'?390:1280, scale=Math.min(1,available/width), height=device==='mobile'?844:900;
  useLayoutEffect(()=>{const observer=new ResizeObserver(([entry])=>setAvailable(entry.contentRect.width));observer.observe(host.current);return ()=>observer.disconnect();},[]);
  useLayoutEffect(()=>{
    if(!frame) return;
    const sync=()=>{
      frame.head.querySelectorAll('[data-player-style]').forEach(node=>node.remove());
      document.head.querySelectorAll('link[rel="stylesheet"],style').forEach(node=>{const copy=node.cloneNode(true);copy.setAttribute('data-player-style','');frame.head.appendChild(copy);});
      const cues=frame.createElement('style');cues.setAttribute('data-player-style','');cues.textContent='html,body{margin:0;min-width:0}.cd-shell :is([data-layout-module],.cd-page-header,nav){cursor:pointer;outline:1px dashed #98c8d6;outline-offset:3px}.cd-shell :is([data-layout-module],.cd-page-header,nav):is(:hover,:focus-within,[data-studio-selected]){outline:3px solid #f1cf91;outline-offset:3px}';frame.head.appendChild(cues);
    };
    sync();const observer=new MutationObserver(sync);observer.observe(document.head,{childList:true,subtree:true});return ()=>observer.disconnect();
  },[frame]);
  useLayoutEffect(()=>{
    root.current?.querySelectorAll('[data-layout-module],.cd-page-header,nav').forEach(node=>{
      node.toggleAttribute('data-studio-selected',selection===(node.dataset.layoutModule || (node.tagName==='NAV'?'navigation':'header')));
    });
  },[selection,page,content,frame]);
  const route=({"mode-practice":["play","practice"],"mode-freeForAll":["play","tables"],"mode-ranked":["compete","ranked"],"mode-draft":["draft",""],"mode-campaign":["campaign",""]})[page] || [page,""];
  const choose = event => {
    const node=event.target.closest('[data-layout-module],.cd-page-header,nav');
    if(event.target.closest('button,a,input,select') || node) { event.preventDefault(); event.stopPropagation(); onSelect(node?.dataset.layoutModule || (node?.tagName==='NAV' ? 'navigation' : 'header')); }
  };
  const noop=()=>{};
  const actions={basicAi:noop,factionAi:noop,createDuel:noop,createFreeForAll:noop,collection:noop,campaign:noop,tutorial:noop,resume:noop,roomCode:''};
  const state={ranked:{},draftQueue:{},savedDraftDecks:[],constructedDecks:[],invitations:[],completedChapters:0,packCredits:0,unread:0};
  return <div ref={host} className="website-render" style={{height:height*scale}}>
    <iframe title={`${device==='mobile'?'Mobile':'Desktop'} player page preview`} srcDoc={'<!doctype html><html lang="en"><head><title>Player page preview</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>'} onLoad={event=>setFrame(event.currentTarget.contentDocument)} style={{width,height,transform:`scale(${scale})`,transformOrigin:'top left'}}/>
    {frame && createPortal(<main ref={root} onClickCapture={choose} aria-label={creativeCopy.creativeWebsitePlayerPreview1}><StaticLayoutProvider factionIds={Object.keys(content.campaigns || {})}><PlayerMenus embedded route={{page:route[0],view:route[1]}} onNavigate={()=>onSelect('navigation')} content={content} actions={actions} state={state} slots={{}} account={null} /></StaticLayoutProvider></main>,frame.body)}
  </div>;
}
