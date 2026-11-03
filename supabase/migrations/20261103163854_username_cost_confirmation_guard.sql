-- Older clients must reload and show the price confirmation before they can spend RC.
begin;
CREATE OR REPLACE FUNCTION tzg_private.change_username_paid(p_username text)
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
revoke all on function tzg_private.change_username_paid(text) from public,anon,authenticated;
create or replace function public.tzg_player_username(p_username text,p_expected_revision bigint,p_mutation uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();previous jsonb;result jsonb;saved tzg_private.player_saves;begin
 if p_mutation is null or p_expected_revision is null then raise invalid_parameter_value;end if;
 perform pg_advisory_xact_lock(hashtextextended(caller::text,160));
 select m.result into previous from tzg_private.username_mutations m where user_id=caller and mutation=p_mutation;
 if found then return previous;end if;
 select * into saved from tzg_private.player_saves where user_id=caller for update;
 if saved.revision is distinct from p_expected_revision then raise exception using errcode='40001',message='CLOUD_CONFLICT: reload your saved data before changing your username.';end if;
 result:=tzg_private.change_username_paid(p_username);
 select * into saved from tzg_private.player_saves where user_id=caller;
 result:=result||jsonb_build_object('revision',saved.revision,'state',jsonb_build_object('fp',saved.fp,'rc',saved.rc,'inventory',saved.inventory));
 insert into tzg_private.username_mutations values(caller,p_mutation,result,now());return result;end;$$;
create or replace function public.tzg_player_username(p_username text) returns jsonb language plpgsql security invoker set search_path='' as $$begin raise exception using errcode='22023',message='Reload the latest game to confirm your username change for 2500 RC.';end;$$;
commit;
