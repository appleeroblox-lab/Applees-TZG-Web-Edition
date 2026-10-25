-- Run once in Supabase SQL Editor, using the postgres role.
-- No passwords, public sign-up hook, or first-visitor bootstrap is installed.
begin;
create schema if not exists tzg_private;
revoke all on schema tzg_private from public, anon, authenticated;

create table if not exists tzg_private.debug_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists tzg_private.debug_audit (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 command text not null check (char_length(command) between 1 and 180)
);
alter table tzg_private.debug_admins enable row level security;
alter table tzg_private.debug_audit enable row level security;
revoke all on all tables in schema tzg_private from public, anon, authenticated;
revoke all on all sequences in schema tzg_private from public, anon, authenticated;

create or replace function public.tzg_debug_authorize(p_command text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
 caller uuid := auth.uid();
begin
 if caller is null or not exists (
  select 1 from tzg_private.debug_admins a
  join auth.users u on u.id=a.user_id
  where a.user_id=caller and a.enabled and u.email_confirmed_at is not null
 ) or not exists (
  select 1 from auth.sessions s
  where s.user_id=caller and s.id::text=(auth.jwt()->>'session_id')
 ) then
  raise insufficient_privilege using message='Developer access denied. Ask the project owner to authorize this account.';
 end if;
 if p_command is not null then
  if char_length(btrim(p_command)) not between 1 and 180 then
   raise invalid_parameter_value using message='Use a command with 1–180 characters.';
  end if;
  -- Serialize checks per developer so simultaneous calls cannot evade the limit.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(caller::text,0));
  if (select count(*) from tzg_private.debug_audit where user_id=caller and created_at>now()-interval '1 minute')>=120 then
   raise sqlstate 'P0001' using message='Too many commands. Wait a minute and retry.';
  end if;
  insert into tzg_private.debug_audit(user_id,command) values(caller,p_command);
  delete from tzg_private.debug_audit where id in (
   select id from tzg_private.debug_audit where user_id=caller order by id desc offset 500
  );
 end if;
 return jsonb_build_object('authorized',true);
end;
$$;
revoke all on function public.tzg_debug_authorize(text) from public, anon, authenticated;
grant execute on function public.tzg_debug_authorize(text) to authenticated;
commit;
