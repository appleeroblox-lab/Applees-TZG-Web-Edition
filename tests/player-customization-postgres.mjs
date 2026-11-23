import {bodies} from '../public/catalog.js';
import {createProtoBodies} from '../public/proto-data.js';
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),email_confirmed_at timestamptz,phone_confirmed_at timestamptz,is_anonymous boolean default false,raw_user_meta_data jsonb default '{}');create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);create table auth.identities(user_id uuid references auth.users(id) on delete cascade,provider text);create function auth.uid() returns uuid language sql stable as $$select(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;create schema cron;create table cron.job(jobname text primary key,schedule text,command text);create function cron.schedule(text,text,text) returns bigint language plpgsql as $$begin insert into cron.job values($1,$2,$3) on conflict(jobname) do update set schedule=excluded.schedule,command=excluded.command;return 1;end;$$;`);
for(const file of (await fs.readdir('supabase/migrations')).filter(f=>!f.includes('mobile_push')).sort()){let sql=await fs.readFile('supabase/migrations/'+file,'utf8');sql=sql.replace(/create extension if not exists pg_cron[^;]*;/gi,'');try{await db.exec(sql)}catch(e){throw Error(file+': '+e.message)}}
const accounts=[crypto.randomUUID(),crypto.randomUUID()];
const sessions=accounts.map(()=>crypto.randomUUID());
for(const [i,id] of accounts.entries()){
 await db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)',[id,'custom'+i+'@example.test',JSON.stringify({username:'cust_'+i,display_name:'Pilot '+i})]);
 await db.query('insert into auth.sessions values($1,$2)',[sessions[i],id]);
}
async function rpc(name,args=[]){
 return (await db.query('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') result',args)).rows[0].result;
}
async function login(i){
 await db.exec('reset role');
 await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:accounts[i],session_id:sessions[i]})]);
 await db.exec('set role authenticated');
 await rpc('tzg_player_session_start');
 return rpc('tzg_player_load');
}
const transactionMode=await db.query("select provolatile from pg_proc where oid='public.tzg_customization_state()'::regprocedure");
assert.equal(transactionMode.rows[0].provolatile,'v','PostgREST must allow the account guard to write');
await login(0);
await db.exec('reset role');
await db.query('update tzg_private.player_saves set fp=2000,rc=1000 where user_id=$1',[accounts[0]]);
await login(0);
const state=()=>rpc('tzg_customization_state');
const load=()=>rpc('tzg_player_load');
async function save(section,paint,cost,face=null,order=null,mutation=crypto.randomUUID(),revision=null){
 return rpc('tzg_customization_save_paid',[section,JSON.stringify(paint),face,order,cost,revision??(await load()).revision,mutation]);
}
async function buy(kind,mutation=crypto.randomUUID(),revision=null){
 return rpc('tzg_customization_unlock',[kind,revision??(await load()).revision,mutation]);
}
assert.deepEqual((await state()).unlocks,[]);
await assert.rejects(rpc('tzg_customization_save',['character','{}','Neutral']),/permission/);
await assert.rejects(save('character',{},0,'Happy'),/Unlock this face/);
await assert.rejects(save('ship',{wings:'#123456'},100),/Unlock Custom Colours/);
// Home Page purchases and Leave flush the full wallet before proceeding.
const inventory=[...bodies,...createProtoBodies(bodies)]
 .filter(body=>body.solid)
 .map(body=>({body:body.id,type:'iron',qty:1}));
const wallet={fp:2000,rc:1000,inventory};
const startingRevision=(await load()).revision;
await assert.rejects(rpc('tzg_player_save',[accounts[0],startingRevision,crypto.randomUUID(),{
 ...wallet,inventory:[{body:'Invented world',type:'iron',qty:1}]
}]),/Unknown item or celestial body/);
const savedWallet=await rpc('tzg_player_save',[accounts[0],startingRevision,crypto.randomUUID(),wallet]);
assert.equal(savedWallet.revision,startingRevision+1);
const faceRevision=(await load()).revision,faceMutation=crypto.randomUUID();
const face=await buy('face:Happy',faceMutation,faceRevision);
assert.equal(face.state.fp,1750);
assert.deepEqual(await buy('face:Happy',faceMutation,faceRevision),face);
await assert.rejects(buy('face:Sleepy',faceMutation,faceRevision),/same pending purchase/);
const five=Object.fromEntries(['head','torso','leftHand','rightHand','leftLeg'].map(part=>[part,'#57b9ff']));
const paintRevision=(await load()).revision,paintMutation=crypto.randomUUID();
await assert.rejects(save('character',five,20,'Happy'),/total changed/);
const paid=await save('character',five,100,'Happy',null,paintMutation,paintRevision);
assert.equal(paid.state.fp,1650);
assert.deepEqual(paid.character.paint,five);
assert.deepEqual(await save('character',five,100,'Happy',null,paintMutation,paintRevision),paid);
assert.equal((await save('character',five,0,'Happy')).state.fp,1650);
const custom=await buy('character:custom');
assert.equal(custom.state.rc,800);
const savedCharacter=await save('character',{...five,head:'#123456'},20,'Happy');
assert.equal(savedCharacter.character.paint.head,'#123456');
assert.equal(savedCharacter.state.fp,1630);
await assert.rejects(save('ship',{wings:'#123456'},100),/Unlock Custom Colours/);
const gradient=await buy('ship:gradient');
assert.equal(gradient.state.rc,300);
assert.deepEqual(gradient.state.inventory,inventory);
const stops=[{position:0,color:'#123456'},{position:1,color:'#abcdef'}];
const ship=await save('ship',{wings:'#57b9ff',trails:stops,exhaust:'#57b9ff'},450,null,['wings','trails','exhaust']);
assert.equal(ship.state.fp,1180);
assert.deepEqual(ship.shipOrder,['wings','trails','exhaust']);
await assert.rejects(save('character',{...five,head:stops},20,'Happy'),/Unlock Gradient Editor/);
await assert.rejects(save('ship',{...ship.ship,trails:[...stops].reverse()},200),/Invalid gradient/);
await assert.rejects(buy('character:gradient'),/Not enough currency/);
await db.exec('reset role');
await db.query('update tzg_private.player_saves set fp=19 where user_id=$1',[accounts[0]]);
await login(0);
await assert.rejects(save('character',five,20,'Happy'),/Not enough FP/);
assert.equal((await state()).character.paint.head,'#123456','insufficient funds leaves paint untouched');
const resetCharacter=await save('character',{},0,'Happy');
assert.equal(resetCharacter.state.fp,19);
assert.deepEqual(resetCharacter.character.paint,{});
const resetShip=await save('ship',{exhaust:'#57b9ff'},0,null,['exhaust']);
assert.equal(resetShip.state.fp,19);
assert.deepEqual(resetShip.shipOrder,['exhaust']);
assert.deepEqual(resetShip.ship,{exhaust:'#57b9ff'});
await assert.rejects(db.query('select * from tzg_private.player_customization'),/permission/);
await login(1);
assert.deepEqual(await state(),{unlocks:[],ship:{},shipOrder:[],character:{face:'Neutral',paint:{}}});
await db.exec('reset role;set role anon');
await assert.rejects(state(),/permission/);
await db.close();
console.log('PASS account customization: prices, retry, independent entitlements, server validation, persistence, and guest permissions');
