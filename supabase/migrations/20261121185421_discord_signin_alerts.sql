-- Optional Discord alerts for newly created game sessions.
-- Configure the URL only in Supabase Vault as tzg_discord_signin_webhook_url.
-- pg_net holds the credential in its internal queue until dispatch.
revoke all on net.http_request_queue from public, anon, authenticated;

create table if not exists tzg_private.discord_signin_cooldown (
 event_kind text primary key check (event_kind in ('member', 'guest')),
 sent_at timestamptz not null
);
alter table tzg_private.discord_signin_cooldown enable row level security;
revoke all on tzg_private.discord_signin_cooldown from public, anon, authenticated;

create or replace function tzg_private.discord_signin_alert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
 event_kind text;
 agent text;
 browser text;
 platform text;
 webhook text;
 event_time timestamptz;
begin
 if tg_table_schema = 'auth' and tg_table_name = 'sessions' then
  event_kind := 'member';
  agent := new.user_agent;
 elsif tg_table_schema = 'tzg_private' and tg_table_name = 'play_sessions' then
  if new.user_id is not null then return new; end if;
  event_kind := 'guest';
  agent := nullif(current_setting('request.headers', true), '')::jsonb ->> 'user-agent';
 else
  return new;
 end if;

 select decrypted_secret into webhook
 from vault.decrypted_secrets
 where name = 'tzg_discord_signin_webhook_url';
 if webhook is null or webhook !~ '^https://discord[.]com/api/webhooks/[0-9]{15,22}/[A-Za-z0-9_-]{20,200}$' then
  return new;
 end if;

 -- Bound traffic from repeated logins and the public guest entry flow.
 if not pg_try_advisory_xact_lock(hashtext('tzg.discord.signin.' || event_kind)) then
  return new;
 end if;
 event_time := clock_timestamp();
 insert into tzg_private.discord_signin_cooldown as existing (event_kind, sent_at)
 values (event_kind, event_time)
 on conflict on constraint discord_signin_cooldown_pkey do update
 set sent_at = excluded.sent_at
 where existing.sent_at <= excluded.sent_at - interval '5 seconds';
 if not found then return new; end if;

 agent := lower(left(coalesce(agent, ''), 1024));
 browser := case
  when agent ~ 'edg(e|a|ios)?/' then 'Edge'
  when agent ~ 'opr/|opios/' then 'Opera'
  when agent ~ 'samsungbrowser/' then 'Samsung Internet'
  when agent ~ 'firefox/|fxios/' then 'Firefox'
  when agent ~ 'chrome/|crios/' then 'Chrome'
  when agent like '%safari/%' then 'Safari'
  else 'Other'
 end;
 platform := case
  when agent like '%android%' then 'Android'
  when agent ~ 'iphone|ipad|ipod' then 'iOS / iPadOS'
  when agent ~ 'windows|macintosh|x11|linux' then 'Desktop'
  else 'Other'
 end;

 -- Delivery is enabled by the private dispatch migration.
 return new;
exception when others then
 -- Alerts must never interrupt sign-in or guest entry. Avoid logging credentials.
 return new;
end;
$$;
revoke all on function tzg_private.discord_signin_alert() from public, anon, authenticated;

create trigger tzg_discord_member_signin after insert on auth.sessions
for each row execute function tzg_private.discord_signin_alert();
create trigger tzg_discord_guest_entry after insert on tzg_private.play_sessions
for each row execute function tzg_private.discord_signin_alert();

create or replace function public.tzg_backend_version()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select jsonb_build_object('version', 'v0.0.4'); $$;
revoke all on function public.tzg_backend_version() from public;
grant execute on function public.tzg_backend_version() to anon, authenticated;

create or replace function public.tzg_debug_discord_webhook(p_action text, p_url text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
 secret_id uuid;
 secret_name constant text := 'tzg_discord_signin_webhook_url';
begin
 if p_action is null or p_action not in ('status', 'save', 'remove') then
  raise invalid_parameter_value using message = 'Unsupported webhook action.';
 end if;
 -- Use the existing developer allowlist and live-session check. Audit only the action.
 perform public.tzg_debug_authorize(case when p_action <> 'status' then 'discord webhook ' || p_action end);

 if p_action <> 'status' then
  perform pg_advisory_xact_lock(hashtext(secret_name));
 end if;
 select id into secret_id from vault.secrets where name = secret_name;
 if p_action = 'status' then
  return jsonb_build_object('configured', secret_id is not null);
 end if;
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
revoke all on function public.tzg_debug_discord_webhook(text,text) from public, anon, authenticated;
grant execute on function public.tzg_debug_discord_webhook(text,text) to authenticated;
