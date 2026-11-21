create or replace function public.tzg_debug_discord_settings(p_action text, p_url text default null, p_settings jsonb default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 secret_id uuid;
 current_secret text;
 webhook text;
 settings jsonb;
 config jsonb;
 secret_name constant text := 'tzg_discord_signin_webhook_url';
begin
 if p_action is null or p_action not in ('status','save','remove') then
  raise invalid_parameter_value using message='Unsupported webhook action.';
 end if;
 perform public.tzg_debug_authorize(case when p_action<>'status' then 'discord webhook '||p_action end);
 if p_action<>'status' then perform pg_advisory_xact_lock(hashtext(secret_name)); end if;
 select id,decrypted_secret into secret_id,current_secret from vault.decrypted_secrets where name=secret_name;
 config := case when left(current_secret,1)='{' then current_secret::jsonb else jsonb_build_object('url',current_secret) end;
 webhook := config->>'url';
 settings := jsonb_build_object('color','#3498DB','member',true,'guest',true,'browser',true,'device',true,'utc',true)
             || coalesce(config->'settings','{}'::jsonb);
 if p_action='status' then return jsonb_build_object('configured',webhook is not null,'settings',settings); end if;
 if p_action='remove' then
  delete from vault.secrets where id=secret_id;
  return jsonb_build_object('configured',false,'settings',settings);
 end if;
 webhook := coalesce(nullif(p_url,''),webhook);
 if webhook is null or webhook !~ '^https://discord[.]com/api/webhooks/[0-9]{15,22}/[A-Za-z0-9_-]{20,200}$' then
  raise invalid_parameter_value using message='Paste a valid Discord webhook URL.';
 end if;
 if jsonb_typeof(p_settings)='object' then
  settings := settings || (select coalesce(jsonb_object_agg(key,value),'{}'::jsonb)
  from jsonb_each(p_settings)
  where (key in ('member','guest','browser','device','utc') and jsonb_typeof(value)='boolean')
     or (key='color' and jsonb_typeof(value)='string' and value #>> '{}' ~ '^#[0-9a-fA-F]{6}$'));
 end if;
 config := jsonb_build_object('url',webhook,'settings',settings);
 begin
  if secret_id is null then perform vault.create_secret(config::text,secret_name);
  else perform vault.update_secret(secret_id,config::text); end if;
 exception when others then
  raise sqlstate 'P0001' using message='Could not update the Discord webhook.';
 end;
 return jsonb_build_object('configured',true,'settings',settings);
end;
$$;
revoke all on function public.tzg_debug_discord_settings(text,text,jsonb) from public, anon, authenticated;
grant execute on function public.tzg_debug_discord_settings(text,text,jsonb) to authenticated;

create or replace function public.tzg_discord_delivery_config(p_member_session uuid,p_member_user uuid,p_guest_visitor uuid,p_test boolean)
returns text language plpgsql stable security definer set search_path=''
as $$
declare secret text;
begin
 if p_test is distinct from true then
  if p_guest_visitor is not null then
   if p_member_session is not null or p_member_user is not null or not exists (
    select 1 from tzg_private.guest_identities where visitor=p_guest_visitor
   ) then return null; end if;
  elsif not exists (
   select 1 from auth.sessions where id=p_member_session and user_id=p_member_user
    and created_at>now()-interval '10 minutes'
  ) then return null;
  end if;
 end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='tzg_discord_signin_webhook_url';
 return secret;
end;
$$;
revoke all on function public.tzg_discord_delivery_config(uuid,uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function public.tzg_discord_delivery_config(uuid,uuid,uuid,boolean) to service_role;

create or replace function public.tzg_backend_version()
returns jsonb language sql stable security invoker set search_path=''
as $$ select jsonb_build_object('version','v0.0.6'); $$;
