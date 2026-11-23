import {menuMotion} from './menu-motion.js?v=187';
import {supabaseConfig} from './supabase-config.js';
export const CLIENT_VERSION='v0.0.281';
export function semanticVersion(value){const s=String(value??'');if(/^v?\d+\.\d+\.\d+$/.test(s))return 'v'+s.replace(/^v/,'');if(/^\d+$/.test(s))return 'v0.0.'+s;return null}
const installed=new WeakMap();
export function installRuntimeVersions(doc=document,fetcher=globalThis.fetch){
 if(installed.has(doc)){installed.get(doc).refresh();return installed.get(doc)}const client=CLIENT_VERSION;let backend='—';
 const draw=()=>{for(const node of [doc.querySelector('.entryRelease'),doc.getElementById('runtimeVersions')].filter(Boolean)){node.textContent='Client Version: '+client+' · Backend Version: '+backend;node.setAttribute('aria-label',node.textContent)}};
 draw();const read=async(url,options)=>{const control=new AbortController(),timer=setTimeout(()=>control.abort(),8000);try{const response=await fetcher(url,{...options,signal:control.signal});if(!response.ok)throw Error('Version unavailable');return await response.json()}finally{clearTimeout(timer)}};
 const ready=Promise.allSettled([
  read(supabaseConfig.url+'/rest/v1/rpc/tzg_backend_version',{method:'POST',headers:{apikey:supabaseConfig.publishableKey,'Content-Type':'application/json'},body:'{}'}).then(m=>{backend=semanticVersion(m.version)||'—';draw()})
 ]);const state={ready,refresh:draw};installed.set(doc,state);return state;
}

export function installUpdateCheck({
 doc=document,fetcher=globalThis.fetch,playerName=()=>'',refreshGame=()=>location.reload(),
 interval=5000,schedule=globalThis.setInterval
}={}){
 let checking=false,version=null,dialog=null,notice=null,notes=null;
 function switchPanel(from,to){
  if(from.inert)return;
  from.inert=true;
  menuMotion(from,false,()=>{
   from.hidden=true;
   to.inert=false;
   menuMotion(to,true);
   to.querySelector('button')?.focus({preventScroll:true});
  });
 }
 function show(){
  if(!dialog){
   dialog=doc.createElement('dialog');
   dialog.id='newUpdateDialog';
   dialog.setAttribute('aria-label','New Update');
   dialog.innerHTML='<section class="newUpdateCard"><h2>New Update</h2><p data-message></p><div class="newUpdateActions"><button type="button" data-refresh>Refresh Game</button><button type="button" data-list>Update Lists</button></div><p data-status role="status" hidden></p></section><section class="newUpdateCard" hidden><header><h2>New Update Lists</h2><button type="button" data-back aria-label="Close update lists">×</button></header><ul data-notes></ul></section>';
   [notice,notes]=dialog.querySelectorAll('section');
   dialog.addEventListener('cancel',event=>event.preventDefault());
   dialog.addEventListener('keydown',event=>event.stopPropagation());
   doc.body.append(dialog);
   const list=dialog.querySelector('[data-notes]');
   const refresh=dialog.querySelector('[data-refresh]');
   refresh.onclick=async()=>{
    refresh.disabled=true;
    try{
     if(await refreshGame()===false)throw Error('Could not save your progress. Try refreshing again.');
    }catch(error){
     const status=dialog.querySelector('[data-status]');
     status.textContent=error.message;status.hidden=false;refresh.disabled=false;
    }
   };
   dialog.querySelector('[data-list]').onclick=async()=>{
    const item=doc.createElement('li');
    item.textContent='Loading update lists…';
    list.replaceChildren(item);
    switchPanel(notice,notes);
    try{
     const response=await fetcher('./NewUpdateFile.txt',{cache:'no-store'});
     if(!response.ok)throw Error('Update lists unavailable.');
     const lines=(await response.text()).trim().split(/\r?\n/);
     if(semanticVersion(lines.shift())!==version||!lines.some(line=>line.trim()))throw Error('Update lists unavailable for '+version+'.');
     list.replaceChildren(...lines.filter(line=>line.trim()).map(line=>{
      const row=doc.createElement('li');row.textContent=line.replace(/^\s*-\s*/, '');return row;
     }));
    }catch(error){item.textContent=error.message||'Update lists unavailable.';}
   };
   dialog.querySelector('[data-back]').onclick=()=>switchPanel(notes,notice);
   if(typeof dialog.showModal==='function')dialog.showModal();
   else dialog.setAttribute('open','');
   menuMotion(notice,true);
  }
  dialog.querySelector('[data-message]').textContent='Hello '+(playerName().trim()||'Player')+', new update '+version+' is available. Please refresh the game to update.';
 }
 async function check(){
  if(checking)return;
  checking=true;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),4500);
  try{
   const response=await fetcher('./source-manifest.json',{cache:'no-store',signal:controller.signal});
   if(!response.ok)return;
   const manifest=await response.json();
   const active=semanticVersion(manifest.clientVersion??manifest.version);
   if(active&&active!==CLIENT_VERSION&&active!==version){version=active;show();}
  }catch{/* Retry on the next check. */}
  finally{clearTimeout(timeout);checking=false;}
 }
 schedule?.(check,interval)?.unref?.();
 return {check};
}
