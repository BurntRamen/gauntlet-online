import {useEffect,useRef} from 'react';
const controls=root=>[...(root?.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),audio,summary,[tabindex="0"]')||[])].filter(node=>!node.closest('[hidden]')&&(!node.closest('details:not([open])')||node.tagName==='SUMMARY'));
export function modalKeys(event,root,close) {
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close?.();}
  if(event.key==='Tab'){
    const items=controls(root),first=items[0],last=items.at(-1);
    if(!first){event.preventDefault();return;}
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
}
export default function useModal(root,{enabled=true,focus,restore,close,contain=false,lock=false}={}) {
  const latest=useRef(null);latest.current={focus,restore,close};
  useEffect(()=>{
    if(!enabled)return;
    const trigger=document.activeElement,overflow=document.body.style.overflow;
    const first=()=> (latest.current.focus?.()||controls(root.current)[0])?.focus({preventScroll:true});
    const keep=event=>{if(root.current&&!root.current.contains(event.target))first();};
    const keyboard=event=>{if(!event.defaultPrevented&&[...document.querySelectorAll('[aria-modal="true"]')].at(-1)===root.current)modalKeys(event,root.current,latest.current.close);};
    first();if(lock)document.body.style.overflow='hidden';if(contain)document.addEventListener('focusin',keep);document.addEventListener('keydown',keyboard);
    return ()=>{document.removeEventListener('keydown',keyboard);document.removeEventListener('focusin',keep);if(lock)document.body.style.overflow=overflow;const target=latest.current.restore?latest.current.restore():trigger;if(target?.isConnected)target.focus();};
  },[root,enabled,contain,lock]);
}
