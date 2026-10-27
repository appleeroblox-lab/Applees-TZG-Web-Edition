export function installGameUI(win=window,doc=document){
 const button=doc.getElementById('installGame');if(!button)return null;
 const standalone=()=>win.matchMedia?.('(display-mode: standalone)')?.matches||win.navigator?.standalone===true;
 let deferred=null,installed=standalone(),signed=false,attempted=false,busy=false;
 const refresh=()=>{button.textContent=installed?'Game Installed':'Install Game';button.disabled=installed||busy;button.title=deferred?'Install this game':/iPad|iPhone|iPod/.test(win.navigator?.userAgent||'')?'Share → Add to Home Screen':'Browser menu → Install app / Add to Home screen'};
 const prompt=async()=>{if(installed||busy||!deferred)return;const event=deferred;deferred=null;busy=true;attempted=true;refresh();try{await event.prompt();const choice=await event.userChoice;if(choice?.outcome==='accepted')installed=true}catch{deferred=event}finally{busy=false;refresh()}};
 const maybeAuto=()=>{if(signed&&!attempted&&!installed&&!win.__loadingSources&&win.navigator?.userActivation?.isActive)return prompt()};
 const available=event=>{event.preventDefault();deferred=event;refresh();maybeAuto()};
 const onInstalled=()=>{installed=true;deferred=null;refresh()};
 const onSigned=()=>{signed=true;maybeAuto()};
 const onGesture=event=>{if(event.isTrusted===false)return;if(signed&&!attempted&&!win.__loadingSources)return prompt()};
 button.onclick=prompt;
 win.addEventListener('beforeinstallprompt',available);win.addEventListener('appinstalled',onInstalled);win.addEventListener('tzg-signed-in',onSigned);win.addEventListener('tzg-ready',maybeAuto);doc.addEventListener('click',onGesture,true);refresh();
 return {dispose(){win.removeEventListener('beforeinstallprompt',available);win.removeEventListener('appinstalled',onInstalled);win.removeEventListener('tzg-signed-in',onSigned);win.removeEventListener('tzg-ready',maybeAuto);doc.removeEventListener('click',onGesture,true);button.onclick=null}};
}
