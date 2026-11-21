-- Dispatch from a private Cron worker. The HTTP credential never enters pg_net.
create extension if not exists http with schema extensions;

create table tzg_private.discord_signin_outbox (
 id bigint generated always as identity primary key,
 created_at timestamptz not null default clock_timestamp(),
 payload jsonb not null
);
alter table tzg_private.discord_signin_outbox enable row level security;
revoke all on tzg_private.discord_signin_outbox from public, anon, authenticated;

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

 if not exists(select 1 from vault.secrets where name='tzg_discord_signin_webhook_url') then
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

 insert into tzg_private.discord_signin_outbox(payload)
 values (jsonb_build_object(
  'content', format('**%s** · %s · %s · %s UTC',
   case event_kind when 'guest' then 'Guest entry' else 'Member sign-in' end,
   browser, platform, to_char(event_time at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
  'allowed_mentions', '{"parse":[]}'::jsonb
 ));
 return new;
exception when others then
 -- Alerts must never interrupt sign-in or guest entry. Avoid logging credentials.
 return new;
end;
$$;
revoke all on function tzg_private.discord_signin_alert() from public, anon, authenticated;


create or replace function tzg_private.dispatch_discord_signin_alerts()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
 webhook text;
 event record;
 response_status integer;
begin
 if not pg_try_advisory_xact_lock(hashtext('tzg_discord_signin_webhook_url')) then return; end if;
 delete from tzg_private.discord_signin_outbox where created_at < now() - interval '10 minutes';
 if not exists (select 1 from tzg_private.discord_signin_outbox) then return; end if;

 select decrypted_secret into webhook from vault.decrypted_secrets
 where name='tzg_discord_signin_webhook_url';
 if webhook is null or webhook !~ '^https://discord[.]com/api/webhooks/[0-9]{15,22}/[A-Za-z0-9_-]{20,200}$' then
  return;
 end if;

 perform set_config('http.curlopt_timeout_msec','1500',true);
 for event in select id,payload from tzg_private.discord_signin_outbox order by id limit 8 loop
  begin
   select status into response_status from extensions.http_post(webhook,event.payload::text,'application/json');
  exception when others then
   return;
  end;
  if response_status = 429 or response_status >= 500 then return; end if;
  delete from tzg_private.discord_signin_outbox where id=event.id;
 end loop;
end;
$$;
revoke all on function tzg_private.dispatch_discord_signin_alerts() from public, anon, authenticated;

select cron.schedule(
 'tzg-discord-signin-alerts', '15 seconds',
 'select tzg_private.dispatch_discord_signin_alerts()'
);

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
 delete from tzg_private.discord_signin_outbox;
 return jsonb_build_object('configured', p_action = 'save');
end;
$$;
revoke all on function public.tzg_debug_discord_webhook(text,text) from public, anon, authenticated;
grant execute on function public.tzg_debug_discord_webhook(text,text) to authenticated;
