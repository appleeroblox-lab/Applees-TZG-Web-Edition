-- Apply after social accounts migration 003. No public player UUIDs/emails.
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
commit;
