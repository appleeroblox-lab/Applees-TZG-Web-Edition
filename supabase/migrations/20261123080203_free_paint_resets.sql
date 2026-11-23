begin;
create or replace function public.tzg_customization_save_paid(
 p_section text,p_paint jsonb,p_face text,p_order text[],p_cost integer,
 p_expected_revision bigint,p_mutation uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player(); wallet tzg_private.player_saves;
 old_paint jsonb; old_order text[]; request_kind text; prior tzg_private.customization_purchases;
 price integer; result jsonb;
begin
 if p_section is null or p_section not in ('character','ship') or jsonb_typeof(p_paint) is distinct from 'object'
  or octet_length(p_paint::text)>8192 or coalesce(cardinality(p_order),0)>13 or coalesce(octet_length(p_order::text),0)>1024 or coalesce(length(p_face),0)>20
  or p_cost is null or p_expected_revision is null or p_mutation is null then
  raise invalid_parameter_value using message='Invalid customization save.';
 end if;
 request_kind:='paint:'||jsonb_build_array(p_section,p_paint,p_face,p_order,p_cost)::text;
 perform pg_advisory_xact_lock(hashtextextended(caller::text,167));
 select * into prior from tzg_private.customization_purchases where user_id=caller and mutation=p_mutation;
 if found then
  if prior.kind<>request_kind then raise invalid_parameter_value using message='Retry the same pending save.'; end if;
  return prior.result;
 end if;
 select * into wallet from tzg_private.player_saves where user_id=caller for update;
 if not found or wallet.revision is distinct from p_expected_revision then
  raise exception using errcode='40001',message='CLOUD_CONFLICT: reload before saving customization.';
 end if;
 select case when p_section='ship' then ship else character->'paint' end,ship_order
 into old_paint,old_order from tzg_private.player_customization where user_id=caller;
 old_paint:=coalesce(old_paint,'{}'::jsonb);
 if p_section='character' then
  old_paint:=coalesce((select jsonb_object_agg(key,value) from jsonb_each(old_paint)
   where value<>'"#f7f4ff"'::jsonb),'{}'::jsonb);
  p_paint:=coalesce((select jsonb_object_agg(key,value) from jsonb_each(p_paint)
   where value<>'"#f7f4ff"'::jsonb or key not in ('leftLeg','leftHand','rightLeg','rightHand','head','torso')),'{}'::jsonb);
 end if;
 select coalesce(sum(case when p_section='character' then 20 when part='trails' then 200
  when part='exhaust' then 150 else 100 end),0)
 into price from (
  select jsonb_object_keys(old_paint) as part union select jsonb_object_keys(p_paint)
 ) parts where p_paint ? part and (old_paint->part) is distinct from (p_paint->part);
 if price<>p_cost then raise invalid_parameter_value using message='The paint total changed. Reopen customization and try again.'; end if;
 if wallet.fp<price then raise invalid_parameter_value using message='Not enough FP to save these colours.'; end if;
 result:=public.tzg_customization_save(p_section,p_paint,p_face,
  case when p_section='ship' and price=0 and old_order is not null then
   array(select part from unnest(old_order) with ordinality as keys(part,position) where p_paint ? part order by position)
   else p_order end);
 if price>0 then
  update tzg_private.player_saves set fp=fp-price,revision=revision+1,updated_at=now()
   where user_id=caller returning * into wallet;
 end if;
 result:=result||jsonb_build_object('cost',price,'revision',wallet.revision,
  'state',jsonb_build_object('fp',wallet.fp,'rc',wallet.rc,'inventory',wallet.inventory));
 insert into tzg_private.customization_purchases values(caller,p_mutation,request_kind,result);
 return result;
end;$$;
revoke all on function public.tzg_customization_save_paid(text,jsonb,text,text[],integer,bigint,uuid) from public,anon,authenticated;
grant execute on function public.tzg_customization_save_paid(text,jsonb,text,text[],integer,bigint,uuid) to authenticated;
create or replace function public.tzg_backend_version()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select jsonb_build_object('version', 'v0.0.11'); $$;
notify pgrst, 'reload schema';
commit;
