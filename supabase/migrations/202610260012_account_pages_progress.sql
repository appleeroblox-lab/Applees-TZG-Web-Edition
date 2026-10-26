-- v87. Run after 011. Private account pages, real exploration progress and self-service actions.
-- No service-role key is used by the browser. Every target is derived from the signed-in user.
begin;
create table if not exists tzg_private.self_account_state(user_id uuid primary key references auth.users(id) on delete cascade,deactivated_at timestamptz);
create table if not exists tzg_private.exploration_visits(user_id uuid references auth.users(id) on delete cascade,body text not null,visited_at timestamptz not null default now(),primary key(user_id,body));
alter table tzg_private.self_account_state enable row level security;
alter table tzg_private.exploration_visits enable row level security;
revoke all on tzg_private.self_account_state,tzg_private.exploration_visits from public,anon,authenticated;
create or replace function tzg_private.account_identity() returns uuid language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid();begin
 if caller is null or not exists(select 1 from auth.users where id=caller and email_confirmed_at is not null) or not exists(select 1 from auth.sessions where user_id=caller and id::text=auth.jwt()->>'session_id') then raise insufficient_privilege using message='Sign in again to manage your account.';end if;return caller;end;$$;
revoke all on function tzg_private.account_identity() from public,anon,authenticated;
-- Preserve existing moderation decisions; a self-deactivation cannot bypass a developer ban.
do $$begin if to_regprocedure('tzg_private.player_moderation_before_v87()') is null then alter function public.tzg_player_moderation() set schema tzg_private;alter function tzg_private.tzg_player_moderation() rename to player_moderation_before_v87;end if;end;$$;
revoke all on function tzg_private.player_moderation_before_v87() from public,anon,authenticated;
create or replace function public.tzg_player_moderation() returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid();notice jsonb;stamp timestamptz;begin
 notice:=tzg_private.player_moderation_before_v87();if notice is not null then return notice;end if;
 select deactivated_at into stamp from tzg_private.self_account_state where user_id=caller;
 if stamp is not null then return jsonb_build_object('kind','deactivated','reason','You temporarily deactivated this account.','decided_at',stamp,'expires_at',null);end if;return null;end;$$;
revoke all on function public.tzg_player_moderation() from public,anon;
grant execute on function public.tzg_player_moderation() to authenticated;
create or replace function tzg_private.require_player_identity() returns uuid language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.account_identity();notice jsonb;begin notice:=public.tzg_player_moderation();if notice is not null then raise exception using errcode='P0001',message=case when notice->>'kind'='deactivated' then 'Account deactivated' when notice->>'kind'='deleted' then 'Game account removed' else 'Account suspended' end,detail=notice::text;end if;return caller;end;$$;
revoke all on function tzg_private.require_player_identity() from public,anon,authenticated;
create or replace function tzg_private.account_progress(who uuid) returns jsonb language sql security definer set search_path='' as $$
 with points as(select count(*)::integer*100 xp,coalesce(jsonb_agg(body order by visited_at),'[]'::jsonb) worlds from tzg_private.exploration_visits where user_id=who),lev as(select *,least(100,greatest(1,floor((1+sqrt(1+8*xp/100.0))/2)::integer)) level from points)
 select jsonb_build_object('xp',xp,'level',level,'level_xp',xp-50*level*(level-1),'required_xp',case when level<100 then 100*level else null end,'worlds',worlds) from lev
$$;
revoke all on function tzg_private.account_progress(uuid) from public,anon,authenticated;
create or replace function public.tzg_account_dashboard() returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.account_identity();result jsonb;sessions jsonb;begin
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'current',s.id::text=auth.jwt()->>'session_id','game_active',exists(select 1 from tzg_private.active_game_sessions g where g.user_id=caller and g.session_id=s.id),'created_at',to_jsonb(s)->>'created_at','device',left(regexp_replace(coalesce(to_jsonb(s)->>'user_agent','Browser session'),'[[:cntrl:]]','','g'),120)) order by s.id),'[]'::jsonb) into sessions from auth.sessions s where s.user_id=caller;
 select jsonb_build_object('joined_at',u.created_at,'email_confirmed',u.email_confirmed_at is not null,'developer',exists(select 1 from tzg_private.debug_admins where user_id=caller and enabled),'sessions',sessions,'blocked_count',(select count(*) from tzg_private.player_blocks where blocker=caller),'inventory',coalesce(s.inventory,'[]'::jsonb),'fp',coalesce(s.fp,0),'rc',coalesce(s.rc,0),'progress',tzg_private.account_progress(caller)) into result from auth.users u left join tzg_private.player_saves s on s.user_id=u.id where u.id=caller;return result;end;$$;
revoke all on function public.tzg_account_dashboard() from public,anon;
grant execute on function public.tzg_account_dashboard() to authenticated;
create or replace function public.tzg_account_explore(p_body text) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();begin
 if p_body is null or not(p_body=any(ARRAY['Mercury','Venus','Earth','Moon','Mars','Ceres','Pluto','Eris','Haumea','Makemake','Phobos','Deimos','Io','Europa','Ganymede','Callisto','Titan','Enceladus','Mimas','Rhea','Dione','Tethys','Iapetus','Miranda','Ariel','Umbriel','Titania','Oberon','Triton','Proteus','Nereid','Charon','Nix','Hydra','Dysnomia','Hiʻiaka','Namaka','Proxima b','Andromeda · simulated world','Triangulum · simulated world','Large Magellanic Cloud · simulated world','Small Magellanic Cloud · simulated world','M87 · simulated world','M51 · simulated world','M104 · simulated world','TRAPPIST-1 b','TRAPPIST-1 c','TRAPPIST-1 d','TRAPPIST-1 e','TRAPPIST-1 f','TRAPPIST-1 g','TRAPPIST-1 h','RS 2041 b','RS 2041 c','RS 2041 c I','RS 2041 d','RS 2042 b','RS 2042 c','RS 2042 c I','RS 2042 d','RS 2043 b','RS 2043 c','RS 2043 c I','RS 2043 d','RS 2044 b','RS 2044 c','RS 2044 c I','RS 2044 d','RS 2045 b','RS 2045 c','RS 2045 c I','RS 2045 d','RS 2046 b','RS 2046 c','RS 2046 c I','RS 2046 d','Orcus','Quaoar','Sedna','Gonggong','Salacia','Varda','Actaea','Ilmarë','Vanth','Xiangliu','Proxima d'])) then raise invalid_parameter_value using message='Unknown exploration destination.';end if;
 insert into tzg_private.exploration_visits(user_id,body) values(caller,p_body) on conflict do nothing;
 return tzg_private.account_progress(caller);end;$$;
revoke all on function public.tzg_account_explore(text) from public,anon;
grant execute on function public.tzg_account_explore(text) to authenticated;
create or replace function public.tzg_account_manage(p_action text,p_confirmation text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.account_identity();roomrow record;successor uuid;sid text:=auth.jwt()->>'session_id';begin
 perform pg_advisory_xact_lock(hashtextextended(caller::text,87));
 if p_action='reactivate' then
  if tzg_private.player_moderation_before_v87() is not null then raise insufficient_privilege using message='A moderation decision cannot be removed by reactivation.';end if;
  delete from tzg_private.self_account_state where user_id=caller;return jsonb_build_object('active',true);
 end if;
 if p_action not in ('deactivate','delete','revoke_others') then raise invalid_parameter_value using message='Unknown account action.';end if;
 if not exists(select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) method where method->>'method'='password' and case when method->>'timestamp' ~ '^[0-9]+$' then (method->>'timestamp')::numeric between extract(epoch from now()-interval '5 minutes') and extract(epoch from now()+interval '1 minute') else false end) then raise insufficient_privilege using message='Enter your current password again before this action.';end if;
 if p_action='revoke_others' then delete from auth.sessions where user_id=caller and id::text<>sid;return jsonb_build_object('revoked',true);end if;
 if p_action='deactivate' then
  insert into tzg_private.self_account_state(user_id,deactivated_at) values(caller,now()) on conflict(user_id) do update set deactivated_at=excluded.deactivated_at;
  delete from tzg_private.active_game_sessions where user_id=caller;update tzg_private.player_profiles set last_seen_at=null,online_session=null where user_id=caller;delete from auth.sessions where user_id=caller and id::text<>sid;return jsonb_build_object('deactivated',true);
 end if;
 if p_confirmation is distinct from 'DELETE' then raise invalid_parameter_value using message='Type DELETE to permanently remove your account.';end if;
 -- Preserve groups for their remaining members. Delete empty owned groups.
 for roomrow in select id from tzg_private.social_rooms where owner=caller for update loop
  select player into successor from tzg_private.social_members where room=roomrow.id and player<>caller order by joined_at,player limit 1;
  if successor is null then delete from tzg_private.social_rooms where id=roomrow.id;else update tzg_private.social_rooms set owner=successor where id=roomrow.id;end if;
 end loop;
 delete from tzg_private.chat_images where message_id in(select id from tzg_private.chat_messages where user_id=caller);
 update tzg_private.chat_messages set user_id=null,username='deleted',display_name='Account Deleted',body='[Account deleted]',deleted=true where user_id=caller;
 update tzg_private.social_messages set sender=null,body='[Account deleted]',image=null,voice=null,deleted=true where sender=caller;
 delete from auth.users where id=caller;
 return jsonb_build_object('deleted',true);end;$$;
revoke all on function public.tzg_account_manage(text,text) from public,anon;
grant execute on function public.tzg_account_manage(text,text) to authenticated;
-- Deactivated accounts cannot be found in player search or openable public profiles.
do $$begin if to_regprocedure('tzg_private.social_profile_before_v87(uuid)') is null then alter function tzg_private.social_profile(uuid) rename to social_profile_before_v87;end if;end;$$;
revoke all on function tzg_private.social_profile_before_v87(uuid) from public,anon,authenticated;
create or replace function tzg_private.social_profile(who uuid) returns jsonb language sql stable security definer set search_path='' as $$select tzg_private.social_profile_before_v87(who) where not exists(select 1 from tzg_private.self_account_state where user_id=who and deactivated_at is not null)$$;
revoke all on function tzg_private.social_profile(uuid) from public,anon,authenticated;
do $$begin if to_regprocedure('tzg_private.social_search_before_v87(text,text,integer)') is null then alter function public.tzg_social_search(text,text,integer) set schema tzg_private;alter function tzg_private.tzg_social_search(text,text,integer) rename to social_search_before_v87;end if;end;$$;
revoke all on function tzg_private.social_search_before_v87(text,text,integer) from public,anon,authenticated;
create or replace function public.tzg_social_search(p_query text,p_kind text default 'players',p_offset integer default 0) returns jsonb language sql security definer set search_path='' as $$select coalesce(jsonb_agg(value),'[]'::jsonb) from jsonb_array_elements(tzg_private.social_search_before_v87(p_query,p_kind,p_offset)) where value<>'null'::jsonb$$;
revoke all on function public.tzg_social_search(text,text,integer) from public,anon;
grant execute on function public.tzg_social_search(text,text,integer) to authenticated;
do $$begin if to_regprocedure('tzg_private.chat_profile_before_v87(bigint)') is null then alter function public.tzg_chat_profile(bigint) set schema tzg_private;alter function tzg_private.tzg_chat_profile(bigint) rename to chat_profile_before_v87;end if;end;$$;
revoke all on function tzg_private.chat_profile_before_v87(bigint) from public,anon,authenticated;
create or replace function public.tzg_chat_profile(p_message bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb:=tzg_private.chat_profile_before_v87(p_message);begin if exists(select 1 from tzg_private.player_profiles p join tzg_private.self_account_state a on a.user_id=p.user_id where p.username=result->>'username' and a.deactivated_at is not null) then raise exception 'This profile is unavailable.';end if;return result;end;$$;
revoke all on function public.tzg_chat_profile(bigint) from public,anon;
grant execute on function public.tzg_chat_profile(bigint) to authenticated;
commit;
