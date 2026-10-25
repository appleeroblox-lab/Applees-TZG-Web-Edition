import assert from 'node:assert/strict';
import {SupabaseDebugService} from '../public/supabase-debug.js';

const config={url:'https://example.supabase.co',publishableKey:'sb_publishable_test'};
const response=(value,status=200)=>({ok:status>=200&&status<300,status,json:async()=>value});
let allowed=true,calls=[];
const request=async(url,options)=>{
 calls.push({url,options});
 assert.equal(options.credentials,'omit');assert.equal(options.headers.apikey,config.publishableKey);
 if(url.includes('/token?')){assert.deepEqual(JSON.parse(options.body),{email:'dev@example.test',password:'test-only-password'});return response({access_token:'test-only-token',expires_in:3600,refresh_token:'must-not-be-stored'})}
 if(url.includes('/logout?scope=local'))return response({});
 assert(url.endsWith('/rpc/tzg_debug_authorize'));assert.equal(options.headers.Authorization,'Bearer test-only-token');
 return allowed?response({authorized:true}):response({message:'Developer access denied.'},403);
};
const service=new SupabaseDebugService(config,request);
assert.equal((await service.api('status')).provider,'supabase');
await assert.rejects(service.api('command',{command:'stop'}),{status:401});
await service.api('login',{email:' dev@example.test ',code:'test-only-password'});
assert.equal(service.refresh_token,undefined);
assert.equal((await service.api('command',{command:'give currency FP 100'})).command.amount,100);
assert.equal(JSON.parse(calls.at(-1).options.body).p_command,'give currency FP 100');
const count=calls.length;await assert.rejects(service.api('command',{command:'give currency FP Infinity'}));assert.equal(calls.length,count,'invalid commands never reach backend');
allowed=false;
await assert.rejects(service.api('command',{command:'stop'}),{status:401});assert.equal(service.token,null,'revoked authorization locks subsequent commands');
await assert.rejects(service.api('login',{email:'dev@example.test',code:'test-only-password'}),{status:403});assert.equal(service.token,null);assert(calls.at(-1).url.includes('/logout?scope=local'));
allowed=true;await service.api('login',{email:'dev@example.test',code:'test-only-password'});
service.expires=0;await assert.rejects(service.api('command',{command:'stop'}),{status:401});
await service.api('login',{email:'dev@example.test',code:'test-only-password'});
await service.api('logout',{},true);assert.equal(service.token,null);assert.equal(calls.at(-1).options.keepalive,true);
assert.equal(new SupabaseDebugService(config,request).token,null,'new pages do not inherit developer tokens');
assert(!calls.filter(c=>c.url.includes('/rpc/')).some(c=>c.options.body.includes('password')));
const missing=new SupabaseDebugService(config,async(url)=>url.includes('/token?')?response({access_token:'test-only-token',expires_in:3600}):url.includes('/logout?')?response({}):response({code:'PGRST202'},404));
await assert.rejects(missing.api('login',{email:'dev@example.test',code:'test-only-password'}),/migration/);
assert.equal(missing.token,null);
assert.throws(()=>new SupabaseDebugService({...config,publishableKey:'sb_secret_never-allowed'}));
console.log('PASS: real authorization required per command, revoked/non-admin/expired sessions denied, memory-only tokens, local logout, command validation, missing migration and public-key guard.');
