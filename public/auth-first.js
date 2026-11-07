import {AccountAuthFlow} from './account-auth-flow.js?v=184';
import {accountGate} from './account-gate.js?v=163';
import {supabaseConfig} from './supabase-config.js?v=61';
let authenticatedClient=null;
export function takePreAuthClient(){const client=authenticatedClient;authenticatedClient=null;return client}
export async function authenticateFirst({doc=document,config=supabaseConfig,requestSDK=()=>import('./vendor/supabase.js?v=62')}={}){
 const root=accountGate(doc);root.hidden=false;root.dataset.preload='true';
 const form=root.querySelector('form'),status=root.querySelector('#accountStatus'),submit=root.querySelector('#accountSubmit'),continueButton=root.querySelector('#accountContinue'),signOut=root.querySelector('#accountGateLogout');const field=name=>root.querySelector('#'+({username:'accountUsername',display_name:'accountName',email:'accountEmail',password:'accountPassword',confirm:'accountConfirm'}[name]));let mode='login',busy=false,selected=false,client,resolveBoot;const recoveryRequested=new URLSearchParams(location.hash.slice(1)).get('type')==='recovery';
 let flow;
 const setMode=next=>{root.querySelector('#accountConnected').hidden=true;form.hidden=false;continueButton.hidden=signOut.hidden=true;flow.setMode(next)};
 const done=new Promise(resolve=>{resolveBoot=resolve;continueButton.onclick=()=>{if(selected)return;selected=true;authenticatedClient=client||null;root.hidden=true;delete root.dataset.preload;doc.body.classList.add('authenticatedBoot');resolve()};});
 flow=new AccountAuthFlow({root,client:()=>client,onSuccess:async()=>continueButton.onclick()});
 root.querySelector('#accountGuest').onclick=()=>{if(busy||flow.busy||selected)return;selected=true;globalThis.__tzgGuest=true;authenticatedClient=client||null;root.hidden=true;delete root.dataset.preload;doc.body.classList.add('authenticatedBoot');resolveBoot()};
 function showContinue(){root.querySelector('#accountConnected').hidden=false;root.querySelector('#accountRetry').hidden=true;root.querySelector('#accountReload').hidden=true;form.hidden=true;root.querySelector('nav').hidden=true;continueButton.hidden=signOut.hidden=false;root.querySelector('#accountForgot').hidden=true;}
 signOut.onclick=async()=>{if(busy)return;busy=true;try{const{error}=await client.auth.signOut({scope:'local'});if(error)throw error;root.querySelector('nav').hidden=false;setMode('login')}catch(e){status.textContent=e.message}finally{busy=false}};
 status.textContent='Connecting to your account…';
 try{const sdk=await Promise.race([requestSDK(),done.then(()=>null)]);if(selected)return done;const{createClient}=sdk;client=createClient(config.url,config.publishableKey,{auth:{storageKey:'tzg-player-session-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},global:{fetch:async(url,options={})=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000),cancel=()=>controller.abort();options.signal?.addEventListener('abort',cancel,{once:true});try{return await fetch(url,{...options,signal:controller.signal})}finally{clearTimeout(timer);options.signal?.removeEventListener('abort',cancel)}}}});try{const storage=doc.defaultView?.localStorage||globalThis.localStorage;const visitor=storage?.getItem('tzg-visitor-id')||crypto.randomUUID();storage?.setItem('tzg-visitor-id',visitor);Promise.resolve(client.rpc('tzg_visit',{p_visitor:visitor})).catch(()=>{})}catch{}const sessionResult=await Promise.race([client.auth.getSession(),done.then(()=>null)]);if(selected)return done;const{data,error}=sessionResult;if(error)throw error;
  if(data?.session){const userResult=await Promise.race([client.auth.getUser(),done.then(()=>null)]);if(selected)return done;const{data:user,error:userError}=userResult;if(userError||!user?.user)throw userError||Error('Please sign in again.');if(recoveryRequested){setMode('recovery');status.textContent='Choose a new password before loading the game.'}else{status.textContent='Signed in. Continue to load your game.';showContinue()}}
  else setMode('login');
 }catch(error){if(!selected){status.textContent=error.message||'Could not connect. Reload to retry.';submit.disabled=!client;}}
 return done;
}
