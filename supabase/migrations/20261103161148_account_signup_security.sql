-- Optional-email accounts, private birthdays and atomic paid username changes.
begin;
create table if not exists tzg_private.account_private(
 user_id uuid primary key references auth.users(id) on delete cascade,
 date_of_birth date not null check(date_of_birth >= date '1900-01-01'),
 created_at timestamptz not null default now()
);
alter table tzg_private.account_private enable row level security;
revoke all on tzg_private.account_private from public,anon,authenticated;
create table if not exists tzg_private.auth_rate_limits(key text primary key,window_start timestamptz not null,hits integer not null);
alter table tzg_private.auth_rate_limits enable row level security;
revoke all on tzg_private.auth_rate_limits from public,anon,authenticated;
create table if not exists tzg_private.username_mutations(user_id uuid references auth.users(id) on delete cascade,mutation uuid not null,result jsonb not null,created_at timestamptz not null default now(),primary key(user_id,mutation));
alter table tzg_private.username_mutations enable row level security;
revoke all on tzg_private.username_mutations from public,anon,authenticated;
create or replace function tzg_private.visible_email(p_email text) returns text language sql immutable set search_path='' as $$select case when p_email ~* '@accounts[.]tzg[.]invalid$' then null else nullif(p_email,'') end$$;
revoke all on function tzg_private.visible_email(text) from public,anon,authenticated;
create or replace function public.tzg_auth_rate(p_key text,p_limit integer,p_seconds integer) returns boolean language plpgsql security definer set search_path='' as $$
declare allowed boolean;begin
 if length(p_key)>200 or p_limit not between 1 and 100 or p_seconds not between 60 and 3600 then raise invalid_parameter_value;end if;
 insert into tzg_private.auth_rate_limits as r values(p_key,now(),1) on conflict(key) do update set hits=case when r.window_start<=now()-make_interval(secs=>p_seconds) then 1 else r.hits+1 end,window_start=case when r.window_start<=now()-make_interval(secs=>p_seconds) then now() else r.window_start end returning hits<=p_limit into allowed;
 return allowed;end;$$;
create or replace function public.tzg_auth_lookup(p_identifier text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('user_id',u.id,'email',u.email,'email_confirmed',u.email_confirmed_at is not null)
 from auth.users u join tzg_private.player_profiles p on p.user_id=u.id
 where case when position('@' in p_identifier)>0 then lower(u.email)=lower(btrim(p_identifier)) else p.username=lower(btrim(p_identifier)) end limit 1
$$;
create or replace function public.tzg_auth_register(p_user uuid,p_date date,p_avatar text default null) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_date is null or p_date>current_date or p_date<greatest(date '1900-01-01',(current_date-interval '125 years')::date) then raise invalid_parameter_value using message='Choose a valid birthday.';end if;
 if not exists(select 1 from auth.users where id=p_user and created_at>now()-interval '5 minutes') then raise insufficient_privilege;end if;
 if p_avatar is not null and (length(p_avatar)>40000 or p_avatar !~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$') then raise invalid_parameter_value using message='Choose a smaller profile image.';end if;
 insert into tzg_private.account_private(user_id,date_of_birth) values(p_user,p_date);
 if p_avatar is not null then update tzg_private.player_profiles set avatar=p_avatar where user_id=p_user;end if;
 return true;end;$$;
revoke all on function public.tzg_auth_rate(text,integer,integer),public.tzg_auth_lookup(text),public.tzg_auth_register(uuid,date,text) from public,anon,authenticated;
grant execute on function public.tzg_auth_rate(text,integer,integer),public.tzg_auth_lookup(text),public.tzg_auth_register(uuid,date,text) to service_role;

CREATE OR REPLACE FUNCTION public.tzg_account_dashboard()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller uuid:=tzg_private.account_identity();result jsonb;sessions jsonb;begin
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'current',s.id::text=auth.jwt()->>'session_id','game_active',exists(select 1 from tzg_private.active_game_sessions g where g.user_id=caller and g.session_id=s.id),'created_at',to_jsonb(s)->>'created_at','device',left(regexp_replace(coalesce(to_jsonb(s)->>'user_agent','Browser session'),'[[:cntrl:]]','','g'),120)) order by s.id),'[]'::jsonb) into sessions from auth.sessions s where s.user_id=caller;
 select jsonb_build_object('joined_at',u.created_at,'email_confirmed',(tzg_private.visible_email(u.email) is not null and u.email_confirmed_at is not null),'date_of_birth',(select date_of_birth from tzg_private.account_private where user_id=u.id),'age_years',(select extract(year from age(current_date,date_of_birth))::integer from tzg_private.account_private where user_id=u.id),'developer',exists(select 1 from tzg_private.debug_admins where user_id=caller and enabled),'sessions',sessions,'blocked_count',(select count(*) from tzg_private.player_blocks where blocker=caller),'inventory',coalesce(s.inventory,'[]'::jsonb),'fp',coalesce(s.fp,0),'rc',coalesce(s.rc,0),'progress',tzg_private.account_progress(caller)) into result from auth.users u left join tzg_private.player_saves s on s.user_id=u.id where u.id=caller;return result;end;$function$
;

CREATE OR REPLACE FUNCTION public.tzg_debug_account(p_target uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
 perform public.tzg_debug_authorize(null);
 select jsonb_build_object('user_id',u.id,'email',tzg_private.visible_email(u.email),'private_email',tzg_private.visible_email(u.email),'verified',p.verified,'display_name',p.display_name,'username',p.username,'avatar',p.avatar,'online',(p.last_seen_at>now()-interval '30 seconds' and exists(select 1 from tzg_private.active_game_sessions g join auth.sessions z on z.id=g.session_id where g.user_id=u.id and g.session_id=p.online_session)),'created_at',u.created_at,'email_confirmed',(tzg_private.visible_email(u.email) is not null and u.email_confirmed_at is not null),'date_of_birth',(select date_of_birth from tzg_private.account_private where user_id=u.id),'age_years',(select extract(year from age(current_date,date_of_birth))::integer from tzg_private.account_private where user_id=u.id),'fp',coalesce(s.fp,0),'rc',coalesce(s.rc,0),'inventory',coalesce(s.inventory,'[]'::jsonb),'revision',coalesce(s.revision,0),'ban',(select to_jsonb(b) from tzg_private.account_bans b where b.user_id=u.id and (b.expires_at is null or b.expires_at>now())),'deletion',(select to_jsonb(d) from tzg_private.account_deletions d where d.user_id=u.id),'history',coalesce((select jsonb_agg(to_jsonb(h)) from (select action,reason,created_at,actor from tzg_private.moderation_log where target=u.id order by id desc limit 20)h),'[]'::jsonb)) into result from auth.users u left join tzg_private.player_profiles p on p.user_id=u.id left join tzg_private.player_saves s on s.user_id=u.id where u.id=p_target;
 if result is null then raise invalid_parameter_value using message='Account no longer exists.'; end if;
 return result;
end; $function$
;

CREATE OR REPLACE FUNCTION public.tzg_debug_accounts(p_offset integer DEFAULT 0, p_search text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb; total bigint;
begin
 perform public.tzg_debug_authorize(null);
 if p_offset is null or p_offset<0 or p_offset>10000000 or p_search is null or char_length(p_search)>100 then raise invalid_parameter_value using message='Invalid account page.'; end if;
 select count(*) into total from auth.users u left join tzg_private.player_profiles p on p.user_id=u.id where coalesce(u.email,'') ilike '%'||p_search||'%' or p.display_name ilike '%'||p_search||'%' or p.username ilike '%'||p_search||'%' or u.id::text=p_search;
 select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) into result from (
 select u.id as user_id,tzg_private.visible_email(u.email) as email,(select date_of_birth from tzg_private.account_private where user_id=u.id) as date_of_birth,p.verified,p.display_name,p.username,p.avatar,(p.last_seen_at>now()-interval '30 seconds' and exists(select 1 from tzg_private.active_game_sessions g join auth.sessions z on z.id=g.session_id where g.user_id=u.id and g.session_id=p.online_session)) as online,u.created_at,(tzg_private.visible_email(u.email) is not null and u.email_confirmed_at is not null) as email_confirmed,
 exists(select 1 from tzg_private.account_bans b where b.user_id=u.id and (b.expires_at is null or b.expires_at>now())) as banned,exists(select 1 from tzg_private.account_deletions d where d.user_id=u.id) as deleted
 from auth.users u left join tzg_private.player_profiles p on p.user_id=u.id where coalesce(u.email,'') ilike '%'||p_search||'%' or p.display_name ilike '%'||p_search||'%' or p.username ilike '%'||p_search||'%' or u.id::text=p_search order by u.created_at desc,u.id limit 50 offset p_offset) a;
 return jsonb_build_object('accounts',result,'total',total);
end; $function$
;

CREATE OR REPLACE FUNCTION public.tzg_player_username(p_username text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller uuid:=tzg_private.require_player(); uname text:=lower(btrim(p_username)); profile tzg_private.player_profiles;
begin
 if uname is null or uname !~ '^[a-z0-9_]{3,36}$' or left(uname,2)='p_' then raise invalid_parameter_value using message='Use 3–36 letters, numbers or underscores. The p_ prefix is reserved.'; end if;
 perform tzg_private.clean_text(uname,36);
 perform pg_advisory_xact_lock(hashtextextended(caller::text,160));
 select * into profile from tzg_private.player_profiles where user_id=caller for update;
 if not found then raise invalid_parameter_value using message='Reload your account before changing username.'; end if;
 if profile.username=uname then return jsonb_build_object('changed',false,'username',uname,'username_changed_at',profile.username_changed_at,'username_next_change_at',profile.username_changed_at+interval '24 hours'); end if;
 if profile.username_changed_at>now()-interval '24 hours' then raise exception using errcode='P0001',message='Username cooldown: try again after '||to_char(profile.username_changed_at+interval '24 hours','YYYY-MM-DD HH24:MI')||' UTC.',detail=jsonb_build_object('next_change_at',profile.username_changed_at+interval '24 hours')::text; end if;
 if exists(select 1 from tzg_private.player_profiles where username=uname and user_id<>caller) then raise unique_violation using message='Username already taken.';end if;
 update tzg_private.player_saves set rc=rc-2500,revision=revision+1,updated_at=now() where user_id=caller and rc>=2500;
 if not found then raise exception using errcode='22023',message='You need 2500 RC to change your username.';end if;
 update tzg_private.player_profiles set username=uname,username_changed_at=now(),updated_at=now() where user_id=caller;
 insert into tzg_private.moderation_log(actor,target,action,reason,details) values(caller,caller,'username_change','Player changed username',jsonb_build_object('previous',profile.username,'new',uname));
 return jsonb_build_object('changed',true,'username',uname,'username_changed_at',now(),'username_next_change_at',now()+interval '24 hours','profile_updated_at',now());
 exception when unique_violation then raise unique_violation using message='Username already taken. Choose another username.';
end; $function$
;

-- The browser uses this overload through CloudSave.serverMutation. It is safe to retry.
create or replace function public.tzg_player_username(p_username text,p_expected_revision bigint,p_mutation uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();previous jsonb;result jsonb;saved tzg_private.player_saves;begin
 if p_mutation is null or p_expected_revision is null then raise invalid_parameter_value;end if;
 perform pg_advisory_xact_lock(hashtextextended(caller::text,160));
 select m.result into previous from tzg_private.username_mutations m where user_id=caller and mutation=p_mutation;
 if found then return previous;end if;
 select * into saved from tzg_private.player_saves where user_id=caller for update;
 if saved.revision is distinct from p_expected_revision then raise exception using errcode='40001',message='CLOUD_CONFLICT: reload your saved data before changing your username.';end if;
 result:=public.tzg_player_username(p_username);
 select * into saved from tzg_private.player_saves where user_id=caller;
 result:=result||jsonb_build_object('revision',saved.revision,'state',jsonb_build_object('fp',saved.fp,'rc',saved.rc,'inventory',saved.inventory));
 insert into tzg_private.username_mutations values(caller,p_mutation,result,now());return result;end;$$;
revoke all on function public.tzg_player_username(text,bigint,uuid) from public,anon,authenticated;
grant execute on function public.tzg_player_username(text,bigint,uuid) to authenticated;
commit;
