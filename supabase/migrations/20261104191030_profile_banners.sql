begin;
-- Profile cosmetics stay behind the same owner/session boundary as saved progress.
create table tzg_private.profile_banners (
 user_id uuid primary key references auth.users(id) on delete cascade,
 image text check (image is null or octet_length(image)<=180000),
 unlocked_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table tzg_private.banner_unlock_mutations (
 user_id uuid not null references auth.users(id) on delete cascade,
 mutation uuid not null,
 result jsonb not null,
 primary key(user_id,mutation)
);
alter table tzg_private.profile_banners enable row level security;
alter table tzg_private.banner_unlock_mutations enable row level security;
revoke all on tzg_private.profile_banners,tzg_private.banner_unlock_mutations from public,anon,authenticated;

create function public.tzg_player_banner_state() returns jsonb
language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();begin
 return jsonb_build_object('unlocked',exists(select 1 from tzg_private.profile_banners where user_id=caller),'banner',(select image from tzg_private.profile_banners where user_id=caller));
end;$$;

create function public.tzg_profile_banner(p_username text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('banner',b.image)
 from tzg_private.player_profiles p join tzg_private.profile_banners b using(user_id)
 where p.username=lower(btrim(p_username)) and length(p_username)<=64
 and not exists(select 1 from tzg_private.account_deletions d where d.user_id=p.user_id)
 and not exists(select 1 from tzg_private.self_account_state a where a.user_id=p.user_id and a.deactivated_at is not null)
$$;

create function public.tzg_player_banner_unlock(p_expected_revision bigint,p_mutation uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();saved tzg_private.player_saves;prior jsonb;result jsonb;charged boolean:=false;
begin
 if p_mutation is null or p_expected_revision is null then raise invalid_parameter_value using message='Reload your account before unlocking a banner.';end if;
 perform pg_advisory_xact_lock(hashtextextended(caller::text,167));
 select m.result into prior from tzg_private.banner_unlock_mutations m where user_id=caller and mutation=p_mutation;
 if found then return prior;end if;
 select * into saved from tzg_private.player_saves where user_id=caller for update;
 if not found or saved.revision is distinct from p_expected_revision then raise exception using errcode='40001',message='CLOUD_CONFLICT: reload before unlocking a banner.';end if;
 if not exists(select 1 from tzg_private.profile_banners where user_id=caller) then
  update tzg_private.player_saves set rc=rc-300,revision=revision+1,updated_at=now() where user_id=caller and rc>=300 returning * into saved;
  if not found then raise invalid_parameter_value using message='You need 300 RC to unlock your profile banner.';end if;
  insert into tzg_private.profile_banners(user_id) values(caller);charged:=true;
 end if;
 result:=jsonb_build_object('unlocked',true,'charged',charged,'revision',saved.revision,'state',jsonb_build_object('fp',saved.fp,'rc',saved.rc,'inventory',saved.inventory));
 insert into tzg_private.banner_unlock_mutations values(caller,p_mutation,result);
 return result;
end;$$;

create function public.tzg_player_banner(p_image text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();bytes bytea;pos integer:=2;marker integer;seg integer;valid_size boolean:=false;
begin
 if p_image is not null then
  if octet_length(p_image)>180000 or p_image !~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$' then raise invalid_parameter_value using message='Choose a JPEG banner under 180 KB.';end if;
  bytes:=decode(substr(p_image,24),'base64');
  if octet_length(bytes)<4 or encode(substring(bytes from 1 for 2),'hex')<>'ffd8' or encode(substring(bytes from octet_length(bytes)-1 for 2),'hex')<>'ffd9' then raise invalid_parameter_value using message='Invalid JPEG banner.';end if;
  -- Read JPEG segment lengths, not arbitrary uploaded metadata. Canvas output
  -- must have the exact wide cover size; scripts and unbounded images are rejected.
  while pos+8<octet_length(bytes) loop
   if get_byte(bytes,pos)<>255 then exit;end if;
   marker:=get_byte(bytes,pos+1);
   if marker=255 then pos:=pos+1;continue;end if;
   if marker=218 or marker=217 then exit;end if;
   seg:=get_byte(bytes,pos+2)*256+get_byte(bytes,pos+3);
   if seg<2 or pos+seg+2>octet_length(bytes) then exit;end if;
   if marker in (192,193,194) then
    valid_size:=(get_byte(bytes,pos+5)*256+get_byte(bytes,pos+6)=320 and get_byte(bytes,pos+7)*256+get_byte(bytes,pos+8)=960);exit;
   end if;
   pos:=pos+seg+2;
  end loop;
  if not valid_size then raise invalid_parameter_value using message='Crop your banner to 960 × 320 before saving.';end if;
 end if;
 update tzg_private.profile_banners set image=p_image,updated_at=now() where user_id=caller;
 if not found then raise insufficient_privilege using message='Unlock your profile banner for 300 RC first.';end if;
 return jsonb_build_object('banner',p_image);
end;$$;
revoke all on function public.tzg_player_banner_state(),public.tzg_profile_banner(text),public.tzg_player_banner_unlock(bigint,uuid),public.tzg_player_banner(text) from public,anon,authenticated;
grant execute on function public.tzg_player_banner_state(),public.tzg_player_banner_unlock(bigint,uuid),public.tzg_player_banner(text) to authenticated;
grant execute on function public.tzg_profile_banner(text) to anon,authenticated;
commit;
