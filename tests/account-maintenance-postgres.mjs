import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),email_confirmed_at timestamptz,phone_confirmed_at timestamptz,is_anonymous boolean default false,raw_user_meta_data jsonb default '{}');create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);create table auth.identities(user_id uuid references auth.users(id) on delete cascade,provider text);create function auth.uid() returns uuid language sql stable as $$select(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;`);
for(const file of ['202610250001_debug_authorization.sql','202610250002_player_accounts.sql','202610250003_social_accounts.sql','202610260011_discovery_gifs.sql','202610260012_account_pages_progress.sql','202610260013_compact_ui_resource_xp.sql','202610280018_mining_catalog.sql','20261028103514_onboarding_guests_rewards.sql','20261028123958_guest_presence_reward_supplies.sql'])await db.exec(await fs.readFile('supabase/migrations/'+file,'utf8'));
await db.exec("create schema cron;create table cron.job(jobname text primary key,schedule text,command text);create function cron.schedule(text,text,text) returns bigint language plpgsql as $$begin insert into cron.job values($1,$2,$3) on conflict(jobname) do update set schedule=excluded.schedule,command=excluded.command;return 1;end;$$;");
const file='supabase/migrations/20261029153639_atmosphere_minimap_account_maintenance.sql',sql=(await fs.readFile(file,'utf8')).replace('create extension if not exists pg_cron;','');await db.exec(sql);await db.exec(sql);assert.equal((await db.query('select count(*)::int n from cron.job')).rows[0].n,1);assert.equal((await db.query('select schedule from cron.job')).rows[0].schedule,'* * * * *');
const ids={};async function add(name,{confirmed=true,age=0,anonymous=false,phone=false,oauth=false}={}){const id=ids[name]=crypto.randomUUID();await db.query("insert into auth.users(id,email,email_confirmed_at,created_at,is_anonymous,phone_confirmed_at,raw_user_meta_data) values($1,$2,case when $3 then now() end,now()-make_interval(hours=>$4),$5,case when $6 then now() end,$7)",[id,name+'@example.test',confirmed,age,anonymous,phone,JSON.stringify({username:name,display_name:name})]);if(oauth)await db.query('insert into auth.identities values($1,$2)',[id,'google']);return id}
const admin=await add('admin'),member=await add('member'),target=await add('target'),orphan=await add('orphan',{confirmed:false});const sid=crypto.randomUUID();await db.query('insert into auth.sessions values($1,$2)',[sid,admin]);await db.query('insert into tzg_private.debug_admins(user_id) values($1)',[admin]);await db.query('delete from tzg_private.player_profiles where user_id=$1',[orphan]);
const va=crypto.randomUUID(),vb=crypto.randomUUID(),vc=crypto.randomUUID();for(const v of [va,vb,vc])await db.query('insert into tzg_private.site_visitors(id) values($1)',[v]);await db.query("insert into tzg_private.play_sessions(id,visitor,user_id,last_seen,ended_at) values($1,$2,null,now(),null),($3,$2,null,now()-interval '2 hours',now()),($4,$5,null,now()-interval '3 hours',now()),($6,$7,$8,now(),null)",[crypto.randomUUID(),va,crypto.randomUUID(),crypto.randomUUID(),vb,crypto.randomUUID(),vc,member]);
async function login(id=admin,session=sid){await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,session_id:session})]);await db.exec('set role authenticated')}
async function rpc(name,args=[]){return(await db.query('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') result',args)).rows[0].result}
await login();const totals=await rpc('tzg_debug_guest_totals');assert.deepEqual(totals,{total_guests:2,online_guests:1,guest_sessions:3});const action=(id,op,data)=>rpc('tzg_debug_account_action',[id,op,'Test moderation reason',JSON.stringify(data||{})]);await assert.rejects(action(target,'delete',{confirm:'target'}),/Confirm the selected/);await assert.rejects(action(target,'delete',{confirm_target:member}),/Confirm the selected/);await action(target,'verify');assert.equal((await rpc('tzg_debug_account',[target])).verified,true);await action(target,'unverify');await action(target,'delete',{confirm_target:target});assert((await rpc('tzg_debug_account',[target])).deletion);await action(target,'restore');assert.equal((await rpc('tzg_debug_account',[target])).deletion,null);await action(orphan,'delete',{confirm_target:orphan});await assert.rejects(action(admin,'delete',{confirm_target:admin}),/Developer accounts/);await assert.rejects(db.query('select tzg_private.purge_unconfirmed_email_users()'),/permission/);
await db.exec('reset role');const memberSession=crypto.randomUUID();await db.query('insert into auth.sessions values($1,$2)',[memberSession,member]);await login(member,memberSession);await assert.rejects(rpc('tzg_debug_guest_totals'),/denied|Developer|not authorized/i);await db.exec('reset role');
const expired=await add('expired',{confirmed:false,age:6}),recent=await add('recent',{confirmed:false,age:4}),verified=await add('verified',{age:8}),anon=await add('anonymous',{confirmed:false,age:8,anonymous:true}),phone=await add('phone',{confirmed:false,age:8,phone:true}),oauth=await add('oauth',{confirmed:false,age:8,oauth:true}),protectedAdmin=await add('protectedadmin',{confirmed:false,age:8});await db.query('insert into tzg_private.debug_admins(user_id) values($1)',[protectedAdmin]);const expiredSession=crypto.randomUUID();await db.query('insert into auth.sessions values($1,$2)',[expiredSession,expired]);const removed=(await db.query('select tzg_private.purge_unconfirmed_email_users() n')).rows[0].n;assert.equal(removed,1);assert.equal((await db.query('select count(*)::int n from auth.users where id=$1',[expired])).rows[0].n,0);assert.equal((await db.query('select count(*)::int n from auth.sessions where id=$1',[expiredSession])).rows[0].n,0);for(const id of [recent,verified,anon,phone,oauth,protectedAdmin,admin,member])assert.equal((await db.query('select count(*)::int n from auth.users where id=$1',[id])).rows[0].n,1);assert.equal((await db.query('select tzg_private.purge_unconfirmed_email_users() n')).rows[0].n,0);await db.exec('set role anon');await assert.rejects(rpc('tzg_debug_guest_totals'),/permission/);await db.exec('reset role');
await db.exec('alter table auth.users add column last_sign_in_at timestamptz');
await db.exec('alter table tzg_private.player_profiles add column last_online_at timestamptz');
for(const file of ['20261109182032_permanent_account_deletion.sql','20261121214500_account_inactivity.sql']){
 await db.exec(await fs.readFile('supabase/migrations/'+file,'utf8'));
}
const idle14=await add('idle14',{age:15*24}),idle30=await add('idle30',{age:30*24});
const optedOut=await add('optedout',{age:29*24}),recentSignIn=await add('recentsignin',{age:31*24});
const recentPresence=await add('recentpresence',{age:31*24});
await db.query("update auth.users set last_sign_in_at=now() where id=$1",[recentSignIn]);
await db.query("update tzg_private.player_profiles set last_online_at=now() where user_id=$1",[recentPresence]);
await db.query("update auth.users set created_at=now()-interval '31 days' where id=$1",[admin]);
for(const id of [idle30,optedOut]){
 const session=crypto.randomUUID();
 await db.exec('reset role');
 await db.query('insert into auth.sessions values($1,$2)',[session,id]);
 await login(id,session);
 assert.equal(await rpc('tzg_account_inactivity'),true);
 assert.equal(await rpc('tzg_account_inactivity',[false]),false);
 assert.equal(await rpc('tzg_account_inactivity'),false);
 await assert.rejects(db.query('select tzg_private.purge_inactive_accounts()'),/permission/);
}
await db.exec('reset role');
assert.equal((await db.query('select tzg_private.purge_inactive_accounts() n')).rows[0].n,2);
assert.equal((await db.query('select tzg_private.purge_inactive_accounts() n')).rows[0].n,0);
for(const id of [optedOut,recentSignIn,recentPresence,admin]){
 assert.equal((await db.query('select count(*)::int n from auth.users where id=$1',[id])).rows[0].n,1);
}
for(const id of [idle14,idle30]){
 assert.equal((await db.query('select count(*)::int n from auth.users where id=$1',[id])).rows[0].n,0);
 await login(id);
 const notice=await rpc('tzg_player_moderation');
 assert.equal(notice.reason,'Your account has been deleted due to inactivity for a long time');
 await db.exec('reset role');
}
await db.close();console.log('PASS maintenance SQL: repeatable minute cron, distinct total/online guests, developer-only counts, UID-bound deletion with missing usernames, verify/restore preservation, five-hour expiry, revoked sessions, verified/recent/anonymous/phone/OAuth/admin protections, and the 14/30-day inactivity policy and reason.');
