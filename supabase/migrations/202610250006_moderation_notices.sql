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
