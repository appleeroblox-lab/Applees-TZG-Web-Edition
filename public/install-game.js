export function installGameUI(win=window,doc=document){
 const button=doc.getElementById('installGame');if(!button)return null;
 const storage=(()=>{try{return win.localStorage}catch{return null}})(),standalone=()=>win.matchMedia?.('(display-mode: standalone)')?.matches||win.navigator?.standalone===true;
 let deferred=null,installed=standalone(),signed=false,invited=false,busy=false;
 const dialog=doc.createElement('dialog');dialog.id='installGameDialog';dialog.className='cargoDialog';dialog.innerHTML='<div class="dialogHead"><h2>Install Game</h2><button type="button" aria-label="Close install">×</button></div><p>Keep The Zero Gravity on your home screen and open it like an app.</p><p id="installGameHelp" role="status"></p><div class="sessionActions"><button type="button" id="confirmInstallGame" class="primary">Install Game</button><button type="button" id="skipInstallGame">Not now</button></div>';doc.body.append(dialog);
 const help=dialog.querySelector('#installGameHelp'),confirm=dialog.querySelector('#confirmInstallGame');
 const instructions=()=>/iPad|iPhone|iPod/.test(win.navigator?.userAgent||'')?'Use your browser’s Share menu, then Add to Home Screen.':'Open your browser menu and choose Install app or Add to Home screen. If this is an in-app browser, open the game in Chrome or another supported browser.';
 const refresh=()=>{button.textContent=installed?'Game Installed':'Install Game';button.disabled=installed||busy;confirm.disabled=busy||installed;confirm.hidden=!deferred;help.textContent=installed?'The game is installed.':deferred?'Tap Install Game to open your browser’s install dialog.':instructions()};
 const close=()=>{if(dialog.open)dialog.close();else dialog.removeAttribute('open')};
 const show=()=>{if(installed)return;refresh();if(!dialog.open){if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','')}};
 const dismiss=()=>{try{storage?.setItem('tzg-install-remind-after',String(Date.now()+7*86400000))}catch{}close()};
 const invite=()=>{if(!signed||invited||installed||win.__loadingSources)return;let remind=0;try{remind=Number(storage?.getItem('tzg-install-remind-after'))||0}catch{}if(Date.now()<remind)return;invited=true;show()};
 const prompt=async()=>{if(installed||busy)return;if(!deferred){show();return}const event=deferred;deferred=null;busy=true;refresh();try{await event.prompt();const choice=await event.userChoice;if(choice?.outcome==='accepted'){installed=true;close()}else dismiss()}catch{deferred=event;help.textContent='Tap Install Game again, or use your browser menu.';show()}finally{busy=false;refresh()}};
 const available=event=>{event.preventDefault();deferred=event;refresh();invite()};
 const onInstalled=()=>{installed=true;deferred=null;close();refresh()};
 const onSigned=()=>{signed=true;invite()};
 button.onclick=()=>deferred?prompt():show();confirm.onclick=prompt;dialog.querySelector('#skipInstallGame').onclick=dismiss;dialog.querySelector('.dialogHead button').onclick=dismiss;dialog.addEventListener('cancel',dismiss);
 win.addEventListener('beforeinstallprompt',available);win.addEventListener('appinstalled',onInstalled);win.addEventListener('tzg-signed-in',onSigned);win.addEventListener('tzg-ready',invite);refresh();
 return {dialog,dispose(){win.removeEventListener('beforeinstallprompt',available);win.removeEventListener('appinstalled',onInstalled);win.removeEventListener('tzg-signed-in',onSigned);win.removeEventListener('tzg-ready',invite);dialog.remove();button.onclick=null}};
}
