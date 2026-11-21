let dialog,lastMessage='',lastAt=0;

export function connectionErrorMessage(error){
 return String(error?.message||error||'Connection unavailable.');
}

function failedRequest(error,request,options){
 const url=new URL(request?.url||request,globalThis.location?.href);
 const method=options?.method||request?.method||'GET';
 const offline=globalThis.navigator?.onLine===false;
 const detail=offline?'This device is offline.':'The browser did not receive a response and did not report the underlying network cause.';
 return new Error(method+' '+url.origin+url.pathname+' — '+detail+' ('+connectionErrorMessage(error)+')',{cause:error});
}

export function showConnectionWarning(error){
 const message=connectionErrorMessage(error);
 if(message===lastMessage&&Date.now()-lastAt<60000)return;
 lastMessage=message;lastAt=Date.now();
 if(!dialog){
  dialog=document.createElement('dialog');dialog.id='connectionWarning';
  dialog.setAttribute('aria-labelledby','connectionWarningTitle');
  dialog.innerHTML='<h2 id="connectionWarningTitle">Uh Oh!! Something went wrong</h2><p>Check your internet connection. If your network provider blocks access, try a VPN, then refresh the page and try again.</p><p class="connectionError"></p><button type="button">Got it</button>';
  dialog.querySelector('button').onclick=()=>dialog.close();
  for(const type of ['keydown','keyup','pointerdown'])dialog.addEventListener(type,e=>e.stopPropagation());
  document.body.append(dialog);
 }
 dialog.querySelector('.connectionError').textContent='Error: '+message;
 if(!dialog.open)dialog.showModal();
}

const original=globalThis.fetch;
globalThis.fetch=async function(request,options){
 try{return await original.call(this,request,options)}catch(error){
  const url=String(request?.url||request||'');
  if(!/^https:\/\/[^/]+\.supabase\.co\//i.test(url)||error?.name==='AbortError')throw error;
  const failure=failedRequest(error,request,options);
  if(document.body.classList.contains('gameplayReady')&&document.getElementById('accountGate')?.hidden!==false&&!document.body.matches('.warping,.protoTransit'))showConnectionWarning(failure);
  throw failure;
 }
};

addEventListener('tzg-entry-connection-error',event=>showConnectionWarning(event.detail));
