export const ENTRY_FADE_MS=650;
// Reveal the ready screen and the first rendered game frame from black.
export function installGameEntryFade({doc=document,win=window,requestFrame=win.requestAnimationFrame?.bind(win)||((fn)=>setTimeout(fn,16)),setTimer=setTimeout,clearTimer=clearTimeout}={}){
 let overlay=null,timer=null,generation=0,revealing=false;
 const clear=()=>{revealing=false;if(timer!==null)clearTimer(timer);timer=null;overlay?.remove();overlay=null};
 const cover=()=>{generation++;clear();const node=doc.createElement('div');node.id='gameEntryFade';node.setAttribute('aria-hidden','true');node.style.cssText='position:fixed!important;inset:0!important;z-index:2147483647!important;background:#000!important;opacity:1;pointer-events:auto;transition:opacity '+ENTRY_FADE_MS+'ms ease';overlay=node;doc.body.append(node);return node};
 const reveal=()=>{const node=overlay||cover(),current=++generation;
  if(timer!==null)clearTimer(timer);
  revealing=true;
  requestFrame(()=>{if(current!==generation)return;requestFrame(()=>{if(current!==generation)return;node.style.opacity='0';timer=setTimer(()=>{if(current===generation)clear()},ENTRY_FADE_MS)})});
 };
 const ready=()=>{cover();reveal()};
 const cancel=()=>{generation++;clear()};
 const revealHome=()=>{if(overlay)reveal()};
 const resume=()=>{if(!doc.hidden&&revealing&&overlay?.style.opacity==='1')reveal()};
 const listeners=[['tzg-ready',ready],['tzg-play',ready],['tzg-home-loading',cover],['tzg-home-ready',revealHome],['tzg-signed-out',cancel],['pageshow',resume]];
 const dispose=()=>{cancel();for(const [event,handler] of listeners)win.removeEventListener(event,handler);win.removeEventListener('pagehide',onPageHide);doc.removeEventListener('visibilitychange',resume)};
 const onPageHide=event=>{if(!event.persisted)dispose()};
 for(const [event,handler] of listeners)win.addEventListener(event,handler);
 win.addEventListener('pagehide',onPageHide);
 doc.addEventListener('visibilitychange',resume);
 return {dispose};
}
