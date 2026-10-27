-- Phone Web Push. Run after 015, then deploy push-dispatch. Keys initialize server-side.
begin;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
create table if not exists tzg_private.push_server_keys(id boolean primary key default true check(id),public_key text not null,private_key text not null,dispatch_secret text not null,url text not null);
create table if not exists tzg_private.push_subscriptions(endpoint text primary key,user_id uuid not null references auth.users(id) on delete cascade,keys jsonb not null,global_enabled boolean not null default false,party_enabled boolean not null default true,friends_enabled boolean not null default true,updated_at timestamptz not null default now());
create index if not exists push_subscriptions_user on tzg_private.push_subscriptions(user_id);
create table if not exists tzg_private.push_outbox(id bigint generated always as identity primary key,user_id uuid not null references auth.users(id) on delete cascade,event_key text not null,payload jsonb not null,created_at timestamptz not null default now(),attempts int not null default 0,lease_until timestamptz,unique(user_id,event_key));
alter table tzg_private.push_server_keys enable row level security;
alter table tzg_private.push_subscriptions enable row level security;
alter table tzg_private.push_outbox enable row level security;
revoke all on tzg_private.push_server_keys,tzg_private.push_subscriptions,tzg_private.push_outbox from public,anon,authenticated;
create or replace function public.tzg_push_authorize() returns boolean language plpgsql security definer set search_path='' as $$begin perform tzg_private.require_player();return true;end;$$;
create or replace function public.tzg_push_subscribe(p_subscription jsonb,p_global boolean default false,p_party boolean default true,p_friends boolean default true) returns boolean language plpgsql security definer set search_path='' as $$declare caller uuid:=tzg_private.require_player();device_endpoint text:=p_subscription->>'endpoint';device_keys jsonb:=p_subscription->'keys';begin
 if device_endpoint is null or length(device_endpoint)>4096 or device_endpoint !~ '^https://' or jsonb_typeof(device_keys)<>'object' or coalesce(device_keys->>'p256dh','') !~ '^[A-Za-z0-9_-]{60,200}$' or coalesce(device_keys->>'auth','') !~ '^[A-Za-z0-9_-]{16,100}$' then raise invalid_parameter_value using message='Invalid push subscription.';end if;
 insert into tzg_private.push_subscriptions(endpoint,user_id,keys,global_enabled,party_enabled,friends_enabled) values(device_endpoint,caller,device_keys,coalesce(p_global,false),coalesce(p_party,true),coalesce(p_friends,true)) on conflict(endpoint) do update set user_id=caller,keys=excluded.keys,global_enabled=excluded.global_enabled,party_enabled=excluded.party_enabled,friends_enabled=excluded.friends_enabled,updated_at=now();return true;
end;$$;
create or replace function public.tzg_push_unsubscribe(p_endpoint text) returns boolean language plpgsql security definer set search_path='' as $$declare caller uuid:=auth.uid();begin if caller is null then raise insufficient_privilege;end if;delete from tzg_private.push_subscriptions where endpoint=p_endpoint and user_id=caller;return true;end;$$;
create or replace function public.tzg_push_server_config(p_create jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$begin
 if p_create is not null then insert into tzg_private.push_server_keys(id,public_key,private_key,dispatch_secret,url) values(true,p_create->>'public_key',p_create->>'private_key',p_create->>'dispatch_secret',p_create->>'url') on conflict(id) do nothing;end if;
 return (select jsonb_build_object('public_key',public_key,'private_key',private_key,'dispatch_secret',dispatch_secret) from tzg_private.push_server_keys where id);
end;$$;
create or replace function tzg_private.push_tick() returns void language plpgsql security definer set search_path='' as $$declare config tzg_private.push_server_keys;begin
 delete from tzg_private.push_outbox where created_at<now()-interval '10 minutes' or attempts>=5;
 select * into config from tzg_private.push_server_keys where id;if not found or not exists(select 1 from tzg_private.push_outbox where lease_until is null or lease_until<now()) then return;end if;
 perform net.http_post(url:=config.url,headers:=jsonb_build_object('Content-Type','application/json','x-push-secret',config.dispatch_secret),body:='{}'::jsonb,timeout_milliseconds:=20000);
 exception when others then
  -- A push transport outage must never stop chat messages or friend requests.
  return;
end;$$;
create or replace function tzg_private.enqueue_push(who uuid,p_event_key text,p_payload jsonb) returns void language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from tzg_private.push_subscriptions s where s.user_id=who and case p_payload->>'kind' when 'global' then s.global_enabled when 'party' then s.party_enabled when 'friends' then s.friends_enabled else false end) then return;end if;
 insert into tzg_private.push_outbox(user_id,event_key,payload) values(who,p_event_key,p_payload) on conflict(user_id,event_key) do nothing;
end;$$;
create or replace function tzg_private.queue_chat_push() returns trigger language plpgsql security definer set search_path='' as $$declare recipient uuid;display text;room_name text;begin
 if tg_table_name='chat_messages' then
  for recipient in select distinct user_id from tzg_private.push_subscriptions where global_enabled and user_id<>new.user_id and not tzg_private.social_blocked(user_id,new.user_id) loop
   perform tzg_private.enqueue_push(recipient,'global:'||new.id,jsonb_build_object('kind','global','title',new.display_name||' · Global Chat','body',left(new.body,160),'tag','global:'||new.id));
  end loop;
 else
  select display_name into display from tzg_private.player_profiles where user_id=new.sender;
  select name into room_name from tzg_private.social_rooms where id=new.room;
  for recipient in select player from tzg_private.social_members where room=new.room and player<>new.sender and not tzg_private.social_blocked(player,new.sender) loop
   perform tzg_private.enqueue_push(recipient,'party:'||new.id,jsonb_build_object('kind','party','title',coalesce(nullif(room_name,''),display,'Party Chat'),'body',left(new.body,160),'room',new.room,'tag','party:'||new.id));
  end loop;
 end if;
 perform tzg_private.push_tick();return new;
end;$$;
create or replace function tzg_private.queue_friend_push() returns trigger language plpgsql security definer set search_path='' as $$declare recipient uuid;display text;begin
 if new.status<>'pending' then return new;end if;
 if tg_op='UPDATE' and old.status=new.status and old.requester=new.requester then return new;end if;
 recipient:=case when new.a=new.requester then new.b else new.a end;
 if tzg_private.social_blocked(recipient,new.requester) then return new;end if;
 select display_name into display from tzg_private.player_profiles where user_id=new.requester;
 perform tzg_private.enqueue_push(recipient,'friend:'||new.a||':'||new.b||':'||new.created_at::text,jsonb_build_object('kind','friends','title','New friend request','body',coalesce(display,'An explorer')||' sent you a friend request','tag','friend:'||new.requester));perform tzg_private.push_tick();return new;
end;$$;
drop trigger if exists tzg_global_push on tzg_private.chat_messages;
create trigger tzg_global_push after insert on tzg_private.chat_messages for each row execute function tzg_private.queue_chat_push();
drop trigger if exists tzg_party_push on tzg_private.social_messages;
create trigger tzg_party_push after insert on tzg_private.social_messages for each row execute function tzg_private.queue_chat_push();
drop trigger if exists tzg_friend_push on tzg_private.friend_links;
create trigger tzg_friend_push after insert or update on tzg_private.friend_links for each row execute function tzg_private.queue_friend_push();
create or replace function public.tzg_push_claim() returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;begin
 with picked as(select id from tzg_private.push_outbox where attempts<5 and created_at>now()-interval '10 minutes' and (lease_until is null or lease_until<now()) order by id for update skip locked limit 30),claimed as(update tzg_private.push_outbox q set attempts=attempts+1,lease_until=now()+interval '2 minutes' from picked where q.id=picked.id returning q.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'payload',q.payload,'subscriptions',coalesce((select jsonb_agg(jsonb_build_object('endpoint',s.endpoint,'keys',s.keys)) from tzg_private.push_subscriptions s where s.user_id=q.user_id and case q.payload->>'kind' when 'global' then s.global_enabled when 'party' then s.party_enabled when 'friends' then s.friends_enabled else false end and not exists(select 1 from tzg_private.account_deletions where user_id=q.user_id) and not exists(select 1 from tzg_private.account_bans where user_id=q.user_id and (expires_at is null or expires_at>now())) and (q.payload->>'kind'<>'party' or exists(select 1 from tzg_private.social_members m where m.player=q.user_id and m.room=(q.payload->>'room')::uuid))),'[]'::jsonb))),'[]'::jsonb) into result from claimed q;return result;
end;$$;
create or replace function public.tzg_push_ack(p_id bigint,p_retry boolean default false) returns void language plpgsql security definer set search_path='' as $$begin if p_retry then update tzg_private.push_outbox set lease_until=now()+interval '1 minute' where id=p_id;else delete from tzg_private.push_outbox where id=p_id;end if;end;$$;
create or replace function public.tzg_push_drop(p_endpoint text) returns void language sql security definer set search_path='' as $$delete from tzg_private.push_subscriptions where endpoint=p_endpoint;$$;
revoke all on function public.tzg_push_authorize(),public.tzg_push_subscribe(jsonb,boolean,boolean,boolean),public.tzg_push_unsubscribe(text),public.tzg_push_server_config(jsonb),public.tzg_push_claim(),public.tzg_push_ack(bigint,boolean),public.tzg_push_drop(text) from public,anon,authenticated;
grant execute on function public.tzg_push_authorize(),public.tzg_push_subscribe(jsonb,boolean,boolean,boolean),public.tzg_push_unsubscribe(text) to authenticated;
grant execute on function public.tzg_push_server_config(jsonb),public.tzg_push_claim(),public.tzg_push_ack(bigint,boolean),public.tzg_push_drop(text) to service_role;
revoke all on function tzg_private.push_tick(),tzg_private.enqueue_push(uuid,text,jsonb),tzg_private.queue_chat_push(),tzg_private.queue_friend_push() from public,anon,authenticated;
do $$begin if not exists(select 1 from cron.job where jobname='tzg-push-retry') then perform cron.schedule('tzg-push-retry','* * * * *','select tzg_private.push_tick()');end if;end;$$;
commit;
