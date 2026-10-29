import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {authenticateFirst,takePreAuthClient} from '../public/auth-first.js';
globalThis.location={hash:'',origin:'https://game.test',pathname:'/'};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
for(const stage of ['sdk','session','user']){
 const {document,window}=parseHTML('<html><body></body></html>');let release;
 const stalled=new Promise(resolve=>release=resolve);const client={rpc:async()=>({}),auth:{getSession:()=>stage==='session'?stalled:Promise.resolve({data:{session:stage==='user'?{}:null}}),getUser:()=>stalled}};
 let loaded=false;const boot=authenticateFirst({doc:document,config:{},requestSDK:()=>stage==='sdk'?stalled:Promise.resolve({createClient:()=>client})}).then(()=>loaded=true);
 await tick();document.querySelector('#accountGuest').onclick();await tick();assert(loaded,stage+' connection cannot block guest loading');await boot;assert(document.querySelector('#accountGate').hidden);assert(document.body.classList.contains('authenticatedBoot'));
 release(stage==='sdk'?{createClient:()=>client}:stage==='session'?{data:{session:{}}}:{data:{user:{id:'late-member'}}});await tick();assert(document.querySelector('#accountGate').hidden,'late connection must not reopen the gate');assert(document.querySelector('#accountConnected').hidden,'late member response must not replace guest choice');takePreAuthClient();delete globalThis.__tzgGuest;
}
console.log('PASS guest boot bypasses stalled SDK, session refresh and user verification, and ignores late member responses.');
