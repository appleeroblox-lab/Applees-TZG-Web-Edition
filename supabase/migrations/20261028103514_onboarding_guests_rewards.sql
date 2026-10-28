-- Additive v0.0.107 update. Existing accounts, saves and progress are preserved.
begin;
create table if not exists tzg_private.player_onboarding (
 user_id uuid primary key references auth.users(id) on delete cascade,
 tutorial_done boolean not null default false,
 tips_enabled boolean not null default true,
 welcome_eligible boolean not null default false,
 daily_day integer not null default 0 check(daily_day between 0 and 7),
 daily_date date,
 updated_at timestamptz not null default now()
);
create table if not exists tzg_private.reward_claims (
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('welcome','daily','discovery','landing')),
 claim_key text not null,
 mutation uuid not null,
 fp integer not null check(fp>=0), rc integer not null check(rc>=0),
 claimed_at timestamptz not null default now(),
 primary key(user_id,kind,claim_key), unique(user_id,mutation)
);
create table if not exists tzg_private.reward_bodies(body text primary key,landable boolean not null);
insert into tzg_private.reward_bodies(body,landable) values ('Mercury',true),('Venus',true),('Earth',true),('Moon',true),('Mars',true),('Jupiter',false),('Saturn',false),('Uranus',false),('Neptune',false),('Ceres',true),('Pluto',true),('Eris',true),('Haumea',true),('Makemake',true),('Phobos',true),('Deimos',true),('Io',true),('Europa',true),('Ganymede',true),('Callisto',true),('Titan',true),('Enceladus',true),('Mimas',true),('Rhea',true),('Dione',true),('Tethys',true),('Iapetus',true),('Miranda',true),('Ariel',true),('Umbriel',true),('Titania',true),('Oberon',true),('Triton',true),('Proteus',true),('Nereid',true),('Charon',true),('Nix',true),('Hydra',true),('Dysnomia',true),('Hiʻiaka',true),('Namaka',true),('Proxima b',true),('TRAPPIST-1 b',true),('TRAPPIST-1 c',true),('TRAPPIST-1 d',true),('TRAPPIST-1 e',true),('TRAPPIST-1 f',true),('TRAPPIST-1 g',true),('TRAPPIST-1 h',true),('Orcus',true),('Quaoar',true),('Sedna',true),('Gonggong',true),('Salacia',true),('Varda',true),('Actaea',true),('Ilmarë',true),('Vanth',true),('Xiangliu',true),('Proxima c',false),('Proxima d',true) on conflict(body) do update set landable=excluded.landable;
create table if not exists tzg_private.exploration_events (
 user_id uuid not null references auth.users(id) on delete cascade,
 body text not null references tzg_private.reward_bodies(body),
 session_id uuid not null, observed_at timestamptz not null default now(),
 landed boolean not null default false, verified_discovery boolean not null default false, verified_landing boolean not null default false, primary key(user_id,body)
);
create table if not exists tzg_private.site_visitors(id uuid primary key,first_seen timestamptz not null default now(),last_seen timestamptz not null default now());
create table if not exists tzg_private.play_sessions(
 id uuid primary key,visitor uuid not null references tzg_private.site_visitors(id),
 user_id uuid references auth.users(id) on delete cascade,
 started_at timestamptz not null default now(),last_seen timestamptz not null default now(),
 duration_seconds integer not null default 0,ended_at timestamptz
);
create index if not exists play_sessions_active on tzg_private.play_sessions(last_seen) where ended_at is null;
create index if not exists play_sessions_day on tzg_private.play_sessions(started_at);
create index if not exists play_sessions_user on tzg_private.play_sessions(user_id) where user_id is not null;
-- All new state stays private. Only narrow validated RPCs can access it.
alter table tzg_private.player_onboarding enable row level security;
alter table tzg_private.reward_claims enable row level security;
alter table tzg_private.reward_bodies enable row level security;
alter table tzg_private.exploration_events enable row level security;
alter table tzg_private.site_visitors enable row level security;
alter table tzg_private.play_sessions enable row level security;
revoke all on tzg_private.player_onboarding,tzg_private.reward_claims,tzg_private.reward_bodies,tzg_private.exploration_events,tzg_private.site_visitors,tzg_private.play_sessions from public,anon,authenticated;

-- Only accounts INSERTED after activation are eligible. No existing account is backfilled.
create or replace function tzg_private.new_player_onboarding() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into tzg_private.player_onboarding(user_id,welcome_eligible) values(new.id,true) on conflict do nothing;return new;end;$$;
create or replace trigger tzg_new_player_onboarding after insert on auth.users for each row execute function tzg_private.new_player_onboarding();
revoke all on function tzg_private.new_player_onboarding() from public,anon,authenticated;

create or replace function public.tzg_onboarding_state(p_tutorial_done boolean default null,p_tips_enabled boolean default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();o tzg_private.player_onboarding;
begin
 insert into tzg_private.player_onboarding(user_id) values(caller) on conflict do nothing;
 update tzg_private.player_onboarding set tutorial_done=tutorial_done or coalesce(p_tutorial_done,false),tips_enabled=coalesce(p_tips_enabled,tips_enabled),updated_at=now() where user_id=caller returning * into o;
 return jsonb_build_object('tutorial_done',o.tutorial_done,'tips_enabled',o.tips_enabled,'welcome_available',o.welcome_eligible and not exists(select 1 from tzg_private.reward_claims where user_id=caller and kind='welcome'), 'daily_day',case when o.daily_date=(now() at time zone 'UTC')::date then o.daily_day else o.daily_day%7+1 end,'daily_available',o.daily_date is distinct from (now() at time zone 'UTC')::date,'next_claim_at',((now() at time zone 'UTC')::date+1)::timestamp at time zone 'UTC','exploration_rewards_available',false,'discovered',coalesce((select jsonb_agg(body) from tzg_private.exploration_events where user_id=caller),'[]'::jsonb),'landed',coalesce((select jsonb_agg(body) from tzg_private.exploration_events where user_id=caller and landed),'[]'::jsonb));
end;$$;

create or replace function public.tzg_exploration_event(p_body text,p_landed boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();sid uuid:=(auth.jwt()->>'session_id')::uuid;e tzg_private.exploration_events;can_land boolean;
begin
 select landable into can_land from tzg_private.reward_bodies where body=p_body;
 if can_land is null then raise invalid_parameter_value using message='This destination has no exploration reward.';end if;
 insert into tzg_private.exploration_events(user_id,body,session_id) values(caller,p_body,sid) on conflict(user_id,body) do update set session_id=excluded.session_id,observed_at=case when tzg_private.exploration_events.session_id=excluded.session_id then tzg_private.exploration_events.observed_at else now() end;
 if p_landed and can_land then update tzg_private.exploration_events set landed=true where user_id=caller and body=p_body and observed_at<=now()-interval '3 seconds';end if;
 select * into e from tzg_private.exploration_events where user_id=caller and body=p_body;
 return jsonb_build_object('body',p_body,'landed',e.landed,'reward_verified',case when p_landed then e.verified_landing else e.verified_discovery end);
end;$$;

create or replace function public.tzg_reward_claim(p_kind text,p_body text,p_expected_revision bigint,p_mutation uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();s tzg_private.player_saves;o tzg_private.player_onboarding;receipt tzg_private.reward_claims;k text;gain_fp integer:=0;gain_rc integer:=0;d integer;stamp date:=(now() at time zone 'UTC')::date;
begin
 if p_mutation is null or p_expected_revision is null or p_expected_revision<0 then raise invalid_parameter_value using message='Invalid reward claim.';end if;
 insert into tzg_private.player_saves(user_id) values(caller) on conflict do nothing;
 select * into s from tzg_private.player_saves where user_id=caller for update;
 select * into receipt from tzg_private.reward_claims where user_id=caller and mutation=p_mutation;
 if found then
  if receipt.kind is distinct from p_kind or (p_kind in ('discovery','landing') and receipt.claim_key is distinct from p_body) then raise invalid_parameter_value using message='Reward retry changed.';end if;
  return jsonb_build_object('revision',s.revision,'state',jsonb_build_object('fp',s.fp,'rc',s.rc,'inventory',s.inventory),'awarded',true,'retry',true,'fp',receipt.fp,'rc',receipt.rc);
 end if;
 if s.revision<>p_expected_revision then raise sqlstate '40001' using message='CLOUD_CONFLICT: reload the latest progress before claiming.';end if;
 insert into tzg_private.player_onboarding(user_id) values(caller) on conflict do nothing;
 select * into o from tzg_private.player_onboarding where user_id=caller for update;
 if p_kind='welcome' then
  k:='once';if not o.welcome_eligible then raise insufficient_privilege using message='Welcome rewards are for new accounts only.';end if;gain_fp:=250;gain_rc:=5;
 elsif p_kind='daily' then
  k:=stamp::text;d:=o.daily_day%7+1;gain_fp:=(array[100,150,200,250,300,400,500])[d];if d=7 then gain_rc:=10;end if;
 elsif p_kind in ('discovery','landing') then
  k:=p_body;
  if not exists(select 1 from tzg_private.exploration_events where user_id=caller and body=p_body and session_id=(auth.jwt()->>'session_id')::uuid and ((p_kind='discovery' and verified_discovery) or (p_kind='landing' and landed and verified_landing))) then raise insufficient_privilege using message='Exploration bonuses need trusted gameplay verification.';end if;
  if p_kind='landing' and not exists(select 1 from tzg_private.reward_claims where user_id=caller and kind='discovery' and claim_key=p_body) then raise insufficient_privilege using message='Discover this world before claiming a landing.';end if;
  gain_fp:=case when p_kind='discovery' then 50 else 100 end;
 else raise invalid_parameter_value using message='Unknown reward.';end if;
 if exists(select 1 from tzg_private.reward_claims where user_id=caller and kind=p_kind and claim_key=k) then
  return jsonb_build_object('revision',s.revision,'state',jsonb_build_object('fp',s.fp,'rc',s.rc,'inventory',s.inventory),'awarded',false,'fp',0,'rc',0);
 end if;
 if s.fp+gain_fp>1000000000000 or s.rc+gain_rc>1000000000000 then raise invalid_parameter_value using message='Currency limit reached.';end if;
 insert into tzg_private.reward_claims(user_id,kind,claim_key,mutation,fp,rc) values(caller,p_kind,k,p_mutation,gain_fp,gain_rc);
 if p_kind='daily' then update tzg_private.player_onboarding set daily_day=d,daily_date=stamp,updated_at=now() where user_id=caller;end if;
 update tzg_private.player_saves set fp=fp+gain_fp,rc=rc+gain_rc,revision=revision+1,last_mutation=p_mutation,updated_at=now() where user_id=caller returning * into s;
 return jsonb_build_object('revision',s.revision,'state',jsonb_build_object('fp',s.fp,'rc',s.rc,'inventory',s.inventory),'awarded',true,'fp',gain_fp,'rc',gain_rc);
end;$$;

-- Guests read a small allowlist, never raw account tables, private messages or auth data.
create or replace function public.tzg_guest_profiles(p_query text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 if length(btrim(p_query))<2 or length(p_query)>64 then return '[]'::jsonb;end if;
 select coalesce(jsonb_agg(jsonb_build_object('username',p.username,'display_name',p.display_name,'avatar',p.avatar,'bio',p.bio,'verified',p.verified)),'[]'::jsonb) into result from (select p.* from tzg_private.player_profiles p where position(lower(btrim(p_query)) in p.username)>0 and not exists(select 1 from tzg_private.account_deletions d where d.user_id=p.user_id) and not exists(select 1 from tzg_private.self_account_state d where d.user_id=p.user_id and d.deactivated_at is not null) order by p.username limit 20)p;
 return result;end;$$;
create or replace function public.tzg_guest_chat(p_after bigint default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 if p_after is null or p_after<0 then raise invalid_parameter_value using message='Invalid cursor.';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id::text,'username',p.username,'display_name',coalesce(p.display_name,m.display_name),'avatar',p.avatar,'verified',coalesce(p.verified,false),'body',m.body,'created_at',m.created_at) order by m.id),'[]'::jsonb) into result from (select * from tzg_private.chat_messages where not deleted and created_at>now()-interval '5 minutes' and id>p_after order by id desc limit 100)m left join tzg_private.player_profiles p on p.user_id=m.user_id;
 return result;end;$$;

create or replace function public.tzg_visit(p_visitor uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin if p_visitor is null then raise invalid_parameter_value using message='Invalid visitor.';end if;insert into tzg_private.site_visitors(id) values(p_visitor) on conflict(id) do update set last_seen=now();return true;end;$$;
revoke all on function public.tzg_visit(uuid) from public,anon,authenticated;
grant execute on function public.tzg_visit(uuid) to anon,authenticated;

create or replace function public.tzg_activity(p_visitor uuid,p_session uuid,p_end boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid();s tzg_private.play_sessions;t timestamptz:=clock_timestamp();begin
 if p_visitor is null or p_session is null then raise invalid_parameter_value using message='Invalid activity session.';end if;
 if caller is not null then caller:=tzg_private.require_player();end if;
 insert into tzg_private.site_visitors(id) values(p_visitor) on conflict(id) do update set last_seen=excluded.last_seen;
 insert into tzg_private.play_sessions(id,visitor,user_id) values(p_session,p_visitor,caller) on conflict do nothing;
 select * into s from tzg_private.play_sessions where id=p_session for update;
 if s.visitor<>p_visitor or s.user_id is distinct from caller or s.ended_at is not null then raise insufficient_privilege using message='Activity session changed.';end if;
 update tzg_private.play_sessions set duration_seconds=duration_seconds+least(90,greatest(0,extract(epoch from t-s.last_seen)::integer)),last_seen=t,ended_at=case when p_end then t else null end where id=p_session;
 return jsonb_build_object('ok',true);
end;$$;
create or replace function public.tzg_debug_statistics() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 perform public.tzg_debug_authorize(null);
 select jsonb_build_object('unique_visitors',(select count(*) from tzg_private.site_visitors),'registered_accounts',(select count(*) from auth.users),'active_players',count(distinct case when ended_at is null and last_seen>now()-interval '90 seconds' then coalesce(user_id,visitor)::text end),'daily_active_players',count(distinct case when last_seen>=(now() at time zone 'UTC')::date::timestamp at time zone 'UTC' then coalesce(user_id,visitor)::text end),'total_sessions',count(*),'guest_sessions',count(*) filter(where user_id is null),'registered_sessions',count(*) filter(where user_id is not null),'average_session_seconds',coalesce(round(avg(duration_seconds)),0)) into result from tzg_private.play_sessions;
 return result;end;$$;
-- Explicit grants; no existing function/table policy is weakened.
revoke all on function public.tzg_onboarding_state(boolean,boolean),public.tzg_exploration_event(text,boolean),public.tzg_reward_claim(text,text,bigint,uuid),public.tzg_debug_statistics() from public,anon,authenticated;
grant execute on function public.tzg_onboarding_state(boolean,boolean),public.tzg_exploration_event(text,boolean),public.tzg_reward_claim(text,text,bigint,uuid),public.tzg_debug_statistics() to authenticated;
revoke all on function public.tzg_guest_profiles(text),public.tzg_guest_chat(bigint),public.tzg_activity(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.tzg_guest_profiles(text),public.tzg_guest_chat(bigint),public.tzg_activity(uuid,uuid,boolean) to anon,authenticated;
commit;
