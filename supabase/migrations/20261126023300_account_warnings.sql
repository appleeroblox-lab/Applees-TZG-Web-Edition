begin;

create index if not exists moderation_log_latest_warning
 on tzg_private.moderation_log (target, id desc) where action='warn';

-- Deliver a warning once to the account and require older sessions to sign in again.
create or replace function public.tzg_player_moderation()
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); notice jsonb; stamp timestamptz; warning tzg_private.moderation_log;
begin
 notice:=tzg_private.player_moderation_before_v87();
 if notice is not null then return notice; end if;
 select deactivated_at into stamp from tzg_private.self_account_state where user_id=caller;
 if stamp is not null then
  return jsonb_build_object('kind','deactivated','reason','You temporarily deactivated this account.','decided_at',stamp,'expires_at',null);
 end if;
 select * into warning from tzg_private.moderation_log
 where target=caller and action='warn' order by id desc limit 1;
 if found and exists(
  select 1 from auth.sessions s where s.user_id=caller and s.id::text=auth.jwt()->>'session_id'
  and (not (warning.details ? 'acknowledged_at') or s.created_at<=(warning.details->>'acknowledged_at')::timestamptz)
 ) then
  return jsonb_build_object('kind','warn','id',warning.id::text,'reason',warning.reason,'decided_at',warning.created_at);
 end if;
 return null;
end;$$;

create or replace function public.tzg_player_acknowledge_warning(p_warning bigint)
returns void language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid();
begin
 if caller is null or not exists(
  select 1 from auth.sessions s where s.user_id=caller and s.id::text=auth.jwt()->>'session_id'
 ) then raise insufficient_privilege using message='Sign in to acknowledge your warning.'; end if;
 update tzg_private.moderation_log set details=details||jsonb_build_object('acknowledged_at',clock_timestamp())
 where id=p_warning and target=caller and action='warn' and not (details ? 'acknowledged_at');
end;$$;
revoke all on function public.tzg_player_acknowledge_warning(bigint) from public,anon,authenticated;
grant execute on function public.tzg_player_acknowledge_warning(bigint) to authenticated;

create or replace function public.tzg_debug_account_action(p_target uuid,p_action text,p_reason text,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); reason text:=btrim(p_reason); hours integer; current_revision bigint; target_name text;
begin
 perform public.tzg_debug_authorize('account '||coalesce(p_action,'')||' '||coalesce(p_target::text,''));
 if reason is null or char_length(reason) not between 3 and 300 then raise invalid_parameter_value using message='Provide a moderation reason with 3–300 characters.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_target::text,1));
 if not exists(select 1 from auth.users where id=p_target) then raise invalid_parameter_value using message='Account no longer exists.'; end if;
 if p_action in ('ban','delete') and exists(select 1 from tzg_private.debug_admins where user_id=p_target and enabled) then raise insufficient_privilege using message='Developer accounts cannot be banned or deleted here.'; end if;
 if p_action='warn' then
  insert into tzg_private.moderation_log(actor,target,action,reason,created_at)
  values(actor,p_target,p_action,reason,clock_timestamp());
  return jsonb_build_object('ok',true);
 elsif p_action in ('verify','unverify') then update tzg_private.player_profiles set verified=p_action='verify',updated_at=now() where user_id=p_target;
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
  if p_data->>'confirm_target' is distinct from p_target::text then raise invalid_parameter_value using message='Confirm the selected account before deleting game data.'; end if;
 else raise invalid_parameter_value using message='Unknown account action.'; end if;
 insert into tzg_private.moderation_log(actor,target,action,reason,details) values(actor,p_target,p_action,reason,jsonb_build_object('hours',p_data->'hours'));
 if p_action='delete' then delete from auth.users where id=p_target;end if;
 return jsonb_build_object('ok',true);
end; $$;

revoke all on function public.tzg_debug_account_action(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.tzg_debug_account_action(uuid,text,text,jsonb) to authenticated;

create or replace function public.tzg_backend_version()
returns jsonb language sql stable security invoker set search_path=''
as $$ select jsonb_build_object('version','v0.0.13'); $$;

commit;
