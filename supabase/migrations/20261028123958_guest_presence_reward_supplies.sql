-- v0.0.108. Additive; retains all existing claims, balances and permissions.
begin;
alter table tzg_private.reward_claims add column if not exists items jsonb not null default '[]'::jsonb;
-- Public presence reveals only an online boolean; never a last-seen time, session or ID.
create or replace function tzg_private.guest_online(who uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from tzg_private.player_profiles p
 where p.user_id=who and p.last_seen_at>now()-interval '30 seconds'
 and not exists(select 1 from tzg_private.account_deletions d where d.user_id=who)
 and not exists(select 1 from tzg_private.self_account_state d where d.user_id=who and d.deactivated_at is not null)
 and exists(select 1 from tzg_private.active_game_sessions g join auth.sessions s on s.id=g.session_id
 where g.user_id=who and s.user_id=who and g.session_id=p.online_session))
$$;
revoke all on function tzg_private.guest_online(uuid) from public,anon,authenticated;
create or replace function public.tzg_reward_claim(p_kind text,p_body text,p_expected_revision bigint,p_mutation uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();s tzg_private.player_saves;o tzg_private.player_onboarding;receipt tzg_private.reward_claims;k text;gain_fp integer:=0;gain_rc integer:=0;d integer;item_type text;item_qty integer;gain_items jsonb:='[]'::jsonb;merged_inventory jsonb;stamp date:=(now() at time zone 'UTC')::date;
begin
 if p_mutation is null or p_expected_revision is null or p_expected_revision<0 then raise invalid_parameter_value using message='Invalid reward claim.';end if;
 insert into tzg_private.player_saves(user_id) values(caller) on conflict do nothing;
 select * into s from tzg_private.player_saves where user_id=caller for update;
 select * into receipt from tzg_private.reward_claims where user_id=caller and mutation=p_mutation;
 if found then
  if receipt.kind is distinct from p_kind or (p_kind in ('discovery','landing') and receipt.claim_key is distinct from p_body) then raise invalid_parameter_value using message='Reward retry changed.';end if;
  return jsonb_build_object('revision',s.revision,'state',jsonb_build_object('fp',s.fp,'rc',s.rc,'inventory',s.inventory),'awarded',true,'retry',true,'fp',receipt.fp,'rc',receipt.rc,'items',receipt.items);
 end if;
 if s.revision<>p_expected_revision then raise sqlstate '40001' using message='CLOUD_CONFLICT: reload the latest progress before claiming.';end if;
 insert into tzg_private.player_onboarding(user_id) values(caller) on conflict do nothing;
 select * into o from tzg_private.player_onboarding where user_id=caller for update;
 if p_kind='welcome' then
  k:='once';if not o.welcome_eligible then raise insufficient_privilege using message='Welcome rewards are for new accounts only.';end if;gain_fp:=250;gain_rc:=5;
 elsif p_kind='daily' then
  k:=stamp::text;d:=o.daily_day%7+1;gain_fp:=(array[100,150,200,250,300,400,500])[d];if d=7 then gain_rc:=10;end if;
  item_type:=(array['wood-planks','concrete-gray','log-block','concrete-white','glass','wood-planks','tnt'])[d];
  item_qty:=(array[16,16,16,24,16,32,64])[d];
  gain_items:=jsonb_build_array(jsonb_build_object('body','Earth','type',item_type,'qty',item_qty));
 elsif p_kind in ('discovery','landing') then
  k:=p_body;
  if not exists(select 1 from tzg_private.exploration_events where user_id=caller and body=p_body and session_id=(auth.jwt()->>'session_id')::uuid and ((p_kind='discovery' and verified_discovery) or (p_kind='landing' and landed and verified_landing))) then raise insufficient_privilege using message='Exploration bonuses need trusted gameplay verification.';end if;
  if p_kind='landing' and not exists(select 1 from tzg_private.reward_claims where user_id=caller and kind='discovery' and claim_key=p_body) then raise insufficient_privilege using message='Discover this world before claiming a landing.';end if;
  gain_fp:=case when p_kind='discovery' then 50 else 100 end;
 else raise invalid_parameter_value using message='Unknown reward.';end if;
 if exists(select 1 from tzg_private.reward_claims where user_id=caller and kind=p_kind and claim_key=k) then
  return jsonb_build_object('revision',s.revision,'state',jsonb_build_object('fp',s.fp,'rc',s.rc,'inventory',s.inventory),'awarded',false,'fp',0,'rc',0);
 end if;
 if s.fp+gain_fp>1000000000000 or s.rc+gain_rc>1000000000000 then raise invalid_parameter_value using message='Currency limit reached.';end if;
 -- Merge into existing stacks before recording the receipt. Validation errors roll back
 -- the entire transaction, leaving the day's reward available to claim later.
 select coalesce(jsonb_agg(jsonb_build_object('body',body,'type',type,'qty',qty) order by body,type),'[]'::jsonb) into merged_inventory from (
  select row->>'body' body,row->>'type' type,sum((row->>'qty')::integer) qty
  from jsonb_array_elements(s.inventory||gain_items) row group by row->>'body',row->>'type'
 ) stacks;
 perform tzg_private.validate_save(jsonb_build_object('fp',s.fp+gain_fp,'rc',s.rc+gain_rc,'inventory',merged_inventory));
 insert into tzg_private.reward_claims(user_id,kind,claim_key,mutation,fp,rc,items) values(caller,p_kind,k,p_mutation,gain_fp,gain_rc,gain_items);
 if p_kind='daily' then update tzg_private.player_onboarding set daily_day=d,daily_date=stamp,updated_at=now() where user_id=caller;end if;
 update tzg_private.player_saves set fp=fp+gain_fp,rc=rc+gain_rc,inventory=merged_inventory,revision=revision+1,last_mutation=p_mutation,updated_at=now() where user_id=caller returning * into s;
 return jsonb_build_object('revision',s.revision,'state',jsonb_build_object('fp',s.fp,'rc',s.rc,'inventory',s.inventory),'awarded',true,'fp',gain_fp,'rc',gain_rc,'items',gain_items);
end;$$;

create or replace function public.tzg_guest_profiles(p_query text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 if length(btrim(p_query))<2 or length(p_query)>64 then return '[]'::jsonb;end if;
 select coalesce(jsonb_agg(jsonb_build_object('username',p.username,'display_name',p.display_name,'avatar',p.avatar,'bio',p.bio,'verified',p.verified,'joined_at',(select u.created_at::date from auth.users u where u.id=p.user_id),'online',tzg_private.guest_online(p.user_id))),'[]'::jsonb) into result from (select p.* from tzg_private.player_profiles p where position(lower(btrim(p_query)) in p.username)>0 and not exists(select 1 from tzg_private.account_deletions d where d.user_id=p.user_id) and not exists(select 1 from tzg_private.self_account_state d where d.user_id=p.user_id and d.deactivated_at is not null) order by p.username limit 20)p;
 return result;end;$$;
create or replace function public.tzg_guest_chat(p_after bigint default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 if p_after is null or p_after<0 then raise invalid_parameter_value using message='Invalid cursor.';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id::text,'username',p.username,'display_name',coalesce(p.display_name,m.display_name),'avatar',p.avatar,'verified',coalesce(p.verified,false),'body',m.body,'created_at',m.created_at,'online',tzg_private.guest_online(p.user_id)) order by m.id),'[]'::jsonb) into result from (select * from tzg_private.chat_messages where not deleted and created_at>now()-interval '5 minutes' and id>p_after order by id desc limit 100)m left join tzg_private.player_profiles p on p.user_id=m.user_id;
 return result;end;$$;

revoke all on function public.tzg_reward_claim(text,text,bigint,uuid) from public,anon,authenticated;
grant execute on function public.tzg_reward_claim(text,text,bigint,uuid) to authenticated;
revoke all on function public.tzg_guest_profiles(text),public.tzg_guest_chat(bigint) from public,anon,authenticated;
grant execute on function public.tzg_guest_profiles(text),public.tzg_guest_chat(bigint) to anon,authenticated;
notify pgrst,'reload schema';
commit;
