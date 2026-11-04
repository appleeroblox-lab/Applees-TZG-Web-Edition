begin;
create table if not exists tzg_private.birthday_mutations (
 user_id uuid not null references auth.users(id) on delete cascade,
 mutation uuid not null,
 requested_date date not null,
 result jsonb not null,
 created_at timestamptz not null default now(),
 primary key (user_id,mutation)
);
alter table tzg_private.birthday_mutations enable row level security;
revoke all on tzg_private.birthday_mutations from public,anon,authenticated;

-- Owner-only account mutation, matching the existing cloud-save/session boundary.
-- Dates never enter public profiles or user-editable auth metadata.
create or replace function public.tzg_player_birthday(
 p_date date,p_expected_date date,p_expected_revision bigint,p_mutation uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();old_date date;prior tzg_private.birthday_mutations;saved tzg_private.player_saves;result jsonb;cost integer:=0;changed boolean;
begin
 if p_date is null or p_mutation is null or p_expected_revision is null then
  raise invalid_parameter_value using message='Choose a birthday and reload your account before continuing.';
 end if;
 if p_date>current_date or p_date<greatest(date '1900-01-01',(current_date-interval '125 years')::date) then
  raise invalid_parameter_value using message='Choose a valid birthday.';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(caller::text,167));
 select * into prior from tzg_private.birthday_mutations where user_id=caller and mutation=p_mutation;
 if found then
  if prior.requested_date is distinct from p_date then raise invalid_parameter_value using message='Retry the same pending birthday change.';end if;
  return prior.result;
 end if;
 select date_of_birth into old_date from tzg_private.account_private where user_id=caller for update;
 select * into saved from tzg_private.player_saves where user_id=caller for update;
 if not found or saved.revision is distinct from p_expected_revision or old_date is distinct from p_expected_date then
  raise exception using errcode='40001',message='CLOUD_CONFLICT: reload your account before changing your birthday.';
 end if;
 changed:=old_date is distinct from p_date;
 if changed then
  cost:=case when old_date is null then 0 else 500 end;
  update tzg_private.player_saves set rc=rc-cost,revision=revision+1,updated_at=now() where user_id=caller and rc>=cost returning * into saved;
  if not found then raise invalid_parameter_value using message='You need 500 RC to change your birthday.';end if;
  insert into tzg_private.account_private(user_id,date_of_birth) values(caller,p_date)
   on conflict(user_id) do update set date_of_birth=excluded.date_of_birth;
 end if;
 result:=jsonb_build_object('changed',changed,'date_of_birth',p_date,'age_years',extract(year from age(current_date,p_date))::integer,'cost',cost,'revision',saved.revision,'state',jsonb_build_object('fp',saved.fp,'rc',saved.rc,'inventory',saved.inventory));
 insert into tzg_private.birthday_mutations(user_id,mutation,requested_date,result) values(caller,p_mutation,p_date,result);
 return result;
end;$$;
revoke all on function public.tzg_player_birthday(date,date,bigint,uuid) from public,anon,authenticated;
grant execute on function public.tzg_player_birthday(date,date,bigint,uuid) to authenticated;
commit;

