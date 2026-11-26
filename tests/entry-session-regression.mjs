import {acceptRules} from './rules-helper.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseHTML} from 'linkedom';
import {authenticateFirst,takePreAuthClient} from '../public/auth-first.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
globalThis.location={hash:'',origin:'https://game.test',pathname:'/'};
const {document}=parseHTML('<html><body class="referenceHUD"></body></html>');
let session={user:{id:'remembered-user'}},releaseSignOut,loaded=false;
const client={rpc:async()=>({}),auth:{
 getSession:async()=>({data:{session}}),getUser:async()=>({data:{user:session?.user}}),
 signOut:()=>new Promise(resolve=>releaseSignOut=()=>{session=null;resolve({})}),
 signInWithPassword:async()=>{session={user:{id:'new-user'}};return {data:{session}}}
}};
const boot=authenticateFirst({doc:document,config:{},requestSDK:async()=>({createClient:()=>client})}).then(()=>loaded=true);
await tick();const $=id=>document.getElementById(id),gate=$('accountGate');
assert(!$('accountConnected').hidden);
acceptRules(document);
const logout=$('accountGateLogout').onclick();
$('accountContinue').onclick();await tick();assert(!loaded,'Continue cannot race sign-out');
releaseSignOut();await logout;
assert($('accountConnected').hidden);assert($('accountContinue').hidden);assert($('accountGateLogout').hidden);
assert.equal(gate.dataset.entry,'welcome');assert(!$('accountForm').hidden);
$('accountContinue').onclick();await tick();assert(!loaded,'stale Continue cannot enter after sign-out');
$('accountEmailLogin').click();assert(!$('accountForm').hidden);assert($('accountConnected').hidden);
$('accountEmail').value='new@example.test';$('accountPassword').value='new-password-123';
await $('accountForm').onsubmit({preventDefault(){}});await tick();await boot;
assert(loaded);assert(gate.hidden);assert.equal(takePreAuthClient(),client);
// Check actual display selectors, including the themed selector that previously
// defeated [hidden] because it had higher specificity.
const css=fs.readFileSync('public/entry-menu.css','utf8');
for(const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
 if(!/display\s*:\s*(?:flex|grid|block)\s*!important/.test(match[2]))continue;
 for(const selector of match[1].replace(/\/\*[\s\S]*?\*\//g,'').split(',')){
  assert(!gate.matches(selector.trim()),'hidden gate must not match a forced visible rule: '+selector);
 }
}
console.log('PASS remembered account → pending sign-out → welcome → fresh login → hidden game gate; stale Continue rejected and themed CSS honors hidden.');

for(const restored of [true,false]){
 const {document}=parseHTML('<html><body></body></html>');
 const $=id=>document.getElementById(id),user={id:'warned-player'};
 let session=restored?{user}:null,warning={kind:'warn',id:'42',reason:'Spam: repeated messages',decided_at:'2026-11-26T00:00:00Z'};
 let signOuts=0,acks=0,started=false;
 const client={
  rpc:async(name,args)=>{
   if(name==='tzg_player_moderation')return {data:warning};
   if(name==='tzg_player_acknowledge_warning'){assert.equal(args.p_warning,'42');acks++}
   return {};
  },
  auth:{
   getSession:async()=>({data:{session}}),getUser:async()=>({data:{user}}),
   signInWithPassword:async()=>({data:{session:session={user}}}),
   signOut:async({scope})=>{assert.equal(scope,'local');signOuts++;session=null;warning=null;return {}}
  }
 };
 const boot=authenticateFirst({doc:document,config:{},requestSDK:async()=>({createClient:()=>client})}).then(()=>started=true);
 await tick();
 const login=async()=>{
  $('accountEmail').value='warned@example.test';
  $('accountPassword').value='test-password';
  await $('accountForm').onsubmit({preventDefault(){}});
  await tick();
 };
 if(!restored){acceptRules(document);$('accountEmailLogin').click();await login()}
 assert.equal(started,false);
 assert.equal(acks,1, String(restored)+' '+$('accountStatus').textContent);
 assert.equal(signOuts,1, String(restored)+' '+$('accountStatus').textContent);
 assert(!$('accountModeration').hidden&&$('accountForm').hidden);
 assert.equal($('moderationReason').textContent,'Spam: repeated messages');
 assert.equal($('accountModerationRetry').textContent,'Back to sign in');
 $('accountModerationRetry').onclick();
 assert($('accountModeration').hidden&&!$('accountForm').hidden);
 if(!$('accountRulesAccepted').checked)acceptRules(document);
 await login();
 await boot;
 assert.equal(takePreAuthClient(),client);
}
const accountCss=fs.readFileSync('public/account.css','utf8');
assert.match(accountCss,/#accountGate:has\(#accountModeration:not\(\[hidden\]\)\) \.entryRules\{display:none!important\}/);
console.log('PASS restored and manual sign-in show an offline warning before gameplay and permit sign-in again.');
