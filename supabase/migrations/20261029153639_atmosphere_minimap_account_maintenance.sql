begin;
-- Run once in the Supabase SQL Editor. No game progress or verified accounts are reset.
-- Unconfirmed EMAIL registrations older than five hours are removed on the next minute tick.
create or replace function public.tzg_debug_guest_totals()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.tzg_debug_authorize(null);
 return (select jsonb_build_object(
  'total_guests',count(distinct visitor),
  'online_guests',count(distinct visitor) filter(where ended_at is null and last_seen>now()-interval '90 seconds'),
  'guest_sessions',count(*)) from tzg_private.play_sessions where user_id is null);
end;$$;
revoke all on function public.tzg_debug_guest_totals() from public,anon,authenticated;
grant execute on function public.tzg_debug_guest_totals() to authenticated;

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
  if p_data->>'confirm_target' is distinct from p_target::text then raise invalid_parameter_value using message='Confirm the selected account before deleting game data.'; end if;
 else raise invalid_parameter_value using message='Unknown account action.'; end if;
 insert into tzg_private.moderation_log(actor,target,action,reason,details) values(actor,p_target,p_action,reason,jsonb_build_object('hours',p_data->'hours'));
 if p_action='delete' then insert into tzg_private.account_deletions(user_id,reason,actor) values(p_target,reason,actor) on conflict(user_id) do update set reason=excluded.reason,actor=excluded.actor,created_at=now();delete from tzg_private.player_saves where user_id=p_target;update tzg_private.player_profiles set avatar=null,bio='',updated_at=now() where user_id=p_target; end if;
 return jsonb_build_object('ok',true);
end; $$;

revoke all on function public.tzg_debug_account_action(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.tzg_debug_account_action(uuid,text,text,jsonb) to authenticated;

create or replace function tzg_private.purge_unconfirmed_email_users()
returns integer language plpgsql security definer set search_path='' as $$
declare candidate record; removed integer:=0;
begin
 for candidate in
  select u.id from auth.users u
  where coalesce(u.email,'')<>'' and u.email_confirmed_at is null
    and u.phone_confirmed_at is null and not coalesce(u.is_anonymous,false)
    and u.created_at<=now()-interval '5 hours'
    and not exists(select 1 from auth.identities i where i.user_id=u.id and i.provider<>'email')
    and not exists(select 1 from tzg_private.debug_admins a where a.user_id=u.id and a.enabled)
  order by u.created_at limit 500 for update of u skip locked
 loop
  delete from auth.sessions where user_id=candidate.id;
  delete from auth.users where id=candidate.id;
  removed:=removed+1;
 end loop;
 return removed;
end;$$;
revoke all on function tzg_private.purge_unconfirmed_email_users() from public,anon,authenticated;
create extension if not exists pg_cron;
select cron.schedule('tzg-expire-unconfirmed-email','* * * * *','select tzg_private.purge_unconfirmed_email_users();');

commit;
