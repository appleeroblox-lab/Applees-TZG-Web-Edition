export const ENTRY_FADE_MS=650;
// Reveal the ready screen and the first rendered game frame from black.
export function installGameEntryFade({doc=document,win=window,requestFrame=win.requestAnimationFrame?.bind(win)||((fn)=>setTimeout(fn,16)),setTimer=setTimeout,clearTimer=clearTimeout}={}){
 let overlay=null,timer=null,generation=0;
 const clear=()=>{if(timer!==null)clearTimer(timer);timer=null;overlay?.remove();overlay=null};
 const reveal=()=>{clear();const current=++generation,node=doc.createElement('div');node.id='gameEntryFade';node.setAttribute('aria-hidden','true');node.style.cssText='position:fixed!important;inset:0!important;z-index:2147483647!important;background:#000!important;opacity:1;pointer-events:auto;transition:opacity '+ENTRY_FADE_MS+'ms ease';overlay=node;doc.body.append(node);
  // Two frames let the Play handler remove the loading menu and render the scene.
  requestFrame(()=>{if(current!==generation)return;requestFrame(()=>{if(current!==generation)return;node.style.opacity='0';timer=setTimer(()=>{if(current===generation)clear()},ENTRY_FADE_MS)})});
 };
 const dispose=()=>{generation++;clear();win.removeEventListener('tzg-ready',reveal);win.removeEventListener('tzg-play',reveal);win.removeEventListener('pagehide',onPageHide)};
 const onPageHide=event=>{if(!event.persisted)dispose()};win.addEventListener('tzg-ready',reveal);win.addEventListener('tzg-play',reveal);win.addEventListener('pagehide',onPageHide);return {dispose};
}
