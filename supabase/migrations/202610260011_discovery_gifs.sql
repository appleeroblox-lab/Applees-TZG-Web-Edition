-- Includes 004–009. Run after the existing 003 setup.
-- Run after 003; includes 004–008 if skipped.
-- Run after 003; includes 004–007 if skipped.
-- Includes moderation/profile fixes from 006. Run after 003, even if 004–006 were skipped.
-- Apply after 003. Includes prior 004/005 additions if not yet applied.
-- Deleting a game account now retains Auth identity to deliver a private moderation/appeal screen.
begin;


alter table tzg_private.player_profiles add column if not exists bio text not null default '';
create or replace function public.tzg_player_load()
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player(); result jsonb; initial_name text;
begin
 select left(btrim(regexp_replace(coalesce(raw_user_meta_data->>'display_name','Explorer'),'[[:cntrl:]]','','g')),32) into initial_name from auth.users where id=caller;
 if initial_name='' then initial_name:='Explorer'; end if;
 insert into tzg_private.player_profiles(user_id,display_name,username) values(caller,initial_name,'p_'||replace(caller::text,'-','')) on conflict do nothing;
 insert into tzg_private.player_saves(user_id) values(caller) on conflict do nothing;
 select jsonb_build_object('user_id',caller,'display_name',p.display_name,'username',p.username,'bio',p.bio,'avatar',p.avatar,'fp',s.fp,'rc',s.rc,'inventory',s.inventory,'revision',s.revision)
 into result from tzg_private.player_profiles p join tzg_private.player_saves s using(user_id) where p.user_id=caller;
 return result;
end; $$;



create or replace function public.tzg_player_profile_edit(p_display_name text,p_bio text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player(); name text:=tzg_private.clean_text(p_display_name,32); bio_value text:=btrim(coalesce(p_bio,''));
begin
 if bio_value<>'' then perform tzg_private.clean_text(bio_value,160); end if;
 update tzg_private.player_profiles set display_name=name,bio=bio_value,updated_at=now() where user_id=caller;
 return jsonb_build_object('display_name',name,'bio',bio_value);
end; $$;

-- Return message IDs, never player UUIDs, to other players. Reports resolve identities on the server.
create or replace function public.tzg_chat_read(p_after bigint default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player(); result jsonb;
begin
 if p_after is null or p_after<0 then raise invalid_parameter_value using message='Invalid chat cursor.'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id::text,'display_name',m.display_name,'avatar',m.avatar,'body',m.body,'created_at',m.created_at,'own',m.user_id=caller) order by m.id),'[]'::jsonb) into result from (
 select c.id,c.user_id,coalesce(p.display_name,c.display_name) as display_name,p.avatar,c.body,c.created_at from tzg_private.chat_messages c left join tzg_private.player_profiles p on p.user_id=c.user_id where c.id>p_after order by c.id desc limit 50)m;
 return result;
end; $$;

create or replace function public.tzg_chat_profile(p_message bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player(); result jsonb;
begin
 select jsonb_build_object('display_name',coalesce(p.display_name,c.display_name),'username',coalesce(p.username,c.username),'bio',coalesce(p.bio,''),'joined_at',u.created_at,'avatar',p.avatar) into result from tzg_private.chat_messages c left join tzg_private.player_profiles p on p.user_id=c.user_id left join auth.users u on u.id=c.user_id where c.id=p_message;
 if result is null then raise invalid_parameter_value using message='This player profile is no longer available.'; end if;
 return result;
end; $$;
revoke all on function public.tzg_player_profile_edit(text,text),public.tzg_chat_profile(bigint) from public,anon,authenticated;
grant execute on function public.tzg_player_profile_edit(text,text),public.tzg_chat_profile(bigint) to authenticated;

alter table tzg_private.player_profiles add column if not exists username_changed_at timestamptz;
create or replace function public.tzg_player_load()
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player(); result jsonb; initial_name text;
begin
 select left(btrim(regexp_replace(coalesce(raw_user_meta_data->>'display_name','Explorer'),'[[:cntrl:]]','','g')),32) into initial_name from auth.users where id=caller;
 if initial_name='' then initial_name:='Explorer'; end if;
 insert into tzg_private.player_profiles(user_id,display_name,username) values(caller,initial_name,'p_'||replace(caller::text,'-','')) on conflict do nothing;
 insert into tzg_private.player_saves(user_id) values(caller) on conflict do nothing;
 select jsonb_build_object('user_id',caller,'display_name',p.display_name,'username',p.username,'bio',p.bio,'username_changed_at',p.username_changed_at,'username_next_change_at',p.username_changed_at+interval '24 hours','profile_updated_at',p.updated_at,'avatar',p.avatar,'fp',s.fp,'rc',s.rc,'inventory',s.inventory,'revision',s.revision)
 into result from tzg_private.player_profiles p join tzg_private.player_saves s using(user_id) where p.user_id=caller;
 return result;
end; $$;




create or replace function public.tzg_player_profile()
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();
begin
 return (select jsonb_build_object('display_name',p.display_name,'username',p.username,'bio',p.bio,'avatar',p.avatar,'profile_updated_at',p.updated_at,'username_changed_at',p.username_changed_at,'username_next_change_at',p.username_changed_at+interval '24 hours') from tzg_private.player_profiles p where p.user_id=caller);
end; $$;

-- A heartbeat intentionally carries no profile image or full save payload.
create or replace function public.tzg_player_heartbeat()
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();
begin return (select jsonb_build_object('revision',s.revision,'profile_updated_at',p.updated_at) from tzg_private.player_profiles p join tzg_private.player_saves s using(user_id) where p.user_id=caller); end; $$;

create or replace function public.tzg_player_username(p_username text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player(); uname text:=lower(btrim(p_username)); profile tzg_private.player_profiles;
begin
 if uname is null or uname !~ '^[a-z0-9_]{3,36}$' or left(uname,2)='p_' then raise invalid_parameter_value using message='Use 3–36 letters, numbers or underscores. The p_ prefix is reserved.'; end if;
 perform tzg_private.clean_text(uname,36);
 select * into profile from tzg_private.player_profiles where user_id=caller for update;
 if not found then raise invalid_parameter_value using message='Reload your account before changing username.'; end if;
 if profile.username=uname then return jsonb_build_object('changed',false,'username',uname,'username_changed_at',profile.username_changed_at,'username_next_change_at',profile.username_changed_at+interval '24 hours'); end if;
 if profile.username_changed_at>now()-interval '24 hours' then raise exception using errcode='P0001',message='Username cooldown: try again after '||to_char(profile.username_changed_at+interval '24 hours','YYYY-MM-DD HH24:MI')||' UTC.',detail=jsonb_build_object('next_change_at',profile.username_changed_at+interval '24 hours')::text; end if;
 update tzg_private.player_profiles set username=uname,username_changed_at=now(),updated_at=now() where user_id=caller;
 insert into tzg_private.moderation_log(actor,target,action,reason,details) values(caller,caller,'username_change','Player changed username',jsonb_build_object('previous',profile.username,'new',uname));
 return jsonb_build_object('changed',true,'username',uname,'username_changed_at',now(),'username_next_change_at',now()+interval '24 hours','profile_updated_at',now());
 exception when unique_violation then raise unique_violation using message='Username already taken. Choose another username.';
end; $$;
create or replace function public.tzg_chat_report(p_message bigint,p_category text,p_reason text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player(); msg tzg_private.chat_messages; reporter text; report_number bigint;
begin
 if p_category is null or p_category not in ('Bullying','Harassment','Spam','Personal information','Inappropriate content','Other') or p_reason is null or char_length(p_reason)>300 then raise invalid_parameter_value using message='Choose a report category and use at most 300 characters.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(caller::text,3));
 select id into report_number from tzg_private.chat_reports where reporter_id=caller and message_id=p_message;
 if found then return jsonb_build_object('ok',true,'report_id',report_number::text); end if;
 if (select count(*) from tzg_private.chat_reports where reporter_id=caller and created_at>now()-interval '1 hour')>=5 then raise exception 'Report limit reached. Try again later.'; end if;
 select * into msg from tzg_private.chat_messages where id=p_message;
 if not found then raise invalid_parameter_value using message='Message is no longer available.'; end if;
 if msg.user_id=caller then raise invalid_parameter_value using message='You cannot report your own message.'; end if;
 select username into reporter from tzg_private.player_profiles where user_id=caller;
 insert into tzg_private.chat_reports(message_id,reporter_id,reported_id,reporter_name,reported_name,evidence,category,reason) values(p_message,caller,msg.user_id,reporter,msg.username,msg.body,p_category,btrim(p_reason)) returning id into report_number;
 return jsonb_build_object('ok',true,'report_id',report_number::text);
end; $$;


create or replace function public.tzg_debug_reports_status(p_after bigint default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare new_reports jsonb; open_count bigint; latest bigint;
begin
 perform public.tzg_debug_authorize(null);
 if p_after is null or p_after<0 then raise invalid_parameter_value using message='Invalid reports cursor.'; end if;
 select count(*) filter(where status='open'),coalesce(max(id),0) into open_count,latest from tzg_private.chat_reports;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.id::bigint),'[]'::jsonb) into new_reports from (
 select id::text as id,reporter_name,reported_name,category,evidence,created_at from tzg_private.chat_reports where id>p_after order by id desc limit 20)r;
 return jsonb_build_object('open',open_count,'latest_id',latest::text,'reports',new_reports);
end; $$;
revoke all on function public.tzg_player_profile(),public.tzg_player_username(text),public.tzg_debug_reports_status(bigint) from public,anon,authenticated;
grant execute on function public.tzg_player_profile(),public.tzg_player_username(text),public.tzg_debug_reports_status(bigint) to authenticated;

create table if not exists tzg_private.account_deletions(user_id uuid primary key,reason text not null,actor uuid not null,created_at timestamptz not null default now());
alter table tzg_private.account_deletions enable row level security;
revoke all on tzg_private.account_deletions from public,anon,authenticated;

create or replace function public.tzg_player_moderation()
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); result jsonb;
begin
 if caller is null then raise insufficient_privilege using message='Sign in to view your account notice.'; end if;
 select jsonb_build_object('kind','deleted','reason',reason,'decided_at',created_at,'expires_at',null,'appeal','https://discord.gg/rPdRRHSkmw') into result from tzg_private.account_deletions where user_id=caller;
 if result is not null then return result; end if;
 if not exists(select 1 from auth.users where id=caller) then
  select jsonb_build_object('kind','deleted','reason',reason,'decided_at',created_at,'expires_at',null,'appeal','https://discord.gg/rPdRRHSkmw') into result from tzg_private.moderation_log where target=caller and action='delete' order by id desc limit 1;
  if result is not null then return result; end if;
 end if;
 select jsonb_build_object('kind','ban','reason',reason,'decided_at',created_at,'expires_at',expires_at,'appeal','https://discord.gg/rPdRRHSkmw') into result from tzg_private.account_bans where user_id=caller and (expires_at is null or expires_at>now());
 return result;
end; $$;

create or replace function tzg_private.require_player()
returns uuid language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); notice jsonb;
begin
 if caller is null then raise insufficient_privilege using message='Sign in with a confirmed account to play.'; end if;
 notice:=public.tzg_player_moderation();
 if notice is not null then raise exception using errcode='P0001',message=case when notice->>'kind'='deleted' then 'Game account removed: ' else 'Account suspended: ' end||(notice->>'reason'),detail=notice::text; end if;
 if not exists(select 1 from auth.users where id=caller and email_confirmed_at is not null) or not exists(select 1 from auth.sessions where user_id=caller and id::text=auth.jwt()->>'session_id') then raise insufficient_privilege using message='Sign in with a confirmed account to play.'; end if;
 return caller;
end; $$;
revoke all on function tzg_private.require_player() from public,anon,authenticated;
create or replace function public.tzg_debug_accounts(p_offset integer default 0,p_search text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; total bigint;
begin
 perform public.tzg_debug_authorize(null);
 if p_offset is null or p_offset<0 or p_offset>10000000 or p_search is null or char_length(p_search)>100 then raise invalid_parameter_value using message='Invalid account page.'; end if;
 select count(*) into total from auth.users u left join tzg_private.player_profiles p on p.user_id=u.id where coalesce(u.email,'') ilike '%'||p_search||'%' or p.display_name ilike '%'||p_search||'%' or p.username ilike '%'||p_search||'%' or u.id::text=p_search;
 select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) into result from (
 select u.id as user_id,u.email,p.display_name,p.username,p.avatar,u.created_at,u.email_confirmed_at is not null as email_confirmed,
 exists(select 1 from tzg_private.account_bans b where b.user_id=u.id and (b.expires_at is null or b.expires_at>now())) as banned,exists(select 1 from tzg_private.account_deletions d where d.user_id=u.id) as deleted
 from auth.users u left join tzg_private.player_profiles p on p.user_id=u.id where coalesce(u.email,'') ilike '%'||p_search||'%' or p.display_name ilike '%'||p_search||'%' or p.username ilike '%'||p_search||'%' or u.id::text=p_search order by u.created_at desc,u.id limit 50 offset p_offset) a;
 return jsonb_build_object('accounts',result,'total',total);
end; $$;

create or replace function public.tzg_debug_account(p_target uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.tzg_debug_authorize(null);
 select jsonb_build_object('user_id',u.id,'email',u.email,'display_name',p.display_name,'username',p.username,'avatar',p.avatar,'created_at',u.created_at,'email_confirmed',u.email_confirmed_at is not null,'fp',coalesce(s.fp,0),'rc',coalesce(s.rc,0),'inventory',coalesce(s.inventory,'[]'::jsonb),'revision',coalesce(s.revision,0),'ban',(select to_jsonb(b) from tzg_private.account_bans b where b.user_id=u.id and (b.expires_at is null or b.expires_at>now())),'deletion',(select to_jsonb(d) from tzg_private.account_deletions d where d.user_id=u.id),'history',coalesce((select jsonb_agg(to_jsonb(h)) from (select action,reason,created_at,actor from tzg_private.moderation_log where target=u.id order by id desc limit 20)h),'[]'::jsonb)) into result from auth.users u left join tzg_private.player_profiles p on p.user_id=u.id left join tzg_private.player_saves s on s.user_id=u.id where u.id=p_target;
 if result is null then raise invalid_parameter_value using message='Account no longer exists.'; end if;
 return result;
end; $$;

create or replace function public.tzg_debug_account_action(p_target uuid,p_action text,p_reason text,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); reason text:=btrim(p_reason); hours integer; current_revision bigint; target_name text;
begin
 perform public.tzg_debug_authorize('account '||coalesce(p_action,'')||' '||coalesce(p_target::text,''));
 if reason is null or char_length(reason) not between 3 and 300 then raise invalid_parameter_value using message='Provide a moderation reason with 3–300 characters.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_target::text,1));
 if not exists(select 1 from auth.users where id=p_target) then raise invalid_parameter_value using message='Account no longer exists.'; end if;
 if p_action in ('ban','delete') and exists(select 1 from tzg_private.debug_admins where user_id=p_target and enabled) then raise insufficient_privilege using message='Developer accounts cannot be banned or deleted here.'; end if;
 if p_action='ban' then
  hours:=(p_data->>'hours')::integer;
  if hours is null or hours not in (0,1,24,72,168,720) then raise invalid_parameter_value using message='Choose a valid ban duration.'; end if;
  insert into tzg_private.account_bans(user_id,reason,expires_at,actor) values(p_target,reason,case when hours=0 then null else now()+make_interval(hours=>hours) end,actor)
  on conflict(user_id) do update set reason=excluded.reason,expires_at=excluded.expires_at,actor=excluded.actor,created_at=now();
 elsif p_action='unban' then delete from tzg_private.account_bans where user_id=p_target;
 elsif p_action='restore' then delete from tzg_private.account_deletions where user_id=p_target;
 elsif p_action='remove_avatar' then update tzg_private.player_profiles set avatar=null,updated_at=now() where user_id=p_target;
 elsif p_action='edit' then
  if exists(select 1 from tzg_private.account_deletions where user_id=p_target) then raise invalid_parameter_value using message='Restore the game account before editing data.'; end if;
  perform tzg_private.validate_save(p_data->'state');
  if p_data->>'display_name' is null then raise invalid_parameter_value using message='Display name required.'; end if;
  perform tzg_private.clean_text(p_data->>'display_name',32);
  insert into tzg_private.player_saves(user_id) values(p_target) on conflict do nothing;
  select revision into current_revision from tzg_private.player_saves where user_id=p_target for update;
  if (p_data->>'revision')::bigint is distinct from current_revision then raise sqlstate '40001' using message='Account data changed. Open it again before editing.'; end if;
  update tzg_private.player_saves set fp=(p_data->'state'->>'fp')::bigint,rc=(p_data->'state'->>'rc')::bigint,inventory=p_data->'state'->'inventory',revision=revision+1,last_mutation=null,updated_at=now() where user_id=p_target;
  update tzg_private.player_profiles set display_name=btrim(p_data->>'display_name'),updated_at=now() where user_id=p_target;
 elsif p_action='delete' then
  select username into target_name from tzg_private.player_profiles where user_id=p_target;
  if p_data->>'confirm' is distinct from target_name then raise invalid_parameter_value using message='Type the exact username to confirm permanent deletion.'; end if;
 else raise invalid_parameter_value using message='Unknown account action.'; end if;
 insert into tzg_private.moderation_log(actor,target,action,reason,details) values(actor,p_target,p_action,reason,jsonb_build_object('hours',p_data->'hours'));
 if p_action='delete' then insert into tzg_private.account_deletions(user_id,reason,actor) values(p_target,reason,actor) on conflict(user_id) do update set reason=excluded.reason,actor=excluded.actor,created_at=now();delete from tzg_private.player_saves where user_id=p_target;update tzg_private.player_profiles set avatar=null,bio='',updated_at=now() where user_id=p_target; end if;
 return jsonb_build_object('ok',true);
end; $$;


-- Peer profiles reveal no moderation reason or private identifiers.
create or replace function public.tzg_chat_profile(p_message bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player(); result jsonb;
begin
 select jsonb_build_object('display_name',coalesce(p.display_name,c.display_name),'username',coalesce(p.username,c.username),'bio',coalesce(p.bio,''),'joined_at',u.created_at,'avatar',p.avatar) into result from tzg_private.chat_messages c left join tzg_private.player_profiles p on p.user_id=c.user_id left join auth.users u on u.id=c.user_id where c.id=p_message and not exists(select 1 from tzg_private.account_deletions d where d.user_id=c.user_id);
 if result is null then raise invalid_parameter_value using message='This player profile is unavailable.'; end if;
 return result;
end; $$;
revoke all on function public.tzg_player_moderation() from public,anon,authenticated;
grant execute on function public.tzg_player_moderation() to authenticated;
commit;


-- One authenticated device session may play an account at a time.
begin;
create table if not exists tzg_private.active_game_sessions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 session_id uuid not null,
 started_at timestamptz not null default now()
);
alter table tzg_private.active_game_sessions enable row level security;
revoke all on tzg_private.active_game_sessions from public,anon,authenticated;
create or replace function tzg_private.require_player_identity()
returns uuid language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); notice jsonb;
begin
 if caller is null then raise insufficient_privilege using message='Sign in with a confirmed account to play.'; end if;
 notice:=public.tzg_player_moderation();
 if notice is not null then raise exception using errcode='P0001',message=case when notice->>'kind'='deleted' then 'Game account removed: ' else 'Account suspended: ' end||(notice->>'reason'),detail=notice::text; end if;
 if not exists(select 1 from auth.users where id=caller and email_confirmed_at is not null) or not exists(select 1 from auth.sessions where user_id=caller and id::text=auth.jwt()->>'session_id') then raise insufficient_privilege using message='Sign in with a confirmed account to play.'; end if;
 return caller;
end; $$;
revoke all on function tzg_private.require_player_identity() from public,anon,authenticated;

create or replace function public.tzg_player_session_start()
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player_identity(); sid uuid:=(auth.jwt()->>'session_id')::uuid;
begin
 insert into tzg_private.active_game_sessions(user_id,session_id) values(caller,sid)
 on conflict(user_id) do update set session_id=excluded.session_id,started_at=case when tzg_private.active_game_sessions.session_id=excluded.session_id then tzg_private.active_game_sessions.started_at else now() end;
 return jsonb_build_object('active',true);
end; $$;
revoke all on function public.tzg_player_session_start() from public,anon;
grant execute on function public.tzg_player_session_start() to authenticated;

create or replace function tzg_private.require_player()
returns uuid language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player_identity(); sid uuid:=(auth.jwt()->>'session_id')::uuid; active_sid uuid;
begin
 -- Old clients can establish the first session, but cannot replace a newer one.
 insert into tzg_private.active_game_sessions(user_id,session_id) values(caller,sid) on conflict(user_id) do nothing;
 -- Hold ownership through a save transaction so device takeover cannot race a write.
 select session_id into active_sid from tzg_private.active_game_sessions where user_id=caller for share;
 if active_sid is distinct from sid then
  raise exception using errcode='P0001',message='Duplicate Game Session',detail='{"kind":"duplicate_session"}';
 end if;
 return caller;
end; $$;
revoke all on function tzg_private.require_player() from public,anon,authenticated;

-- Confirm the exact persisted public profile, including bio.
create or replace function public.tzg_player_profile_edit(p_display_name text,p_bio text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player(); name text:=tzg_private.clean_text(p_display_name,32); bio_value text:=btrim(coalesce(p_bio,'')); result jsonb;
begin
 if bio_value<>'' then perform tzg_private.clean_text(bio_value,160); end if;
 update tzg_private.player_profiles set display_name=name,bio=bio_value,updated_at=now() where user_id=caller
 returning jsonb_build_object('display_name',display_name,'bio',bio,'profile_updated_at',updated_at) into result;
 if result is null then raise exception 'Reconnect to load your profile before editing.'; end if;
 return result;
end; $$;
revoke all on function public.tzg_player_profile_edit(text,text) from public,anon;
grant execute on function public.tzg_player_profile_edit(text,text) to authenticated;
commit;

begin;
alter table tzg_private.player_profiles add column if not exists last_seen_at timestamptz;
alter table tzg_private.player_profiles add column if not exists online_session uuid;
create or replace function public.tzg_player_heartbeat()
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();
begin
 update tzg_private.player_profiles set last_seen_at=now(),online_session=(auth.jwt()->>'session_id')::uuid where user_id=caller;
 return (select jsonb_build_object('revision',s.revision,'profile_updated_at',p.updated_at) from tzg_private.player_profiles p join tzg_private.player_saves s using(user_id) where p.user_id=caller);
end; $$;
create or replace function public.tzg_player_session_end()
returns void language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid();
begin update tzg_private.player_profiles set last_seen_at=null,online_session=null where user_id=caller and online_session=(auth.jwt()->>'session_id')::uuid; end; $$;
create or replace function public.tzg_chat_join()
returns jsonb language plpgsql security definer set search_path='' as $$
begin perform tzg_private.require_player();return jsonb_build_object('after',coalesce((select max(id) from tzg_private.chat_messages),0)::text);end; $$;
create table if not exists tzg_private.chat_images(message_id bigint primary key references tzg_private.chat_messages(id) on delete cascade,image text not null check(char_length(image)<=160000 and image ~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$'));
alter table tzg_private.chat_images enable row level security;
revoke all on tzg_private.chat_images from public,anon,authenticated;
alter table tzg_private.chat_reports add column if not exists evidence_image text;
create or replace function tzg_private.report_image_evidence() returns trigger language plpgsql security definer set search_path='' as $$
begin new.evidence_image:=(select image from tzg_private.chat_images where message_id=new.message_id);return new;end; $$;
revoke all on function tzg_private.report_image_evidence() from public,anon,authenticated;
drop trigger if exists report_image_evidence on tzg_private.chat_reports;
create trigger report_image_evidence before insert on tzg_private.chat_reports for each row execute function tzg_private.report_image_evidence();
create or replace function public.tzg_chat_send_image(p_body text,p_image text,p_mutation uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; caller uuid:=tzg_private.require_player();
begin
 if p_image is null or char_length(p_image)>160000 or p_image !~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$' then raise exception 'Choose a smaller JPG screenshot.';end if;
 result:=public.tzg_chat_send(case when btrim(coalesce(p_body,''))='' then '[Screenshot]' else p_body end,p_mutation);
 insert into tzg_private.chat_images(message_id,image) values((result->>'id')::bigint,p_image) on conflict(message_id) do nothing;
 return result;
end; $$;
create or replace function public.tzg_chat_image(p_message bigint)
returns text language plpgsql security definer set search_path='' as $$
begin perform tzg_private.require_player();return (select image from tzg_private.chat_images where message_id=p_message);end; $$;
create or replace function public.tzg_chat_read(p_after bigint default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();result jsonb;
begin
 if p_after is null or p_after<0 then raise exception 'Invalid chat cursor.';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id::text,'display_name',m.display_name,'avatar',m.avatar,'body',m.body,'created_at',m.created_at,'own',m.user_id=caller,'image_available',m.has_image,'name_color',(array['#ffb8b8','#9bd2ff','#b9f6af','#e4c1ff','#ffd68e','#99eee7','#ffb5dc','#e7ee98'])[1+abs(hashtextextended(m.username,0)%8)::integer]) order by m.id),'[]'::jsonb) into result from (
 select c.id,c.user_id,coalesce(p.username,c.username) as username,coalesce(p.display_name,c.display_name) as display_name,p.avatar,c.body,c.created_at,exists(select 1 from tzg_private.chat_images i where i.message_id=c.id) as has_image from tzg_private.chat_messages c left join tzg_private.player_profiles p on p.user_id=c.user_id where c.id>p_after order by c.id asc limit 50)m;
 return result;
end; $$;
create or replace function public.tzg_debug_accounts(p_offset integer default 0,p_search text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; total bigint;
begin
 perform public.tzg_debug_authorize(null);
 if p_offset is null or p_offset<0 or p_offset>10000000 or p_search is null or char_length(p_search)>100 then raise invalid_parameter_value using message='Invalid account page.'; end if;
 select count(*) into total from auth.users u left join tzg_private.player_profiles p on p.user_id=u.id where coalesce(u.email,'') ilike '%'||p_search||'%' or p.display_name ilike '%'||p_search||'%' or p.username ilike '%'||p_search||'%' or u.id::text=p_search;
 select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) into result from (
 select u.id as user_id,u.email,p.display_name,p.username,p.avatar,(p.last_seen_at>now()-interval '30 seconds' and exists(select 1 from tzg_private.active_game_sessions g join auth.sessions z on z.id=g.session_id where g.user_id=u.id and g.session_id=p.online_session)) as online,u.created_at,u.email_confirmed_at is not null as email_confirmed,
 exists(select 1 from tzg_private.account_bans b where b.user_id=u.id and (b.expires_at is null or b.expires_at>now())) as banned,exists(select 1 from tzg_private.account_deletions d where d.user_id=u.id) as deleted
 from auth.users u left join tzg_private.player_profiles p on p.user_id=u.id where coalesce(u.email,'') ilike '%'||p_search||'%' or p.display_name ilike '%'||p_search||'%' or p.username ilike '%'||p_search||'%' or u.id::text=p_search order by u.created_at desc,u.id limit 50 offset p_offset) a;
 return jsonb_build_object('accounts',result,'total',total);
end; $$;

create or replace function public.tzg_debug_account(p_target uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.tzg_debug_authorize(null);
 select jsonb_build_object('user_id',u.id,'email',u.email,'display_name',p.display_name,'username',p.username,'avatar',p.avatar,'online',(p.last_seen_at>now()-interval '30 seconds' and exists(select 1 from tzg_private.active_game_sessions g join auth.sessions z on z.id=g.session_id where g.user_id=u.id and g.session_id=p.online_session)),'created_at',u.created_at,'email_confirmed',u.email_confirmed_at is not null,'fp',coalesce(s.fp,0),'rc',coalesce(s.rc,0),'inventory',coalesce(s.inventory,'[]'::jsonb),'revision',coalesce(s.revision,0),'ban',(select to_jsonb(b) from tzg_private.account_bans b where b.user_id=u.id and (b.expires_at is null or b.expires_at>now())),'deletion',(select to_jsonb(d) from tzg_private.account_deletions d where d.user_id=u.id),'history',coalesce((select jsonb_agg(to_jsonb(h)) from (select action,reason,created_at,actor from tzg_private.moderation_log where target=u.id order by id desc limit 20)h),'[]'::jsonb)) into result from auth.users u left join tzg_private.player_profiles p on p.user_id=u.id left join tzg_private.player_saves s on s.user_id=u.id where u.id=p_target;
 if result is null then raise invalid_parameter_value using message='Account no longer exists.'; end if;
 return result;
end; $$;


revoke all on function public.tzg_player_session_end(),public.tzg_chat_join(),public.tzg_chat_send_image(text,text,uuid),public.tzg_chat_image(bigint) from public,anon;
grant execute on function public.tzg_player_session_end(),public.tzg_chat_join(),public.tzg_chat_send_image(text,text,uuid),public.tzg_chat_image(bigint) to authenticated;
commit;

create or replace function public.tzg_debug_reports(p_offset integer default 0,p_status text default 'open')
returns jsonb language plpgsql security definer set search_path='' as $$
declare rows jsonb; total bigint;
begin
 perform public.tzg_debug_authorize(null);
 if p_offset is null or p_offset<0 or p_offset>10000000 or p_status is null or p_status not in ('open','reviewed','dismissed','all') then raise invalid_parameter_value using message='Invalid reports page.'; end if;
 select count(*) into total from tzg_private.chat_reports where p_status='all' or status=p_status;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into rows from (
 select r.id::text as id,r.message_id::text as message_id,r.reporter_id,r.reported_id,r.reporter_name,r.reported_name,r.evidence,r.evidence_image,r.category,r.reason,r.status,r.created_at,r.reviewed_at,p.avatar as reporter_avatar,q.avatar as reported_avatar from tzg_private.chat_reports r left join tzg_private.player_profiles p on p.user_id=r.reporter_id left join tzg_private.player_profiles q on q.user_id=r.reported_id where p_status='all' or r.status=p_status order by r.id desc limit 25 offset p_offset)r;
 return jsonb_build_object('reports',rows,'total',total);
end; $$;


begin;
create table if not exists tzg_private.friend_links(a uuid references auth.users(id) on delete cascade,b uuid references auth.users(id) on delete cascade,requester uuid not null,status text not null check(status in ('pending','accepted')),created_at timestamptz default now(),primary key(a,b),check(a<b));
create table if not exists tzg_private.player_blocks(blocker uuid references auth.users(id) on delete cascade,target uuid references auth.users(id) on delete cascade,primary key(blocker,target),check(blocker<>target));
create table if not exists tzg_private.social_rooms(id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('dm','group')),owner uuid references auth.users(id),name text not null default '',bio text not null default '',image text,dm_key text unique,created_at timestamptz default now());
create table if not exists tzg_private.social_members(room uuid references tzg_private.social_rooms(id) on delete cascade,player uuid references auth.users(id) on delete cascade,joined_at timestamptz default now(),primary key(room,player));
create table if not exists tzg_private.social_bans(room uuid references tzg_private.social_rooms(id) on delete cascade,player uuid references auth.users(id) on delete cascade,primary key(room,player));
create table if not exists tzg_private.social_messages(id bigint generated always as identity primary key,room uuid references tzg_private.social_rooms(id) on delete cascade,sender uuid references auth.users(id),body text not null,image text,mutation uuid not null,created_at timestamptz default now(),unique(sender,mutation));
create index if not exists social_message_room on tzg_private.social_messages(room,id);
alter table tzg_private.friend_links enable row level security;
alter table tzg_private.player_blocks enable row level security;
alter table tzg_private.social_rooms enable row level security;
alter table tzg_private.social_members enable row level security;
alter table tzg_private.social_bans enable row level security;
alter table tzg_private.social_messages enable row level security;
revoke all on tzg_private.friend_links,tzg_private.player_blocks,tzg_private.social_rooms,tzg_private.social_members,tzg_private.social_bans,tzg_private.social_messages from public,anon,authenticated;
revoke all on sequence tzg_private.social_messages_id_seq from public,anon,authenticated;
create or replace function tzg_private.social_blocked(x uuid,y uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from tzg_private.player_blocks where (blocker=x and target=y) or (blocker=y and target=x))$$;
create or replace function tzg_private.social_profile(who uuid) returns jsonb language sql stable security definer set search_path='' as $$select jsonb_build_object('username',p.username,'display_name',p.display_name,'avatar',p.avatar,'bio',p.bio,'joined_at',u.created_at,'online',coalesce(not tzg_private.social_blocked(auth.uid(),who) and p.last_seen_at>now()-interval '30 seconds' and exists(select 1 from tzg_private.active_game_sessions g join auth.sessions s on s.id=g.session_id where g.user_id=p.user_id and g.session_id=p.online_session),false)) from tzg_private.player_profiles p join auth.users u on u.id=p.user_id where p.user_id=who and not exists(select 1 from tzg_private.account_deletions where user_id=who)$$;
create or replace function tzg_private.social_target(uname text) returns uuid language plpgsql stable security definer set search_path='' as $$declare result uuid;begin select user_id into result from tzg_private.player_profiles where username=lower(btrim(uname)) and not exists(select 1 from tzg_private.account_deletions where user_id=player_profiles.user_id);if result is null then raise exception 'Player not found.';end if;return result;end;$$;
create or replace function tzg_private.social_member(rid uuid,caller uuid) returns tzg_private.social_rooms language plpgsql security definer set search_path='' as $$declare result tzg_private.social_rooms;begin select * into result from tzg_private.social_rooms where id=rid for update;if not found or not exists(select 1 from tzg_private.social_members where room=rid and player=caller) or exists(select 1 from tzg_private.social_bans where room=rid and player=caller) then raise insufficient_privilege using message='You do not have access to this chat.';end if;if result.kind='dm' and exists(select 1 from tzg_private.social_members m where m.room=rid and m.player<>caller and (tzg_private.social_blocked(caller,m.player) or not exists(select 1 from tzg_private.friend_links f where f.a=least(caller,m.player) and f.b=greatest(caller,m.player) and f.status='accepted'))) then raise insufficient_privilege using message='This friend chat is unavailable.';end if;return result;end;$$;
revoke all on function tzg_private.social_blocked(uuid,uuid),tzg_private.social_profile(uuid),tzg_private.social_target(text),tzg_private.social_member(uuid,uuid) from public,anon,authenticated;
create or replace function public.tzg_social_profile(p_username text) returns jsonb language plpgsql security definer set search_path='' as $$declare caller uuid:=tzg_private.require_player();target uuid:=tzg_private.social_target(p_username);begin return tzg_private.social_profile(target);end;$$;
create or replace function public.tzg_social_action(p_action text,p_username text) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare caller uuid:=tzg_private.require_player();target uuid:=tzg_private.social_target(p_username);lo uuid:=least(caller,target);hi uuid:=greatest(caller,target);link tzg_private.friend_links;
begin
 if caller=target then raise exception 'Choose another player.';end if;
 perform pg_advisory_xact_lock(hashtextextended(lo::text||hi::text,14));
 select * into link from tzg_private.friend_links where a=lo and b=hi for update;
 if p_action='block' then insert into tzg_private.player_blocks values(caller,target) on conflict do nothing;delete from tzg_private.friend_links where a=lo and b=hi;
 elsif p_action='unblock' then delete from tzg_private.player_blocks where blocker=caller and player_blocks.target=target;
 elsif p_action='unfriend' then delete from tzg_private.friend_links where a=lo and b=hi;
 elsif p_action='cancel' then delete from tzg_private.friend_links where a=lo and b=hi and requester=caller and status='pending';
 elsif p_action='decline' then delete from tzg_private.friend_links where a=lo and b=hi and requester=target and status='pending';
 elsif p_action='request' then
  if tzg_private.social_blocked(caller,target) then raise exception 'Friend request unavailable.';end if;
  if link.status='accepted' then raise exception 'You are already friends.';end if;
  if (select count(*) from tzg_private.friend_links where a=caller or b=caller)>=200 or (select count(*) from tzg_private.friend_links where a=target or b=target)>=200 then raise exception 'Friend request limit reached.';end if;
  if link.status is null then insert into tzg_private.friend_links(a,b,requester,status) values(lo,hi,caller,'pending');end if;
 elsif p_action='accept' then
  if tzg_private.social_blocked(caller,target) or link.status is distinct from 'pending' or link.requester<>target then raise exception 'No incoming request to accept.';end if;
  update tzg_private.friend_links set status='accepted' where a=lo and b=hi;
 else raise exception 'Unknown friend action.';end if;
 return jsonb_build_object('ok',true);
end;$$;
create or replace function public.tzg_social_room(p_room uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();r tzg_private.social_rooms:=tzg_private.social_member(p_room,caller);
begin return jsonb_build_object('id',r.id,'kind',r.kind,'name',r.name,'bio',r.bio,'image',r.image,'owner',(select username from tzg_private.player_profiles where user_id=r.owner),'is_owner',r.owner=caller,'members',(select coalesce(jsonb_agg(coalesce(tzg_private.social_profile(player),jsonb_build_object('username',(select username from tzg_private.player_profiles where user_id=player),'display_name','Removed player','online',false)) order by joined_at),'[]') from tzg_private.social_members where room=r.id),'bans',case when r.owner=caller then (select coalesce(jsonb_agg(coalesce(tzg_private.social_profile(player),jsonb_build_object('username',(select username from tzg_private.player_profiles where user_id=player),'display_name','Removed player','online',false))),'[]') from tzg_private.social_bans where room=r.id) else '[]'::jsonb end);end;$$;
create or replace function public.tzg_social_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();friends jsonb;incoming jsonb;outgoing jsonb;blocked jsonb;rooms jsonb;
begin
 select coalesce(jsonb_agg(tzg_private.social_profile(case when a=caller then b else a end)) filter(where status='accepted'),'[]'),coalesce(jsonb_agg(tzg_private.social_profile(requester)) filter(where status='pending' and requester<>caller),'[]'),coalesce(jsonb_agg(tzg_private.social_profile(case when a=caller then b else a end)) filter(where status='pending' and requester=caller),'[]') into friends,incoming,outgoing from tzg_private.friend_links where a=caller or b=caller;
 select coalesce(jsonb_agg(tzg_private.social_profile(target)),'[]') into blocked from tzg_private.player_blocks where blocker=caller;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'kind',r.kind,'name',case when r.kind='dm' then coalesce((select p.display_name from tzg_private.social_members m join tzg_private.player_profiles p on p.user_id=m.player where m.room=r.id and m.player<>caller),'Friend chat') else r.name end,'image',r.image) order by r.created_at desc),'[]') into rooms from tzg_private.social_rooms r join tzg_private.social_members m on m.room=r.id and m.player=caller where r.kind='group' or exists(select 1 from tzg_private.social_members n join tzg_private.friend_links f on f.a=least(caller,n.player) and f.b=greatest(caller,n.player) and f.status='accepted' where n.room=r.id and n.player<>caller and not tzg_private.social_blocked(caller,n.player));
 return jsonb_build_object('friends',friends,'incoming',incoming,'outgoing',outgoing,'blocked',blocked,'rooms',rooms);
end;$$;
create or replace function public.tzg_social_create(p_kind text,p_name text default '',p_username text default '') returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare caller uuid:=tzg_private.require_player();target uuid;rid uuid;key text;
begin
 perform pg_advisory_xact_lock(hashtextextended(caller::text,15));
 if p_kind='dm' then target:=tzg_private.social_target(p_username);if target=caller or tzg_private.social_blocked(caller,target) or not exists(select 1 from tzg_private.friend_links where a=least(caller,target) and b=greatest(caller,target) and status='accepted') then raise exception 'Accept the friend request before chatting.';end if;key:=least(caller,target)::text||greatest(caller,target)::text;select id into rid from tzg_private.social_rooms where dm_key=key;if rid is not null then return jsonb_build_object('id',rid);end if;
 elsif p_kind<>'group' then raise exception 'Invalid chat type.';end if;
 if (select count(*) from tzg_private.social_members where player=caller)>=100 then raise exception 'Chat limit reached.';end if;
 insert into tzg_private.social_rooms(kind,owner,name,dm_key) values(p_kind,caller,case when p_kind='group' then tzg_private.clean_text(p_name,40) else '' end,key) on conflict(dm_key) do update set dm_key=excluded.dm_key returning id into rid;
 insert into tzg_private.social_members(room,player) values(rid,caller) on conflict do nothing;if target is not null then insert into tzg_private.social_members(room,player) values(rid,target) on conflict do nothing;end if;
 return jsonb_build_object('id',rid);
end;$$;
create or replace function public.tzg_social_group(p_room uuid,p_action text,p_username text default '',p_name text default '',p_bio text default '',p_image text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();r tzg_private.social_rooms:=tzg_private.social_member(p_room,caller);target uuid;
begin
 if r.kind<>'group' then raise exception 'This is not a group.';end if;
 if p_action='leave' then if caller=r.owner then raise exception 'Transfer ownership or delete this group before leaving.';end if;delete from tzg_private.social_members where room=r.id and player=caller;return jsonb_build_object('left',true);end if;
 if caller<>r.owner then raise insufficient_privilege using message='Only the group owner can do that.';end if;
 if p_action='edit' then
  if p_image is not null and (length(p_image)>40000 or p_image !~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$') then raise exception 'Invalid group image.';end if;
  if btrim(p_bio)<>'' then perform tzg_private.clean_text(p_bio,160);end if;
  update tzg_private.social_rooms set name=tzg_private.clean_text(p_name,40),bio=btrim(p_bio),image=p_image where id=r.id;
 elsif p_action='delete' then delete from tzg_private.social_rooms where id=r.id;return jsonb_build_object('deleted',true);
 else
  select user_id into target from tzg_private.player_profiles where username=lower(btrim(p_username));if target is null then raise exception 'Player not found.';end if;if target=caller then raise exception 'Choose another member.';end if;if p_action in ('add','transfer') and exists(select 1 from tzg_private.account_deletions where user_id=target) then raise exception 'This game account is removed.';end if;
  if p_action='add' then
   if (select count(*) from tzg_private.social_members where room=r.id)>=10 then raise exception 'Groups are limited to 10 members, including the owner.';end if;
   if exists(select 1 from tzg_private.social_bans where room=r.id and player=target) then raise exception 'Unban this player first.';end if;
   if tzg_private.social_blocked(caller,target) or not exists(select 1 from tzg_private.friend_links where a=least(caller,target) and b=greatest(caller,target) and status='accepted') then raise exception 'Only accepted friends can be added.';end if;
   insert into tzg_private.social_members(room,player) values(r.id,target) on conflict do nothing;
  elsif p_action in ('kick','ban','transfer') then
   if not exists(select 1 from tzg_private.social_members where room=r.id and player=target) then raise exception 'Player is not a member.';end if;
   if p_action='transfer' then update tzg_private.social_rooms set owner=target where id=r.id;
   else delete from tzg_private.social_members where room=r.id and player=target;if p_action='ban' then insert into tzg_private.social_bans values(r.id,target) on conflict do nothing;end if;end if;
  elsif p_action='unban' then delete from tzg_private.social_bans where room=r.id and player=target;
  else raise exception 'Unknown group action.';end if;
 end if;
 return jsonb_build_object('ok',true);
end;$$;
create or replace function public.tzg_social_messages(p_room uuid,p_after bigint default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();r tzg_private.social_rooms:=tzg_private.social_member(p_room,caller);result jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object('id',id::text,'profile',tzg_private.social_profile(sender),'body',body,'image_available',image is not null,'own',sender=caller,'created_at',created_at) order by id),'[]') into result from (select * from tzg_private.social_messages where room=r.id and id>greatest(0,p_after) and not tzg_private.social_blocked(caller,sender) order by id desc limit 50)m;return result;
end;$$;
create or replace function public.tzg_social_send(p_room uuid,p_body text,p_image text,p_mutation uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();r tzg_private.social_rooms:=tzg_private.social_member(p_room,caller);msg bigint;body text;
begin
 if p_mutation is null then raise exception 'Missing message ID.';end if;
 perform pg_advisory_xact_lock(hashtextextended(caller::text,16));
 select id into msg from tzg_private.social_messages where sender=caller and mutation=p_mutation;if found then return jsonb_build_object('id',msg::text);end if;
 if exists(select 1 from tzg_private.social_messages where sender=caller and created_at>now()-interval '3 seconds') or (select count(*) from tzg_private.social_messages where sender=caller and created_at>now()-interval '1 minute')>=10 then raise exception 'Wait a moment before sending again.';end if;
 if p_image is not null and (length(p_image)>160000 or p_image !~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$') then raise exception 'Invalid screenshot.';end if;
 body:=tzg_private.clean_text(case when btrim(coalesce(p_body,''))='' and p_image is not null then '[Screenshot]' else p_body end);
 insert into tzg_private.social_messages(room,sender,body,image,mutation) values(r.id,caller,body,p_image,p_mutation) returning id into msg;
 delete from tzg_private.social_messages where room=r.id and id in(select id from tzg_private.social_messages where room=r.id order by id desc offset 500);
 return jsonb_build_object('id',msg::text);
end;$$;
create or replace function public.tzg_social_image(p_message bigint) returns text language plpgsql security definer set search_path='' as $$declare caller uuid:=tzg_private.require_player();msg tzg_private.social_messages;begin select * into msg from tzg_private.social_messages where id=p_message;if not found then return null;end if;perform tzg_private.social_member(msg.room,caller);if tzg_private.social_blocked(caller,msg.sender) then raise insufficient_privilege;end if;return msg.image;end;$$;
revoke all on function public.tzg_social_profile(text),public.tzg_social_action(text,text),public.tzg_social_room(uuid),public.tzg_social_state(),public.tzg_social_create(text,text,text),public.tzg_social_group(uuid,text,text,text,text,text),public.tzg_social_messages(uuid,bigint),public.tzg_social_send(uuid,text,text,uuid),public.tzg_social_image(bigint) from public,anon;
grant execute on function public.tzg_social_profile(text),public.tzg_social_action(text,text),public.tzg_social_room(uuid),public.tzg_social_state(),public.tzg_social_create(text,text,text),public.tzg_social_group(uuid,text,text,text,text,text),public.tzg_social_messages(uuid,bigint),public.tzg_social_send(uuid,text,text,uuid),public.tzg_social_image(bigint) to authenticated;
create or replace function public.tzg_chat_profile(p_message bigint) returns jsonb language plpgsql security definer set search_path='' as $$declare caller uuid:=tzg_private.require_player();result jsonb;begin select tzg_private.social_profile(user_id) into result from tzg_private.chat_messages where id=p_message;if result is null then raise exception 'Player profile is unavailable.';end if;return result;end;$$;
create or replace function public.tzg_social_report(p_message bigint,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$declare caller uuid:=tzg_private.require_player();msg tzg_private.social_messages;rid bigint;begin
 select * into msg from tzg_private.social_messages where id=p_message;if not found or msg.sender=caller then raise exception 'Choose another player message.';end if;perform tzg_private.social_member(msg.room,caller);
 if char_length(btrim(p_reason))<3 or char_length(p_reason)>300 then raise exception 'Enter a reason of 3–300 characters.';end if;
 if (select count(*) from tzg_private.chat_reports where reporter_id=caller and created_at>now()-interval '1 hour')>=5 then raise exception 'Report limit reached.';end if;
 insert into tzg_private.chat_reports(message_id,reporter_id,reported_id,reporter_name,reported_name,evidence,category,reason) values(-msg.id,caller,msg.sender,(select username from tzg_private.player_profiles where user_id=caller),(select username from tzg_private.player_profiles where user_id=msg.sender),msg.body,'Private chat',btrim(p_reason)) on conflict(reporter_id,message_id) do nothing returning id into rid;
 update tzg_private.chat_reports set evidence_image=msg.image where reporter_id=caller and message_id=-msg.id;
 return jsonb_build_object('ok',true);
end;$$;
revoke all on function public.tzg_social_report(bigint,text) from public,anon;
grant execute on function public.tzg_social_report(bigint,text) to authenticated;
commit;

create or replace function public.tzg_chat_read(p_after bigint default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();result jsonb;
begin
 if p_after is null or p_after<0 then raise exception 'Invalid chat cursor.';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id::text,'display_name',m.display_name,'avatar',m.avatar,'body',m.body,'created_at',m.created_at,'own',m.user_id=caller,'image_available',m.has_image,'name_color',(array['#ffb8b8','#9bd2ff','#b9f6af','#e4c1ff','#ffd68e','#99eee7','#ffb5dc','#e7ee98'])[1+abs(hashtextextended(m.username,0)%8)::integer]) order by m.id),'[]'::jsonb) into result from (
 select c.id,c.user_id,coalesce(p.username,c.username) as username,coalesce(p.display_name,c.display_name) as display_name,p.avatar,c.body,c.created_at,exists(select 1 from tzg_private.chat_images i where i.message_id=c.id) as has_image from tzg_private.chat_messages c left join tzg_private.player_profiles p on p.user_id=c.user_id where c.id>p_after and not tzg_private.social_blocked(caller,c.user_id) order by c.id asc limit 50)m;
 return result;
end; $$;
create or replace function public.tzg_chat_image(p_message bigint) returns text language plpgsql security definer set search_path='' as $$declare caller uuid:=tzg_private.require_player();begin return(select i.image from tzg_private.chat_images i join tzg_private.chat_messages m on m.id=i.message_id where i.message_id=p_message and not tzg_private.social_blocked(caller,m.user_id));end;$$;

begin;
alter table tzg_private.player_profiles add column if not exists verified boolean not null default false;
alter table tzg_private.chat_messages add column if not exists deleted boolean not null default false;
alter table tzg_private.chat_messages add column if not exists updated_at timestamptz not null default now();
alter table tzg_private.social_messages add column if not exists deleted boolean not null default false;
alter table tzg_private.social_messages add column if not exists updated_at timestamptz not null default now();
alter table tzg_private.social_messages add column if not exists voice text;
create table if not exists tzg_private.message_audit(id bigint generated always as identity primary key,kind text not null,message_id bigint not null,actor uuid not null,display_name text not null,action text not null,original jsonb not null,created_at timestamptz not null default now());
alter table tzg_private.message_audit enable row level security;
revoke all on tzg_private.message_audit from public,anon,authenticated;
revoke all on sequence tzg_private.message_audit_id_seq from public,anon,authenticated;
create or replace function public.tzg_message_change(p_kind text,p_message bigint,p_action text,p_body text default '',p_image text default null,p_replace_image boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();sender uuid;rid uuid;old_body text;old_image text;old_voice text;was_deleted boolean;next_body text;
begin
 if p_kind='global' then select user_id,body,deleted into sender,old_body,was_deleted from tzg_private.chat_messages where id=p_message for update;select image into old_image from tzg_private.chat_images where message_id=p_message;
 elsif p_kind='private' then select room,social_messages.sender,body,image,voice,deleted into rid,sender,old_body,old_image,old_voice,was_deleted from tzg_private.social_messages where id=p_message for update;perform tzg_private.social_member(rid,caller);
 else raise exception 'Invalid chat.';end if;
 if sender is distinct from caller then raise insufficient_privilege using message='You can only change your own messages.';end if;
 if p_action not in ('edit','delete') then raise exception 'Invalid message action.';end if;
 if was_deleted then if p_action='delete' then return jsonb_build_object('ok',true);else raise exception 'This message was deleted.';end if;end if;
 if p_replace_image and p_image is not null and (length(p_image)>160000 or p_image !~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$') then raise exception 'Choose a smaller screenshot.';end if;
 perform pg_advisory_xact_lock(hashtextextended(caller::text,17));if (select count(*) from tzg_private.message_audit where actor=caller and action in ('edit','delete') and created_at>now()-interval '1 hour')>=60 then raise exception 'Message change limit reached. Try again later.';end if;next_body:=case when p_action='delete' then 'deleted a message' else tzg_private.clean_text(case when btrim(coalesce(p_body,''))='' and (case when p_replace_image then p_image else old_image end) is not null then '[Screenshot]' when btrim(coalesce(p_body,''))='' and old_voice is not null then '[Voice message]' else p_body end) end;
 if p_action='edit' and next_body is not distinct from old_body and (not p_replace_image or p_image is not distinct from old_image) then return jsonb_build_object('ok',true);end if;insert into tzg_private.message_audit(kind,message_id,actor,display_name,action,original) values(p_kind,p_message,caller,(select display_name from tzg_private.player_profiles where user_id=caller),p_action,jsonb_build_object('body',old_body,'image',old_image,'voice',old_voice));
 if p_kind='global' then
  update tzg_private.chat_messages set body=next_body,deleted=p_action='delete',updated_at=clock_timestamp() where id=p_message;
  if p_action='delete' or p_replace_image then delete from tzg_private.chat_images where message_id=p_message;if p_action='edit' and p_image is not null then insert into tzg_private.chat_images values(p_message,p_image);end if;end if;
 else update tzg_private.social_messages set body=next_body,deleted=p_action='delete',image=case when p_action='delete' then null when p_replace_image then p_image else image end,voice=case when p_action='delete' then null else voice end,updated_at=clock_timestamp() where id=p_message;end if;
 return jsonb_build_object('ok',true);
end;$$;
create or replace function public.tzg_debug_message_logs(p_offset integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$begin perform public.tzg_debug_authorize(null);if p_offset<0 or p_offset>10000000 then raise exception 'Invalid page.';end if;return jsonb_build_object('total',(select count(*) from tzg_private.message_audit),'logs',coalesce((select jsonb_agg(to_jsonb(t)) from(select id::text,kind,message_id::text,display_name,action,created_at from tzg_private.message_audit order by id desc limit 25 offset p_offset)t),'[]'));end;$$;
create or replace function public.tzg_debug_message_log(p_log bigint) returns jsonb language plpgsql security definer set search_path='' as $$begin perform public.tzg_debug_authorize(null);return(select to_jsonb(l) from tzg_private.message_audit l where id=p_log);end;$$;
create or replace function public.tzg_social_voice_send(p_room uuid,p_voice text,p_mutation uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare caller uuid:=tzg_private.require_player();r tzg_private.social_rooms:=tzg_private.social_member(p_room,caller);result jsonb;begin
 if p_voice is null or length(p_voice)>350000 or p_voice !~ '^data:audio/(webm|mp4|ogg);base64,[A-Za-z0-9+/=]+$' then raise exception 'Voice message is too large or unsupported.';end if;
 perform pg_advisory_xact_lock(hashtextextended(caller::text,16));if exists(select 1 from tzg_private.social_messages where sender=caller and mutation=p_mutation) then if exists(select 1 from tzg_private.social_messages where sender=caller and mutation=p_mutation and room=p_room and voice=p_voice and not deleted) then return(select jsonb_build_object('id',id::text) from tzg_private.social_messages where sender=caller and mutation=p_mutation);else raise exception 'Message ID already used.';end if;end if;result:=public.tzg_social_send(p_room,'[Voice message]',null,p_mutation);update tzg_private.social_messages set voice=p_voice where id=(result->>'id')::bigint and sender=caller and not deleted and voice is null;return result;
end;$$;
create or replace function public.tzg_social_voice(p_message bigint) returns text language plpgsql security definer set search_path='' as $$declare caller uuid:=tzg_private.require_player();m tzg_private.social_messages;begin select * into m from tzg_private.social_messages where id=p_message;if not found then return null;end if;perform tzg_private.social_member(m.room,caller);if tzg_private.social_blocked(caller,m.sender) then raise insufficient_privilege;end if;return case when m.deleted then null else m.voice end;end;$$;
create or replace function public.tzg_social_notifications(p_seen jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$declare caller uuid:=tzg_private.require_player();result jsonb;begin
 if jsonb_typeof(p_seen)<>'object' or length(p_seen::text)>16000 then raise exception 'Invalid notification cursor.';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'last_id',coalesce((select max(id) from tzg_private.social_messages where room=r.id),0)::text,'unread',(select count(*) from tzg_private.social_messages m where m.room=r.id and m.sender<>caller and not m.deleted and not tzg_private.social_blocked(caller,m.sender) and m.id>case when coalesce(p_seen->>r.id::text,'') ~ '^[0-9]{1,18}$' then (p_seen->>r.id::text)::bigint else coalesce((select max(id) from tzg_private.social_messages where room=r.id),0) end))),'[]') into result from tzg_private.social_rooms r join tzg_private.social_members s on s.room=r.id and s.player=caller where r.kind='group' or exists(select 1 from tzg_private.social_members peer join tzg_private.friend_links f on f.a=least(caller,peer.player) and f.b=greatest(caller,peer.player) and f.status='accepted' where peer.room=r.id and peer.player<>caller and not tzg_private.social_blocked(caller,peer.player));
 return jsonb_build_object('rooms',result,'requests',coalesce((select jsonb_agg((select username from tzg_private.player_profiles where user_id=requester)) from tzg_private.friend_links where (a=caller or b=caller) and requester<>caller and status='pending'),'[]'));
end;$$;
revoke all on function public.tzg_message_change(text,bigint,text,text,text,boolean),public.tzg_debug_message_logs(integer),public.tzg_debug_message_log(bigint),public.tzg_social_voice_send(uuid,text,uuid),public.tzg_social_voice(bigint),public.tzg_social_notifications(jsonb) from public,anon;
grant execute on function public.tzg_message_change(text,bigint,text,text,text,boolean),public.tzg_debug_message_logs(integer),public.tzg_debug_message_log(bigint),public.tzg_social_voice_send(uuid,text,uuid),public.tzg_social_voice(bigint),public.tzg_social_notifications(jsonb) to authenticated;
commit;

create or replace function tzg_private.social_profile(who uuid) returns jsonb language sql stable security definer set search_path='' as $$select jsonb_build_object('verified',p.verified,'username',p.username,'display_name',p.display_name,'avatar',p.avatar,'bio',p.bio,'joined_at',u.created_at,'online',coalesce(not tzg_private.social_blocked(auth.uid(),who) and p.last_seen_at>now()-interval '30 seconds' and exists(select 1 from tzg_private.active_game_sessions g join auth.sessions s on s.id=g.session_id where g.user_id=p.user_id and g.session_id=p.online_session),false)) from tzg_private.player_profiles p join auth.users u on u.id=p.user_id where p.user_id=who and not exists(select 1 from tzg_private.account_deletions where user_id=who)$$;
create or replace function public.tzg_player_load()
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player(); result jsonb; initial_name text;
begin
 select left(btrim(regexp_replace(coalesce(raw_user_meta_data->>'display_name','Explorer'),'[[:cntrl:]]','','g')),32) into initial_name from auth.users where id=caller;
 if initial_name='' then initial_name:='Explorer'; end if;
 insert into tzg_private.player_profiles(user_id,display_name,username) values(caller,initial_name,'p_'||replace(caller::text,'-','')) on conflict do nothing;
 insert into tzg_private.player_saves(user_id) values(caller) on conflict do nothing;
 select jsonb_build_object('user_id',caller,'verified',p.verified,'display_name',p.display_name,'username',p.username,'bio',p.bio,'username_changed_at',p.username_changed_at,'username_next_change_at',p.username_changed_at+interval '24 hours','profile_updated_at',p.updated_at,'avatar',p.avatar,'fp',s.fp,'rc',s.rc,'inventory',s.inventory,'revision',s.revision)
 into result from tzg_private.player_profiles p join tzg_private.player_saves s using(user_id) where p.user_id=caller;
 return result;
end; $$;
create or replace function public.tzg_player_profile()
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();
begin
 return (select jsonb_build_object('verified',p.verified,'display_name',p.display_name,'username',p.username,'bio',p.bio,'avatar',p.avatar,'profile_updated_at',p.updated_at,'username_changed_at',p.username_changed_at,'username_next_change_at',p.username_changed_at+interval '24 hours') from tzg_private.player_profiles p where p.user_id=caller);
end; $$;
create or replace function public.tzg_debug_account(p_target uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.tzg_debug_authorize(null);
 select jsonb_build_object('user_id',u.id,'email',u.email,'verified',p.verified,'display_name',p.display_name,'username',p.username,'avatar',p.avatar,'online',(p.last_seen_at>now()-interval '30 seconds' and exists(select 1 from tzg_private.active_game_sessions g join auth.sessions z on z.id=g.session_id where g.user_id=u.id and g.session_id=p.online_session)),'created_at',u.created_at,'email_confirmed',u.email_confirmed_at is not null,'fp',coalesce(s.fp,0),'rc',coalesce(s.rc,0),'inventory',coalesce(s.inventory,'[]'::jsonb),'revision',coalesce(s.revision,0),'ban',(select to_jsonb(b) from tzg_private.account_bans b where b.user_id=u.id and (b.expires_at is null or b.expires_at>now())),'deletion',(select to_jsonb(d) from tzg_private.account_deletions d where d.user_id=u.id),'history',coalesce((select jsonb_agg(to_jsonb(h)) from (select action,reason,created_at,actor from tzg_private.moderation_log where target=u.id order by id desc limit 20)h),'[]'::jsonb)) into result from auth.users u left join tzg_private.player_profiles p on p.user_id=u.id left join tzg_private.player_saves s on s.user_id=u.id where u.id=p_target;
 if result is null then raise invalid_parameter_value using message='Account no longer exists.'; end if;
 return result;
end; $$;
create or replace function public.tzg_debug_accounts(p_offset integer default 0,p_search text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; total bigint;
begin
 perform public.tzg_debug_authorize(null);
 if p_offset is null or p_offset<0 or p_offset>10000000 or p_search is null or char_length(p_search)>100 then raise invalid_parameter_value using message='Invalid account page.'; end if;
 select count(*) into total from auth.users u left join tzg_private.player_profiles p on p.user_id=u.id where coalesce(u.email,'') ilike '%'||p_search||'%' or p.display_name ilike '%'||p_search||'%' or p.username ilike '%'||p_search||'%' or u.id::text=p_search;
 select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) into result from (
 select u.id as user_id,u.email,p.verified,p.display_name,p.username,p.avatar,(p.last_seen_at>now()-interval '30 seconds' and exists(select 1 from tzg_private.active_game_sessions g join auth.sessions z on z.id=g.session_id where g.user_id=u.id and g.session_id=p.online_session)) as online,u.created_at,u.email_confirmed_at is not null as email_confirmed,
 exists(select 1 from tzg_private.account_bans b where b.user_id=u.id and (b.expires_at is null or b.expires_at>now())) as banned,exists(select 1 from tzg_private.account_deletions d where d.user_id=u.id) as deleted
 from auth.users u left join tzg_private.player_profiles p on p.user_id=u.id where coalesce(u.email,'') ilike '%'||p_search||'%' or p.display_name ilike '%'||p_search||'%' or p.username ilike '%'||p_search||'%' or u.id::text=p_search order by u.created_at desc,u.id limit 50 offset p_offset) a;
 return jsonb_build_object('accounts',result,'total',total);
end; $$;
create or replace function public.tzg_debug_account_action(p_target uuid,p_action text,p_reason text,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); reason text:=btrim(p_reason); hours integer; current_revision bigint; target_name text;
begin
 perform public.tzg_debug_authorize('account '||coalesce(p_action,'')||' '||coalesce(p_target::text,''));
 if reason is null or char_length(reason) not between 3 and 300 then raise invalid_parameter_value using message='Provide a moderation reason with 3–300 characters.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_target::text,1));
 if not exists(select 1 from auth.users where id=p_target) then raise invalid_parameter_value using message='Account no longer exists.'; end if;
 if p_action in ('ban','delete') and exists(select 1 from tzg_private.debug_admins where user_id=p_target and enabled) then raise insufficient_privilege using message='Developer accounts cannot be banned or deleted here.'; end if;
 if p_action in ('verify','unverify') then update tzg_private.player_profiles set verified=p_action='verify',updated_at=now() where user_id=p_target;
 elsif p_action='ban' then
  hours:=(p_data->>'hours')::integer;
  if hours is null or hours not in (0,1,24,72,168,720) then raise invalid_parameter_value using message='Choose a valid ban duration.'; end if;
  insert into tzg_private.account_bans(user_id,reason,expires_at,actor) values(p_target,reason,case when hours=0 then null else now()+make_interval(hours=>hours) end,actor)
  on conflict(user_id) do update set reason=excluded.reason,expires_at=excluded.expires_at,actor=excluded.actor,created_at=now();
 elsif p_action='unban' then delete from tzg_private.account_bans where user_id=p_target;
 elsif p_action='restore' then delete from tzg_private.account_deletions where user_id=p_target;
 elsif p_action='remove_avatar' then update tzg_private.player_profiles set avatar=null,updated_at=now() where user_id=p_target;
 elsif p_action='edit' then
  if exists(select 1 from tzg_private.account_deletions where user_id=p_target) then raise invalid_parameter_value using message='Restore the game account before editing data.'; end if;
  perform tzg_private.validate_save(p_data->'state');
  if p_data->>'display_name' is null then raise invalid_parameter_value using message='Display name required.'; end if;
  perform tzg_private.clean_text(p_data->>'display_name',32);
  insert into tzg_private.player_saves(user_id) values(p_target) on conflict do nothing;
  select revision into current_revision from tzg_private.player_saves where user_id=p_target for update;
  if (p_data->>'revision')::bigint is distinct from current_revision then raise sqlstate '40001' using message='Account data changed. Open it again before editing.'; end if;
  update tzg_private.player_saves set fp=(p_data->'state'->>'fp')::bigint,rc=(p_data->'state'->>'rc')::bigint,inventory=p_data->'state'->'inventory',revision=revision+1,last_mutation=null,updated_at=now() where user_id=p_target;
  update tzg_private.player_profiles set display_name=btrim(p_data->>'display_name'),updated_at=now() where user_id=p_target;
 elsif p_action='delete' then
  select username into target_name from tzg_private.player_profiles where user_id=p_target;
  if p_data->>'confirm' is distinct from target_name then raise invalid_parameter_value using message='Type the exact username to confirm permanent deletion.'; end if;
 else raise invalid_parameter_value using message='Unknown account action.'; end if;
 insert into tzg_private.moderation_log(actor,target,action,reason,details) values(actor,p_target,p_action,reason,jsonb_build_object('hours',p_data->'hours'));
 if p_action='delete' then insert into tzg_private.account_deletions(user_id,reason,actor) values(p_target,reason,actor) on conflict(user_id) do update set reason=excluded.reason,actor=excluded.actor,created_at=now();delete from tzg_private.player_saves where user_id=p_target;update tzg_private.player_profiles set avatar=null,bio='',updated_at=now() where user_id=p_target; end if;
 return jsonb_build_object('ok',true);
end; $$;
create or replace function public.tzg_social_messages(p_room uuid,p_after bigint default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();r tzg_private.social_rooms:=tzg_private.social_member(p_room,caller);result jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object('id',id::text,'profile',tzg_private.social_profile(sender),'body',body,'image_available',image is not null,'own',sender=caller,'created_at',created_at,'deleted',deleted,'updated_at',updated_at,'voice_available',voice is not null) order by id),'[]') into result from (select * from tzg_private.social_messages where room=r.id and id>greatest(0,p_after) and not tzg_private.social_blocked(caller,sender) order by id desc limit 50)m;return result;
end;$$;
drop function if exists public.tzg_chat_read(bigint);
create or replace function public.tzg_chat_read(p_after bigint default 0,p_ids bigint[] default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();result jsonb;
begin
 if coalesce(array_length(p_ids,1),0)>100 then raise exception 'Too many message IDs.';end if; if p_after is null or p_after<0 then raise exception 'Invalid chat cursor.';end if;
 select coalesce(jsonb_agg(jsonb_build_object('verified',m.verified,'deleted',m.deleted,'updated_at',m.updated_at,'id',m.id::text,'display_name',m.display_name,'avatar',m.avatar,'body',m.body,'created_at',m.created_at,'own',m.user_id=caller,'image_available',m.has_image,'name_color',(array['#ffb8b8','#9bd2ff','#b9f6af','#e4c1ff','#ffd68e','#99eee7','#ffb5dc','#e7ee98'])[1+abs(hashtextextended(m.username,0)%8)::integer]) order by m.id),'[]'::jsonb) into result from (
 select c.id,c.user_id,c.deleted,c.updated_at,p.verified,coalesce(p.username,c.username) as username,coalesce(p.display_name,c.display_name) as display_name,p.avatar,c.body,c.created_at,exists(select 1 from tzg_private.chat_images i where i.message_id=c.id) as has_image from tzg_private.chat_messages c left join tzg_private.player_profiles p on p.user_id=c.user_id where (c.id>p_after or c.id=any(p_ids)) and not tzg_private.social_blocked(caller,c.user_id) order by c.id asc limit 150)m;
 return result;
end; $$;
revoke all on function public.tzg_chat_read(bigint,bigint[]) from public,anon;grant execute on function public.tzg_chat_read(bigint,bigint[]) to authenticated;

create or replace function tzg_private.audit_group_delete() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.kind='group' then insert into tzg_private.message_audit(kind,message_id,actor,display_name,action,original)
 select 'private',m.id,coalesce(auth.uid(),old.owner),coalesce(p.display_name,'Removed player'),'group_delete',jsonb_build_object('body',m.body,'image',m.image,'voice',m.voice,'room_name',old.name,'sender',m.sender) from tzg_private.social_messages m left join tzg_private.player_profiles p on p.user_id=m.sender where m.room=old.id and not m.deleted;end if;
 return old;
end;$$;
revoke all on function tzg_private.audit_group_delete() from public,anon,authenticated;
drop trigger if exists audit_group_delete on tzg_private.social_rooms;
create trigger audit_group_delete before delete on tzg_private.social_rooms for each row execute function tzg_private.audit_group_delete();


-- v81: public group discovery, partial username search and bounded animated GIFs.
begin;
alter table tzg_private.social_rooms add column if not exists is_public boolean not null default false;
create or replace function tzg_private.valid_chat_image(value text) returns boolean language plpgsql immutable set search_path='' as $$
declare bytes bytea; w integer;h integer;
begin
 if value is null then return false;end if;
 if length(value)<=160000 and value ~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$' then return true;end if;
 if length(value)>1400000 or value !~ '^data:image/gif;base64,[A-Za-z0-9+/=]+$' then return false;end if;
 bytes:=decode(split_part(value,',',2),'base64');if length(bytes)<13 or length(bytes)>1048576 or convert_from(substring(bytes from 1 for 6),'SQL_ASCII') not in ('GIF87a','GIF89a') then return false;end if;
 w:=get_byte(bytes,6)+256*get_byte(bytes,7);h:=get_byte(bytes,8)+256*get_byte(bytes,9);return w between 1 and 1024 and h between 1 and 1024;
 exception when others then return false;
end;$$;
revoke all on function tzg_private.valid_chat_image(text) from public,anon,authenticated;
alter table tzg_private.chat_images drop constraint if exists chat_images_image_check;
alter table tzg_private.chat_images add constraint chat_images_image_check check(tzg_private.valid_chat_image(image));
create or replace function public.tzg_chat_send_image(p_body text,p_image text,p_mutation uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; caller uuid:=tzg_private.require_player();
begin
 perform pg_advisory_xact_lock(hashtextextended(caller::text,2));
 if exists(select 1 from tzg_private.chat_messages where user_id=caller and mutation=p_mutation) then if exists(select 1 from tzg_private.chat_messages m join tzg_private.chat_images i on i.message_id=m.id where m.user_id=caller and m.mutation=p_mutation and i.image=p_image and not m.deleted) then return(select jsonb_build_object('id',id::text) from tzg_private.chat_messages where user_id=caller and mutation=p_mutation);else raise exception 'Message ID already used.';end if;end if;
 if not tzg_private.valid_chat_image(p_image) then raise exception 'Choose a smaller JPG screenshot or a valid GIF under 1 MB (up to 1024 × 1024).';end if;
 result:=public.tzg_chat_send(case when btrim(coalesce(p_body,''))='' then '[Screenshot]' else p_body end,p_mutation);
 insert into tzg_private.chat_images(message_id,image) values((result->>'id')::bigint,p_image) on conflict(message_id) do nothing;
 return result;
end; $$;
create or replace function public.tzg_social_send(p_room uuid,p_body text,p_image text,p_mutation uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();r tzg_private.social_rooms:=tzg_private.social_member(p_room,caller);msg bigint;body text;
begin
 if p_mutation is null then raise exception 'Missing message ID.';end if;
 perform pg_advisory_xact_lock(hashtextextended(caller::text,16));
 select id into msg from tzg_private.social_messages where sender=caller and mutation=p_mutation;if found then return jsonb_build_object('id',msg::text);end if;
 if exists(select 1 from tzg_private.social_messages where sender=caller and created_at>now()-interval '3 seconds') or (select count(*) from tzg_private.social_messages where sender=caller and created_at>now()-interval '1 minute')>=10 then raise exception 'Wait a moment before sending again.';end if;
 if p_image is not null and (not tzg_private.valid_chat_image(p_image)) then raise exception 'Invalid screenshot.';end if;
 body:=tzg_private.clean_text(case when btrim(coalesce(p_body,''))='' and p_image is not null then '[Screenshot]' else p_body end);
 insert into tzg_private.social_messages(room,sender,body,image,mutation) values(r.id,caller,body,p_image,p_mutation) returning id into msg;
 delete from tzg_private.social_messages where room=r.id and id in(select id from tzg_private.social_messages where room=r.id order by id desc offset 500);
 return jsonb_build_object('id',msg::text);
end;$$;
create or replace function public.tzg_message_change(p_kind text,p_message bigint,p_action text,p_body text default '',p_image text default null,p_replace_image boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();sender uuid;rid uuid;old_body text;old_image text;old_voice text;was_deleted boolean;next_body text;
begin
 if p_kind='global' then select user_id,body,deleted into sender,old_body,was_deleted from tzg_private.chat_messages where id=p_message for update;select image into old_image from tzg_private.chat_images where message_id=p_message;
 elsif p_kind='private' then select room,social_messages.sender,body,image,voice,deleted into rid,sender,old_body,old_image,old_voice,was_deleted from tzg_private.social_messages where id=p_message for update;perform tzg_private.social_member(rid,caller);
 else raise exception 'Invalid chat.';end if;
 if sender is distinct from caller then raise insufficient_privilege using message='You can only change your own messages.';end if;
 if p_action not in ('edit','delete') then raise exception 'Invalid message action.';end if;
 if was_deleted then if p_action='delete' then return jsonb_build_object('ok',true);else raise exception 'This message was deleted.';end if;end if;
 if p_replace_image and p_image is not null and (not tzg_private.valid_chat_image(p_image)) then raise exception 'Choose a smaller screenshot.';end if;
 perform pg_advisory_xact_lock(hashtextextended(caller::text,17));if (select count(*) from tzg_private.message_audit where actor=caller and action in ('edit','delete') and created_at>now()-interval '1 hour')>=60 then raise exception 'Message change limit reached. Try again later.';end if;next_body:=case when p_action='delete' then 'deleted a message' else tzg_private.clean_text(case when btrim(coalesce(p_body,''))='' and (case when p_replace_image then p_image else old_image end) is not null then '[Screenshot]' when btrim(coalesce(p_body,''))='' and old_voice is not null then '[Voice message]' else p_body end) end;
 if p_action='edit' and next_body is not distinct from old_body and (not p_replace_image or p_image is not distinct from old_image) then return jsonb_build_object('ok',true);end if;insert into tzg_private.message_audit(kind,message_id,actor,display_name,action,original) values(p_kind,p_message,caller,(select display_name from tzg_private.player_profiles where user_id=caller),p_action,jsonb_build_object('body',old_body,'image',old_image,'voice',old_voice));
 if p_kind='global' then
  update tzg_private.chat_messages set body=next_body,deleted=p_action='delete',updated_at=clock_timestamp() where id=p_message;
  if p_action='delete' or p_replace_image then delete from tzg_private.chat_images where message_id=p_message;if p_action='edit' and p_image is not null then insert into tzg_private.chat_images values(p_message,p_image);end if;end if;
 else update tzg_private.social_messages set body=next_body,deleted=p_action='delete',image=case when p_action='delete' then null when p_replace_image then p_image else image end,voice=case when p_action='delete' then null else voice end,updated_at=clock_timestamp() where id=p_message;end if;
 return jsonb_build_object('ok',true);
end;$$;
create or replace function public.tzg_social_room(p_room uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();r tzg_private.social_rooms:=tzg_private.social_member(p_room,caller);
begin return jsonb_build_object('id',r.id,'kind',r.kind,'is_public',r.is_public,'name',r.name,'bio',r.bio,'image',r.image,'owner',(select username from tzg_private.player_profiles where user_id=r.owner),'is_owner',r.owner=caller,'members',(select coalesce(jsonb_agg(coalesce(tzg_private.social_profile(player),jsonb_build_object('username',(select username from tzg_private.player_profiles where user_id=player),'display_name','Removed player','online',false)) order by joined_at),'[]') from tzg_private.social_members where room=r.id),'bans',case when r.owner=caller then (select coalesce(jsonb_agg(coalesce(tzg_private.social_profile(player),jsonb_build_object('username',(select username from tzg_private.player_profiles where user_id=player),'display_name','Removed player','online',false))),'[]') from tzg_private.social_bans where room=r.id) else '[]'::jsonb end);end;$$;
create or replace function public.tzg_social_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();friends jsonb;incoming jsonb;outgoing jsonb;blocked jsonb;rooms jsonb;
begin
 select coalesce(jsonb_agg(tzg_private.social_profile(case when a=caller then b else a end)) filter(where status='accepted'),'[]'),coalesce(jsonb_agg(tzg_private.social_profile(requester)) filter(where status='pending' and requester<>caller),'[]'),coalesce(jsonb_agg(tzg_private.social_profile(case when a=caller then b else a end)) filter(where status='pending' and requester=caller),'[]') into friends,incoming,outgoing from tzg_private.friend_links where a=caller or b=caller;
 select coalesce(jsonb_agg(tzg_private.social_profile(target)),'[]') into blocked from tzg_private.player_blocks where blocker=caller;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'kind',r.kind,'name',case when r.kind='dm' then coalesce((select p.display_name from tzg_private.social_members m join tzg_private.player_profiles p on p.user_id=m.player where m.room=r.id and m.player<>caller),'Friend chat') else r.name end,'image',case when r.kind='dm' then (select p.avatar from tzg_private.social_members n join tzg_private.player_profiles p on p.user_id=n.player where n.room=r.id and n.player<>caller limit 1) else r.image end) order by r.created_at desc),'[]') into rooms from tzg_private.social_rooms r join tzg_private.social_members m on m.room=r.id and m.player=caller where r.kind='group' or exists(select 1 from tzg_private.social_members n join tzg_private.friend_links f on f.a=least(caller,n.player) and f.b=greatest(caller,n.player) and f.status='accepted' where n.room=r.id and n.player<>caller and not tzg_private.social_blocked(caller,n.player));
 return jsonb_build_object('friends',friends,'incoming',incoming,'outgoing',outgoing,'blocked',blocked,'rooms',rooms);
end;$$;

create or replace function public.tzg_social_search(p_query text,p_kind text default 'players',p_offset integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();needle text:=lower(btrim(coalesce(p_query,'')));result jsonb;
begin
 if p_offset<0 or p_offset>10000 or length(needle)>64 then raise exception 'Invalid search.';end if;
 if p_kind='players' then
  if length(needle)<2 then return '[]'::jsonb;end if;
  select coalesce(jsonb_agg(tzg_private.social_profile(user_id) order by username),'[]'::jsonb) into result from(select p.user_id,p.username from tzg_private.player_profiles p join auth.users u on u.id=p.user_id where u.email_confirmed_at is not null and strpos(p.username,needle)>0 and not tzg_private.social_blocked(caller,p.user_id) and not exists(select 1 from tzg_private.account_deletions where user_id=p.user_id) and not exists(select 1 from tzg_private.account_bans where user_id=p.user_id and (expires_at is null or expires_at>now())) order by p.username limit 20 offset p_offset)profiles;
 elsif p_kind='groups' then
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'bio',bio,'image',image,'member_count',members,'joined',joined) order by name,id),'[]'::jsonb) into result from(select r.id,r.name,r.bio,r.image,(select count(*) from tzg_private.social_members where room=r.id) members,exists(select 1 from tzg_private.social_members where room=r.id and player=caller) joined from tzg_private.social_rooms r where r.kind='group' and r.is_public and (needle='' or strpos(lower(r.name),needle)>0) and not exists(select 1 from tzg_private.social_bans where room=r.id and player=caller) and not tzg_private.social_blocked(caller,r.owner) and not exists(select 1 from tzg_private.account_deletions where user_id=r.owner) and not exists(select 1 from tzg_private.account_bans where user_id=r.owner and(expires_at is null or expires_at>now())) order by r.name,r.id limit 20 offset p_offset)groups;
 else raise exception 'Invalid search kind.';end if;return result;
end;$$;
create or replace function public.tzg_social_visibility(p_room uuid,p_public boolean) returns jsonb language plpgsql security definer set search_path='' as $$declare caller uuid:=tzg_private.require_player();r tzg_private.social_rooms:=tzg_private.social_member(p_room,caller);begin if r.kind<>'group' or r.owner is distinct from caller or p_public is null then raise insufficient_privilege using message='Only the group owner can change visibility.';end if;update tzg_private.social_rooms set is_public=p_public where id=r.id;return jsonb_build_object('ok',true);end;$$;
create or replace function public.tzg_social_public_join(p_room uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare caller uuid:=tzg_private.require_player();r tzg_private.social_rooms;begin
 select * into r from tzg_private.social_rooms where id=p_room for update;
 if not found or r.kind<>'group' or not r.is_public or tzg_private.social_blocked(caller,r.owner) or exists(select 1 from tzg_private.social_bans where room=p_room and player=caller) or exists(select 1 from tzg_private.account_deletions where user_id=r.owner) or exists(select 1 from tzg_private.account_bans where user_id=r.owner and(expires_at is null or expires_at>now())) then raise insufficient_privilege using message='This public group is unavailable.';end if;
 if exists(select 1 from tzg_private.social_members where room=p_room and player=caller) then return jsonb_build_object('ok',true);end if;
 if (select count(*) from tzg_private.social_members where room=p_room)>=10 then raise exception 'Group full (10/10).';end if;
 insert into tzg_private.social_members(room,player) values(p_room,caller);return jsonb_build_object('ok',true);
end;$$;
revoke all on function public.tzg_social_search(text,text,integer),public.tzg_social_visibility(uuid,boolean),public.tzg_social_public_join(uuid) from public,anon;
grant execute on function public.tzg_social_search(text,text,integer),public.tzg_social_visibility(uuid,boolean),public.tzg_social_public_join(uuid) to authenticated;
commit;
