-- Apply after migrations 001 and 002 in Supabase SQL Editor.
begin;
alter table tzg_private.player_profiles add column if not exists username text;
alter table tzg_private.player_profiles add column if not exists avatar text;
update tzg_private.player_profiles set username='p_'||replace(user_id::text,'-','') where username is null;
alter table tzg_private.player_profiles alter column username set not null;
create unique index if not exists player_username_unique on tzg_private.player_profiles(lower(username));
create table if not exists tzg_private.account_bans(user_id uuid primary key references auth.users(id) on delete cascade,reason text not null,expires_at timestamptz,created_at timestamptz not null default now(),actor uuid not null);
create table if not exists tzg_private.moderation_log(id bigint generated always as identity primary key,actor uuid not null,target uuid not null,action text not null,reason text not null,details jsonb not null default '{}',created_at timestamptz not null default now());
create table if not exists tzg_private.chat_messages(id bigint generated always as identity primary key,user_id uuid references auth.users(id) on delete set null,username text not null,display_name text not null,body text not null,created_at timestamptz not null default now(),mutation uuid not null,unique(user_id,mutation));
create table if not exists tzg_private.chat_limits(user_id uuid primary key references auth.users(id) on delete cascade,last_message timestamptz,window_start timestamptz not null default now(),message_count integer not null default 0);
create index if not exists chat_user_time on tzg_private.chat_messages(user_id,created_at desc);
create table if not exists tzg_private.chat_reports(id bigint generated always as identity primary key,message_id bigint not null,reporter_id uuid not null,reported_id uuid,reporter_name text not null,reported_name text not null,evidence text not null,category text not null,reason text not null,status text not null default 'open',created_at timestamptz not null default now(),reviewed_at timestamptz,reviewer uuid,unique(reporter_id,message_id));
create index if not exists reports_created on tzg_private.chat_reports(created_at desc);
create index if not exists reports_reporter on tzg_private.chat_reports(reporter_id,created_at desc);
alter table tzg_private.account_bans enable row level security;
alter table tzg_private.moderation_log enable row level security;
alter table tzg_private.chat_messages enable row level security;
alter table tzg_private.chat_limits enable row level security;
alter table tzg_private.chat_reports enable row level security;

-- Defense-in-depth rule filter; deliberately not advertised as Roblox's filter.
create or replace function tzg_private.clean_text(p_text text,p_max integer default 200)
returns text language plpgsql set search_path='' as $$
declare body text:=btrim(p_text); compact text;
begin
 if body is null or char_length(body) not between 1 and p_max or body ~ '[[:cntrl:]]' then raise invalid_parameter_value using message='Use a single-line message within the length limit.'; end if;
 compact:=regexp_replace(translate(lower(body),'013457@$','oieastas'),'[^a-z]','','g');
 if compact ~ '(fuck|shit|bitch|cunt|nigger|nigga|faggot|porn|sexvideo|killmyself|killyourself)' or body ~ '(မေလိုး|လီး|စောက်)' then raise invalid_parameter_value using message='Text blocked by the language filter. Please rephrase.'; end if;
 if body ~* '(https?[:/]|www[.]|discord[.]gg|[a-z0-9._%+-]+@[a-z0-9.-]+[.][a-z]{2,}|[.](com|net|org|gg)(/|[[:space:]]|$))' or body ~ '([0-9][ .()+-]*){7,}' then raise invalid_parameter_value using message='Do not share links, emails or phone numbers in chat or names.'; end if;
 return body;
end; $$;

create or replace function tzg_private.create_player_profile()
returns trigger language plpgsql security definer set search_path='' as $$
declare uname text:=lower(btrim(new.raw_user_meta_data->>'username')); dname text;
begin
 if uname is not null and uname<>'' and left(uname,2)='p_' then raise invalid_parameter_value using message='That username prefix is reserved.'; end if;
 if uname is null or uname='' then uname:='p_'||replace(new.id::text,'-',''); end if;
 if uname !~ '^[a-z0-9_]{3,36}$' then raise invalid_parameter_value using message='Username must contain 3–36 letters, numbers or underscores.'; end if;
 perform tzg_private.clean_text(uname,36);
 dname:=tzg_private.clean_text(coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'),''),'Explorer'),32);
 insert into tzg_private.player_profiles(user_id,display_name,username) values(new.id,dname,uname);
 return new;
 exception when unique_violation then raise unique_violation using message='Username already taken. Choose another username.';
end; $$;
drop trigger if exists tzg_create_profile on auth.users;
create trigger tzg_create_profile after insert on auth.users for each row execute function tzg_private.create_player_profile();
-- Users created before the account system receive a guaranteed-unique default.
insert into tzg_private.player_profiles(user_id,display_name,username)
select id,left(coalesce(nullif(btrim(raw_user_meta_data->>'display_name'),''),'Explorer'),32),'p_'||replace(id::text,'-','') from auth.users on conflict(user_id) do nothing;

create or replace function tzg_private.require_player()
returns uuid language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); banned tzg_private.account_bans;
begin
 if caller is null or not exists(select 1 from auth.users where id=caller and email_confirmed_at is not null)
 or not exists(select 1 from auth.sessions where user_id=caller and id::text=auth.jwt()->>'session_id') then raise insufficient_privilege using message='Sign in with a confirmed account to play.'; end if;
 select * into banned from tzg_private.account_bans where user_id=caller and (expires_at is null or expires_at>now());
 if found then raise exception using errcode='P0001',message='Account suspended: '||banned.reason,detail=jsonb_build_object('ban',true,'reason',banned.reason,'expires_at',banned.expires_at,'appeal','https://discord.gg/rPdRRHSkmw')::text; end if;
 return caller;
end; $$;

create or replace function public.tzg_username_available(p_username text)
returns boolean language plpgsql security definer set search_path='' as $$
declare uname text:=lower(btrim(p_username));
begin
 if uname is null or uname !~ '^[a-z0-9_]{3,36}$' or uname like 'p\_%' escape '\' then return false; end if;
 perform tzg_private.clean_text(uname,36);
 return not exists(select 1 from tzg_private.player_profiles where lower(username)=uname);
end; $$;
create or replace function public.tzg_player_load()
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player(); result jsonb; initial_name text;
begin
 select left(btrim(regexp_replace(coalesce(raw_user_meta_data->>'display_name','Explorer'),'[[:cntrl:]]','','g')),32) into initial_name from auth.users where id=caller;
 if initial_name='' then initial_name:='Explorer'; end if;
 insert into tzg_private.player_profiles(user_id,display_name,username) values(caller,initial_name,'p_'||replace(caller::text,'-','')) on conflict do nothing;
 insert into tzg_private.player_saves(user_id) values(caller) on conflict do nothing;
 select jsonb_build_object('user_id',caller,'display_name',p.display_name,'username',p.username,'avatar',p.avatar,'fp',s.fp,'rc',s.rc,'inventory',s.inventory,'revision',s.revision)
 into result from tzg_private.player_profiles p join tzg_private.player_saves s using(user_id) where p.user_id=caller;
 return result;
end; $$;


create or replace function public.tzg_player_display_name(p_display_name text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player(); name text:=tzg_private.clean_text(p_display_name,32);
begin
 update tzg_private.player_profiles set display_name=name,updated_at=now() where user_id=caller;
 return jsonb_build_object('display_name',name);
end; $$;

create or replace function public.tzg_player_avatar(p_image text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player(); bytes bytea;
begin
 if p_image is not null then
  if octet_length(p_image)>40000 or p_image !~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$' then raise invalid_parameter_value using message='Use a small JPEG profile image.'; end if;
  bytes:=decode(substr(p_image,24),'base64');
  if octet_length(bytes)<4 or encode(substring(bytes from 1 for 2),'hex')<>'ffd8' or encode(substring(bytes from octet_length(bytes)-1 for 2),'hex')<>'ffd9' then raise invalid_parameter_value using message='Invalid JPEG image.'; end if;
 end if;
 update tzg_private.player_profiles set avatar=p_image,updated_at=now() where user_id=caller;
 return jsonb_build_object('avatar',p_image);
end; $$;

create or replace function public.tzg_player_heartbeat()
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();
begin return (select jsonb_build_object('revision',s.revision,'display_name',p.display_name,'avatar',p.avatar,'username',p.username) from tzg_private.player_profiles p join tzg_private.player_saves s using(user_id) where p.user_id=caller); end; $$;

create or replace function tzg_private.validate_save(p_state jsonb)
returns void language plpgsql set search_path='' as $$
declare row jsonb; n integer;
begin
 if p_state is null or jsonb_typeof(p_state)<>'object' or octet_length(p_state::text)>262144 then
  raise invalid_parameter_value using message='Invalid cloud save.';
 end if;
 if exists(select 1 from jsonb_object_keys(p_state) k where k not in ('fp','rc','inventory'))
 or not(p_state ?& array['fp','rc','inventory']) then raise invalid_parameter_value using message='Only inventory and currencies can be cloud saved.'; end if;
 if jsonb_typeof(p_state->'fp')<>'number' or jsonb_typeof(p_state->'rc')<>'number'
 or (p_state->>'fp') !~ '^[0-9]{1,13}$' or (p_state->>'rc') !~ '^[0-9]{1,13}$'
 or (p_state->>'fp')::bigint>1000000000000 or (p_state->>'rc')::bigint>1000000000000
 or jsonb_typeof(p_state->'inventory')<>'array' then raise invalid_parameter_value using message='Invalid inventory or currencies.'; end if;
 if jsonb_array_length(p_state->'inventory')>2048 then raise invalid_parameter_value using message='Too many inventory stacks.'; end if;
 for row in select value from jsonb_array_elements(p_state->'inventory') loop
  if jsonb_typeof(row)<>'object' or not(row ?& array['type','body','qty'])
  or exists(select 1 from jsonb_object_keys(row) k where k not in ('type','body','qty'))
  or jsonb_typeof(row->'type')<>'string' or jsonb_typeof(row->'body')<>'string'
  or jsonb_typeof(row->'qty')<>'number' or (row->>'qty') !~ '^[1-9][0-9]{0,5}$'
  or (row->>'qty')::integer>100000 then raise invalid_parameter_value using message='Invalid item stack.'; end if;
  -- Exact catalogue values are filled below during source preparation.
  if not ((row->>'type')=any(ARRAY['quartz','iron','copper','bauxite','gold','mica','feldspar','graphite','ilmenite','anorthite','basalt','silica','helium','hematite','olivine','gypsum','perchlorate','sulfur','pyrite','corundum','titanium','obsidian','ice','methane','ammonia','salt','cobalt','nickel','platinum','diamond','ruby','emerald','sapphire','lithium','chromite','magnetite','opal','garnet','zircon','tungsten','lumenite','cryonite','starshard','voidglass','sunstone','aetherite','prismarine','novaore','snow-block','log-block','wood-planks','iron-saw','steel-saw','diamond-saw','concrete-white','concrete-gray','concrete-charcoal','concrete-black','concrete-red','concrete-orange','concrete-yellow','concrete-lime','concrete-green','concrete-cyan','concrete-blue','concrete-indigo','concrete-purple','concrete-pink','concrete-brown','concrete-sand','tnt','door','ladder','torch','glass','shovel','copper-pickaxe','steel-pickaxe','diamond-pickaxe','tree-log','snow-ball'])) or not ((row->>'body')=any(ARRAY['Mercury','Venus','Earth','Moon','Mars','Ceres','Pluto','Eris','Haumea','Makemake','Phobos','Deimos','Io','Europa','Ganymede','Callisto','Titan','Enceladus','Mimas','Rhea','Dione','Tethys','Iapetus','Miranda','Ariel','Umbriel','Titania','Oberon','Triton','Proteus','Nereid','Charon','Nix','Hydra','Dysnomia','Hiʻiaka','Namaka','Proxima b','Andromeda · simulated world','Triangulum · simulated world','Large Magellanic Cloud · simulated world','Small Magellanic Cloud · simulated world','M87 · simulated world','M51 · simulated world','M104 · simulated world','TRAPPIST-1 b','TRAPPIST-1 c','TRAPPIST-1 d','TRAPPIST-1 e','TRAPPIST-1 f','TRAPPIST-1 g','TRAPPIST-1 h','RS 2041 b','RS 2041 c','RS 2041 c I','RS 2041 d','RS 2042 b','RS 2042 c','RS 2042 c I','RS 2042 d','RS 2043 b','RS 2043 c','RS 2043 c I','RS 2043 d','RS 2044 b','RS 2044 c','RS 2044 c I','RS 2044 d','RS 2045 b','RS 2045 c','RS 2045 c I','RS 2045 d','RS 2046 b','RS 2046 c','RS 2046 c I','RS 2046 d','Orcus','Quaoar','Sedna','Gonggong','Salacia','Varda','Actaea','Ilmarë','Vanth','Xiangliu','Proxima d'])) then
   raise invalid_parameter_value using message='Unknown item or celestial body.';
  end if;
 end loop;
 select count(*) into n from (select distinct value->>'body',value->>'type' from jsonb_array_elements(p_state->'inventory')) d;
 if n<>jsonb_array_length(p_state->'inventory') then raise invalid_parameter_value using message='Duplicate inventory stacks.'; end if;

end; $$;

create or replace function public.tzg_debug_accounts(p_offset integer default 0,p_search text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; total bigint;
begin
 perform public.tzg_debug_authorize(null);
 if p_offset is null or p_offset<0 or p_offset>10000000 or p_search is null or char_length(p_search)>100 then raise invalid_parameter_value using message='Invalid account page.'; end if;
 select count(*) into total from auth.users u left join tzg_private.player_profiles p on p.user_id=u.id where coalesce(u.email,'') ilike '%'||p_search||'%' or p.display_name ilike '%'||p_search||'%' or p.username ilike '%'||p_search||'%' or u.id::text=p_search;
 select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) into result from (
 select u.id as user_id,u.email,p.display_name,p.username,p.avatar,u.created_at,u.email_confirmed_at is not null as email_confirmed,
 exists(select 1 from tzg_private.account_bans b where b.user_id=u.id and (b.expires_at is null or b.expires_at>now())) as banned
 from auth.users u left join tzg_private.player_profiles p on p.user_id=u.id where coalesce(u.email,'') ilike '%'||p_search||'%' or p.display_name ilike '%'||p_search||'%' or p.username ilike '%'||p_search||'%' or u.id::text=p_search order by u.created_at desc,u.id limit 50 offset p_offset) a;
 return jsonb_build_object('accounts',result,'total',total);
end; $$;

create or replace function public.tzg_debug_account(p_target uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.tzg_debug_authorize(null);
 select jsonb_build_object('user_id',u.id,'email',u.email,'display_name',p.display_name,'username',p.username,'avatar',p.avatar,'created_at',u.created_at,'email_confirmed',u.email_confirmed_at is not null,'fp',coalesce(s.fp,0),'rc',coalesce(s.rc,0),'inventory',coalesce(s.inventory,'[]'::jsonb),'revision',coalesce(s.revision,0),'ban',(select to_jsonb(b) from tzg_private.account_bans b where b.user_id=u.id and (b.expires_at is null or b.expires_at>now())),'history',coalesce((select jsonb_agg(to_jsonb(h)) from (select action,reason,created_at,actor from tzg_private.moderation_log where target=u.id order by id desc limit 20)h),'[]'::jsonb)) into result from auth.users u left join tzg_private.player_profiles p on p.user_id=u.id left join tzg_private.player_saves s on s.user_id=u.id where u.id=p_target;
 if result is null then raise invalid_parameter_value using message='Account no longer exists.'; end if;
 return result;
end; $$;

create or replace function public.tzg_debug_account_action(p_target uuid,p_action text,p_reason text,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); reason text:=btrim(p_reason); hours integer; current_revision bigint; target_name text;
begin
 perform public.tzg_debug_authorize('account '||coalesce(p_action,'')||' '||coalesce(p_target::text,''));
 if reason is null or char_length(reason) not between 3 and 300 then raise invalid_parameter_value using message='Provide a moderation reason with 3–300 characters.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_target::text,1));
 if not exists(select 1 from auth.users where id=p_target) then raise invalid_parameter_value using message='Account no longer exists.'; end if;
 if p_action in ('ban','delete') and exists(select 1 from tzg_private.debug_admins where user_id=p_target and enabled) then raise insufficient_privilege using message='Developer accounts cannot be banned or deleted here.'; end if;
 if p_action='ban' then
  hours:=(p_data->>'hours')::integer;
  if hours is null or hours not in (0,1,24,72,168,720) then raise invalid_parameter_value using message='Choose a valid ban duration.'; end if;
  insert into tzg_private.account_bans(user_id,reason,expires_at,actor) values(p_target,reason,case when hours=0 then null else now()+make_interval(hours=>hours) end,actor)
  on conflict(user_id) do update set reason=excluded.reason,expires_at=excluded.expires_at,actor=excluded.actor,created_at=now();
 elsif p_action='unban' then delete from tzg_private.account_bans where user_id=p_target;
 elsif p_action='remove_avatar' then update tzg_private.player_profiles set avatar=null,updated_at=now() where user_id=p_target;
 elsif p_action='edit' then
  perform tzg_private.validate_save(p_data->'state');
  if p_data->>'display_name' is null then raise invalid_parameter_value using message='Display name required.'; end if;
  perform tzg_private.clean_text(p_data->>'display_name',32);
  insert into tzg_private.player_saves(user_id) values(p_target) on conflict do nothing;
  select revision into current_revision from tzg_private.player_saves where user_id=p_target for update;
  if (p_data->>'revision')::bigint is distinct from current_revision then raise sqlstate '40001' using message='Account data changed. Open it again before editing.'; end if;
  update tzg_private.player_saves set fp=(p_data->'state'->>'fp')::bigint,rc=(p_data->'state'->>'rc')::bigint,inventory=p_data->'state'->'inventory',revision=revision+1,last_mutation=null,updated_at=now() where user_id=p_target;
  update tzg_private.player_profiles set display_name=btrim(p_data->>'display_name'),updated_at=now() where user_id=p_target;
 elsif p_action='delete' then
  select username into target_name from tzg_private.player_profiles where user_id=p_target;
  if p_data->>'confirm' is distinct from target_name then raise invalid_parameter_value using message='Type the exact username to confirm permanent deletion.'; end if;
 else raise invalid_parameter_value using message='Unknown account action.'; end if;
 insert into tzg_private.moderation_log(actor,target,action,reason,details) values(actor,p_target,p_action,reason,jsonb_build_object('hours',p_data->'hours'));
 if p_action='delete' then delete from auth.users where id=p_target; end if;
 return jsonb_build_object('ok',true);
end; $$;

create or replace function public.tzg_chat_send(p_body text,p_mutation uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player(); body text:=tzg_private.clean_text(p_body); profile tzg_private.player_profiles; existing bigint; limits tzg_private.chat_limits;
begin
 if p_mutation is null then raise invalid_parameter_value using message='Missing message ID.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(caller::text,2));
 select id into existing from tzg_private.chat_messages where user_id=caller and mutation=p_mutation;
 if found then return jsonb_build_object('id',existing::text); end if;
 insert into tzg_private.chat_limits(user_id) values(caller) on conflict do nothing;
 select * into limits from tzg_private.chat_limits where user_id=caller for update;
 if limits.last_message>now()-interval '3 seconds' or (limits.window_start>now()-interval '1 minute' and limits.message_count>=10) then raise exception 'Chat rate limit: wait a moment before sending again.'; end if;
 update tzg_private.chat_limits set last_message=now(),window_start=case when window_start<=now()-interval '1 minute' then now() else window_start end,message_count=case when window_start<=now()-interval '1 minute' then 1 else message_count+1 end where user_id=caller;
 select * into profile from tzg_private.player_profiles where user_id=caller;
 insert into tzg_private.chat_messages(user_id,username,display_name,body,mutation) values(caller,profile.username,profile.display_name,body,p_mutation) returning id into existing;
 delete from tzg_private.chat_messages where id in (select id from tzg_private.chat_messages order by id desc offset 1000);
 return jsonb_build_object('id',existing::text);
end; $$;

create or replace function public.tzg_chat_read(p_after bigint default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player(); result jsonb;
begin
 if p_after is null or p_after<0 then raise invalid_parameter_value using message='Invalid chat cursor.'; end if;
 select coalesce(jsonb_agg(to_jsonb(m) order by m.sort_id),'[]'::jsonb) into result from (
 select c.id as sort_id,c.id::text as id,c.user_id,coalesce(p.username,c.username) as username,coalesce(p.display_name,c.display_name) as display_name,p.avatar,c.body,c.created_at from tzg_private.chat_messages c left join tzg_private.player_profiles p on p.user_id=c.user_id where c.id>p_after order by c.id desc limit 50)m;
 return result;
end; $$;

create or replace function public.tzg_chat_report(p_message bigint,p_category text,p_reason text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player(); msg tzg_private.chat_messages; reporter text;
begin
 if p_category is null or p_category not in ('Bullying','Harassment','Spam','Personal information','Inappropriate content','Other') or p_reason is null or char_length(p_reason)>300 then raise invalid_parameter_value using message='Choose a report category and use at most 300 characters.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(caller::text,3));
 if exists(select 1 from tzg_private.chat_reports where reporter_id=caller and message_id=p_message) then return jsonb_build_object('ok',true); end if;
 if (select count(*) from tzg_private.chat_reports where reporter_id=caller and created_at>now()-interval '1 hour')>=5 then raise exception 'Report limit reached. Try again later.'; end if;
 select * into msg from tzg_private.chat_messages where id=p_message;
 if not found then raise invalid_parameter_value using message='Message is no longer available.'; end if;
 if msg.user_id=caller then raise invalid_parameter_value using message='You cannot report your own message.'; end if;
 select username into reporter from tzg_private.player_profiles where user_id=caller;
 insert into tzg_private.chat_reports(message_id,reporter_id,reported_id,reporter_name,reported_name,evidence,category,reason) values(p_message,caller,msg.user_id,reporter,msg.username,msg.body,p_category,btrim(p_reason));
 return jsonb_build_object('ok',true);
end; $$;

create or replace function public.tzg_debug_reports(p_offset integer default 0,p_status text default 'open')
returns jsonb language plpgsql security definer set search_path='' as $$
declare rows jsonb; total bigint;
begin
 perform public.tzg_debug_authorize(null);
 if p_offset is null or p_offset<0 or p_offset>10000000 or p_status is null or p_status not in ('open','reviewed','dismissed','all') then raise invalid_parameter_value using message='Invalid reports page.'; end if;
 select count(*) into total from tzg_private.chat_reports where p_status='all' or status=p_status;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into rows from (
 select r.id::text as id,r.message_id::text as message_id,r.reporter_id,r.reported_id,r.reporter_name,r.reported_name,r.evidence,r.category,r.reason,r.status,r.created_at,r.reviewed_at,p.avatar as reporter_avatar,q.avatar as reported_avatar from tzg_private.chat_reports r left join tzg_private.player_profiles p on p.user_id=r.reporter_id left join tzg_private.player_profiles q on q.user_id=r.reported_id where p_status='all' or r.status=p_status order by r.id desc limit 25 offset p_offset)r;
 return jsonb_build_object('reports',rows,'total',total);
end; $$;

create or replace function public.tzg_debug_report_review(p_report bigint,p_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.tzg_debug_authorize('review report');
 if p_status is null or p_status not in ('reviewed','dismissed','open') then raise invalid_parameter_value using message='Invalid review status.'; end if;
 update tzg_private.chat_reports set status=p_status,reviewed_at=now(),reviewer=auth.uid() where id=p_report;
 if not found then raise invalid_parameter_value using message='Report not found.'; end if;
 return jsonb_build_object('ok',true);
end; $$;

revoke all on all tables in schema tzg_private from public,anon,authenticated;
revoke all on all sequences in schema tzg_private from public,anon,authenticated;
revoke all on all functions in schema tzg_private from public,anon,authenticated;
revoke all on function public.tzg_username_available(text),public.tzg_player_avatar(text),public.tzg_player_heartbeat(),public.tzg_debug_account(uuid),public.tzg_debug_account_action(uuid,text,text,jsonb),public.tzg_chat_send(text,uuid),public.tzg_chat_read(bigint),public.tzg_chat_report(bigint,text,text),public.tzg_debug_reports(integer,text),public.tzg_debug_report_review(bigint,text) from public,anon,authenticated;
grant execute on function public.tzg_username_available(text) to anon,authenticated;
grant execute on function public.tzg_player_avatar(text),public.tzg_player_heartbeat(),public.tzg_debug_account(uuid),public.tzg_debug_account_action(uuid,text,text,jsonb),public.tzg_chat_send(text,uuid),public.tzg_chat_read(bigint),public.tzg_chat_report(bigint,text,text),public.tzg_debug_reports(integer,text),public.tzg_debug_report_review(bigint,text) to authenticated;
commit;
