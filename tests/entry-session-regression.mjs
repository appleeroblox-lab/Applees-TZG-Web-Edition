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
$('accountRulesAccepted').checked=true;$('accountRulesAccepted').onchange();
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
