-- Appended to the generated achievement rules migration. No client counter API.
create table tzg_private.achievement_rules(key text primary key,data jsonb not null);
create table tzg_private.achievement_totals(user_id uuid primary key references auth.users(id) on delete cascade,counters jsonb not null default '{}',cycle bigint not null default 0,last_hit timestamptz);
create table tzg_private.achievement_uniques(user_id uuid references auth.users(id) on delete cascade,kind text,value text,primary key(user_id,kind,value));
create table tzg_private.achievement_origins(user_id uuid references auth.users(id) on delete cascade,body text,type text,qty bigint not null check(qty>=0),primary key(user_id,body,type));
create table tzg_private.achievement_node_state(user_id uuid references auth.users(id) on delete cascade,body text,node text,cycle bigint,hp integer not null,primary key(user_id,body,node));
create table tzg_private.achievement_runs(user_id uuid primary key references auth.users(id) on delete cascade,run uuid not null,sid uuid not null,seq bigint not null default 0,sample jsonb,observed_at timestamptz not null default clock_timestamp(),countdown_at timestamptz,airborne_at timestamptz,entry_pending boolean not null default false,warp jsonb,boost_left double precision not null default 20,boost_stopped timestamptz,last_result jsonb not null default '{}');
create table tzg_private.achievement_save_receipts(user_id uuid references auth.users(id) on delete cascade,mutation uuid,revision bigint,spent_fp bigint not null,spent_rc bigint not null,created_at timestamptz not null default clock_timestamp(),warp_used boolean not null default false,spent_items jsonb not null default '{}',used_tnt bigint not null default 0,primary key(user_id,mutation));
create table tzg_private.achievement_explosives(user_id uuid references auth.users(id) on delete cascade,block text,body text not null,pos jsonb not null,placed_at timestamptz not null default clock_timestamp(),ignited_at timestamptz,exploded_at timestamptz,primary key(user_id,block));
do $$declare t text;begin foreach t in array array['achievement_rules','achievement_totals','achievement_uniques','achievement_origins','achievement_node_state','achievement_runs','achievement_save_receipts','achievement_explosives'] loop execute format('alter table tzg_private.%I enable row level security',t);execute format('revoke all on tzg_private.%I from public,anon,authenticated',t);end loop;end$$;
create function tzg_private.achievement_add(who uuid,k text,n numeric) returns void language plpgsql security definer set search_path='' as $$declare old_value numeric;begin
 select coalesce((counters->>k)::numeric,0) into old_value from tzg_private.achievement_totals where user_id=who;old_value:=coalesce(old_value,0);
 if n<0 or n>1e12 then raise exception 'Invalid internal achievement increment';end if;
 insert into tzg_private.achievement_totals(user_id,counters) values(who,jsonb_build_object(k,n)) on conflict(user_id) do update set counters=jsonb_set(tzg_private.achievement_totals.counters,array[k],to_jsonb(least(1e15,coalesce((tzg_private.achievement_totals.counters->>k)::numeric,0)+n)));
 if exists(select 1 from tzg_private.achievement_metric_map m join tzg_private.achievement_catalog c on c.id=m.id where m.metric=k and old_value<c.target and old_value+n>=c.target) then perform tzg_private.achievement_sync(who);end if;
end$$;
create function tzg_private.achievement_unique(who uuid,k text,v text) returns void language plpgsql security definer set search_path='' as $$begin insert into tzg_private.achievement_uniques values(who,k,v) on conflict do nothing;if found then perform tzg_private.achievement_sync(who);end if;end$$;
create function tzg_private.achievement_distance(a jsonb,b jsonb) returns double precision language sql immutable set search_path='' as $$select sqrt(power((a->>0)::double precision-(b->>0)::double precision,2)+power((a->>1)::double precision-(b->>1)::double precision,2)+power((a->>2)::double precision-(b->>2)::double precision,2))$$;
create function tzg_private.achievement_ground_altitude(sample jsonb) returns double precision language plpgsql immutable set search_path='' as $$
declare x double precision:=(sample->'pos'->>0)::double precision;y double precision:=(sample->'pos'->>1)::double precision;z double precision:=(sample->'pos'->>2)::double precision;r double precision;fade double precision;ground_height double precision;begin
 r:=sqrt(x*x+z*z);fade:=greatest(0,least(1,(r-140)/560));fade:=fade*fade*(3-2*fade);
 ground_height:=fade*(22+sin(x*.0028)*cos(z*.0034)*24+sin(x*.007+z*.004)*8);
 if r<8 then ground_height:=ground_height+.55;elsif abs(x)<=1.5 and z<=-8 and z>=-11 then ground_height:=ground_height+.55*(1-(-z-8)/3);end if;
 return greatest(0,y-ground_height-1.39);end$$;
create function tzg_private.achievement_tracker_start(p_run uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=tzg_private.require_player();r tzg_private.achievement_runs;sid uuid:=(auth.jwt()->>'session_id')::uuid;begin
 if p_run is null then raise invalid_parameter_value using message='Tracker run is required';end if;
 perform pg_advisory_xact_lock(hashtextextended(who::text,174));
 select * into r from tzg_private.achievement_runs where user_id=who for update;
 if found and r.run=p_run and r.sid=sid then return jsonb_build_object('seq',r.seq);end if;
 insert into tzg_private.achievement_runs(user_id,run,sid) values(who,p_run,sid) on conflict(user_id) do update set run=excluded.run,sid=excluded.sid,seq=0,sample=tzg_private.achievement_runs.sample,observed_at=tzg_private.achievement_runs.observed_at,countdown_at=null,airborne_at=null,entry_pending=false,warp=null,boost_left=least(tzg_private.achievement_runs.boost_left,20),last_result='{}';
 return jsonb_build_object('seq',0);end$$;
create function public.tzg_achievement_tracker_start(p_run uuid) returns jsonb language sql security invoker set search_path='' as $$select tzg_private.achievement_tracker_start(p_run)$$;
create function tzg_private.achievement_observe(p_run uuid,p_seq bigint,p_sample jsonb,p_action jsonb default '{"type":"sample"}') returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=tzg_private.require_player();r tzg_private.achievement_runs;t tzg_private.achievement_totals;now_at timestamptz:=clock_timestamp();dt double precision;distance double precision:=0;active boolean:=false;world jsonb;target jsonb;node_rule jsonb;tool jsonb;phase text;action text;position jsonb;old_position jsonb;hp integer;damage integer:=25;gain double precision;kind text;peer record;result jsonb;receipt tzg_private.achievement_save_receipts;cost_fp integer;cost_rc integer;is_planet boolean;explosive tzg_private.achievement_explosives;radius_distance double precision;earth_reset boolean:=false;
begin
 if p_run is null or p_seq is null or p_seq<1 or p_sample is null or jsonb_typeof(p_sample)<>'object' or octet_length(p_sample::text)>3000 or jsonb_typeof(p_action)<>'object' or octet_length(p_action::text)>500 then raise invalid_parameter_value using message='Invalid achievement event';end if;
 if exists(select 1 from jsonb_object_keys(p_sample) k where k not in ('system','body','pos','altitude','phase','input','boost','foot','mode')) or exists(select 1 from jsonb_object_keys(p_action) k where k not in ('type','node','tool','target','mutation','block','pos')) then raise invalid_parameter_value using message='Achievement counters cannot be submitted';end if;
 phase:=p_sample->>'phase';action:=p_action->>'type';position:=p_sample->'pos';
 if phase is null or phase not in ('parked','countdown','flying','descending','space','gas') or p_sample->>'mode' is null or p_sample->>'mode' not in ('manual','warp','approach','free','debug','paused') or action is null or action not in ('sample','countdown','ignition','landing','entry','exit','warp_start','warp_finish','warp_cancel','mine','tnt_place','tnt_ignite','tnt_explode','craft','sale') then raise invalid_parameter_value using message='Unknown achievement action';end if;
 if action in ('countdown','ignition','landing','entry','exit','mine','craft','sale','tnt_place','tnt_ignite','tnt_explode') and p_sample->>'mode'<>'manual' or action='warp_start' and p_sample->>'mode'<>'warp' or action='warp_finish' and p_sample->>'mode' not in ('manual','approach') then raise invalid_parameter_value using message='Paused, free-camera and debug actions cannot earn achievements';end if;
 if jsonb_typeof(position)<>'array' or jsonb_array_length(position)<>3 or exists(select 1 from jsonb_array_elements(position) v where jsonb_typeof(v)<>'number' or abs(v::text::double precision)>1e15) or jsonb_typeof(p_sample->'altitude')<>'number' or (p_sample->>'altitude')::double precision not between 0 and 20000 or exists(select 1 from unnest(array['input','boost','foot']) k where jsonb_typeof(p_sample->k) is distinct from 'boolean') then raise invalid_parameter_value using message='Invalid movement sample';end if;
 select value into world from tzg_private.achievement_rules,jsonb_array_elements(data) where key='worlds' and value->>'id'=p_sample->>'body';
 if phase<>'space' and (world is null or not(world->>'landable')::boolean and phase<>'gas' or world->>'system' is distinct from p_sample->>'system') then raise invalid_parameter_value using message='Unknown public surface';end if;
 if p_sample->>'system'<>'Sol' and not exists(select 1 from tzg_private.system_unlocks where user_id=who and system=p_sample->>'system') then raise insufficient_privilege using message='Public system is not unlocked';end if;
 if not exists(select 1 from tzg_private.achievement_rules,jsonb_array_elements(data) b where key='worlds' and b->>'system'=p_sample->>'system') then raise invalid_parameter_value using message='Experimental and unknown systems do not count';end if;
 -- Wallet first, matching every other account mutation, then the achievement lock.
 perform 1 from tzg_private.player_saves where user_id=who for share;
 perform pg_advisory_xact_lock(hashtextextended(who::text,174));
 select * into r from tzg_private.achievement_runs where user_id=who for update;
 if not found or r.run<>p_run or r.sid is distinct from (auth.jwt()->>'session_id')::uuid then raise insufficient_privilege using message='Achievement tracking session changed';end if;
 if p_seq=r.seq then return r.last_result;elsif p_seq<r.seq then return jsonb_build_object('seq',p_seq,'duplicate',true);elsif p_seq<>r.seq+1 then raise invalid_parameter_value using message='Achievement event sequence gap';end if;
 insert into tzg_private.achievement_totals(user_id) values(who) on conflict do nothing;select * into t from tzg_private.achievement_totals where user_id=who for update;
 dt:=greatest(0,extract(epoch from now_at-r.observed_at));old_position:=r.sample->'pos';
 earth_reset:=action='sample' and p_sample->>'body'='Earth' and phase='parked' and tzg_private.achievement_distance(position,'[0,0,0]'::jsonb)<20;
 if earth_reset and r.sample is not null and (r.sample->>'body' is distinct from 'Earth' or r.sample->>'phase'='space') then r.sample:=null;r.countdown_at:=null;r.airborne_at:=null;r.warp:=null;r.entry_pending:=false;end if;
 if r.sample is null and not(p_sample->>'body'='Earth' and phase='parked' and tzg_private.achievement_distance(position,'[0,0,0]'::jsonb)<20) then raise invalid_parameter_value using message='Return to the Earth launch pad once to initialize achievement tracking';end if;
 if r.sample is not null and p_sample->>'system' is distinct from r.sample->>'system' and not(action in ('warp_finish','warp_cancel') and r.warp is not null) then raise invalid_parameter_value using message='System changes require a confirmed warp';end if;
 if r.sample is not null and (r.sample->>'phase'='space')<>(phase='space') and not(action='entry' and r.sample->>'phase'='space' or action='exit' and phase='space' and r.airborne_at is not null and (tzg_private.achievement_ground_altitude(r.sample)>=3500 or r.sample->>'phase'='gas')) then raise invalid_parameter_value using message='Surface transitions require validated entry or exit events';end if;
 if r.sample is not null and phase<>'space' and r.sample->>'phase'<>'space' and r.sample->>'body' is distinct from p_sample->>'body' then raise invalid_parameter_value using message='Surface teleportation cannot earn achievements';end if;
 if r.sample is not null and phase='flying' and r.sample->>'phase'='parked' and action<>'ignition' then raise invalid_parameter_value using message='Launch ignition must follow its countdown';end if;
 if r.sample is not null and r.sample->>'body' is not distinct from p_sample->>'body' and (r.sample->>'phase'='space')=(phase='space') and r.sample->>'system'=p_sample->>'system' then distance:=tzg_private.achievement_distance(old_position,position);end if;
 -- Large network gaps/paused/free/debug samples establish a baseline and earn nothing.
 active:=r.sample is not null and r.seq>0 and dt between .001 and 15 and p_sample->>'mode'='manual' and r.sample->>'mode'='manual' and (p_sample->>'input')::boolean and (r.sample->>'input')::boolean and distance>.01;
 if phase<>'space' and r.sample is not null and r.sample->>'body'=p_sample->>'body' and distance>(case when (p_sample->>'foot')::boolean then 15 else 550 end)*least(dt,60)+8 then raise invalid_parameter_value using message='Surface movement exceeded its validated speed budget';end if;
 if phase='space' and distance>299792.458*least(dt,60)+100 and action not in ('warp_start','warp_finish','warp_cancel') and r.warp is null then raise invalid_parameter_value using message='Space movement exceeded its validated speed budget';end if;
 if active then insert into tzg_private.achievement_days values(who,(now_at at time zone 'UTC')::date) on conflict do nothing;if found then perform tzg_private.achievement_sync(who);end if;end if;
 if active and not(p_sample->>'foot')::boolean and phase in ('flying','space','gas') and (phase='space' or r.airborne_at is not null) then
 perform tzg_private.achievement_add(who,'manual_s',dt::numeric);
 if phase<>'space' and (world->>'air')::boolean and tzg_private.achievement_ground_altitude(p_sample)<6500 then perform tzg_private.achievement_add(who,'air_m',least(distance,550*dt)::numeric);end if;
 if phase<>'space' and tzg_private.achievement_ground_altitude(p_sample)<800 and tzg_private.achievement_ground_altitude(r.sample)<800 then perform tzg_private.achievement_add(who,'low_m',least(distance,450*dt)::numeric);end if;
 if phase='space' and not exists(select 1 from tzg_private.achievement_rules,jsonb_array_elements(data) b where key='worlds' and b->>'system'=p_sample->>'system' and tzg_private.achievement_distance(position,b->'pos')<(b->>'r')::double precision*3+1000) then perform tzg_private.achievement_add(who,'deep_s',dt::numeric);end if;
 if phase='space' and (r.sample->>'boost')::boolean then gain:=least(dt,r.boost_left);r.boost_left:=r.boost_left-gain;perform tzg_private.achievement_add(who,'boost_s',gain::numeric);r.boost_stopped:=null;
 else if r.boost_stopped is null then r.boost_stopped:=now_at;elsif now_at-r.boost_stopped>=interval '3 seconds' then r.boost_left:=20;end if;end if;
 end if;
 if active and exists(select 1 from tzg_private.social_members a join tzg_private.social_rooms g on g.id=a.room and g.kind='group' join tzg_private.social_members b on b.room=a.room and b.player<>who join tzg_private.achievement_runs pr on pr.user_id=b.player join tzg_private.active_game_sessions sessions on sessions.user_id=pr.user_id and sessions.session_id=pr.sid where a.player=who and pr.observed_at>now_at-interval '15 seconds' and (pr.sample->>'input')::boolean and pr.sample->>'mode'='manual') then perform tzg_private.achievement_add(who,'party_s',dt::numeric);end if;
 if not(p_sample->>'boost')::boolean then if r.boost_stopped is null then r.boost_stopped:=now_at;elsif now_at-r.boost_stopped>=interval '3 seconds' then r.boost_left:=20;end if;end if;

 if action='countdown' and phase='countdown' and r.sample->>'phase'='parked' and not(p_sample->>'foot')::boolean then r.countdown_at:=now_at;
 elsif action='ignition' and phase='flying' and r.countdown_at is not null and now_at-r.countdown_at>=interval '4 seconds' and now_at-r.countdown_at<interval '30 seconds' then perform tzg_private.achievement_add(who,'launches',1);r.countdown_at:=null;r.airborne_at:=now_at;
 elsif action='entry' and phase in ('flying','gas') and r.sample->>'phase'='space' and r.sample->>'system'=p_sample->>'system' and tzg_private.achievement_distance(r.sample->'pos',world->'pos')<(world->>'r')::double precision*1.2+50 then r.airborne_at:=now_at;r.entry_pending:=coalesce((world->>'air')::boolean,false);
 elsif action='exit' and phase='space' then select value into target from tzg_private.achievement_rules,jsonb_array_elements(data) where key='worlds' and value->>'id'=r.sample->>'body';if target is null or tzg_private.achievement_distance(position,target->'pos') not between (target->>'r')::double precision and (target->>'r')::double precision*1.2+50 then raise invalid_parameter_value using message='Surface exit position is invalid';end if;r.entry_pending:=false;
 elsif action='landing' and phase='parked' and r.sample->>'body'=p_sample->>'body' and r.airborne_at is not null  and (p_sample->>'altitude')::double precision<5 and tzg_private.achievement_ground_altitude(p_sample)<15 and not(p_sample->>'foot')::boolean and p_sample->>'mode'='manual' and r.sample->>'phase' in ('flying','descending') then
 perform tzg_private.achievement_add(who,'landings',1);perform tzg_private.achievement_unique(who,'body',p_sample->>'body');r.airborne_at:=null;
 end if;
 if phase='parked' and (p_sample->>'input')::boolean and p_sample->>'mode'='manual' and exists(select 1 from tzg_private.achievement_uniques u where u.user_id=who and u.kind='body' and u.value=p_sample->>'body') and exists(select 1 from tzg_private.social_members a join tzg_private.social_rooms g on g.id=a.room and g.kind='group' join tzg_private.social_members b on b.room=a.room and b.player<>who join tzg_private.achievement_runs pr on pr.user_id=b.player join tzg_private.active_game_sessions sessions on sessions.user_id=pr.user_id and sessions.session_id=pr.sid where a.player=who and pr.observed_at>now_at-interval '30 seconds' and pr.sample->>'body'=p_sample->>'body' and pr.sample->>'phase'='parked' and (pr.sample->>'input')::boolean and pr.sample->>'mode'='manual' and exists(select 1 from tzg_private.achievement_uniques u where u.user_id=b.player and u.kind='body' and u.value=p_sample->>'body')) then perform tzg_private.achievement_unique(who,'party_body',p_sample->>'body');end if;
 if r.entry_pending and phase in ('flying','descending','parked','gas') and tzg_private.achievement_ground_altitude(p_sample)<800 and p_sample->>'mode'='manual' then perform tzg_private.achievement_add(who,'reentries',1);r.entry_pending:=false;end if;
 if r.warp is not null and now_at-(r.warp->>'started')::timestamptz>interval '40 seconds' or action='warp_cancel' then r.warp:=null;end if;
 if action='warp_start' and phase='space' and r.sample is not null and r.warp is null then
 select value into target from tzg_private.achievement_rules,jsonb_array_elements(data) where key='worlds' and value->>'id'=p_action->>'target';
 if target is null or target->>'system'<>'Sol' and not exists(select 1 from tzg_private.system_unlocks where user_id=who and system=target->>'system') then raise insufficient_privilege using message='Warp target is not unlocked';end if;
 if target->>'system'=p_sample->>'system' and tzg_private.achievement_distance(position,target->'pos')<((target->>'boundary')::double precision+greatest(100,(target->>'r')::double precision*2)) then raise invalid_parameter_value using message='Warp started too near its target';end if;
 if exists(select 1 from tzg_private.achievement_rules,jsonb_array_elements(data) b where key='worlds' and b->>'system'=p_sample->>'system' and b->>'kind' not in ('NEBULA','STAR CLUSTER','GALAXY') and tzg_private.achievement_distance(position,b->'pos')<case when b->>'kind'='STAR' then (b->>'collision')::double precision else (b->>'boundary')::double precision end+greatest(20,(b->>'r')::double precision*.2)) then raise invalid_parameter_value using message='Warp start is inside a public body exclusion zone';end if;
 cost_fp:=case when target->>'id'='Earth' then 0 when target->>'system'<>p_sample->>'system' then 1000 else round(50+250*least(1,greatest(0,tzg_private.achievement_distance(position,target->'pos')-(target->>'r')::double precision)/(50*1495978.707)))::integer end;
 cost_rc:=case when target->>'id'='Earth' or target->>'system'=p_sample->>'system' then 0 else (target->>'rc')::integer end;
 if cost_fp>0 or cost_rc>0 then
 select * into receipt from tzg_private.achievement_save_receipts where user_id=who and mutation=(p_action->>'mutation')::uuid for update;
 if not found or receipt.warp_used or receipt.created_at<now_at-interval '20 seconds' or receipt.spent_fp<cost_fp or receipt.spent_rc<cost_rc then raise insufficient_privilege using message='Warp needs a new matching server payment receipt';end if;
 update tzg_private.achievement_save_receipts set warp_used=true where user_id=who and mutation=receipt.mutation;
 end if;
 r.warp:=jsonb_build_object('target',target->>'id','source',p_sample->>'system','started',now_at);r.airborne_at:=null;
 elsif action='warp_finish' then
 select value into target from tzg_private.achievement_rules,jsonb_array_elements(data) where key='worlds' and value->>'id'=p_action->>'target';
 if r.warp is not null and target is not null and r.warp->>'target'=target->>'id' and p_sample->>'system'=target->>'system' and now_at-(r.warp->>'started')::timestamptz between interval '8 seconds' and interval '40 seconds' and tzg_private.achievement_distance(position,target->'pos') between (target->>'r')::double precision and (target->>'r')::double precision*15+500 then
 perform tzg_private.achievement_add(who,'warps',1);if r.warp->>'source'<>target->>'system' then perform tzg_private.achievement_add(who,'interstellar',1);end if;
 r.warp:=null;else raise invalid_parameter_value using message='Warp completion requires its active ticket, duration and arrival position';end if;
 end if;
 if action='tnt_place' then
 if phase<>'parked' or not(p_sample->>'foot')::boolean or p_sample->>'mode'<>'manual' or jsonb_typeof(p_action->'pos')<>'array' or jsonb_array_length(p_action->'pos')<>3 or octet_length(coalesce(p_action->>'block','')) not between 1 and 100 then raise invalid_parameter_value using message='Invalid explosive placement';end if;
 if exists(select 1 from jsonb_array_elements(p_action->'pos') v where jsonb_typeof(v)<>'number' or abs(v::text::double precision)>1e9) or tzg_private.achievement_distance(position,p_action->'pos')>7 then raise invalid_parameter_value using message='Explosive placement is outside reach';end if;
 select * into receipt from tzg_private.achievement_save_receipts where user_id=who and mutation=(p_action->>'mutation')::uuid for update;
 if not found or receipt.created_at<now_at-interval '20 seconds' or coalesce((receipt.spent_items->>'tnt')::bigint,0)<=receipt.used_tnt then raise insufficient_privilege using message='Explosive placement needs a new consumed TNT receipt';end if;
 insert into tzg_private.achievement_explosives(user_id,block,body,pos) values(who,p_action->>'block',world->>'id',p_action->'pos');
 update tzg_private.achievement_save_receipts set used_tnt=used_tnt+1 where user_id=who and mutation=receipt.mutation;
 elsif action='tnt_ignite' then
 select * into explosive from tzg_private.achievement_explosives where user_id=who and block=p_action->>'block' for update;
 if not found or explosive.ignited_at is not null or explosive.body is distinct from p_sample->>'body' or not(p_sample->>'foot')::boolean or p_sample->>'mode'<>'manual' or tzg_private.achievement_distance(position,explosive.pos)>6 or not exists(select 1 from tzg_private.player_saves,jsonb_array_elements(inventory) item where user_id=who and item->>'type'='torch' and (item->>'qty')::int>0) then raise insufficient_privilege using message='Explosive ignition needs its placed TNT, owned torch and proximity';end if;
 update tzg_private.achievement_explosives set ignited_at=now_at where user_id=who and block=explosive.block;
 elsif action='tnt_explode' then
 select * into explosive from tzg_private.achievement_explosives where user_id=who and block=p_action->>'block' for update;
 if not found or explosive.exploded_at is not null then raise invalid_parameter_value using message='Explosive is unknown or already consumed';end if;
 if not(explosive.ignited_at is not null and now_at-explosive.ignited_at>=interval '3 seconds') and not exists(select 1 from tzg_private.achievement_explosives e where e.user_id=who and e.body=explosive.body and e.exploded_at>now_at-interval '3 seconds' and tzg_private.achievement_distance(e.pos,explosive.pos)<=6) then raise invalid_parameter_value using message='Explosive fuse or chain reaction is not confirmed';end if;
 update tzg_private.achievement_explosives set exploded_at=now_at where user_id=who and block=explosive.block;
 select value into target from tzg_private.achievement_rules,jsonb_array_elements(data) where key='worlds' and value->>'id'=explosive.body;
 for node_rule in select value from jsonb_array_elements(target->'nodes') loop
 radius_distance:=tzg_private.achievement_distance(explosive.pos,node_rule->'pos');continue when radius_distance>6;
 select case when cycle=t.cycle then n.hp else (node_rule->>'hp')::integer end into hp from tzg_private.achievement_node_state n where n.user_id=who and n.body=explosive.body and n.node=node_rule->>'id';hp:=coalesce(hp,(node_rule->>'hp')::integer);continue when hp=0;
 hp:=greatest(0,hp-greatest(30,round(180*(1-radius_distance/6))::integer));
 insert into tzg_private.achievement_node_state values(who,explosive.body,node_rule->>'id',t.cycle,hp) on conflict(user_id,body,node) do update set cycle=excluded.cycle,hp=excluded.hp;
 if hp=0 then perform tzg_private.achievement_add(who,'mined',1);if (node_rule->>'rare')::boolean then perform tzg_private.achievement_add(who,'rare_mined',1);end if;
 perform tzg_private.achievement_unique(who,'mining_body',explosive.body);perform tzg_private.achievement_unique(who,'mining_system',target->>'system');perform tzg_private.achievement_unique(who,'mineral',node_rule->>'type');
 insert into tzg_private.achievement_origins values(who,explosive.body,node_rule->>'type',1) on conflict(user_id,body,type) do update set qty=tzg_private.achievement_origins.qty+1;
 end if;end loop;
 end if;
 if action='mine' then
 if phase<>'parked' or not(p_sample->>'foot')::boolean or p_sample->>'mode'<>'manual' or not(p_sample->>'input')::boolean or world is null or t.last_hit is not null and now_at-t.last_hit<interval '.30 seconds' then raise invalid_parameter_value using message='Mining requires an active player on a public surface and the mining cooldown';end if;
 select value into node_rule from jsonb_array_elements(world->'nodes') where value->>'id'=p_action->>'node';
 if node_rule is null or tzg_private.achievement_distance(position,node_rule->'pos')>6.25 then raise invalid_parameter_value using message='Mineral node is unknown or outside mining reach';end if;
 if p_action->>'tool'<>'pickaxe' then
 select value into tool from tzg_private.achievement_rules,jsonb_array_elements(data) where key='tools' and value->>'id'=p_action->>'tool';
 if tool is null or not exists(select 1 from tzg_private.player_saves,jsonb_array_elements(inventory) item where user_id=who and item->>'type'=tool->>'id' and (item->>'qty')::int>0) then raise insufficient_privilege using message='Mining tool is not owned';end if;damage:=(tool->>'damage')::integer;
 end if;
 select case when cycle=t.cycle then s.hp else (node_rule->>'hp')::integer end into hp from tzg_private.achievement_node_state s where s.user_id=who and s.body=world->>'id' and s.node=node_rule->>'id';
 hp:=coalesce(hp,(node_rule->>'hp')::integer);if hp=0 then raise invalid_parameter_value using message='This mineral is already depleted';end if;hp:=greatest(0,hp-damage);
 insert into tzg_private.achievement_node_state values(who,world->>'id',node_rule->>'id',t.cycle,hp) on conflict(user_id,body,node) do update set cycle=excluded.cycle,hp=excluded.hp;
 update tzg_private.achievement_totals set last_hit=now_at where user_id=who;
 if hp=0 then perform tzg_private.achievement_add(who,'mined',1);if (node_rule->>'rare')::boolean then perform tzg_private.achievement_add(who,'rare_mined',1);end if;
 perform tzg_private.achievement_unique(who,'mining_body',world->>'id');perform tzg_private.achievement_unique(who,'mining_system',world->>'system');perform tzg_private.achievement_unique(who,'mineral',node_rule->>'type');
 insert into tzg_private.achievement_origins values(who,world->>'id',node_rule->>'type',1) on conflict(user_id,body,type) do update set qty=tzg_private.achievement_origins.qty+1;
 end if;
 end if;
 result:=jsonb_build_object('seq',p_seq,'accepted',true,'changed',exists(select 1 from tzg_private.achievement_progress where user_id=who and completed_at is not null and notified_at is null));
 update tzg_private.achievement_runs set seq=p_seq,sample=p_sample,observed_at=now_at,countdown_at=r.countdown_at,airborne_at=r.airborne_at,entry_pending=r.entry_pending,warp=r.warp,boost_left=r.boost_left,boost_stopped=r.boost_stopped,last_result=result where user_id=who;
 return result;
end$$;
create function public.tzg_achievement_observe(p_run uuid,p_seq bigint,p_sample jsonb,p_action jsonb default '{"type":"sample"}') returns jsonb language sql security invoker set search_path='' as $$select tzg_private.achievement_observe(p_run,p_seq,p_sample,p_action)$$;
create function tzg_private.achievement_consume_origin(who uuid,item text,amount bigint,for_craft boolean) returns void language plpgsql security definer set search_path='' as $$
declare origin record;n bigint;remaining bigint:=amount;begin
 for origin in select * from tzg_private.achievement_origins where user_id=who and type=item and qty>0 order by body for update loop
 exit when remaining<=0;n:=least(remaining,origin.qty);remaining:=remaining-n;
 update tzg_private.achievement_origins set qty=qty-n where user_id=who and body=origin.body and type=item;
 if for_craft and n>0 then perform tzg_private.achievement_unique(who,'craft_body',origin.body);end if;
 end loop;end$$;
create function tzg_private.achievement_record_save(who uuid,before_row tzg_private.player_saves,after_state jsonb,save_mutation uuid,new_revision bigint) returns void language plpgsql security definer set search_path='' as $$
declare spent jsonb:='{}';gained jsonb:='{}';row record;recipe jsonb;ingredient record;batch bigint;self_batch bigint;available bigint;quantity bigint;sold bigint:=0;expected_fp bigint:=0;expected_rc bigint:=0;rule jsonb;present tzg_private.achievement_runs;can_craft boolean:=false;can_trade boolean:=false;
begin
 insert into tzg_private.achievement_save_receipts(user_id,mutation,revision,spent_fp,spent_rc) values(who,save_mutation,new_revision,greatest(0,before_row.fp-(after_state->>'fp')::bigint),greatest(0,before_row.rc-(after_state->>'rc')::bigint)) on conflict do nothing;
 if not found then return;end if;
 select * into present from tzg_private.achievement_runs where user_id=who and sid=(auth.jwt()->>'session_id')::uuid and observed_at>clock_timestamp()-interval '30 seconds';
 if found and present.sample->>'body'='Earth' and present.sample->>'phase'='parked' and (present.sample->>'foot')::boolean and present.sample->>'mode'='manual' then
 can_craft:=tzg_private.achievement_distance(present.sample->'pos','[-28,0,-38]'::jsonb)<14;
 can_trade:=tzg_private.achievement_distance(present.sample->'pos','[0,0,-45]'::jsonb)<12;
 end if;
 for row in with old_items as(select value->>'type' type,sum((value->>'qty')::bigint) qty from jsonb_array_elements(before_row.inventory) group by 1),new_items as(select value->>'type' type,sum((value->>'qty')::bigint) qty from jsonb_array_elements(after_state->'inventory') group by 1) select coalesce(o.type,n.type) type,coalesce(o.qty,0)-coalesce(n.qty,0) difference from old_items o full join new_items n on o.type=n.type loop
 if row.difference>0 then spent:=spent||jsonb_build_object(row.type,row.difference);elsif row.difference<0 then gained:=gained||jsonb_build_object(row.type,-row.difference);end if;end loop;
 update tzg_private.achievement_save_receipts set spent_items=spent where user_id=who and mutation=save_mutation;
 if can_craft then
 for recipe in select value from tzg_private.achievement_rules,jsonb_array_elements(data) where key='recipes' loop
 batch:=coalesce((gained->>(recipe->>'id'))::bigint,0)/(recipe->>'output')::integer;
 for ingredient in select key,value from jsonb_each_text(recipe->'ingredients') loop batch:=least(batch,coalesce((spent->>ingredient.key)::bigint,0)/ingredient.value::bigint);end loop;
 if batch>0 then
 self_batch:=batch;
 for ingredient in select key,value from jsonb_each_text(recipe->'ingredients') loop select coalesce(sum(qty),0) into available from tzg_private.achievement_origins where user_id=who and type=ingredient.key;self_batch:=least(self_batch,available/ingredient.value::bigint);end loop;
 perform tzg_private.achievement_add(who,'crafted',batch*(recipe->>'output')::bigint);
 perform tzg_private.achievement_add(who,'self_crafted',self_batch*(recipe->>'output')::bigint);
 perform tzg_private.achievement_unique(who,'recipe',recipe->>'id');
 if (recipe->>'tool')::boolean then perform tzg_private.achievement_unique(who,'tool',recipe->>'id');end if;
 for ingredient in select key,value from jsonb_each_text(recipe->'ingredients') loop
 quantity:=batch*ingredient.value::bigint;spent:=spent||jsonb_build_object(ingredient.key,(spent->>ingredient.key)::bigint-quantity);perform tzg_private.achievement_consume_origin(who,ingredient.key,quantity,true);
 end loop;
 end if;end loop;end if;
 for rule in select value from tzg_private.achievement_rules,jsonb_array_elements(data) where key='resources' loop
 quantity:=coalesce((spent->>(rule->>'id'))::bigint,0);sold:=sold+quantity;expected_fp:=expected_fp+quantity*(rule->>'fp')::integer;expected_rc:=expected_rc+quantity*(rule->>'rc')::integer;
 end loop;
 if can_trade and sold>0 and (after_state->>'fp')::bigint-before_row.fp=expected_fp and (after_state->>'rc')::bigint-before_row.rc=expected_rc then
 perform tzg_private.achievement_add(who,'trades',1);perform tzg_private.achievement_add(who,'earned_fp',expected_fp);perform tzg_private.achievement_add(who,'earned_rc',expected_rc);
 if not exists(select 1 from jsonb_array_elements(after_state->'inventory') i join tzg_private.achievement_rules r on r.key='resources' where exists(select 1 from jsonb_array_elements(r.data) d where d->>'id'=i->>'type')) then
 insert into tzg_private.achievement_totals(user_id,cycle) values(who,1) on conflict(user_id) do update set cycle=tzg_private.achievement_totals.cycle+1;
 end if;
 end if;
 -- Any disappearance consumes origin budgets, even discards/unrecognized actions.
 for ingredient in select key,value from jsonb_each_text(spent) loop perform tzg_private.achievement_consume_origin(who,ingredient.key,ingredient.value::bigint,false);end loop;
 delete from tzg_private.achievement_save_receipts where user_id=who and created_at<clock_timestamp()-interval '1 day';
end$$;
-- Retain the original save/session/revision/XP validator, adding only achievement receipts.
alter function public.tzg_player_save(uuid,bigint,uuid,jsonb) set schema tzg_private;
alter function tzg_private.tzg_player_save(uuid,bigint,uuid,jsonb) rename to player_save_before_achievements;
revoke all on function tzg_private.player_save_before_achievements(uuid,bigint,uuid,jsonb) from public,anon,authenticated;
create function tzg_private.achievement_player_save(p_account uuid,p_expected_revision bigint,p_mutation uuid,p_state jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=tzg_private.require_player();before_row tzg_private.player_saves;result jsonb;begin
 if who is distinct from p_account then raise insufficient_privilege using message='Account changed';end if;
 insert into tzg_private.player_saves(user_id) values(who) on conflict do nothing;select * into before_row from tzg_private.player_saves where user_id=who for update;
 result:=tzg_private.player_save_before_achievements(p_account,p_expected_revision,p_mutation,p_state);
 if before_row.last_mutation is distinct from p_mutation then
 perform pg_advisory_xact_lock(hashtextextended(who::text,174));
 perform tzg_private.achievement_record_save(who,before_row,p_state,p_mutation,(result->>'revision')::bigint);
 end if;return result;end$$;
create function public.tzg_player_save(p_account uuid,p_expected_revision bigint,p_mutation uuid,p_state jsonb) returns jsonb language sql security invoker set search_path='' as $$select tzg_private.achievement_player_save(p_account,p_expected_revision,p_mutation,p_state)$$;
-- Every catalog entry derives progress from a fixed server-owned metric/set.
create table tzg_private.achievement_metric_map(id text primary key references tzg_private.achievement_catalog,metric text not null);
insert into tzg_private.achievement_metric_map values
('001','launches'),('002','air_m'),('003','air_m'),('004','reentries'),('005','low_m'),('006','landings'),('007','reentries'),('008','boost_s'),('009','manual_s'),('010','manual_s'),
('011','warps'),('012','warps'),('013','warps'),('014','interstellar'),('015','warps'),('016','deep_s'),('017','interstellar'),('018','warps'),('020','warps'),
('031','mined'),('032','mined'),('033','mined'),('035','rare_mined'),('036','mined'),('038','mined'),('040','mined'),
('041','crafted'),('042','crafted'),('044','crafted'),('045','self_crafted'),('046','crafted'),('048','crafted'),('050','crafted'),
('051','earned_fp'),('052','earned_rc'),('053','trades'),('054','trades'),('055','earned_fp'),('056','trades'),('057','earned_rc'),('058','earned_fp'),('059','trades'),('060','earned_fp'),('075','party_s');
alter table tzg_private.achievement_metric_map enable row level security;revoke all on tzg_private.achievement_metric_map from public,anon,authenticated;
create or replace function tzg_private.achievement_sync(who uuid) returns void language plpgsql security definer set search_path='' as $$
declare counters jsonb;row record;v bigint;lev bigint;days bigint;world_count bigint;begin
 perform pg_advisory_xact_lock(hashtextextended(who::text,174));
 select (tzg_private.account_progress(who)->>'level')::bigint into lev;
 -- Retroactive credit only for previously server-verified exploration records.
 insert into tzg_private.achievement_uniques(user_id,kind,value) select who,'body',e.body from tzg_private.exploration_events e join tzg_private.achievement_bodies b on b.body=e.body where e.user_id=who and e.landed and e.verified_landing on conflict do nothing;
 select coalesce(t.counters,'{}') into counters from tzg_private.achievement_totals t where user_id=who;counters:=coalesce(counters,'{}');
 select count(*) into days from tzg_private.achievement_days where user_id=who;
 for row in select c.*,m.metric from tzg_private.achievement_catalog c left join tzg_private.achievement_metric_map m on m.id=c.id where c.available order by c.id loop
 v:=0;
 if row.metric is not null then v:=floor(coalesce((counters->>row.metric)::numeric,0));
 elsif row.id between '061' and '070' then v:=lev;
 elsif row.id in ('074','076','078','079','080') then v:=days;
 elsif row.id='071' then select count(*) into v from tzg_private.friend_links where (a=who or b=who) and status='accepted';
 elsif row.id='072' then select count(*) into v from tzg_private.social_members m join tzg_private.social_rooms r on r.id=m.room where m.player=who and r.kind='group';
 elsif row.id='019' then select count(*) into v from tzg_private.system_unlocks u join tzg_private.system_unlock_catalog c on c.system=u.system where u.user_id=who;
 elsif row.id in ('021','023','022','024','025','026','027','029','030','073','077') then
 select count(*) into v from tzg_private.achievement_uniques u join tzg_private.achievement_bodies b on b.body=u.value where u.user_id=who and u.kind=case when row.id in ('073','077') then 'party_body' else 'body' end and case when row.id in ('021','023','073') then b.kind like '%PLANET%' when row.id in ('022','024') then b.kind='MOON' when row.id='025' then b.kind like '%EXOPLANET%' when row.id='027' then b.air else true end;
 elsif row.id='028' then
 select count(*) into v from(select b.system from tzg_private.achievement_bodies b left join tzg_private.achievement_uniques u on u.user_id=who and u.kind='body' and u.value=b.body group by b.system having count(*)=count(u.value)) completed_systems;
 elsif row.id in ('034','037','039','043','047','049') then
 select count(*) into v from tzg_private.achievement_uniques u where u.user_id=who and u.kind=case row.id when '034' then 'mining_body' when '037' then 'mining_system' when '039' then 'mineral' when '043' then 'tool' when '047' then 'craft_body' else 'recipe' end and (row.id<>'047' or exists(select 1 from tzg_private.achievement_bodies b where b.body=u.value and b.kind like '%PLANET%'));
 end if;
 insert into tzg_private.achievement_progress(user_id,id,progress,completed_at) values(who,row.id,least(row.target,v),case when v>=row.target then clock_timestamp() end)
 on conflict(user_id,id) do update set progress=greatest(tzg_private.achievement_progress.progress,excluded.progress),completed_at=coalesce(tzg_private.achievement_progress.completed_at,excluded.completed_at)
 where tzg_private.achievement_progress.progress<excluded.progress or tzg_private.achievement_progress.completed_at is null and excluded.completed_at is not null;
 end loop;
end$$;
-- Dynamic set targets reflect only currently obtainable public content.
update tzg_private.achievement_catalog set target=(select count(*) from tzg_private.achievement_bodies) where id='030';
do $$begin if to_regclass('tzg_private.system_unlock_catalog') is not null then update tzg_private.achievement_catalog set target=(select count(*) from tzg_private.system_unlock_catalog) where id='019';end if;end$$;
update tzg_private.achievement_catalog set target=(select count(distinct n->>'type') from tzg_private.achievement_rules,jsonb_array_elements(data) w,jsonb_array_elements(w->'nodes') n where key='worlds') where id='039';
update tzg_private.achievement_catalog set target=(select jsonb_array_length(data) from tzg_private.achievement_rules where key='recipes') where id='049';
update tzg_private.achievement_catalog set available=true;
-- A server-observed active input interval, not reconnect count, credits one UTC day.
-- Existing play-day entries are retained. New days are inserted by the observation RPC.
revoke all on function tzg_private.achievement_add(uuid,text,numeric),tzg_private.achievement_unique(uuid,text,text),tzg_private.achievement_distance(jsonb,jsonb),tzg_private.achievement_ground_altitude(jsonb),tzg_private.achievement_tracker_start(uuid),tzg_private.achievement_observe(uuid,bigint,jsonb,jsonb),tzg_private.achievement_consume_origin(uuid,text,bigint,boolean),tzg_private.achievement_record_save(uuid,tzg_private.player_saves,jsonb,uuid,bigint),tzg_private.achievement_player_save(uuid,bigint,uuid,jsonb),tzg_private.achievement_sync(uuid),public.tzg_achievement_tracker_start(uuid),public.tzg_achievement_observe(uuid,bigint,jsonb,jsonb),public.tzg_player_save(uuid,bigint,uuid,jsonb) from public,anon,authenticated;
grant execute on function tzg_private.achievement_tracker_start(uuid),tzg_private.achievement_observe(uuid,bigint,jsonb,jsonb),tzg_private.achievement_player_save(uuid,bigint,uuid,jsonb),public.tzg_achievement_tracker_start(uuid),public.tzg_achievement_observe(uuid,bigint,jsonb,jsonb),public.tzg_player_save(uuid,bigint,uuid,jsonb) to authenticated;
