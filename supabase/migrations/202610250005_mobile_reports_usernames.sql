-- Apply after 003. Also includes the v65 privacy/bio changes if 004 was missed.
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
commit;
