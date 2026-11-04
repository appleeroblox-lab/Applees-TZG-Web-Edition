-- Run once in the existing Supabase project's SQL Editor, after the v167 SQL.
-- Safe to rerun. No existing balances, inventories or account data are reset.
begin;

create table if not exists tzg_private.system_unlock_catalog(
 system text primary key, position integer unique not null, fp integer not null, rc integer not null,
 check(fp between 1000 and 10000),check(rc between 250 and 2500)
);
insert into tzg_private.system_unlock_catalog(system,position,fp,rc) values
 ('Proxima',1,1000,250),('TRAPPIST-1',2,2000,500),('Beyond',3,3000,750),
 ('Nebulae',4,3000,750),('Procedural',5,4000,1000),('Galaxy:Andromeda',6,5000,1250),
 ('Galaxy:Triangulum',7,6000,1500),('Galaxy:Large Magellanic Cloud',8,7000,1750),
 ('Galaxy:Small Magellanic Cloud',9,7000,1750),('Galaxy:M51',10,8000,2000),
 ('Galaxy:M104',11,9000,2250),('Blackholes',12,10000,2500),('Galaxy:M87',13,10000,2500)
 on conflict(system) do update set position=excluded.position,fp=excluded.fp,rc=excluded.rc;
create table if not exists tzg_private.system_unlocks(
 user_id uuid not null references auth.users(id) on delete cascade,
 system text not null references tzg_private.system_unlock_catalog(system),
 unlocked_at timestamptz not null default now(),primary key(user_id,system)
);
create table if not exists tzg_private.system_unlock_mutations(
 user_id uuid not null references auth.users(id) on delete cascade,
 mutation uuid not null,system text not null,result jsonb not null,
 created_at timestamptz not null default now(),primary key(user_id,mutation)
);
alter table tzg_private.system_unlock_catalog enable row level security;
alter table tzg_private.system_unlocks enable row level security;
alter table tzg_private.system_unlock_mutations enable row level security;
revoke all on tzg_private.system_unlock_catalog,tzg_private.system_unlocks,tzg_private.system_unlock_mutations from public,anon,authenticated;

create or replace function public.tzg_system_unlock_state() returns jsonb
 language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();systems jsonb;
begin
 select coalesce(jsonb_agg(u.system order by c.position),'[]'::jsonb) into systems
 from tzg_private.system_unlocks u join tzg_private.system_unlock_catalog c using(system) where u.user_id=caller;
 return jsonb_build_object('systems',systems,'pricingVersion',168);
end;$$;
revoke all on function public.tzg_system_unlock_state() from public,anon,authenticated;
grant execute on function public.tzg_system_unlock_state() to authenticated;

create or replace function public.tzg_system_unlock(p_system text,p_expected_revision bigint,p_mutation uuid) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();item tzg_private.system_unlock_catalog;
 prior tzg_private.system_unlock_mutations;saved tzg_private.player_saves;result jsonb;systems jsonb;charged boolean:=false;
begin
 if p_system is null or p_mutation is null or p_expected_revision is null then raise invalid_parameter_value;end if;
 perform pg_advisory_xact_lock(hashtextextended(caller::text,160));
 select * into prior from tzg_private.system_unlock_mutations where user_id=caller and mutation=p_mutation;
 if found then
  if prior.system is distinct from p_system then raise invalid_parameter_value using message='Retry the same pending system unlock.';end if;
  return prior.result;
 end if;
 select * into item from tzg_private.system_unlock_catalog where system=p_system;
 if not found then raise invalid_parameter_value using message='Unknown or unavailable system.';end if;
 select * into saved from tzg_private.player_saves where user_id=caller for update;
 if not found or saved.revision is distinct from p_expected_revision then
  raise exception using errcode='40001',message='CLOUD_CONFLICT: reload your saved data before unlocking this system.';
 end if;
 if exists(select 1 from tzg_private.system_unlock_catalog c where c.position<item.position and not exists(select 1 from tzg_private.system_unlocks u where u.user_id=caller and u.system=c.system)) then
  raise invalid_parameter_value using message='Unlock the previous systems first.';
 end if;
 if not exists(select 1 from tzg_private.system_unlocks where user_id=caller and system=p_system) then
  update tzg_private.player_saves set fp=fp-item.fp,rc=rc-item.rc,revision=revision+1,updated_at=now()
   where user_id=caller and fp>=item.fp and rc>=item.rc returning * into saved;
  if not found then raise invalid_parameter_value using message='Not enough FP or RC to unlock this system.';end if;
  insert into tzg_private.system_unlocks(user_id,system) values(caller,p_system);charged:=true;
 end if;
 select coalesce(jsonb_agg(u.system order by c.position),'[]'::jsonb) into systems
  from tzg_private.system_unlocks u join tzg_private.system_unlock_catalog c using(system) where u.user_id=caller;
 result:=jsonb_build_object('systems',systems,'charged',charged,'revision',saved.revision,
  'state',jsonb_build_object('fp',saved.fp,'rc',saved.rc,'inventory',saved.inventory));
 insert into tzg_private.system_unlock_mutations(user_id,mutation,system,result) values(caller,p_mutation,p_system,result);
 return result;
end;$$;
revoke all on function public.tzg_system_unlock(text,bigint,uuid) from public,anon,authenticated;
grant execute on function public.tzg_system_unlock(text,bigint,uuid) to authenticated;

-- Update the existing paid account functions, preserving validation, cooldowns,
-- transaction locks, ownership checks and idempotent mutation handling.
do $update_costs$
declare source text;
begin
 source:=pg_get_functiondef('tzg_private.change_username_paid(text)'::regprocedure);
 if position('2500' in source)>0 then execute replace(source,'2500','1000');end if;
 source:=pg_get_functiondef('public.tzg_player_username(text)'::regprocedure);
 if position('2500' in source)>0 then execute replace(source,'2500','1000');end if;
 source:=pg_get_functiondef('public.tzg_player_birthday(date,date,bigint,uuid)'::regprocedure);
 if position('500' in source)>0 then execute replace(source,'500','300');end if;
end;$update_costs$;
commit;
