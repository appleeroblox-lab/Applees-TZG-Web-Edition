begin;
-- The account guard can insert a session and takes a row lock.
alter function public.tzg_customization_state() volatile;
create or replace function public.tzg_backend_version()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select jsonb_build_object('version', 'v0.0.9'); $$;
notify pgrst, 'reload schema';
commit;
