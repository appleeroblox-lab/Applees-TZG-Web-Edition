begin;
create table if not exists tzg_private.player_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default 'Explorer' check (char_length(btrim(display_name)) between 1 and 32),
 updated_at timestamptz not null default now()
);
create table if not exists tzg_private.player_saves (
 user_id uuid primary key references auth.users(id) on delete cascade,
 fp bigint not null default 0 check(fp between 0 and 1000000000000),
 rc bigint not null default 0 check(rc between 0 and 1000000000000),
 inventory jsonb not null default '[]'::jsonb,
 revision bigint not null default 0,
 last_mutation uuid,
 updated_at timestamptz not null default now()
);
alter table tzg_private.player_profiles enable row level security;
alter table tzg_private.player_saves enable row level security;
revoke all on all tables in schema tzg_private from public, anon, authenticated;

create or replace function tzg_private.require_player()
returns uuid language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid();
begin
 if caller is null or not exists(select 1 from auth.users where id=caller and email_confirmed_at is not null)
 or not exists(select 1 from auth.sessions where user_id=caller and id::text=auth.jwt()->>'session_id') then
  raise insufficient_privilege using message='Sign in with a confirmed account to play.';
 end if;
 return caller;
end; $$;
revoke all on function tzg_private.require_player() from public,anon,authenticated;

create or replace function public.tzg_player_load()
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player(); result jsonb; initial_name text;
begin
 select left(btrim(regexp_replace(coalesce(raw_user_meta_data->>'display_name','Explorer'),'[[:cntrl:]]','','g')),32) into initial_name from auth.users where id=caller;
 if initial_name='' then initial_name:='Explorer'; end if;
 insert into tzg_private.player_profiles(user_id,display_name) values(caller,initial_name) on conflict do nothing;
 insert into tzg_private.player_saves(user_id) values(caller) on conflict do nothing;
 select jsonb_build_object('user_id',caller,'display_name',p.display_name,'fp',s.fp,'rc',s.rc,'inventory',s.inventory,'revision',s.revision)
 into result from tzg_private.player_profiles p join tzg_private.player_saves s using(user_id) where p.user_id=caller;
 return result;
end; $$;

create or replace function public.tzg_player_display_name(p_display_name text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player(); name text:=btrim(p_display_name);
begin
 if name is null or char_length(name) not between 1 and 32 or name ~ '[[:cntrl:]]' then
  raise invalid_parameter_value using message='Use a display name with 1–32 visible characters.';
 end if;
 insert into tzg_private.player_profiles(user_id,display_name) values(caller,name)
 on conflict(user_id) do update set display_name=excluded.display_name,updated_at=now();
 return jsonb_build_object('display_name',name);
end; $$;

create or replace function public.tzg_player_save(p_account uuid,p_expected_revision bigint,p_mutation uuid,p_state jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player(); saved tzg_private.player_saves; row jsonb; n integer;
begin
 if p_account is distinct from caller then raise insufficient_privilege using message='Account changed. Reload before saving.'; end if;
 if p_mutation is null or p_expected_revision is null or p_expected_revision<0 or p_state is null or jsonb_typeof(p_state)<>'object' or octet_length(p_state::text)>262144 then
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
 insert into tzg_private.player_saves(user_id) values(caller) on conflict do nothing;
 select * into saved from tzg_private.player_saves where user_id=caller for update;
 if saved.last_mutation=p_mutation then return jsonb_build_object('revision',saved.revision); end if;
 if saved.revision<>p_expected_revision then raise sqlstate '40001' using message='CLOUD_CONFLICT: progress changed on another tab or device. Reload to load the latest save.'; end if;
 update tzg_private.player_saves set fp=(p_state->>'fp')::bigint,rc=(p_state->>'rc')::bigint,
 inventory=p_state->'inventory',revision=revision+1,last_mutation=p_mutation,updated_at=now()
 where user_id=caller returning * into saved;
 return jsonb_build_object('revision',saved.revision);
end; $$;

create or replace function public.tzg_debug_accounts(p_offset integer default 0,p_search text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; total bigint;
begin
 perform public.tzg_debug_authorize(null);
 if p_offset is null or p_offset<0 or p_offset>10000000 or p_search is null or char_length(p_search)>100 then
  raise invalid_parameter_value using message='Invalid account page.';
 end if;
 select count(*) into total from auth.users u left join tzg_private.player_profiles p on p.user_id=u.id
 where coalesce(u.email,'') ilike '%'||p_search||'%' or coalesce(p.display_name,u.raw_user_meta_data->>'display_name','Explorer') ilike '%'||p_search||'%' or u.id::text=p_search;
 select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) into result from (
  select u.id as user_id,u.email,coalesce(p.display_name,u.raw_user_meta_data->>'display_name','Explorer') as display_name,u.created_at,
  u.email_confirmed_at is not null as email_confirmed
  from auth.users u left join tzg_private.player_profiles p on p.user_id=u.id
  where coalesce(u.email,'') ilike '%'||p_search||'%' or coalesce(p.display_name,u.raw_user_meta_data->>'display_name','Explorer') ilike '%'||p_search||'%' or u.id::text=p_search
  order by u.created_at desc,u.id limit 50 offset p_offset
 ) a;
 return jsonb_build_object('accounts',result,'total',total);
end; $$;
revoke all on function public.tzg_player_load() from public,anon,authenticated;
revoke all on function public.tzg_player_display_name(text) from public,anon,authenticated;
revoke all on function public.tzg_player_save(uuid,bigint,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.tzg_debug_accounts(integer,text) from public,anon,authenticated;
grant execute on function public.tzg_player_load(),public.tzg_player_display_name(text),public.tzg_player_save(uuid,bigint,uuid,jsonb),public.tzg_debug_accounts(integer,text) to authenticated;
commit;
