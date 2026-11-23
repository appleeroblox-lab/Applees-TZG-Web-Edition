import {supabaseConfig} from './supabase-config.js';
export const CLIENT_VERSION='v0.0.268';
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
