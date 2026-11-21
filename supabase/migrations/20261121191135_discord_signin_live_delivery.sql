-- Sign-in alerts are sent by the Edge Function. Only the Vault URL is retained.
drop trigger if exists tzg_discord_member_signin on auth.sessions;
drop trigger if exists tzg_discord_guest_entry on tzg_private.play_sessions;

do $$
begin
 if to_regprocedure('cron.unschedule(text)') is not null and exists (
  select 1 from cron.job where jobname='tzg-discord-signin-alerts'
 ) then
  perform cron.unschedule('tzg-discord-signin-alerts');
 end if;
end;
$$;

create or replace function public.tzg_debug_discord_webhook(p_action text, p_url text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
 secret_id uuid;
 secret_name constant text := 'tzg_discord_signin_webhook_url';
begin
 if p_action is null or p_action not in ('status', 'save', 'remove') then
  raise invalid_parameter_value using message = 'Unsupported webhook action.';
 end if;
 perform public.tzg_debug_authorize(case when p_action <> 'status' then 'discord webhook ' || p_action end);
 if p_action <> 'status' then perform pg_advisory_xact_lock(hashtext(secret_name)); end if;
 select id into secret_id from vault.secrets where name = secret_name;
 if p_action = 'status' then return jsonb_build_object('configured', secret_id is not null); end if;
 if p_action = 'save' and (p_url is null or length(p_url) > 300 or
   p_url !~ '^https://discord[.]com/api/webhooks/[0-9]{15,22}/[A-Za-z0-9_-]{20,200}$') then
  raise invalid_parameter_value using message = 'Enter a Discord webhook URL copied from Server Settings.';
 end if;
 begin
  if p_action = 'remove' then
   delete from vault.secrets where id = secret_id;
  elsif secret_id is null then
   perform vault.create_secret(p_url, secret_name);
  else
   perform vault.update_secret(secret_id, p_url);
  end if;
 exception when others then
  raise sqlstate 'P0001' using message = 'Could not update the Discord webhook.';
 end;
 return jsonb_build_object('configured', p_action = 'save');
end;
$$;

drop function if exists tzg_private.dispatch_discord_signin_alerts();
drop function if exists tzg_private.discord_signin_alert();
drop table if exists tzg_private.discord_signin_outbox;
drop table if exists tzg_private.discord_signin_cooldown;

create or replace function public.tzg_discord_live_config(p_member_session uuid, p_member_user uuid, p_guest_visitor uuid)
returns text language plpgsql stable security definer set search_path = ''
as $$
declare webhook text;
begin
 if p_guest_visitor is not null then
  if p_member_session is not null or p_member_user is not null or not exists (
   select 1 from tzg_private.guest_identities where visitor = p_guest_visitor
  ) then return null; end if;
 else
  if p_member_session is null or p_member_user is null or not exists (
   select 1 from auth.sessions
   where id = p_member_session and user_id = p_member_user
   and created_at > now() - interval '2 minutes'
  ) then return null; end if;
 end if;
 select decrypted_secret into webhook from vault.decrypted_secrets where name='tzg_discord_signin_webhook_url';
 return webhook;
end;
$$;
revoke all on function public.tzg_discord_live_config(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.tzg_discord_live_config(uuid,uuid,uuid) to service_role;

create or replace function public.tzg_backend_version()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select jsonb_build_object('version', 'v0.0.5'); $$;
