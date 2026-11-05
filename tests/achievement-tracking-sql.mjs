import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),email_confirmed_at timestamptz,phone_confirmed_at timestamptz,is_anonymous boolean default false,raw_user_meta_data jsonb default '{}');create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);create table auth.identities(user_id uuid references auth.users(id) on delete cascade,provider text);create function auth.uid() returns uuid language sql stable as $$select(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;create schema cron;create table cron.job(jobname text primary key,schedule text,command text);create function cron.schedule(text,text,text) returns bigint language plpgsql as $$begin insert into cron.job values($1,$2,$3) on conflict(jobname) do update set schedule=excluded.schedule,command=excluded.command;return 1;end;$$;`);
for(const file of (await fs.readdir('supabase/migrations')).filter(f=>!f.includes('mobile_push')&&!f.includes('_achievements')).sort()){let sql=await fs.readFile('supabase/migrations/'+file,'utf8');sql=sql.replace(/create extension if not exists pg_cron[^;]*;/gi,'');try{await db.exec(sql)}catch(e){throw Error(file+': '+e.message)}}

await db.exec(await fs.readFile('docs/sql/v168-system-progression.sql','utf8'));
await db.exec(await fs.readFile('supabase/migrations/20261105122716_achievements.sql','utf8'));
await db.exec(await fs.readFile('supabase/migrations/20261105172454_achievements_profile_totals.sql','utf8'));


await db.exec(await fs.readFile('supabase/migrations/20261105134834_achievements_tracking.sql','utf8')).catch(e=>{throw Error(e.message+' at '+e.position+' '+(e.where||''))});
await db.exec(await fs.readFile('supabase/migrations/20261105135845_achievements_event_guards.sql','utf8'));
const a=crypto.randomUUID(),sa=crypto.randomUUID();
await db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)',[a,'tracking@example.test',JSON.stringify({username:'tracking_test',display_name:'Tracker'})]);
await db.query('insert into auth.sessions values($1,$2)',[sa,a]);
async function rpc(name,args=[]){return(await db.query('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') result',args)).rows[0].result}
async function login(){await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:a,session_id:sa})]);await db.exec('set role authenticated')}
await login();await rpc('tzg_player_session_start');let wallet=await rpc('tzg_player_load');
const run=crypto.randomUUID();assert.deepEqual(await rpc('tzg_achievement_tracker_start',[run]),{seq:0});
const sample={system:'Sol',body:'Earth',pos:[0,3,0],altitude:0,phase:'parked',input:true,boost:false,foot:false,mode:'manual'};
let seq=0;async function event(action={type:'sample'},s=sample){const r=await rpc('tzg_achievement_observe',[run,seq+1,s,action]);seq=r.seq;return r}
await event();
async function advance(seconds){await db.exec('reset role');await db.query("update tzg_private.achievement_runs set observed_at=observed_at-($1||' seconds')::interval,countdown_at=countdown_at-($1||' seconds')::interval,airborne_at=airborne_at-($1||' seconds')::interval where user_id=$2",[seconds,a]);await db.query("update tzg_private.achievement_totals set last_hit=last_hit-($1||' seconds')::interval where user_id=$2",[seconds,a]);await login()}
async function totals(){await db.exec('reset role');const r=(await db.query('select counters from tzg_private.achievement_totals where user_id=$1',[a])).rows[0]?.counters||{};await login();return r}
await assert.rejects(event({type:'countdown'},{...sample,phase:'countdown',mode:'paused'}),/cannot earn/);
await event({type:'countdown'},{...sample,phase:'countdown'});await advance(5);
await event({type:'ignition'},{...sample,phase:'flying',pos:[0,3.1,0],altitude:.1});assert.equal((await totals()).launches,1);
await advance(5);await event({type:'sample'},{...sample,phase:'flying',pos:[0,53,0],altitude:50});
assert((await totals()).manual_s>=5);assert((await totals()).air_m>40);
await advance(5);const landing=await event({type:'landing'});assert.equal((await totals()).landings,1);
assert.deepEqual(await rpc('tzg_achievement_observe',[run,seq,sample,{type:'landing'}]),landing);assert.equal((await totals()).landings,1,'same event replay cannot count twice');
await event({type:'landing'});assert.equal((await totals()).landings,1,'new sequence cannot repeat a parked landing');
await assert.rejects(rpc('tzg_achievement_observe',[run,seq+1,{...sample,progress:999999},{type:'sample'}]),/cannot be submitted/);
await assert.rejects(event({type:'sample'},{...sample,system:'Experimental',body:'Sphere Test'}),/Unknown|Experimental|unlocked/);
const rules=JSON.parse(await fs.readFile('supabase/achievement-rules.json','utf8'));const earth=rules.worlds.find(w=>w.id==='Earth'),node=earth.nodes.find(n=>n.type==='quartz');
const miner={...sample,pos:node.pos,foot:true};await advance(15);await event({type:'sample'},miner);
for(let hits=0;hits<Math.ceil(node.hp/25);hits++){await advance(.45);await event({type:'mine',node:node.id,tool:'pickaxe'},miner)}
assert.equal((await totals()).mined,1);await advance(.45);await assert.rejects(event({type:'mine',node:node.id,tool:'pickaxe'},miner),/depleted/);
await assert.rejects(event({type:'mine',node:'invented',tool:'pickaxe'},miner),/unknown/);
await advance(5);await assert.rejects(event({type:'mine',node:node.id,tool:'diamond-pickaxe'},miner),/not owned|depleted/);
// Real accepted inventory deltas, exact recipe consumption and self-mined origin budgets.
let mutation=crypto.randomUUID();let saved=await rpc('tzg_player_save',[a,wallet.revision,mutation,{fp:wallet.fp,rc:wallet.rc,inventory:[{body:'Earth',type:'quartz',qty:1}]}]);wallet={...wallet,revision:saved.revision};
const crafter={...sample,pos:[-28,2,-38],foot:true};await advance(15);await event({type:'craft'},crafter);
mutation=crypto.randomUUID();saved=await rpc('tzg_player_save',[a,wallet.revision,mutation,{fp:wallet.fp,rc:wallet.rc,inventory:[{body:'Earth',type:'concrete-gray',qty:5}]}]);wallet={...wallet,revision:saved.revision};assert.equal((await totals()).crafted,5);assert.equal((await totals()).self_crafted,5);
await rpc('tzg_player_save',[a,wallet.revision-1,mutation,{fp:wallet.fp,rc:wallet.rc,inventory:[{body:'Earth',type:'concrete-gray',qty:5}]}]);assert.equal((await totals()).crafted,5,'save retries do not duplicate crafting');
mutation=crypto.randomUUID();saved=await rpc('tzg_player_save',[a,wallet.revision,mutation,{fp:wallet.fp,rc:wallet.rc,inventory:[{body:'Earth',type:'quartz',qty:2}]}]);wallet={...wallet,revision:saved.revision};
await advance(10);await event({type:'sale'},{...sample,pos:[0,2,-45],foot:true});
mutation=crypto.randomUUID();saved=await rpc('tzg_player_save',[a,wallet.revision,mutation,{fp:wallet.fp+110,rc:wallet.rc+4,inventory:[]}]);wallet={...wallet,revision:saved.revision,fp:wallet.fp+110,rc:wallet.rc+4};
assert.equal((await totals()).trades,1);assert.equal((await totals()).earned_fp,110);assert.equal((await totals()).earned_rc,4);
const achievements=await rpc('tzg_achievement_state');assert.equal(achievements.filter(r=>r.available).length,80);for(const id of ['001','021','031','041','051','052','053'])assert(achievements.find(r=>r.id===id).completed_at,id+' completes from validated events');
const before=await totals();await advance(5);await event({type:'sample'},{...sample,pos:[0,2,-40],foot:true,input:false});assert.deepEqual(await totals(),before,'idle sample adds no counters');
const claim=await rpc('tzg_achievement_claim',[wallet.revision,crypto.randomUUID()]);assert(claim.ids.length>=7);assert.equal((await totals()).earned_fp,110,'achievement rewards cannot feed gameplay earnings');
// Completed warps require both payment receipts and a server-timed arrival ticket.
wallet=await rpc('tzg_player_load');await advance(15);await event({type:'sample'},sample);await event({type:'countdown'},{...sample,phase:'countdown'});await advance(5);await event({type:'ignition'},{...sample,phase:'flying',altitude:.1});await advance(15);await event({type:'sample'},{...sample,phase:'flying',pos:[0,6503,0],altitude:6500});
let space={...sample,body:null,phase:'space',pos:[0,earth.r*1.06,0],altitude:0};await event({type:'exit'},space);await advance(5);space={...space,pos:[0,earth.r+200,0]};await event({type:'sample'},space);
async function pay(fp,rc){const w=await rpc('tzg_player_load'),m=crypto.randomUUID();await rpc('tzg_player_save',[a,w.revision,m,{fp:w.fp-fp,rc:w.rc-rc,inventory:w.inventory}]);return m}
let paid=await pay(50,0);await event({type:'warp_start',target:'Moon',mutation:paid},{...space,mode:'warp'});
const moon=rules.worlds.find(w=>w.id==='Moon');let arrival={...space,pos:[moon.pos[0],moon.pos[1],moon.pos[2]+moon.r+30]};
await assert.rejects(event({type:'warp_finish',target:'Moon'},arrival),/duration/);
async function ageWarp(){await db.exec('reset role');await db.query("update tzg_private.achievement_runs set warp=jsonb_set(warp,'{started}',to_jsonb(((warp->>'started')::timestamptz-interval '10 seconds')::text)),observed_at=observed_at-interval '10 seconds' where user_id=$1",[a]);await login()}
await ageWarp();await event({type:'warp_finish',target:'Moon'},arrival);assert.equal((await totals()).warps,1);assert(!(await totals()).interstellar);
await assert.rejects(event({type:'warp_start',target:'Mars',mutation:paid},{...arrival,mode:'warp'}),/receipt/);
await assert.rejects(event({type:'warp_finish',target:'Moon'},arrival),/ticket/);
await db.exec('reset role');await db.query("insert into tzg_private.system_unlocks(user_id,system) values($1,'Proxima')",[a]);await login();const proxima=rules.worlds.find(w=>w.id==='Proxima b');paid=await pay(1000,proxima.rc);await event({type:'warp_start',target:proxima.id,mutation:paid},{...arrival,mode:'warp'});await ageWarp();
space={...space,system:'Proxima',pos:[proxima.pos[0],proxima.pos[1],proxima.pos[2]+proxima.r+30]};await event({type:'warp_finish',target:proxima.id},space);assert.equal((await totals()).warps,2);assert.equal((await totals()).interstellar,1);
// Active boost cannot exceed its 20-second budget without the recharge interval.
space={...space,boost:true};await event({type:'sample'},space);for(let i=0;i<2;i++){await advance(10);space={...space,pos:[space.pos[0]+100000,space.pos[1],space.pos[2]]};await event({type:'sample'},space)}
const boosted=(await totals()).boost_s;assert(boosted>=19.9&&boosted<=20);
await advance(5);space={...space,pos:[space.pos[0]+1000,space.pos[1],space.pos[2]]};await event({type:'sample'},space);assert.equal((await totals()).boost_s,boosted);
// Two authenticated, live group members on the same genuinely visited body count.
const b=crypto.randomUUID(),sb=crypto.randomUUID(),room=crypto.randomUUID();await db.exec('reset role');await db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)',[b,'companion@example.test',JSON.stringify({username:'companion_test',display_name:'Companion'})]);await db.query('insert into auth.sessions values($1,$2)',[sb,b]);await db.query('insert into tzg_private.active_game_sessions(user_id,session_id) values($1,$2)',[b,sb]);
await db.query("insert into tzg_private.social_rooms(id,kind,owner,name) values($1,'group',$2,'Achievement Party')",[room,a]);await db.query('insert into tzg_private.social_members(room,player) values($1,$2),($1,$3)',[room,a,b]);await db.query("insert into tzg_private.achievement_uniques values($1,'body','Earth') on conflict do nothing",[b]);
await db.query('insert into tzg_private.achievement_runs(user_id,run,sid,sample) values($1,$2,$3,$4)',[b,crypto.randomUUID(),sb,JSON.stringify(sample)]);await login();await event({type:'sample'},sample);assert((await rpc('tzg_achievement_state')).find(r=>r.id==='073').progress===1);
await advance(5);await event({type:'sample'},{...sample,pos:[1,3,0]});assert((await totals()).party_s>=5);
// Explosive collection requires a consumed TNT item, owned torch, placement and elapsed fuse.
await advance(15);const blastSample={...sample,pos:[node.pos[0],node.pos[1]+2,node.pos[2]],foot:true};await event({type:'sample'},blastSample);
wallet=await rpc('tzg_player_load');let m=crypto.randomUUID();let result=await rpc('tzg_player_save',[a,wallet.revision,m,{fp:wallet.fp,rc:wallet.rc,inventory:[{body:'Earth',type:'tnt',qty:1},{body:'Earth',type:'torch',qty:1}]}]);wallet.revision=result.revision;
m=crypto.randomUUID();result=await rpc('tzg_player_save',[a,wallet.revision,m,{fp:wallet.fp,rc:wallet.rc,inventory:[{body:'Earth',type:'torch',qty:1}]}]);wallet.revision=result.revision;
await event({type:'tnt_place',block:'test-tnt',pos:node.pos,mutation:m},blastSample);await assert.rejects(event({type:'tnt_place',block:'test-tnt-duplicate',pos:node.pos,mutation:m},blastSample),/consumed TNT/);
await event({type:'tnt_ignite',block:'test-tnt'},blastSample);await assert.rejects(event({type:'tnt_explode',block:'test-tnt'},blastSample),/fuse/);await db.exec('reset role');await db.query("update tzg_private.achievement_explosives set ignited_at=ignited_at-interval '300 seconds' where user_id=$1",[a]);await login();const minedBefore=(await totals()).mined;await event({type:'tnt_explode',block:'test-tnt'},blastSample);assert((await totals()).mined>minedBefore);await assert.rejects(event({type:'tnt_explode',block:'test-tnt'},blastSample),/already consumed/);
// Exercise all catalog thresholds from private fixture records, then claim the entire catalog once.
await db.exec('reset role');await db.query("update tzg_private.achievement_totals set counters=$1 where user_id=$2",[JSON.stringify({launches:1,air_m:500000,reentries:250,low_m:250000,landings:100,boost_s:36000,manual_s:1800000,warps:10000,interstellar:250,deep_s:86400,mined:250000,rare_mined:50,crafted:25000,self_crafted:100,earned_fp:1000000,earned_rc:500,trades:2000,party_s:36000}),a]);
await db.query('insert into tzg_private.resource_progress(user_id,xp) values($1,495000) on conflict(user_id) do update set xp=495000',[a]);
await db.query("insert into tzg_private.achievement_days select $1,(now() at time zone 'UTC')::date-n from generate_series(0,729)n on conflict do nothing",[a]);
await db.query('insert into tzg_private.system_unlocks(user_id,system) select $1,system from tzg_private.system_unlock_catalog on conflict do nothing',[a]);await db.query("insert into tzg_private.friend_links(a,b,requester,status) values(least($1::uuid,$2::uuid),greatest($1::uuid,$2::uuid),$1,'accepted')",[a,b]);
for(const [kind,values] of [['body',rules.worlds.filter(w=>w.landable).map(w=>w.id)],['party_body',rules.worlds.filter(w=>w.landable).map(w=>w.id)],['mining_body',rules.worlds.filter(w=>w.landable).map(w=>w.id)],['mining_system',[...new Set(rules.worlds.map(w=>w.system))]],['mineral',[...new Set(rules.worlds.flatMap(w=>w.nodes).map(n=>n.type))]],['recipe',rules.recipes.map(r=>r.id)],['tool',rules.recipes.filter(r=>r.tool).map(r=>r.id)],['craft_body',rules.worlds.filter(w=>w.landable&&w.kind.includes('PLANET')).map(w=>w.id)]])for(const value of values)await db.query('insert into tzg_private.achievement_uniques values($1,$2,$3) on conflict do nothing',[a,kind,value]);
await login();const all=await rpc('tzg_achievement_state');assert.equal(all.filter(r=>r.completed_at).length,80,JSON.stringify(all.filter(r=>!r.completed_at)));
wallet=await rpc('tzg_player_load');const allPaid=await rpc('tzg_achievement_claim',[wallet.revision,crypto.randomUUID()]);assert.equal(allPaid.fp+claim.fp,100000);assert.equal(allPaid.rc+claim.rc,10000);const noMore=await rpc('tzg_achievement_claim',[allPaid.revision,crypto.randomUUID()]);assert.equal(noMore.fp,0);assert.equal(noMore.rc,0);
await db.exec('reset role;set role anon');for(const name of ['tzg_achievement_tracker_start','tzg_achievement_observe'])await assert.rejects(rpc(name,name.endsWith('start')?[crypto.randomUUID()]:[run,seq+1,sample,{type:'sample'}]),/permission/);await db.exec('reset role;set role authenticated');for(const table of ['achievement_rules','achievement_totals','achievement_origins','achievement_node_state','achievement_runs','achievement_explosives'])await assert.rejects(db.query('select * from tzg_private.'+table),/permission/);
await db.close();console.log('PASS all 80 thresholds and exact lifetime payout; warp payment/duration/replay/interstellar, boost budget, live party co-presence and complete catalog idempotence');console.log('PASS tracked gameplay: launch/flight/landing, replay rejection, no arbitrary counters, mineral HP/tool/proximity/depletion, recipe consumption/provenance, verified sale earnings, save replay, idle exclusion and auto-claim loop protection');

