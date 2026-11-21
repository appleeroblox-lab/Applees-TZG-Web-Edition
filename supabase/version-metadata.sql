-- Independent backend release metadata. Does not read or change player data.
create or replace function public.tzg_backend_version()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select jsonb_build_object('version', 'v0.0.6'); $$;
revoke all on function public.tzg_backend_version() from public;
grant execute on function public.tzg_backend_version() to anon, authenticated;
