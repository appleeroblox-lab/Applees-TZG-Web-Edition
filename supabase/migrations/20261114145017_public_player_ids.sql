-- Public numeric player IDs; auth UUIDs and save ownership stay unchanged.
ALTER TABLE tzg_private.player_profiles ADD COLUMN public_id bigint GENERATED ALWAYS AS IDENTITY (START WITH 100000001) UNIQUE;

CREATE OR REPLACE FUNCTION public.tzg_player_profile()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller uuid:=tzg_private.require_player();
begin
 return (select jsonb_build_object('public_id',p.public_id::text,'verified',p.verified,'display_name',p.display_name,'username',p.username,'bio',p.bio,'avatar',p.avatar,'profile_updated_at',p.updated_at,'username_changed_at',p.username_changed_at,'username_next_change_at',p.username_changed_at+interval '24 hours') from tzg_private.player_profiles p where p.user_id=caller);
end; $function$
;

CREATE OR REPLACE FUNCTION tzg_private.social_profile(who uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$select (tzg_private.social_profile_before_v87(who) || (select jsonb_build_object('public_id',p.public_id::text) from tzg_private.player_profiles p where p.user_id=who)) where not exists(select 1 from tzg_private.self_account_state where user_id=who and deactivated_at is not null)$function$
;

CREATE OR REPLACE FUNCTION tzg_private.social_search_before_v87(p_query text, p_kind text DEFAULT 'players'::text, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller uuid:=tzg_private.require_player();needle text:=lower(btrim(coalesce(p_query,'')));result jsonb;
begin
 if p_offset<0 or p_offset>10000 or length(needle)>64 then raise exception 'Invalid search.';end if;
 if p_kind='players' then
  if length(needle)<2 then return '[]'::jsonb;end if;
  select coalesce(jsonb_agg(tzg_private.social_profile(user_id) order by username),'[]'::jsonb) into result from(select p.user_id,p.username from tzg_private.player_profiles p join auth.users u on u.id=p.user_id where u.email_confirmed_at is not null and (strpos(p.username,needle)>0 or p.public_id::text=needle) and not tzg_private.social_blocked(caller,p.user_id) and not exists(select 1 from tzg_private.account_deletions where user_id=p.user_id) and not exists(select 1 from tzg_private.account_bans where user_id=p.user_id and (expires_at is null or expires_at>now())) order by p.username limit 20 offset p_offset)profiles;
 elsif p_kind='groups' then
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'bio',bio,'image',image,'member_count',members,'joined',joined) order by name,id),'[]'::jsonb) into result from(select r.id,r.name,r.bio,r.image,(select count(*) from tzg_private.social_members where room=r.id) members,exists(select 1 from tzg_private.social_members where room=r.id and player=caller) joined from tzg_private.social_rooms r where r.kind='group' and r.is_public and (needle='' or strpos(lower(r.name),needle)>0) and not exists(select 1 from tzg_private.social_bans where room=r.id and player=caller) and not tzg_private.social_blocked(caller,r.owner) and not exists(select 1 from tzg_private.account_deletions where user_id=r.owner) and not exists(select 1 from tzg_private.account_bans where user_id=r.owner and(expires_at is null or expires_at>now())) order by r.name,r.id limit 20 offset p_offset)groups;
 else raise exception 'Invalid search kind.';end if;return result;
end;$function$
;

CREATE OR REPLACE FUNCTION public.tzg_player_load()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller uuid:=tzg_private.require_player(); result jsonb; initial_name text;
begin
 select left(btrim(regexp_replace(coalesce(raw_user_meta_data->>'display_name','Explorer'),'[[:cntrl:]]','','g')),32) into initial_name from auth.users where id=caller;
 if initial_name='' then initial_name:='Explorer'; end if;
 insert into tzg_private.player_profiles(user_id,display_name,username) values(caller,initial_name,'p_'||replace(caller::text,'-','')) on conflict do nothing;
 insert into tzg_private.player_saves(user_id) values(caller) on conflict do nothing;
 select jsonb_build_object('public_id',p.public_id::text,'user_id',caller,'verified',p.verified,'display_name',p.display_name,'username',p.username,'bio',p.bio,'username_changed_at',p.username_changed_at,'username_next_change_at',p.username_changed_at+interval '24 hours','profile_updated_at',p.updated_at,'avatar',p.avatar,'fp',s.fp,'rc',s.rc,'inventory',s.inventory,'revision',s.revision)
 into result from tzg_private.player_profiles p join tzg_private.player_saves s using(user_id) where p.user_id=caller;
 return result;
end; $function$
;

CREATE OR REPLACE FUNCTION public.tzg_guest_profiles(p_query text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;begin
 if length(btrim(p_query))<2 or length(p_query)>64 then return '[]'::jsonb;end if;
 select coalesce(jsonb_agg(jsonb_build_object('public_id',p.public_id::text,'username',p.username,'display_name',p.display_name,'avatar',p.avatar,'bio',p.bio,'verified',p.verified,'joined_at',(select u.created_at::date from auth.users u where u.id=p.user_id),'online',tzg_private.guest_online(p.user_id))),'[]'::jsonb) into result from (select p.* from tzg_private.player_profiles p where (position(lower(btrim(p_query)) in p.username)>0 or p.public_id::text=btrim(p_query)) and not exists(select 1 from tzg_private.account_deletions d where d.user_id=p.user_id) and not exists(select 1 from tzg_private.self_account_state d where d.user_id=p.user_id and d.deactivated_at is not null) order by p.username limit 20)p;
 return result;end;$function$
;

CREATE OR REPLACE FUNCTION public.tzg_profile_banner(p_username text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object('public_id',p.public_id::text,'last_online_at',p.last_online_at,'banner',b.image,'achievements_unlocked',(select count(*) from tzg_private.achievement_progress ap where ap.user_id=p.user_id and ap.completed_at is not null))
 from tzg_private.player_profiles p left join tzg_private.profile_banners b using(user_id)
 where p.username=lower(btrim(p_username)) and length(p_username)<=64
 and not exists(select 1 from tzg_private.account_deletions d where d.user_id=p.user_id)
 and not exists(select 1 from tzg_private.self_account_state a where a.user_id=p.user_id and a.deactivated_at is not null)
$function$
;

-- Keep identifier allocation private and prevent subsequent reassignment.
REVOKE ALL ON SEQUENCE tzg_private.player_profiles_public_id_seq FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION tzg_private.keep_public_player_id() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.public_id IS DISTINCT FROM OLD.public_id THEN
  RAISE EXCEPTION 'Public Player ID cannot be changed.';
 END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION tzg_private.keep_public_player_id() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER keep_public_player_id BEFORE UPDATE OF public_id ON tzg_private.player_profiles
FOR EACH ROW EXECUTE FUNCTION tzg_private.keep_public_player_id();
