-- Accept inventory from the Proto Solar System in the shared cloud save validator.
begin;
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
  -- Preserve the origin of inventory mined in either era.
  if not ((row->>'type')=any(ARRAY['quartz','iron','copper','bauxite','gold','mica','feldspar','graphite','ilmenite','anorthite','basalt','silica','helium','hematite','olivine','gypsum','perchlorate','sulfur','pyrite','corundum','titanium','obsidian','ice','methane','ammonia','salt','cobalt','nickel','platinum','diamond','ruby','emerald','sapphire','lithium','chromite','magnetite','opal','garnet','zircon','tungsten','lumenite','cryonite','starshard','voidglass','sunstone','aetherite','prismarine','novaore','snow-block','log-block','wood-planks','iron-saw','steel-saw','diamond-saw','concrete-white','concrete-gray','concrete-charcoal','concrete-black','concrete-red','concrete-orange','concrete-yellow','concrete-lime','concrete-green','concrete-cyan','concrete-blue','concrete-indigo','concrete-purple','concrete-pink','concrete-brown','concrete-sand','tnt','door','ladder','torch','glass','shovel','copper-pickaxe','steel-pickaxe','diamond-pickaxe','tree-log','snow-ball'])) or not ((row->>'body')=any(ARRAY['Mercury','Venus','Earth','Moon','Mars','Ceres','Pluto','Eris','Haumea','Makemake','Phobos','Deimos','Io','Europa','Ganymede','Callisto','Titan','Enceladus','Mimas','Rhea','Dione','Tethys','Iapetus','Miranda','Ariel','Umbriel','Titania','Oberon','Triton','Proteus','Nereid','Charon','Nix','Hydra','Dysnomia','Hiʻiaka','Namaka','Proxima b','Andromeda · simulated world','Triangulum · simulated world','Large Magellanic Cloud · simulated world','Small Magellanic Cloud · simulated world','M87 · simulated world','M51 · simulated world','M104 · simulated world','TRAPPIST-1 b','TRAPPIST-1 c','TRAPPIST-1 d','TRAPPIST-1 e','TRAPPIST-1 f','TRAPPIST-1 g','TRAPPIST-1 h','RS 2041 b','RS 2041 c','RS 2041 c I','RS 2041 d','RS 2042 b','RS 2042 c','RS 2042 c I','RS 2042 d','RS 2043 b','RS 2043 c','RS 2043 c I','RS 2043 d','RS 2044 b','RS 2044 c','RS 2044 c I','RS 2044 d','RS 2045 b','RS 2045 c','RS 2045 c I','RS 2045 d','RS 2046 b','RS 2046 c','RS 2046 c I','RS 2046 d','Orcus','Quaoar','Sedna','Gonggong','Salacia','Varda','Actaea','Ilmarë','Vanth','Xiangliu','Proxima d','Zoozve','Vesta','Pallas','Hygiea','Eros','Ida','Gaspra','Itokawa','Bennu','Ryugu','Arrokoth','Varuna','Ixion','Oort Survey 01','Oort Survey 02','Oort Survey 03','Oort Survey 04','Oort Survey 05','Oort Survey 06','Oort Survey 07','Oort Survey 08',
   'Proto Mercury','Proto Venus','Proto Earth','Proto Theia','Proto Mars','Proto Pluto Asteroid','Proto Io Asteroid','Proto Europa Asteroid','Proto Ganymede Asteroid','Proto Callisto Asteroid','Proto Titan Asteroid','Proto Enceladus Asteroid','Proto Mimas Asteroid','Proto Rhea Asteroid','Proto Dione Asteroid','Proto Tethys Asteroid','Proto Iapetus Asteroid','Proto Miranda Asteroid','Proto Ariel Asteroid','Proto Umbriel Asteroid','Proto Titania Asteroid','Proto Oberon Asteroid','Proto Triton Asteroid','Proto Proteus Asteroid','Proto Nereid Asteroid','Proto Charon Asteroid'])) then
   raise invalid_parameter_value using message='Unknown item or celestial body.';
  end if;
 end loop;
 select count(*) into n from (select distinct value->>'body',value->>'type' from jsonb_array_elements(p_state->'inventory')) d;
 if n<>jsonb_array_length(p_state->'inventory') then raise invalid_parameter_value using message='Duplicate inventory stacks.'; end if;

end; $$;

create or replace function public.tzg_backend_version()
returns jsonb language sql stable security invoker set search_path=''
as $$ select jsonb_build_object('version','v0.0.12'); $$;

commit;
