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
await login(0);
await db.exec('reset role');
await db.query('update tzg_private.player_saves set fp=1000,rc=1000 where user_id=$1',[accounts[0]]);
let player=await login(0);
const state=()=>rpc('tzg_customization_state');
const save=(section,paint,face=null)=>rpc('tzg_customization_save',[section,JSON.stringify(paint),face]);
const buy=(kind,revision,mutation=crypto.randomUUID())=>rpc('tzg_customization_unlock',[kind,revision,mutation]);
assert.deepEqual((await state()).unlocks,[]);
await assert.rejects(save('character',{},'Happy'),/Unlock this face/);
await assert.rejects(save('ship',{wings:'#123456'}),/Unlock Custom Colours/);
await save('character',{head:'#57b9ff'},'Neutral');
const mutation=crypto.randomUUID();
const face=await buy('face:Happy',player.revision,mutation);
assert.equal(face.state.fp,750);
assert.deepEqual(await buy('face:Happy',player.revision,mutation),face);
await assert.rejects(buy('face:Sleepy',player.revision,mutation),/same pending purchase/);
await save('character',{head:'#57b9ff'},'Happy');
const custom=await buy('character:custom',face.revision);
assert.equal(custom.state.rc,800);
await save('character',{head:'#123456'},'Happy');
await assert.rejects(save('ship',{wings:'#123456'}),/Unlock Custom Colours/);
const gradient=await buy('ship:gradient',custom.revision);
assert.equal(gradient.state.rc,300);
const stops=[{position:0,color:'#123456'},{position:1,color:'#abcdef'}];
await save('ship',{wings:stops});
await assert.rejects(save('character',{head:stops},'Happy'),/Unlock Gradient Editor/);
await assert.rejects(save('ship',{wings:[...stops].reverse()}),/Invalid gradient/);
await assert.rejects(buy('character:gradient',gradient.revision),/Not enough currency/);
assert.deepEqual((await state()).ship.wings,stops);
await rpc('tzg_customization_save',['ship',JSON.stringify({wings:stops,body:'#57b9ff'}),null,['wings','body']]);
assert.deepEqual((await state()).shipOrder,['wings','body']);
await assert.rejects(db.query('select * from tzg_private.player_customization'),/permission/);
await login(1);
assert.deepEqual(await state(),{unlocks:[],ship:{},shipOrder:[],character:{face:'Neutral',paint:{}}});
await db.exec('reset role;set role anon');
await assert.rejects(state(),/permission/);
await db.close();
console.log('PASS account customization: prices, retry, independent entitlements, server validation, persistence, and guest permissions');
