begin;
-- Private tables, owner-only RPC reads, no browser writes to progress/rewards.
create table tzg_private.achievement_catalog(id text primary key, target bigint not null check(target>0),fp integer not null check(fp>=0),rc integer not null check(rc>=0),available boolean not null);
create table tzg_private.achievement_bodies(body text primary key,system text not null,kind text not null,air boolean not null);
create table tzg_private.achievement_progress(user_id uuid references auth.users(id) on delete cascade,id text references tzg_private.achievement_catalog(id),progress bigint not null default 0,completed_at timestamptz,claimed_at timestamptz,notified_at timestamptz,primary key(user_id,id));
create table tzg_private.achievement_mutations(user_id uuid references auth.users(id) on delete cascade,mutation uuid,result jsonb not null,primary key(user_id,mutation));
create table tzg_private.achievement_days(user_id uuid references auth.users(id) on delete cascade,day date,primary key(user_id,day));
alter table tzg_private.achievement_catalog enable row level security;
alter table tzg_private.achievement_bodies enable row level security;
alter table tzg_private.achievement_progress enable row level security;
alter table tzg_private.achievement_mutations enable row level security;
alter table tzg_private.achievement_days enable row level security;
revoke all on tzg_private.achievement_catalog,tzg_private.achievement_bodies,tzg_private.achievement_progress,tzg_private.achievement_mutations,tzg_private.achievement_days from public,anon,authenticated;
insert into tzg_private.achievement_catalog values
('001',1,106,0,false),
('002',100000,212,0,false),
('003',500000,261,4,false),
('004',10,523,9,false),
('005',250000,300,12,false),
('006',100,600,25,false),
('007',250,475,27,false),
('008',36000,950,55,false),
('009',540000,900,80,false),
('010',1800000,900,175,false),
('011',1,318,0,false),
('012',25,785,14,false),
('013',100,900,37,false),
('014',25,1200,50,false),
('015',500,1425,82,false),
('016',86400,1900,110,false),
('017',250,1800,160,false),
('018',2500,1200,150,false),
('019',13,1090,154,true),
('020',10000,1800,350,false),
('021',1,424,0,false),
('022',1,106,0,false),
('023',3,1047,19,false),
('024',5,300,12,false),
('025',1,600,25,false),
('026',10,475,27,false),
('027',10,950,55,false),
('028',1,2700,240,false),
('029',30,2400,300,false),
('030',96,2700,525,false),
('031',1,212,0,false),
('032',250,318,0,false),
('033',1000,261,4,false),
('034',5,900,37,false),
('035',50,1200,50,false),
('036',10000,1425,82,false),
('037',3,1900,110,false),
('038',50000,3600,320,false),
('039',1,2181,309,false),
('040',250000,3600,700,false),
('041',1,424,0,false),
('042',25,106,0,false),
('043',5,523,9,false),
('044',100,300,12,false),
('045',100,600,25,false),
('046',1000,475,27,false),
('047',3,950,55,false),
('048',5000,900,80,false),
('049',1,3272,463,false),
('050',25000,900,175,false),
('051',100,212,0,false),
('052',1,318,0,false),
('053',1,785,14,false),
('054',25,900,37,false),
('055',25000,1200,50,false),
('056',250,1425,82,false),
('057',500,1900,110,false),
('058',250000,1800,160,false),
('059',2000,3600,450,false),
('060',1000000,1800,350,false),
('061',5,424,0,true),
('062',10,1047,19,true),
('063',20,300,12,true),
('064',30,600,25,true),
('065',40,475,27,true),
('066',50,950,55,true),
('067',60,2700,240,true),
('068',75,4800,600,true),
('069',90,4363,618,true),
('070',100,2700,525,true),
('071',1,106,0,true),
('072',1,214,0,true),
('073',3,268,8,false),
('074',7,900,37,true),
('075',36000,1200,54,false),
('076',30,1425,82,true),
('077',15,1900,114,false),
('078',100,3600,320,true),
('079',365,1094,156,true),
('080',730,3600,700,true);
insert into tzg_private.achievement_bodies values
('Mercury','Sol','TERRESTRIAL PLANET',false),
('Venus','Sol','TERRESTRIAL PLANET',true),
('Earth','Sol','TERRESTRIAL PLANET',true),
('Moon','Sol','MOON',false),
('Mars','Sol','TERRESTRIAL PLANET',true),
('Ceres','Sol','DWARF PLANET',false),
('Pluto','Sol','DWARF PLANET',false),
('Eris','Sol','DWARF PLANET',false),
('Haumea','Sol','DWARF PLANET',false),
('Makemake','Sol','DWARF PLANET',false),
('Phobos','Sol','MOON',false),
('Deimos','Sol','MOON',false),
('Io','Sol','MOON',true),
('Europa','Sol','MOON',false),
('Ganymede','Sol','MOON',false),
('Callisto','Sol','MOON',false),
('Titan','Sol','MOON',true),
('Enceladus','Sol','MOON',false),
('Mimas','Sol','MOON',false),
('Rhea','Sol','MOON',false),
('Dione','Sol','MOON',false),
('Tethys','Sol','MOON',false),
('Iapetus','Sol','MOON',false),
('Miranda','Sol','MOON',false),
('Ariel','Sol','MOON',false),
('Umbriel','Sol','MOON',false),
('Titania','Sol','MOON',false),
('Oberon','Sol','MOON',false),
('Triton','Sol','MOON',false),
('Proteus','Sol','MOON',false),
('Nereid','Sol','MOON',false),
('Charon','Sol','MOON',false),
('Nix','Sol','MOON',false),
('Hydra','Sol','MOON',false),
('Dysnomia','Sol','MOON',false),
('Hiʻiaka','Sol','MOON',false),
('Namaka','Sol','MOON',false),
('Proxima b','Proxima','EXOPLANET',true),
('Andromeda · simulated world','Galaxy:Andromeda','SIMULATED PLANET',true),
('Triangulum · simulated world','Galaxy:Triangulum','SIMULATED PLANET',true),
('Large Magellanic Cloud · simulated world','Galaxy:Large Magellanic Cloud','SIMULATED PLANET',true),
('Small Magellanic Cloud · simulated world','Galaxy:Small Magellanic Cloud','SIMULATED PLANET',true),
('M87 · simulated world','Galaxy:M87','SIMULATED PLANET',true),
('M51 · simulated world','Galaxy:M51','SIMULATED PLANET',true),
('M104 · simulated world','Galaxy:M104','SIMULATED PLANET',true),
('TRAPPIST-1 b','TRAPPIST-1','EXOPLANET',false),
('TRAPPIST-1 c','TRAPPIST-1','EXOPLANET',false),
('TRAPPIST-1 d','TRAPPIST-1','EXOPLANET',false),
('TRAPPIST-1 e','TRAPPIST-1','EXOPLANET',true),
('TRAPPIST-1 f','TRAPPIST-1','EXOPLANET',true),
('TRAPPIST-1 g','TRAPPIST-1','EXOPLANET',true),
('TRAPPIST-1 h','TRAPPIST-1','EXOPLANET',false),
('RS 2041 b','Procedural','SIMULATED PLANET',true),
('RS 2041 c','Procedural','SIMULATED PLANET',true),
('RS 2041 c I','Procedural','MOON',true),
('RS 2041 d','Procedural','SIMULATED PLANET',true),
('RS 2042 b','Procedural','SIMULATED PLANET',true),
('RS 2042 c','Procedural','SIMULATED PLANET',true),
('RS 2042 c I','Procedural','MOON',true),
('RS 2042 d','Procedural','SIMULATED PLANET',true),
('RS 2043 b','Procedural','SIMULATED PLANET',true),
('RS 2043 c','Procedural','SIMULATED PLANET',true),
('RS 2043 c I','Procedural','MOON',true),
('RS 2043 d','Procedural','SIMULATED PLANET',true),
('RS 2044 b','Procedural','SIMULATED PLANET',true),
('RS 2044 c','Procedural','SIMULATED PLANET',true),
('RS 2044 c I','Procedural','MOON',true),
('RS 2044 d','Procedural','SIMULATED PLANET',true),
('RS 2045 b','Procedural','SIMULATED PLANET',true),
('RS 2045 c','Procedural','SIMULATED PLANET',true),
('RS 2045 c I','Procedural','MOON',true),
('RS 2045 d','Procedural','SIMULATED PLANET',true),
('RS 2046 b','Procedural','SIMULATED PLANET',true),
('RS 2046 c','Procedural','SIMULATED PLANET',true),
('RS 2046 c I','Procedural','MOON',true),
('RS 2046 d','Procedural','SIMULATED PLANET',true),
('Orcus','Sol','DWARF PLANET CANDIDATE',false),
('Quaoar','Sol','DWARF PLANET CANDIDATE',false),
('Sedna','Sol','DWARF PLANET CANDIDATE',false),
('Gonggong','Sol','DWARF PLANET CANDIDATE',false),
('Salacia','Sol','DWARF PLANET CANDIDATE',false),
('Varda','Sol','DWARF PLANET CANDIDATE',false),
('Actaea','Sol','MOON',false),
('Ilmarë','Sol','MOON',false),
('Vanth','Sol','MOON',false),
('Xiangliu','Sol','MOON',false),
('Proxima d','Proxima','EXOPLANET CANDIDATE',true),
('Vesta','Sol','ASTEROID',false),
('Pallas','Sol','ASTEROID',false),
('Hygiea','Sol','ASTEROID',false),
('Eros','Sol','ASTEROID',false),
('Ida','Sol','ASTEROID',false),
('Gaspra','Sol','ASTEROID',false),
('Itokawa','Sol','ASTEROID',false),
('Bennu','Sol','ASTEROID',false),
('Ryugu','Sol','ASTEROID',false);
do $$begin if (select count(*)<>80 or sum(fp)<>100000 or sum(rc)<>10000 from tzg_private.achievement_catalog) then raise exception 'Invalid achievement totals';end if;end$$;
-- All progress comes from server-owned records. No client-supplied increments.
create function tzg_private.achievement_sync(who uuid) returns void language plpgsql security definer set search_path='' as $$
declare lev bigint;days bigint;friends bigint;parties bigint;systems bigint;planets bigint;moons bigint;aliens bigint;worlds bigint;air bigint;survey bigint;record_row record;value bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended(who::text,174));
 select (tzg_private.account_progress(who)->>'level')::bigint into lev;
 -- One UTC day, observed by the server, after a nonzero logged-in play session.
 insert into tzg_private.achievement_days(user_id,day)
 select who,(last_seen at time zone 'UTC')::date from tzg_private.play_sessions
 where user_id=who and last_seen>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC' and duration_seconds>=30
 on conflict do nothing;
 select count(*) into days from tzg_private.achievement_days where user_id=who;
 select count(*) into friends from tzg_private.friend_links where (a=who or b=who) and status='accepted' and a<>b;
 select count(*) into parties from tzg_private.social_members m join tzg_private.social_rooms r on r.id=m.room where m.player=who and r.kind='group';
 select count(*) into systems from tzg_private.system_unlock_catalog c join tzg_private.system_unlocks u on u.system=c.system and u.user_id=who;
 select count(*) filter(where b.kind not like '%MOON%' and b.kind not like '%EXOPLANET%' and b.kind like '%PLANET%'),count(*) filter(where b.kind='MOON'),count(*) filter(where b.kind like '%EXOPLANET%'),count(*),count(*) filter(where b.air)
 into planets,moons,aliens,worlds,air from tzg_private.achievement_bodies b join tzg_private.exploration_events e on e.body=b.body and e.user_id=who and e.landed and e.verified_landing;
 select count(*) into survey from (select b.system from tzg_private.achievement_bodies b left join tzg_private.exploration_events e on e.body=b.body and e.user_id=who and e.landed and e.verified_landing group by b.system having count(*)=count(e.body)) z;
 for record_row in select * from tzg_private.achievement_catalog where available loop
 value:=case when record_row.id between '061' and '070' then lev
 when record_row.id in ('074','076','078','079','080') then days
 when record_row.id='071' then friends when record_row.id='072' then parties
 when record_row.id='019' then systems when record_row.id in ('021','023') then planets
 when record_row.id in ('022','024') then moons when record_row.id='025' then aliens
 when record_row.id='027' then air when record_row.id='028' then survey
 when record_row.id in ('026','029','030') then worlds else 0 end;
 insert into tzg_private.achievement_progress(user_id,id,progress,completed_at) values(who,record_row.id,least(record_row.target,value),case when value>=record_row.target then now() end)
 on conflict(user_id,id) do update set progress=greatest(tzg_private.achievement_progress.progress,excluded.progress),completed_at=coalesce(tzg_private.achievement_progress.completed_at,excluded.completed_at);
 end loop;
end$$;
revoke all on function tzg_private.achievement_sync(uuid) from public,anon,authenticated;
create function tzg_private.achievement_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=tzg_private.require_player();result jsonb;begin
 perform tzg_private.achievement_sync(who);
 select jsonb_agg(jsonb_build_object('id',c.id,'target',c.target,'available',c.available,'progress',coalesce(p.progress,0),'completed_at',p.completed_at,'claimed_at',p.claimed_at) order by c.id) into result
 from tzg_private.achievement_catalog c left join tzg_private.achievement_progress p on p.id=c.id and p.user_id=who;
 return result;end$$;
create function public.tzg_achievement_state() returns jsonb language sql security invoker set search_path='' as $$select tzg_private.achievement_state()$$;
create function tzg_private.achievement_notices() returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=tzg_private.require_player();result jsonb;begin
 with notices as(update tzg_private.achievement_progress set notified_at=now() where user_id=who and completed_at is not null and notified_at is null returning id)
 select coalesce(jsonb_agg(id order by id),'[]'::jsonb) into result from notices;
 return result;end$$;
create function public.tzg_achievement_notices() returns jsonb language sql security invoker set search_path='' as $$select tzg_private.achievement_notices()$$;
create function tzg_private.achievement_claim(p_expected_revision bigint,p_mutation uuid,p_kind text default 'achievements',p_body text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=tzg_private.require_player();s tzg_private.player_saves;receipt jsonb;gain_fp bigint;gain_rc bigint;ids jsonb;result jsonb;
begin
 if p_mutation is null or p_expected_revision is null or p_kind is distinct from 'achievements' or p_body is not null then raise invalid_parameter_value using message='Invalid achievement claim';end if;
 -- Same wallet lock/revision protocol as cloud saves; serializes concurrent claims.
 select * into s from tzg_private.player_saves where user_id=who for update;
 if not found then raise exception 'Load your account before claiming';end if;
 select m.result into receipt from tzg_private.achievement_mutations m where user_id=who and mutation=p_mutation;
 if found then return receipt;end if;
 if s.revision<>p_expected_revision then raise sqlstate '40001' using message='CLOUD_CONFLICT: reload before claiming achievements';end if;
 perform tzg_private.achievement_sync(who);
 with claimed as(update tzg_private.achievement_progress p set claimed_at=now() from tzg_private.achievement_catalog c where p.user_id=who and p.id=c.id and c.available and p.completed_at is not null and p.claimed_at is null returning c.id,c.fp,c.rc)
 select coalesce(sum(fp),0),coalesce(sum(rc),0),coalesce(jsonb_agg(id order by id),'[]'::jsonb) into gain_fp,gain_rc,ids from claimed;
 if jsonb_array_length(ids)>0 then
 update tzg_private.player_saves set fp=fp+gain_fp,rc=rc+gain_rc,revision=revision+1,last_mutation=p_mutation,updated_at=now() where user_id=who returning * into s;
 end if;
 result:=jsonb_build_object('revision',s.revision,'state',jsonb_build_object('fp',s.fp,'rc',s.rc,'inventory',s.inventory),'ids',ids,'fp',gain_fp,'rc',gain_rc);
 insert into tzg_private.achievement_mutations values(who,p_mutation,result);
 return result;
end$$;
create function public.tzg_achievement_claim(p_expected_revision bigint,p_mutation uuid,p_kind text default 'achievements',p_body text default null) returns jsonb language sql security invoker set search_path='' as $$select tzg_private.achievement_claim(p_expected_revision,p_mutation,p_kind,p_body)$$;
revoke all on function tzg_private.achievement_state(),tzg_private.achievement_notices(),tzg_private.achievement_claim(bigint,uuid,text,text),public.tzg_achievement_state(),public.tzg_achievement_notices(),public.tzg_achievement_claim(bigint,uuid,text,text) from public,anon,authenticated;
-- Private schema is not exposed via PostgREST; only these authenticated wrappers call it.
grant usage on schema tzg_private to authenticated;
grant execute on function tzg_private.achievement_state(),tzg_private.achievement_notices(),tzg_private.achievement_claim(bigint,uuid,text,text),public.tzg_achievement_state(),public.tzg_achievement_notices(),public.tzg_achievement_claim(bigint,uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
