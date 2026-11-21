begin;

alter table tzg_private.player_profiles
 add column inactivity_delete_14_days boolean not null default true;

create function public.tzg_account_inactivity(p_delete_after_14_days boolean default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare
 caller uuid := tzg_private.require_player();
 enabled boolean;
begin
 if p_delete_after_14_days is null then
  select inactivity_delete_14_days into strict enabled
  from tzg_private.player_profiles where user_id=caller;
 else
  update tzg_private.player_profiles
  set inactivity_delete_14_days=p_delete_after_14_days
  where user_id=caller returning inactivity_delete_14_days into strict enabled;
 end if;
 return enabled;
end;
$$;

revoke all on function public.tzg_account_inactivity(boolean) from public,anon,authenticated;
grant execute on function public.tzg_account_inactivity(boolean) to authenticated;

create function tzg_private.purge_inactive_accounts()
returns integer language plpgsql security definer set search_path='' as $$
declare
 candidate record;
 removed integer := 0;
begin
 for candidate in
  select u.id
  from auth.users u
  join tzg_private.player_profiles p on p.user_id=u.id
  where not coalesce(u.is_anonymous,false)
   and not exists(select 1 from tzg_private.debug_admins a where a.user_id=u.id and a.enabled)
   and greatest(u.created_at,u.last_sign_in_at,p.last_online_at,p.last_seen_at)
      <= now() - case when p.inactivity_delete_14_days then interval '14 days' else interval '30 days' end
  order by greatest(u.created_at,u.last_sign_in_at,p.last_online_at,p.last_seen_at)
  limit 500 for update of u,p skip locked
 loop
  insert into tzg_private.moderation_log(actor,target,action,reason,details)
  values('00000000-0000-0000-0000-000000000000',candidate.id,'delete',
   'Your account has been deleted due to inactivity for a long time','{"source":"inactivity"}');
  delete from auth.users where id=candidate.id;
  removed:=removed+1;
 end loop;
 return removed;
end;
$$;

revoke all on function tzg_private.purge_inactive_accounts() from public,anon,authenticated;
select cron.schedule('tzg-expire-inactive-accounts','17 * * * *','select tzg_private.purge_inactive_accounts();');

-- Independent backend release metadata. Does not read or change player data.
create or replace function public.tzg_backend_version()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select jsonb_build_object('version', 'v0.0.2'); $$;
revoke all on function public.tzg_backend_version() from public;
grant execute on function public.tzg_backend_version() to anon, authenticated;

commit;
