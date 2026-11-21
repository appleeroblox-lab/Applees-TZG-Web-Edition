import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';

const origin='https://applees-tzg-web-edition.space';
const visitor='11111111-1111-4111-8111-111111111111';
const session='22222222-2222-4222-8222-222222222222';
const user='33333333-3333-4333-8333-333333333333';
const invalid='44444444-4444-4444-8444-444444444444';
const token='test.'+Buffer.from(JSON.stringify({session_id:session})).toString('base64url')+'.test';
const url='https://discord.com/api/webhooks/123456789012345678/test-fixture-1234567890';
const posts=[];
let handler;
const sdk={
 auth:{getUser:async input=>({data:{user:input===token?{id:user}:null}})},
 rpc:async(name,params)=>{
  if(name==='tzg_debug_authorize')return {data:{authorized:true}};
  assert.equal(name,'tzg_discord_delivery_config');
  const valid=params.p_guest_visitor===visitor||params.p_member_session===session&&params.p_member_user===user;
  return {data:params.p_test?JSON.stringify({url,settings:{color:'#ff0033',browser:false}}):params.p_member_session===session?JSON.stringify({url,settings:{ip:true},details:{display_name:'Explorer',public_id:'123',fp:120,rc:10,xp:500,level:3,ip:'192.0.2.1'}}):valid?url:null};
 },
};
const code=readFileSync(new URL('../supabase/functions/discord-signin/index.ts',import.meta.url),'utf8')
 .replace(/^import .*;\n/,'');
vm.runInNewContext(stripTypeScriptTypes(code),{
 Deno:{env:{get:()=> 'fixture'},serve:fn=>{handler=fn}},
 createClient:()=>sdk,
 Request,Response,AbortSignal,atob,
 fetch:async(endpoint,options)=>{
  assert.equal(endpoint,url+'?wait=true');
  assert.equal(options.redirect,'error');
  posts.push(JSON.parse(options.body));
  return new Response(null,{status:204});
 },
});
const call=(data,requestOrigin=origin,auth='')=>handler(new Request('https://backend.example/functions/v1/discord-signin',{
 method:'POST',headers:{origin:requestOrigin,authorization:auth,'user-agent':'Android Chrome/99'},body:JSON.stringify(data),
}));
assert.equal((await call({kind:'guest',visitor},'https://unrelated.example')).status,403);
await call({kind:'guest',visitor:invalid});
await call({kind:'member'},'https://appleeroblox-lab.github.io','Bearer invalid');
assert.equal(posts.length,0);
await call({kind:'guest',visitor});
await call({kind:'guest',visitor});
await call({kind:'member',restored:true},origin,'Bearer '+token);
assert.equal(posts.length,2);
assert.equal(posts[0].embeds[0].title,'Guest entry');
assert.equal(posts[0].embeds[0].color,0x3498db);
assert.equal(posts[0].embeds[0].fields[0].value,'Chrome');
assert.equal(posts[1].embeds[0].title,'Member auto-login');
const memberFields=Object.fromEntries(posts[1].embeds[0].fields.map(({name,value})=>[name,value]));
assert.equal(memberFields['Flight Points (FP)'],'120');
assert.equal(memberFields.XP,'500');
assert.equal(memberFields.Level,'3');
assert.equal(memberFields['Member sign-in IP'],'192.0.2.1');
assert(!posts[0].embeds[0].fields.some(field=>field.name.includes('IP')));
const result=await call({kind:'test'},origin,'Bearer '+token);
assert.deepEqual(await result.json(),{ok:true});
assert.equal(posts[2].embeds[0].color,0xff0033);
assert.equal(posts[2].embeds[0].fields[0].name,'Device');
assert.doesNotMatch(JSON.stringify(posts),new RegExp(visitor+'|'+session+'|'+user));
console.log('PASS live Discord payload, origin guard, authorization, duplicate suppression and private IDs omitted.');
