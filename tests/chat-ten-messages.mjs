import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),email_confirmed_at timestamptz,phone_confirmed_at timestamptz,is_anonymous boolean default false,raw_user_meta_data jsonb default '{}');create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,created_at timestamptz default now());create table auth.identities(user_id uuid references auth.users(id) on delete cascade,provider text);create function auth.uid() returns uuid language sql stable as $$select(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;create schema cron;create table cron.job(jobname text primary key,schedule text,command text);create function cron.schedule(text,text,text) returns bigint language plpgsql as $$begin insert into cron.job values($1,$2,$3) on conflict(jobname) do update set schedule=excluded.schedule,command=excluded.command;return 1;end;$$;`);
for(const file of (await fs.readdir('supabase/migrations')).filter(f=>!f.includes('mobile_push')).sort()){let sql=await fs.readFile('supabase/migrations/'+file,'utf8');sql=sql.replace(/create extension if not exists pg_cron[^;]*;/gi,'');try{await db.exec(sql)}catch(e){throw Error(file+': '+e.message)}}


const id=crypto.randomUUID(),session=crypto.randomUUID();
await db.query("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,'count@example.test',now(),$2)",[id,JSON.stringify({username:'counter',display_name:'Counter'})]);
await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,id]);
await db.query("insert into tzg_private.chat_messages(user_id,username,display_name,body,mutation,created_at) select $1,'counter','Counter','message '||n,gen_random_uuid(),now()-interval '1 hour' from generate_series(1,12)n",[id]);
let rows=(await db.query('select body from tzg_private.chat_messages order by id')).rows;
assert.equal(rows.length,10);assert.equal(rows[0].body,'message 3');assert.equal(rows[9].body,'message 12');
await db.exec('select tzg_private.cleanup_temporary_chat()');assert.equal((await db.query('select count(*)::int n from tzg_private.chat_messages')).rows[0].n,10,'messages younger than five hours remain');
await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,session_id:session})]);await db.exec('set role authenticated');
await db.exec('select public.tzg_player_session_start()');
const rpc=async(name,args=[]) => (await db.query('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') result',args)).rows[0].result;
assert.equal((await rpc('tzg_chat_read',[999999,[]])).length,10,'read returns authoritative latest snapshot');
await rpc('tzg_chat_send',['new message',crypto.randomUUID()]);
assert.equal((await rpc('tzg_chat_read')).length,10);assert.equal((await rpc('tzg_chat_read'))[0].body,'message 4');
await db.exec('reset role;set role anon');assert.equal((await rpc('tzg_guest_chat')).length,10);
await db.exec('reset role');
const visitor=crypto.randomUUID(),guestVisitor=crypto.randomUUID(),staleVisitor=crypto.randomUUID();
await db.query("insert into tzg_private.site_visitors(id) values($1),($2),($3)",[visitor,guestVisitor,staleVisitor]);
await db.query("insert into tzg_private.play_sessions(id,visitor,user_id,last_seen) values($1,$2,$3,now()),($4,$2,$3,now()),($5,$6,null,now()),($7,$8,null,now()-interval '2 minutes')",[crypto.randomUUID(),visitor,id,crypto.randomUUID(),crypto.randomUUID(),guestVisitor,crypto.randomUUID(),staleVisitor]);
await db.exec('set role anon');assert.equal(Number(await rpc('tzg_online_players')),2,'deduplicate accounts and ignore expired presence');
await db.exec("reset role;update tzg_private.chat_messages set created_at=now()-interval '6 hours' where id=(select min(id) from tzg_private.chat_messages);select tzg_private.cleanup_temporary_chat()");assert.equal((await db.query('select count(*)::int n from tzg_private.chat_messages')).rows[0].n,9,'only the expired message is deleted');
const guestToken=crypto.randomUUID(),mutation=crypto.randomUUID();
await db.exec('set role anon');await rpc('tzg_guest_identity',[guestToken,'Guest Pilot']);await rpc('tzg_guest_identity',[guestToken,'Guest Pilot']);await assert.rejects(rpc('tzg_guest_identity',[crypto.randomUUID(),'guest pilot']),/already taken/);
await assert.rejects(rpc('tzg_guest_chat_send',[crypto.randomUUID(),'No identity',crypto.randomUUID()]),/display name/);
const sent=await rpc('tzg_guest_chat_send',[guestToken,'Hello from guest',mutation]);
assert.equal((await rpc('tzg_guest_chat_send',[guestToken,'Hello from guest',mutation])).id,sent.id,'retry does not duplicate');
const visible=(await rpc('tzg_guest_chat')).find(m=>m.id===sent.id);assert.equal(visible.display_name,'Guest Pilot');assert(visible.guest);await db.exec('reset role;set role authenticated');const memberView=(await rpc('tzg_chat_read')).find(m=>m.id===sent.id);assert(memberView,'guest sent message is visible to normal players');assert.equal(memberView.display_name,'Guest Pilot');assert(memberView.guest);await db.exec('reset role;set role anon');assert(!JSON.stringify(visible).includes(guestToken),'guest identity token stays private');
await assert.rejects(rpc('tzg_guest_chat_send',[guestToken,'Too soon',crypto.randomUUID()]),/Wait/);
await assert.rejects(db.query('select * from tzg_private.guest_identities'),/permission/);
await db.close();console.log('PASS ten-message cap, individual five-hour expiry, guest names/send/rate limits/idempotency/privacy and online counts');
