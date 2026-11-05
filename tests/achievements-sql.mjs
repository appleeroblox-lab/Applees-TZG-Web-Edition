import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),email_confirmed_at timestamptz,phone_confirmed_at timestamptz,is_anonymous boolean default false,raw_user_meta_data jsonb default '{}');create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);create table auth.identities(user_id uuid references auth.users(id) on delete cascade,provider text);create function auth.uid() returns uuid language sql stable as $$select(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;create schema cron;create table cron.job(jobname text primary key,schedule text,command text);create function cron.schedule(text,text,text) returns bigint language plpgsql as $$begin insert into cron.job values($1,$2,$3) on conflict(jobname) do update set schedule=excluded.schedule,command=excluded.command;return 1;end;$$;`);
for(const file of (await fs.readdir('supabase/migrations')).filter(f=>!f.includes('mobile_push')&&!f.includes('_achievements')).sort()){let sql=await fs.readFile('supabase/migrations/'+file,'utf8');sql=sql.replace(/create extension if not exists pg_cron[^;]*;/gi,'');try{await db.exec(sql)}catch(e){throw Error(file+': '+e.message)}}

await db.exec(await fs.readFile('docs/sql/v168-system-progression.sql','utf8'));
await db.exec(await fs.readFile('supabase/migrations/20261105122716_achievements.sql','utf8'));
await db.exec(await fs.readFile('supabase/migrations/20261105172454_achievements_profile_totals.sql','utf8'));

const a=crypto.randomUUID(),b=crypto.randomUUID(),sa=crypto.randomUUID(),sb=crypto.randomUUID();
for(const [id,name] of [[a,'achieve_a'],[b,'achieve_b']])await db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)',[id,name+'@example.test',JSON.stringify({username:name,display_name:name})]);
await db.query('insert into auth.sessions values($1,$2),($3,$4)',[sa,a,sb,b]);
async function rpc(name,args=[]){return(await db.query('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') result',args)).rows[0].result}
async function login(id=a,sid=sa){await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,session_id:sid})]);await db.exec('set role authenticated')}
await login();await rpc('tzg_player_session_start');let wallet=await rpc('tzg_player_load');
assert.equal((await rpc('tzg_achievement_state')).length,80);
assert.deepEqual(await rpc('tzg_achievement_notices'),[]);
await db.exec('reset role');
await db.query('insert into tzg_private.resource_progress(user_id,xp) values($1,1000) on conflict(user_id) do update set xp=1000',[a]);
await db.query("insert into tzg_private.friend_links(a,b,requester,status) values(least($1::uuid,$2::uuid),greatest($1::uuid,$2::uuid),$1,'accepted')",[a,b]);
await login();let rows=await rpc('tzg_achievement_state');assert(rows.find(r=>r.id==='061').completed_at);assert(rows.find(r=>r.id==='071').completed_at);assert(!rows.find(r=>r.id==='001').available);
const notices=await rpc('tzg_achievement_notices');assert.deepEqual(notices,['061','071']);assert.deepEqual(await rpc('tzg_achievement_notices'),[],'not repeated after reload/reconnect');
const mutation=crypto.randomUUID(),claim=await rpc('tzg_achievement_claim',[wallet.revision,mutation]);
assert.equal(claim.state.fp,wallet.fp+424+106);assert.equal(claim.state.rc,wallet.rc);assert.deepEqual(claim.ids,['061','071']);
assert.deepEqual(await rpc('tzg_achievement_claim',[wallet.revision,mutation]),claim,'lost response retries return exact receipt');
await assert.rejects(rpc('tzg_achievement_claim',[wallet.revision,crypto.randomUUID()]),/CLOUD_CONFLICT/);
const again=await rpc('tzg_achievement_claim',[claim.revision,crypto.randomUUID()]);assert.equal(again.fp,0);assert.equal(again.state.fp,claim.state.fp);
await assert.rejects(rpc('tzg_achievement_claim',[claim.revision,crypto.randomUUID(),'forged']),/Invalid/);
for(const table of ['achievement_catalog','achievement_progress','achievement_days','achievement_mutations'])await assert.rejects(db.query('select * from tzg_private.'+table),/permission/);
await login(b,sb);await rpc('tzg_player_session_start');wallet=await rpc('tzg_player_load');rows=await rpc('tzg_achievement_state');assert(!rows.find(r=>r.id==='061').completed_at,'progress belongs to account');assert.equal((await rpc('tzg_profile_banner',['achieve_a'])).achievements_unlocked,2,'Other members see actual unlocked count without banner purchase');
await db.exec('reset role;set role anon');assert.equal((await rpc('tzg_profile_banner',['achieve_a'])).achievements_unlocked,2,'Guests see public unlocked count');assert.equal(await rpc('tzg_profile_banner',['__missing__']),null);await assert.rejects(rpc('tzg_achievement_state'),/permission/);await assert.rejects(rpc('tzg_achievement_claim',[0,crypto.randomUUID()]),/permission/);
await db.exec('reset role');const totals=(await db.query('select count(*)::int n,sum(fp)::int fp,sum(rc)::int rc from tzg_private.achievement_catalog')).rows[0];assert.deepEqual(totals,{n:80,fp:100000,rc:10000});
await login();await db.exec('reset role');await db.query('delete from auth.sessions where id=$1',[sa]);await login();await assert.rejects(rpc('tzg_achievement_state'),/session|sign|log/i);
await db.close();console.log('PASS: catalog totals, server milestones, notice consumption, claims/retries/stale revisions, no duplicate payout, ownership, guest denial, private-table permissions and revoked sessions');

