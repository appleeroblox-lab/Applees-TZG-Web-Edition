import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),email_confirmed_at timestamptz,phone_confirmed_at timestamptz,is_anonymous boolean default false,raw_user_meta_data jsonb default '{}');create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);create table auth.identities(user_id uuid references auth.users(id) on delete cascade,provider text);create function auth.uid() returns uuid language sql stable as $$select(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;create schema cron;create table cron.job(jobname text primary key,schedule text,command text);create function cron.schedule(text,text,text) returns bigint language plpgsql as $$begin insert into cron.job values($1,$2,$3) on conflict(jobname) do update set schedule=excluded.schedule,command=excluded.command;return 1;end;$$;`);
for(const file of (await fs.readdir('supabase/migrations')).filter(f=>!f.includes('mobile_push')).sort()){let sql=await fs.readFile('supabase/migrations/'+file,'utf8');sql=sql.replace(/create extension if not exists pg_cron[^;]*;/gi,'');try{await db.exec(sql)}catch(e){throw Error(file+': '+e.message)}}
const file='supabase/migrations/20261103161148_account_signup_security.sql';await db.exec(await fs.readFile(file,'utf8'));await db.exec(await fs.readFile('supabase/migrations/20261103163854_username_cost_confirmation_guard.sql','utf8'));
const update=await fs.readFile('docs/sql/v168-system-progression.sql','utf8');await db.exec(update);await db.exec(update);
const a=crypto.randomUUID(),b=crypto.randomUUID(),sa=crypto.randomUUID(),sb=crypto.randomUUID();
for(const [id,name] of [[a,'pilot_a'],[b,'pilot_b']])await db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)',[id,name+'@example.test',JSON.stringify({username:name,display_name:name})]);
await db.query('insert into auth.sessions values($1,$2),($3,$4)',[sa,a,sb,b]);
async function rpc(name,args=[]){return(await db.query('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') result',args)).rows[0].result}
async function login(id=a,sid=sa){await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,session_id:sid})]);await db.exec('set role authenticated')}
await login();await rpc('tzg_player_session_start');let state=await rpc('tzg_player_load');
assert.deepEqual((await rpc('tzg_system_unlock_state')).systems,[]);
await assert.rejects(rpc('tzg_system_unlock',['TRAPPIST-1',state.revision,crypto.randomUUID()]),/previous/);
await assert.rejects(rpc('tzg_system_unlock',['Proxima',state.revision,crypto.randomUUID()]),/Not enough/);
assert.equal((await rpc('tzg_player_load')).revision,state.revision);
await db.exec('reset role');await db.query('update tzg_private.player_saves set fp=100000,rc=100000 where user_id=$1',[a]);await login();state=await rpc('tzg_player_load');
const mutation=crypto.randomUUID(),paid=await rpc('tzg_system_unlock',['Proxima',state.revision,mutation]);
assert.equal(paid.state.fp,99000);assert.equal(paid.state.rc,99750);assert.deepEqual(paid.systems,['Proxima']);assert.equal(paid.revision,state.revision+1);
assert.deepEqual(await rpc('tzg_system_unlock',['Proxima',state.revision,mutation]),paid,'retry after lost response never charges twice');
await assert.rejects(rpc('tzg_system_unlock',['TRAPPIST-1',state.revision,mutation]),/same pending/);
await assert.rejects(rpc('tzg_system_unlock',['TRAPPIST-1',state.revision,crypto.randomUUID()]),/CLOUD_CONFLICT/);
const again=await rpc('tzg_system_unlock',['Proxima',paid.revision,crypto.randomUUID()]);assert(!again.charged);assert.equal(again.state.rc,paid.state.rc);
const {SYSTEM_ORDER,systemUnlockQuote}=await import('../public/system-unlocks.js');
state=again;for(const system of SYSTEM_ORDER.slice(1)){const quote=systemUnlockQuote(system),result=await rpc('tzg_system_unlock',[system,state.revision,crypto.randomUUID()]);assert.equal(state.state.fp-result.state.fp,quote.fp);assert.equal(state.state.rc-result.state.rc,quote.rc);state=result;}
assert.deepEqual((await rpc('tzg_system_unlock_state')).systems,SYSTEM_ORDER);
assert.equal(systemUnlockQuote('Blackholes').fp,10000);assert.equal(systemUnlockQuote('Galaxy:M87').rc,2500);
const username=await rpc('tzg_player_username',['pilot_changed',state.revision,crypto.randomUUID()]);assert.equal(username.state.rc,state.state.rc-1000);state=username;
const initial=await rpc('tzg_player_birthday',['2000-01-01',null,state.revision,crypto.randomUUID()]);assert.equal(initial.cost,0);
const birthday=await rpc('tzg_player_birthday',['2001-01-01','2000-01-01',initial.revision,crypto.randomUUID()]);assert.equal(birthday.cost,300);assert.equal(birthday.state.rc,initial.state.rc-300);
await login(b,sb);await rpc('tzg_player_session_start');await rpc('tzg_player_load');assert.deepEqual((await rpc('tzg_system_unlock_state')).systems,[],'unlock ownership is account-specific');
for(const table of ['system_unlock_catalog','system_unlocks','system_unlock_mutations'])await assert.rejects(db.query('select * from tzg_private.'+table),/permission/);
await db.exec('reset role;set role anon');await assert.rejects(rpc('tzg_system_unlock_state'),/permission/);await assert.rejects(rpc('tzg_system_unlock',['Proxima',0,crypto.randomUUID()]),/permission/);
await db.exec('reset role');await db.query("select set_config('request.jwt.claims','{}',false)");await db.exec('set role authenticated');await assert.rejects(rpc('tzg_system_unlock_state'),/sign|session|log|confirm/i);
await db.close();console.log('PASS v168 SQL: sequential unlocks, exact costs, rollback, retry, revision conflicts, account ownership, permissions, 1000 RC username and 300 RC birthday.');
