alter table tzg_private.player_profiles add column if not exists last_online_at timestamptz;
update tzg_private.player_profiles set last_online_at=last_seen_at where last_online_at is null and last_seen_at is not null;
create function tzg_private.remember_last_online() returns trigger language plpgsql set search_path='' as $$
begin
 if new.last_seen_at is not null then
  new.last_online_at=greatest(old.last_online_at,new.last_seen_at);
 elsif old.last_seen_at is not null then
  new.last_online_at=greatest(old.last_online_at,old.last_seen_at,now());
 else
  new.last_online_at=old.last_online_at;
 end if;
 return new;
end $$;
revoke all on function tzg_private.remember_last_online() from public,anon,authenticated;
create trigger remember_last_online before update of last_seen_at on tzg_private.player_profiles for each row execute function tzg_private.remember_last_online();
do $$
declare definition text;
begin
 definition:=pg_get_functiondef('public.tzg_profile_banner(text)'::regprocedure);
 if position('jsonb_build_object(''banner'',b.image' in definition)=0 then raise exception 'Profile API changed';end if;
 execute replace(definition,'jsonb_build_object(''banner'',b.image','jsonb_build_object(''last_online_at'',p.last_online_at,''banner'',b.image');
 definition:=pg_get_functiondef('public.tzg_debug_account(uuid)'::regprocedure);
 if position('''created_at'',u.created_at' in definition)=0 then raise exception 'Debug detail API changed';end if;
 execute replace(definition,'''created_at'',u.created_at','''last_online_at'',p.last_online_at,''created_at'',u.created_at');
 definition:=pg_get_functiondef('public.tzg_debug_accounts(integer,text)'::regprocedure);
 if position('as online,u.created_at' in definition)=0 then raise exception 'Debug list API changed';end if;
 execute replace(definition,'as online,u.created_at','as online,p.last_online_at,u.created_at');
end $$;
