import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {DebugMenu} from '../public/debug-menu.js?v=103';
import {SupabaseDebugService} from '../public/supabase-debug.js';
const {window,document}=parseHTML('<html><body><button id="debugMenuBtn">Debug</button></body></html>');
globalThis.document=document;globalThis.addEventListener=window.addEventListener.bind(window);
globalThis.innerWidth=844;globalThis.innerHeight=390;
window.Element.prototype.getBoundingClientRect=()=>({left:20,top:70,width:500,height:300});
let allowed=true,executions=0;
const response=(value,status=200)=>({ok:status===200,status,json:async()=>value});
const authorization=new SupabaseDebugService({url:'https://example.supabase.co',publishableKey:'sb_publishable_test'},async(url,options)=>{
 if(url.includes('/token?')){assert.deepEqual(JSON.parse(options.body),{email:'dev@example.test',password:'test-only-password'});return response({access_token:'test-only-token',expires_in:3600})}
 if(url.includes('/logout?'))return response({});
 return allowed?response({authorized:true}):response({message:'Developer access denied.'},403);
});
const menu=new DebugMenu({closeSettings(){},clearInputs(){},snapshot:()=> 'Earth',execute(){executions++;return 'Stopped'},authorization,request(){throw Error('Static game must not call /api/debug')}});
const $=id=>document.getElementById(id);
await menu.open();assert(!$('debugEmailRow').hidden);assert($('debugEmail').required);assert($('debugConfirmRow').hidden);assert(!$('debugUnlock').disabled);assert.equal($('debugCodeLabel').textContent,'Developer password');
$('debugEmail').value='dev@example.test';$('debugCode').value='test-only-password';await menu.unlock();assert(menu.active);assert.equal($('debugCode').value,'');assert(!$('debugSignOut').hidden);
await menu.run('stop');assert.equal(executions,1);
await menu.close();assert(menu.active);await menu.open();assert(!$('debugContent').hidden);
allowed=false;await menu.run('stop');assert.equal(executions,1,'revoked user cannot execute another command');assert(!menu.active);assert(!$('debugAuth').hidden);
allowed=true;$('debugCode').value='test-only-password';await menu.unlock();assert(menu.active);
await $('debugSignOut').onclick();assert(!menu.active);assert.equal(authorization.token,null);assert(!$('debugAuth').hidden);
console.log('PASS UI: Supabase email/password form, cleared password, authorized commands, close/reopen, revoked-account lock and explicit sign out without static API calls.');
