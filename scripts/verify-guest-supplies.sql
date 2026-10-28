-- Disposable live verification: all fixture writes are rolled back. Run as postgres.
rollback;
begin;
select set_config('tzg.qa_user',gen_random_uuid()::text,true),set_config('tzg.qa_session',gen_random_uuid()::text,true),set_config('tzg.qa_mutation',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data,aud,role)
values(current_setting('tzg.qa_user')::uuid,'tzg-qa-'||current_setting('tzg.qa_user')||'@example.test',now(),jsonb_build_object('username','qa_'||translate(replace(current_setting('tzg.qa_user'),'-',''),'0123456789','abcdefghij'),'display_name','Disposable QA'),'{"provider":"email","providers":["email"]}','authenticated','authenticated');
insert into auth.sessions(id,user_id,created_at,updated_at) values(current_setting('tzg.qa_session')::uuid,current_setting('tzg.qa_user')::uuid,now(),now());
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('tzg.qa_user'),'session_id',current_setting('tzg.qa_session'),'role','authenticated')::text,true);
set local role authenticated;
select public.tzg_player_session_start();
select public.tzg_player_load()->>'fp' as initial_fp;
do $$declare result jsonb;begin
 result:=public.tzg_onboarding_state();if not (result->>'welcome_available')::boolean then raise exception 'Welcome eligibility failed';end if;
 result:=public.tzg_reward_claim('welcome',null,0,current_setting('tzg.qa_mutation')::uuid);
 if (result->'state'->>'fp')::integer<>250 or (result->'state'->>'rc')::integer<>5 or (result->>'revision')::integer<>1 then raise exception 'Welcome grant failed';end if;
 result:=public.tzg_reward_claim('welcome',null,0,current_setting('tzg.qa_mutation')::uuid);
 if (result->>'revision')::integer<>1 then raise exception 'Welcome retry duplicated';end if;
 result:=public.tzg_reward_claim('daily',null,1,gen_random_uuid());
 if result->'items'<>jsonb_build_array(jsonb_build_object('body','Earth','type','wood-planks','qty',16)) or result->'state'->'inventory'<>result->'items' then raise exception 'Supply grant failed';end if;
 if (result->'state'->>'fp')::integer<>350 or (result->>'revision')::integer<>2 then raise exception 'Daily grant failed';end if;
 result:=public.tzg_reward_claim('daily',null,2,gen_random_uuid());if (result->>'awarded')::boolean then raise exception 'Daily duplicate accepted';end if;
 result:=public.tzg_onboarding_state(true,false);if not (result->>'tutorial_done')::boolean or (result->>'tips_enabled')::boolean then raise exception 'Tutorial persistence failed';end if;
 perform public.tzg_exploration_event('Mars',false);
 begin perform public.tzg_reward_claim('discovery','Mars',2,gen_random_uuid());raise exception 'Unverified exploration bonus was accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
update tzg_private.player_onboarding set daily_day=6,daily_date=null where user_id=current_setting('tzg.qa_user')::uuid;
delete from tzg_private.reward_claims where user_id=current_setting('tzg.qa_user')::uuid and kind='daily';
set local role authenticated;
do $$declare result jsonb;again jsonb;mutation uuid:=gen_random_uuid();begin
 result:=public.tzg_reward_claim('daily',null,2,mutation);
 if result->'items'<>jsonb_build_array(jsonb_build_object('body','Earth','type','tnt','qty',64)) then raise exception 'Day 7 supply mismatch';end if;
 if (result->'state'->>'fp')::integer<>850 or (result->'state'->>'rc')::integer<>15 then raise exception 'Day 7 currency mismatch';end if;
 again:=public.tzg_reward_claim('daily',null,2,mutation);
 if again->'state'<>result->'state' or again->'items'<>result->'items' then raise exception 'Supply retry duplicated or lost receipt';end if;
end $$;
reset role;
update tzg_private.player_profiles set last_seen_at=now(),online_session=current_setting('tzg.qa_session')::uuid where user_id=current_setting('tzg.qa_user')::uuid;
do $$begin if not tzg_private.guest_online(current_setting('tzg.qa_user')::uuid) then raise exception 'Active online status missing';end if;end $$;
select set_config('request.jwt.claims','{}',true);
set local role anon;
select jsonb_typeof(public.tzg_guest_chat()) as guest_chat_type,jsonb_typeof(public.tzg_guest_profiles('qa_')) as guest_profile_type;
do $$begin
 begin perform public.tzg_reward_claim('daily',null,0,gen_random_uuid());raise exception 'Guest reward permission leak';exception when insufficient_privilege then null;end;
 begin perform public.tzg_onboarding_state();raise exception 'Guest account permission leak';exception when insufficient_privilege then null;end;
 begin perform public.tzg_debug_statistics();raise exception 'Guest statistics permission leak';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'PASS v108 supplies/Day7/retry/presence and live transaction: welcome/daily claims, duplicate prevention, tutorial persistence, anonymous reads and denials; all QA data rolled back' as verification;
