// Save by wall clock, including slow devices and paused rendering.
export function installFlightAutosave({save,ready,doc=document,win=window,setTimer=setInterval,clearTimer=globalThis.clearInterval||(()=>{})}){
 const checkpoint=()=>{if(ready())save()};
 const hidden=()=>{if(doc.hidden)checkpoint()};
 const timer=setTimer(checkpoint,5000);timer?.unref?.();doc.addEventListener('visibilitychange',hidden);win.addEventListener('pagehide',checkpoint);win.addEventListener('blur',checkpoint);
 return()=>{clearTimer(timer);doc.removeEventListener('visibilitychange',hidden);win.removeEventListener('pagehide',checkpoint);win.removeEventListener('blur',checkpoint)};
}
