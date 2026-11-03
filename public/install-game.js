import {removeLegacyUI} from './legacy-ui.js?v=102';
export function installGameUI(win=window,doc=document){
 const more=doc.getElementById('utilityMenu');if(more&&!doc.getElementById('creditsBtn')){const button=doc.createElement('button');button.id='creditsBtn';button.type='button';button.textContent='Credits';more.append(button);const dialog=doc.createElement('dialog');dialog.id='creditsDialog';dialog.setAttribute('aria-label','Credits');dialog.innerHTML='<div class="dialogHead"><h2>Credits</h2><button type="button" aria-label="Close credits">X</button></div><dl><dt>Game designer</dt><dd>Applee</dd><dt>Game developer</dt><dd>Applee</dd><dt>Studio</dt><dd>Meowple Studios</dd></dl><a href="credits.html" target="_blank" rel="noopener noreferrer">Asset credits and licenses</a>';doc.body.append(dialog);button.onclick=()=>{more.hidden=true;if(dialog.open){dialog.close?.();return}if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','')};dialog.querySelector('button').onclick=()=>{if(dialog.close)dialog.close();else dialog.removeAttribute('open')};for(const type of ['keydown','keyup','pointerdown'])dialog.addEventListener(type,event=>event.stopPropagation());}
 removeLegacyUI(doc);const button=doc.getElementById('installGame');if(!button)return null;
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
