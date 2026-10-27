-- Current, server-validated catalogue for exploration progress.
begin;
create or replace function public.tzg_account_explore(p_body text) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();begin
 if p_body is null or not(p_body=any(ARRAY['Mercury','Venus','Earth','Moon','Mars','Jupiter','Saturn','Uranus','Neptune','Ceres','Pluto','Eris','Haumea','Makemake','Phobos','Deimos','Io','Europa','Ganymede','Callisto','Titan','Enceladus','Mimas','Rhea','Dione','Tethys','Iapetus','Miranda','Ariel','Umbriel','Titania','Oberon','Triton','Proteus','Nereid','Charon','Nix','Hydra','Dysnomia','Hiʻiaka','Namaka','Proxima b','Andromeda · simulated world','Triangulum · simulated world','Large Magellanic Cloud · simulated world','Small Magellanic Cloud · simulated world','M87 · simulated world','M51 · simulated world','M104 · simulated world','TRAPPIST-1 b','TRAPPIST-1 c','TRAPPIST-1 d','TRAPPIST-1 e','TRAPPIST-1 f','TRAPPIST-1 g','TRAPPIST-1 h','RS 2041 b','RS 2041 c','RS 2041 c I','RS 2041 d','RS 2042 b','RS 2042 c','RS 2042 c I','RS 2042 d','RS 2043 b','RS 2043 c','RS 2043 c I','RS 2043 d','RS 2044 b','RS 2044 c','RS 2044 c I','RS 2044 d','RS 2045 b','RS 2045 c','RS 2045 c I','RS 2045 d','RS 2046 b','RS 2046 c','RS 2046 c I','RS 2046 d','Orcus','Quaoar','Sedna','Gonggong','Salacia','Varda','Actaea','Ilmarë','Vanth','Xiangliu','Planet X','Proxima c','Proxima d','Zoozve','Vesta','Pallas','Hygiea','Eros','Ida','Gaspra','Itokawa','Bennu','Ryugu','Arrokoth','Varuna','Ixion','Oort Survey 01','Oort Survey 02','Oort Survey 03','Oort Survey 04','Oort Survey 05','Oort Survey 06','Oort Survey 07','Oort Survey 08'])) then raise invalid_parameter_value using message='Unknown exploration destination.';end if;
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

commit;
