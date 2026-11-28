create table tzg_studio.drafts (
  user_id uuid primary key references tzg_studio.developers on delete cascade,
  revision bigint not null check (revision > 0),
  document jsonb not null,
  updated_at timestamptz not null default now()
);

create table tzg_studio.draft_history (
  user_id uuid not null references tzg_studio.developers on delete cascade,
  revision bigint not null,
  document jsonb not null,
  action text not null check (action in ('save', 'restore')),
  restored_from bigint,
  recorded_at timestamptz not null default now(),
  primary key (user_id, revision)
);

revoke all on tzg_studio.drafts, tzg_studio.draft_history from public, anon, authenticated;

create function public.tzg_studio_read_draft(token text, requested_revision bigint default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.tzg_studio_check(token) then
    return jsonb_build_object('status', 'locked');
  end if;
  if requested_revision is not null then
    return coalesce(
      (select jsonb_build_object('status', 'ok', 'revision', revision, 'document', document)
       from tzg_studio.draft_history where user_id = auth.uid() and revision = requested_revision),
      jsonb_build_object('status', 'missing')
    );
  end if;
  return coalesce(
    (select jsonb_build_object('status', 'ok', 'revision', revision, 'document', document)
     from tzg_studio.drafts where user_id = auth.uid()),
    jsonb_build_object('status', 'ok', 'revision', 0, 'document', '{}'::jsonb)
  );
end
$$;

create function public.tzg_studio_history(token text, before_revision bigint default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.tzg_studio_check(token) then
    return jsonb_build_object('status', 'locked');
  end if;
  return jsonb_build_object('status', 'ok', 'versions',
    coalesce((select jsonb_agg(to_jsonb(h) order by h.revision desc) from (
      select revision, action, restored_from, recorded_at
      from tzg_studio.draft_history
      where user_id = auth.uid() and (before_revision is null or revision < before_revision)
      order by revision desc limit 50
    ) h), '[]'::jsonb));
end
$$;

create function public.tzg_studio_write_draft(
  token text, password text, expected_revision bigint, edits jsonb default null,
  restore_revision bigint default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  next_revision bigint;
  next_document jsonb := edits;
  operation text := 'save';
begin
  if expected_revision is null or expected_revision < 0
    or (edits is null) = (restore_revision is null)
    or (edits is not null and (jsonb_typeof(edits) <> 'object' or octet_length(edits::text) > 262144))
  then
    return jsonb_build_object('status', 'invalid');
  end if;
  if not public.tzg_studio_check(token) then
    return jsonb_build_object('status', 'locked');
  end if;
  -- This also locks the developer row so writes by the same account serialize.
  if not tzg_studio.verify_password(password) then
    return jsonb_build_object('status', 'verification_failed');
  end if;
  select revision into next_revision from tzg_studio.drafts where user_id = caller;
  if coalesce(next_revision, 0) <> expected_revision then
    return jsonb_build_object('status', 'conflict', 'revision', next_revision);
  end if;
  if restore_revision is not null then
    select document into next_document from tzg_studio.draft_history
      where user_id = caller and revision = restore_revision;
    if not found then return jsonb_build_object('status', 'missing'); end if;
    operation := 'restore';
  end if;
  next_revision := expected_revision + 1;
  insert into tzg_studio.drafts (user_id, revision, document)
    values (caller, next_revision, next_document)
    on conflict (user_id) do update
      set revision = excluded.revision, document = excluded.document, updated_at = now();
  insert into tzg_studio.draft_history (user_id, revision, document, action, restored_from)
    values (caller, next_revision, next_document, operation, restore_revision);
  return jsonb_build_object('status', 'ok', 'revision', next_revision);
end
$$;

revoke all on function public.tzg_studio_read_draft(text, bigint),
  public.tzg_studio_history(text, bigint),
  public.tzg_studio_write_draft(text, text, bigint, jsonb, bigint) from public, anon, authenticated;
grant execute on function public.tzg_studio_read_draft(text, bigint),
  public.tzg_studio_history(text, bigint),
  public.tzg_studio_write_draft(text, text, bigint, jsonb, bigint) to authenticated;
