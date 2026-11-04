import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),email_confirmed_at timestamptz,phone_confirmed_at timestamptz,is_anonymous boolean default false,raw_user_meta_data jsonb default '{}');create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);create table auth.identities(user_id uuid references auth.users(id) on delete cascade,provider text);create function auth.uid() returns uuid language sql stable as $$select(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;create schema cron;create table cron.job(jobname text primary key,schedule text,command text);create function cron.schedule(text,text,text) returns bigint language plpgsql as $$begin insert into cron.job values($1,$2,$3) on conflict(jobname) do update set schedule=excluded.schedule,command=excluded.command;return 1;end;$$;`);
for(const file of (await fs.readdir('supabase/migrations')).filter(f=>!f.includes('mobile_push')).sort()){let sql=await fs.readFile('supabase/migrations/'+file,'utf8');sql=sql.replace(/create extension if not exists pg_cron[^;]*;/gi,'');try{await db.exec(sql)}catch(e){throw Error(file+': '+e.message)}}
const a=crypto.randomUUID(),b=crypto.randomUUID(),sa=crypto.randomUUID(),sb=crypto.randomUUID();
for(const [id,name] of [[a,'pilot_a'],[b,'pilot_b']])await db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)',[id,name+'@example.test',JSON.stringify({username:name,display_name:name})]);
await db.query('insert into auth.sessions values($1,$2),($3,$4)',[sa,a,sb,b]);
async function rpc(name,args=[]){return(await db.query('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') result',args)).rows[0].result}
async function login(id=a,sid=sa){await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,session_id:sid})]);await db.exec('set role authenticated')}
await login();await rpc('tzg_player_session_start');let state=await rpc('tzg_player_load');

assert.deepEqual(await rpc('tzg_player_banner_state'),{unlocked:false,banner:null});
const image='data:image/jpeg;base64,'+Buffer.from([255,216,255,192,0,17,8,1,64,3,192,3,1,17,0,2,17,0,3,17,0,255,217]).toString('base64');
await assert.rejects(rpc('tzg_player_banner',[image]),/Unlock/);
await assert.rejects(rpc('tzg_player_banner_unlock',[state.revision,crypto.randomUUID()]),/300 RC/);
assert.equal((await rpc('tzg_player_load')).rc,state.rc);
await db.exec('reset role');await db.query('update tzg_private.player_saves set rc=900 where user_id=$1',[a]);await login();state=await rpc('tzg_player_load');
const mutation=crypto.randomUUID(),paid=await rpc('tzg_player_banner_unlock',[state.revision,mutation]);assert.equal(paid.state.rc,600);assert(paid.charged);assert(paid.unlocked);
assert.deepEqual(await rpc('tzg_player_banner_unlock',[state.revision,mutation]),paid,'lost response retry charges once');
await assert.rejects(rpc('tzg_player_banner_unlock',[state.revision,crypto.randomUUID()]),/CLOUD_CONFLICT/);
const again=await rpc('tzg_player_banner_unlock',[paid.revision,crypto.randomUUID()]);assert(!again.charged);assert.equal(again.state.rc,600);
await assert.rejects(rpc('tzg_player_banner',['data:image/svg+xml;base64,AAAA']),/JPEG/);
await assert.rejects(rpc('tzg_player_banner',['data:image/jpeg;base64,/9j/2Q==']),/960/);
await assert.rejects(rpc('tzg_player_banner',['data:image/jpeg;base64,'+'A'.repeat(180000)]),/180 KB/);
assert.deepEqual(await rpc('tzg_player_banner',[image]),{banner:image});assert.equal((await rpc('tzg_player_banner_state')).banner,image);
assert.equal((await rpc('tzg_profile_banner',['pilot_a'])).banner,image);
await login(b,sb);await rpc('tzg_player_session_start');await rpc('tzg_player_load');assert.equal((await rpc('tzg_player_banner_state')).unlocked,false,'unlock belongs to purchaser only');await assert.rejects(rpc('tzg_player_banner',[image]),/Unlock/);
for(const table of ['profile_banners','banner_unlock_mutations'])await assert.rejects(db.query('select * from tzg_private.'+table),/permission/);
await db.exec('reset role;set role anon');assert.equal((await rpc('tzg_profile_banner',['pilot_a'])).banner,image);await assert.rejects(rpc('tzg_player_banner_state'),/permission/);await assert.rejects(rpc('tzg_player_banner_unlock',[paid.revision,crypto.randomUUID()]),/permission/);
await login();await rpc('tzg_player_banner',[null]);assert.equal((await rpc('tzg_player_banner_state')).unlocked,true,'removal retains permanent unlock');assert.equal((await rpc('tzg_player_load')).rc,600,'edits and removal are free');
await db.exec('reset role');await db.query('update tzg_private.profile_banners set image=$1 where user_id=$2',[image,a]);await db.query('update tzg_private.self_account_state set deactivated_at=now() where user_id=$1',[a]);
// ensure deactivation record exists even for accounts without earlier state
await db.query('insert into tzg_private.self_account_state(user_id,deactivated_at) values($1,now()) on conflict(user_id) do update set deactivated_at=now()',[a]);await db.exec('set role anon');assert.equal(await rpc('tzg_profile_banner',['pilot_a']),null,'deactivated public profile stays hidden');
await db.exec('reset role');await db.query('delete from tzg_private.self_account_state where user_id=$1',[a]);await login();await db.exec('reset role');await db.query('delete from auth.sessions where id=$1',[sa]);await login();await assert.rejects(rpc('tzg_player_banner',[null]),/session|sign|log/i);
await db.close();console.log('PASS banner SQL: permanent 300 RC unlock, insufficient funds rollback, idempotent retry, stale revisions, ownership, permissions, JPEG dimensions/limits, free edits/removal and hidden deactivated profiles.');
