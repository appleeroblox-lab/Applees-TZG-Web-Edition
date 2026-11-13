begin;
-- Generated UUID placeholders are internal identifiers, not player-entered names.
create or replace function tzg_private.create_player_profile()
returns trigger language plpgsql security definer set search_path='' as $$
declare uname text:=lower(btrim(new.raw_user_meta_data->>'username')); dname text;
begin
 if uname is not null and uname<>'' and left(uname,2)='p_' then raise invalid_parameter_value using message='That username prefix is reserved.'; end if;
 if uname is null or uname='' then uname:='p_'||replace(new.id::text,'-',''); end if;
 if uname !~ '^[a-z0-9_]{3,36}$' then raise invalid_parameter_value using message='Username must contain 3–36 letters, numbers or underscores.'; end if;
 if left(uname,2)<>'p_' then perform tzg_private.clean_text(uname,36);end if;
 dname:=tzg_private.clean_text(coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'),''),'Explorer'),32);
 insert into tzg_private.player_profiles(user_id,display_name,username) values(new.id,dname,uname);
 return new;
 exception when unique_violation then raise unique_violation using message='Username already taken. Choose another username.';
end; $$;

-- Private implementation: derive identity from the signed session, never client claims.
create or replace function tzg_private.google_profile(p_username text default null,p_display_name text default null,p_date date default null,p_avatar text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid();profile tzg_private.player_profiles;picture text;uname text:=lower(btrim(p_username));dname text;
begin
 if caller is null or not exists(select 1 from auth.users u join auth.identities i on i.user_id=u.id where u.id=caller and i.provider='google' and u.email_confirmed_at is not null)
 or not exists(select 1 from auth.sessions where user_id=caller and id::text=auth.jwt()->>'session_id') then raise insufficient_privilege using message='Sign in with Google again.';end if;
 perform pg_advisory_xact_lock(hashtextextended(caller::text,203));
 select * into profile from tzg_private.player_profiles where user_id=caller for update;
 if not found then raise invalid_parameter_value using message='Profile unavailable.';end if;
 -- Existing profiles are never renamed, charged or overwritten on repeat Google sign-in.
 if left(profile.username,2)<>'p_' then return jsonb_build_object('complete',true);end if;
 if p_username is null then return jsonb_build_object('complete',false);end if;
 if uname is null or uname !~ '^[a-z0-9_]{3,36}$' or left(uname,2)='p_' then raise invalid_parameter_value using message='Choose a valid username.';end if;
 perform tzg_private.clean_text(uname,36);dname:=tzg_private.clean_text(p_display_name,32);
 if p_date is null or p_date>current_date or p_date<greatest(date '1900-01-01',(current_date-interval '125 years')::date) then raise invalid_parameter_value using message='Choose a valid birthday.';end if;
 if p_avatar is not null and (length(p_avatar)>40000 or p_avatar !~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$') then raise invalid_parameter_value using message='Choose a smaller profile image.';end if;
 -- Provider photo is presentation data only. Trust the Google identity row for provider membership.
 select coalesce(identity_data->>'avatar_url',identity_data->>'picture') into picture from auth.identities where user_id=caller and provider='google' limit 1;
 if picture !~ '^https://([a-z0-9-]+[.])*googleusercontent[.]com/' then picture:=null;end if;
 update tzg_private.player_profiles set username=uname,display_name=dname,avatar=coalesce(p_avatar,picture,avatar),updated_at=now() where user_id=caller;
 insert into tzg_private.account_private(user_id,date_of_birth) values(caller,p_date) on conflict(user_id) do nothing;
 return jsonb_build_object('complete',true);
 exception when unique_violation then raise unique_violation using message='Username already taken. Choose another username.';
end;$$;
revoke all on function tzg_private.google_profile(text,text,date,text) from public,anon;
grant usage on schema tzg_private to authenticated;
grant execute on function tzg_private.google_profile(text,text,date,text) to authenticated;
create or replace function public.tzg_google_profile_status() returns jsonb language sql security invoker set search_path='' as $$select tzg_private.google_profile()$$;
create or replace function public.tzg_google_profile_complete(p_username text,p_display_name text,p_date date,p_avatar text default null) returns jsonb language sql security invoker set search_path='' as $$select tzg_private.google_profile(p_username,p_display_name,p_date,p_avatar)$$;
revoke all on function public.tzg_google_profile_status(),public.tzg_google_profile_complete(text,text,date,text) from public,anon;
grant execute on function public.tzg_google_profile_status(),public.tzg_google_profile_complete(text,text,date,text) to authenticated;
commit;
