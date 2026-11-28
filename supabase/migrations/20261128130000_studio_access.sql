-- Provision one row through the backend after confirming the owner's auth UID.
-- An empty allowlist grants nobody Studio access.
create schema if not exists tzg_studio;
create extension if not exists pgcrypto with schema extensions;

revoke all on schema tzg_studio from public, anon, authenticated;

create table tzg_studio.developers (
  user_id uuid primary key references auth.users on delete cascade,
  password_hash text not null,
  failed_attempts integer not null default 0,
  retry_after timestamptz
);

create table tzg_studio.unlocks (
  token_hash bytea primary key,
  user_id uuid not null references tzg_studio.developers on delete cascade,
  game_session uuid not null references auth.sessions on delete cascade,
  last_used_at timestamptz not null
);
create index on tzg_studio.unlocks (user_id);

create function tzg_studio.active_session()
returns uuid
language sql stable
set search_path = ''
as $$
  select s.id
  from auth.sessions s
  join auth.users u on u.id = s.user_id
  where s.user_id = auth.uid()
    and s.id::text = auth.jwt()->>'session_id'
    and u.email_confirmed_at is not null
    and coalesce(auth.jwt()->>'is_anonymous', 'false') = 'false'
    and (s.not_after is null or s.not_after > now())
$$;

-- Return false on a bad password so the failure count commits.
create function tzg_studio.verify_password(password text)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  developer tzg_studio.developers%rowtype;
begin
  if tzg_studio.active_session() is null then return false; end if;
  select * into developer from tzg_studio.developers
    where user_id = auth.uid() for update;
  if not found or developer.retry_after > now() then return false; end if;

  if password is null or octet_length(password) not between 12 and 72
    or extensions.crypt(password, developer.password_hash) is distinct from developer.password_hash
  then
    update tzg_studio.developers
    set failed_attempts = case when developer.failed_attempts >= 4 then 0 else developer.failed_attempts + 1 end,
        retry_after = case when developer.failed_attempts >= 4 then now() + interval '5 minutes' end
    where user_id = developer.user_id;
    return false;
  end if;

  update tzg_studio.developers set failed_attempts = 0, retry_after = null
    where user_id = developer.user_id;
  return true;
end
$$;

create function public.tzg_studio_open(password text)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  game_session uuid := tzg_studio.active_session();
  token text;
begin
  if not tzg_studio.verify_password(password) then return null; end if;
  delete from tzg_studio.unlocks
    where user_id = auth.uid() and last_used_at <= now() - interval '10 minutes';
  token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into tzg_studio.unlocks values
    (extensions.digest(token, 'sha256'), auth.uid(), game_session, now());
  return token;
end
$$;

create function public.tzg_studio_check(token text)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
begin
  if token is null or token !~ '^[0-9a-f]{64}$' then return false; end if;
  update tzg_studio.unlocks set last_used_at = now()
    where token_hash = extensions.digest(token, 'sha256')
      and user_id = auth.uid()
      and game_session = tzg_studio.active_session()
      and last_used_at > now() - interval '10 minutes';
  return found;
end
$$;

create function public.tzg_studio_lock(token text)
returns void
language sql security definer
set search_path = ''
as $$
  delete from tzg_studio.unlocks
    where token is not null and token ~ '^[0-9a-f]{64}$'
      and token_hash = extensions.digest(token, 'sha256')
      and user_id = auth.uid()
      and game_session = tzg_studio.active_session()
$$;

revoke all on all tables in schema tzg_studio from public, anon, authenticated;
revoke all on all functions in schema tzg_studio from public, anon, authenticated;
revoke all on function public.tzg_studio_open(text), public.tzg_studio_check(text),
  public.tzg_studio_lock(text) from public, anon, authenticated;
grant execute on function public.tzg_studio_open(text), public.tzg_studio_check(text),
  public.tzg_studio_lock(text) to authenticated;
