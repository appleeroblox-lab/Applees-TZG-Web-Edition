begin;
create table tzg_private.player_customization (
 user_id uuid primary key references auth.users(id) on delete cascade,
 unlocks text[] not null default '{}',
 character jsonb not null default '{"face":"Neutral","paint":{}}',
 ship jsonb not null default '{}',
 ship_order text[] not null default '{}'
);
create table tzg_private.customization_purchases (
 user_id uuid not null references auth.users(id) on delete cascade,
 mutation uuid not null,
 kind text not null,
 result jsonb not null,
 primary key(user_id,mutation)
);
alter table tzg_private.player_customization enable row level security;
alter table tzg_private.customization_purchases enable row level security;
revoke all on tzg_private.player_customization,tzg_private.customization_purchases from public,anon,authenticated;

create function public.tzg_customization_state() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player(); saved tzg_private.player_customization;
begin
 select * into saved from tzg_private.player_customization where user_id=caller;
 return jsonb_build_object('unlocks',coalesce(saved.unlocks,'{}'::text[]),
  'character',coalesce(saved.character,'{"face":"Neutral","paint":{}}'::jsonb),'ship',coalesce(saved.ship,'{}'::jsonb),'shipOrder',coalesce(saved.ship_order,'{}'::text[]));
end;$$;

create function public.tzg_customization_unlock(p_kind text,p_expected_revision bigint,p_mutation uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player(); prior tzg_private.customization_purchases;
 saved tzg_private.player_saves; owned text[]; fp_cost int:=0; rc_cost int:=0; result jsonb;
begin
 case p_kind
 when 'face:Happy','face:Surprised','face:Sleepy','face:Wink','face:Serious' then fp_cost:=250;
 when 'character:custom','ship:custom' then rc_cost:=200;
 when 'character:gradient','ship:gradient' then rc_cost:=500;
 else raise invalid_parameter_value using message='Unknown customization unlock.';
 end case;
 if p_mutation is null or p_expected_revision is null then raise invalid_parameter_value; end if;
 perform pg_advisory_xact_lock(hashtextextended(caller::text,167));
 select * into prior from tzg_private.customization_purchases where user_id=caller and mutation=p_mutation;
 if found then
  if prior.kind<>p_kind then raise invalid_parameter_value using message='Retry the same pending purchase.'; end if;
  return prior.result;
 end if;
 select * into saved from tzg_private.player_saves where user_id=caller for update;
 if not found or saved.revision is distinct from p_expected_revision then raise exception using errcode='40001',message='CLOUD_CONFLICT: reload before purchasing.'; end if;
 insert into tzg_private.player_customization(user_id) values(caller) on conflict do nothing;
 select unlocks into owned from tzg_private.player_customization where user_id=caller for update;
 if not (p_kind=any(owned)) then
  update tzg_private.player_saves set fp=fp-fp_cost,rc=rc-rc_cost,revision=revision+1,updated_at=now()
   where user_id=caller and fp>=fp_cost and rc>=rc_cost returning * into saved;
  if not found then raise invalid_parameter_value using message='Not enough currency for this unlock.'; end if;
  owned:=array_append(owned,p_kind);
  update tzg_private.player_customization set unlocks=owned where user_id=caller;
 end if;
 result:=jsonb_build_object('unlocks',owned,'revision',saved.revision,
  'state',jsonb_build_object('fp',saved.fp,'rc',saved.rc,'inventory',saved.inventory));
 insert into tzg_private.customization_purchases values(caller,p_mutation,p_kind,result);
 return result;
end;$$;

create function public.tzg_customization_save(p_section text,p_paint jsonb,p_face text default null,p_order text[] default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player(); owned text[]; entry record; stop jsonb; pos numeric; last_pos numeric;
 palette constant text[]:=array['#f7f4ff','#b8c4d4','#424b60','#171c2b','#ff6464','#ff984c','#ffd95b','#c5ed68','#50cb91','#46d9d1','#57b9ff','#6378ed','#a080ed','#e188e6','#f6abc6','#b78a65'];
 parts text[];
begin
 case p_section
 when 'character' then parts:=array['leftLeg','leftHand','rightLeg','rightHand','head','torso'];
 when 'ship' then parts:=array['redParts','whiteParts','blueParts','darkParts','body','wings','cockpit','cockpitWindow','tail','accents','lights','exhaust','trails'];
 else raise invalid_parameter_value using message='Unknown customization section.';
 end case;
 if jsonb_typeof(p_paint) is distinct from 'object' or octet_length(p_paint::text)>8192 then
  raise invalid_parameter_value using message='Invalid customization paint.';
 end if;
 insert into tzg_private.player_customization(user_id) values(caller) on conflict do nothing;
 select unlocks into owned from tzg_private.player_customization where user_id=caller for update;
 if p_section='character' then
  if p_face is null or (p_face<>'Neutral' and not ('face:'||p_face=any(owned))) then
   raise insufficient_privilege using message='Unlock this face first.';
  end if;
 end if;
 for entry in select * from jsonb_each(p_paint) loop
  if not (entry.key=any(parts)) then raise invalid_parameter_value using message='Unknown part.'; end if;
  if jsonb_typeof(entry.value)='string' then
   if (entry.value#>>'{}') !~* '^#[0-9a-f]{6}$' then raise invalid_parameter_value using message='Invalid colour.'; end if;
   if not (lower(entry.value#>>'{}')=any(palette)) and not (p_section||':custom'=any(owned)) then
    raise insufficient_privilege using message='Unlock Custom Colours first.';
   end if;
  elsif jsonb_typeof(entry.value)='array' then
   if not (p_section||':gradient'=any(owned)) then raise insufficient_privilege using message='Unlock Gradient Editor first.'; end if;
   if jsonb_array_length(entry.value) not between 2 and 4 then raise invalid_parameter_value using message='Invalid gradient.'; end if;
   last_pos:=null;
   for stop in select value from jsonb_array_elements(entry.value) loop
    if jsonb_typeof(stop->'position') is distinct from 'number' or
       coalesce(stop->>'color','') !~* '^#[0-9a-f]{6}$' then raise invalid_parameter_value using message='Invalid gradient stop.'; end if;
    pos:=(stop->>'position')::numeric;
    if pos>1 or (last_pos is null and pos<>0) or (last_pos is not null and pos<=last_pos) then
     raise invalid_parameter_value using message='Invalid gradient order.';
    end if;
    last_pos:=pos;
   end loop;
   if last_pos<>1 then raise invalid_parameter_value using message='Invalid gradient endpoint.'; end if;
  else
   raise invalid_parameter_value using message='Invalid paint value.';
  end if;
 end loop;
 if p_section='character' then
  update tzg_private.player_customization set character=jsonb_build_object('paint',p_paint,'face',p_face) where user_id=caller;
 else
  if p_order is not null and (
   cardinality(p_order)<>(select count(*) from jsonb_object_keys(p_paint)) or
   cardinality(p_order)<>(select count(distinct key) from unnest(p_order) keys(key)) or
   exists(select 1 from unnest(p_order) keys(key) where not (p_paint ? key))
  ) then raise invalid_parameter_value using message='Invalid ship paint order.'; end if;
  update tzg_private.player_customization set ship=p_paint,
   ship_order=coalesce(p_order,array(select jsonb_object_keys(p_paint))) where user_id=caller;
 end if;
 return public.tzg_customization_state();
end;$$;

revoke all on function public.tzg_customization_state(),public.tzg_customization_unlock(text,bigint,uuid),public.tzg_customization_save(text,jsonb,text,text[]) from public,anon,authenticated;
grant execute on function public.tzg_customization_state(),public.tzg_customization_unlock(text,bigint,uuid),public.tzg_customization_save(text,jsonb,text,text[]) to authenticated;

create or replace function public.tzg_backend_version()
returns jsonb language sql stable security invoker set search_path=''
as $$ select jsonb_build_object('version', 'v0.0.8'); $$;
revoke all on function public.tzg_backend_version() from public;
grant execute on function public.tzg_backend_version() to anon, authenticated;
commit;
