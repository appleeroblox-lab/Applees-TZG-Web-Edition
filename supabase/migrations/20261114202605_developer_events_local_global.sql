CREATE TABLE tzg_private.developer_event_catalog(kind text NOT NULL,key text NOT NULL,PRIMARY KEY(kind,key));
CREATE TABLE tzg_private.developer_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor uuid NOT NULL,request uuid NOT NULL,scope text NOT NULL CHECK(scope IN ('local','global')),kind text NOT NULL CHECK(kind IN ('currency','parts','warp')),key text NOT NULL,amount integer NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT now()+interval '5 minutes',UNIQUE(actor,request));
CREATE TABLE tzg_private.developer_event_recipients(event uuid NOT NULL REFERENCES tzg_private.developer_events ON DELETE CASCADE,recipient text NOT NULL,user_id uuid REFERENCES auth.users ON DELETE CASCADE,visitor uuid,handled_at timestamptz,mutation uuid,result jsonb,PRIMARY KEY(event,recipient));
ALTER TABLE tzg_private.developer_event_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE tzg_private.developer_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tzg_private.developer_event_recipients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tzg_private.developer_event_catalog,tzg_private.developer_events,tzg_private.developer_event_recipients FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.tzg_debug_event(p_request uuid,p_scope text,p_kind text,p_key text,p_amount integer DEFAULT 0,p_local_user uuid DEFAULT NULL,p_local_visitor uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE caller uuid:=auth.uid();eid uuid;recipients integer;
BEGIN
 PERFORM public.tzg_debug_authorize('event '||p_scope||' '||p_kind);
 IF p_request IS NULL OR p_scope NOT IN ('local','global') OR p_kind NOT IN ('currency','parts','warp') THEN RAISE EXCEPTION 'Invalid event.';END IF;
 IF NOT EXISTS(SELECT 1 FROM tzg_private.developer_event_catalog WHERE kind=p_kind AND key=p_key) THEN RAISE EXCEPTION 'Unknown event selection.';END IF;
 IF p_kind<>'warp' AND (p_amount IS NULL OR p_amount<1 OR p_amount>CASE WHEN p_kind='parts' THEN 100000 ELSE 1000000000 END) THEN RAISE EXCEPTION 'Invalid giveaway amount.';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(caller::text,218));
 SELECT id INTO eid FROM tzg_private.developer_events WHERE actor=caller AND request=p_request;
 IF FOUND THEN RETURN jsonb_build_object('event',eid,'recipients',(SELECT count(*) FROM tzg_private.developer_event_recipients WHERE event=eid));END IF;
 INSERT INTO tzg_private.developer_events(actor,request,scope,kind,key,amount) VALUES(caller,p_request,p_scope,p_kind,p_key,coalesce(p_amount,0)) RETURNING id INTO eid;
 IF p_scope='local' THEN
  IF p_local_user IS NOT NULL THEN
   INSERT INTO tzg_private.developer_event_recipients(event,recipient,user_id) VALUES(eid,'user:'||p_local_user::text,p_local_user);
  ELSIF p_kind='warp' AND p_local_visitor IS NOT NULL THEN
   INSERT INTO tzg_private.developer_event_recipients(event,recipient,visitor) VALUES(eid,'guest:'||p_local_visitor::text,p_local_visitor);
  ELSE RAISE EXCEPTION 'Sign in before giving local rewards.';END IF;
 ELSE
  INSERT INTO tzg_private.developer_event_recipients(event,recipient,user_id,visitor)
  SELECT DISTINCT eid,CASE WHEN user_id IS NOT NULL THEN 'user:'||user_id::text ELSE 'guest:'||visitor::text END,user_id,CASE WHEN user_id IS NULL THEN visitor ELSE NULL END
  FROM tzg_private.play_sessions WHERE ended_at IS NULL AND last_seen>now()-interval '90 seconds' AND (user_id IS NOT NULL OR p_kind='warp');
 END IF;
 GET DIAGNOSTICS recipients=ROW_COUNT;
 RETURN jsonb_build_object('event',eid,'recipients',recipients);
END;$$;
REVOKE ALL ON FUNCTION public.tzg_debug_event(uuid,text,text,text,integer,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tzg_debug_event(uuid,text,text,text,integer,uuid,uuid) TO authenticated;
CREATE FUNCTION public.tzg_event_poll(p_visitor uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'kind',e.kind,'key',e.key,'amount',e.amount) ORDER BY e.created_at,e.id),'[]'::jsonb)
 FROM tzg_private.developer_event_recipients r JOIN tzg_private.developer_events e ON e.id=r.event
 WHERE r.handled_at IS NULL AND e.expires_at>now() AND (r.user_id=auth.uid() OR (auth.uid() IS NULL AND r.visitor=p_visitor AND e.kind='warp'))
$$;
REVOKE ALL ON FUNCTION public.tzg_event_poll(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tzg_event_poll(uuid) TO anon,authenticated;
CREATE FUNCTION public.tzg_event_warp_ack(p_event uuid,p_visitor uuid DEFAULT NULL) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE tzg_private.developer_event_recipients r SET handled_at=now() FROM tzg_private.developer_events e
 WHERE e.id=r.event AND e.id=p_event AND e.kind='warp' AND (r.user_id=auth.uid() OR (auth.uid() IS NULL AND r.visitor=p_visitor))
$$;
REVOKE ALL ON FUNCTION public.tzg_event_warp_ack(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tzg_event_warp_ack(uuid,uuid) TO anon,authenticated;
CREATE FUNCTION public.tzg_event_claim(p_kind text,p_expected_revision bigint,p_mutation uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE caller uuid:=tzg_private.require_player();e tzg_private.developer_events;r tzg_private.developer_event_recipients;s tzg_private.player_saves;inv jsonb;qty integer;answer jsonb;
BEGIN
 IF p_mutation IS NULL OR p_expected_revision IS NULL OR p_expected_revision<0 THEN RAISE invalid_parameter_value USING message='Missing reward receipt or revision.';END IF;
 SELECT * INTO e FROM tzg_private.developer_events WHERE id=p_kind::uuid;
 IF NOT FOUND OR e.kind='warp' THEN RAISE invalid_parameter_value USING message='Reward not found.';END IF;
 SELECT * INTO r FROM tzg_private.developer_event_recipients WHERE event=e.id AND user_id=caller FOR UPDATE;
 IF NOT FOUND THEN RAISE insufficient_privilege USING message='This event is not addressed to your account.';END IF;
 IF r.handled_at IS NOT NULL THEN
  IF r.mutation=p_mutation THEN RETURN r.result;END IF;
  RAISE invalid_parameter_value USING message='Event already collected.';
 END IF;
 IF e.expires_at<=now() THEN RAISE invalid_parameter_value USING message='Event expired.';END IF;
 SELECT * INTO s FROM tzg_private.player_saves WHERE user_id=caller FOR UPDATE;
 IF s.revision<>p_expected_revision THEN RAISE SQLSTATE '40001' USING message='CLOUD_CONFLICT';END IF;
 inv:=s.inventory;
 IF e.kind='currency' THEN
  IF e.key='fp' THEN s.fp:=s.fp+e.amount;ELSE s.rc:=s.rc+e.amount;END IF;
  IF s.fp>1000000000000 OR s.rc>1000000000000 THEN RAISE EXCEPTION 'Currency limit exceeded.';END IF;
 ELSE
  SELECT coalesce(sum((v->>'qty')::integer),0) INTO qty FROM jsonb_array_elements(inv)v WHERE v->>'type'=e.key;
  IF qty+e.amount>100000 THEN RAISE EXCEPTION 'Item stack limit exceeded.';END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(inv)v WHERE v->>'type'=e.key AND v->>'body'='Earth') THEN
   SELECT jsonb_agg(CASE WHEN v->>'type'=e.key AND v->>'body'='Earth' THEN jsonb_set(v,'{qty}',to_jsonb((v->>'qty')::integer+e.amount)) ELSE v END) INTO inv FROM jsonb_array_elements(inv)v;
  ELSE inv:=inv||jsonb_build_array(jsonb_build_object('body','Earth','type',e.key,'qty',e.amount));END IF;
 END IF;
 UPDATE tzg_private.player_saves SET fp=s.fp,rc=s.rc,inventory=inv,revision=revision+1,updated_at=now() WHERE user_id=caller RETURNING * INTO s;
 answer:=jsonb_build_object('revision',s.revision,'state',jsonb_build_object('fp',s.fp,'rc',s.rc,'inventory',s.inventory));
 UPDATE tzg_private.developer_event_recipients SET handled_at=now(),mutation=p_mutation,result=answer WHERE event=e.id AND user_id=caller;
 RETURN answer;
END;$$;
REVOKE ALL ON FUNCTION public.tzg_event_claim(text,bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tzg_event_claim(text,bigint,uuid) TO authenticated;

INSERT INTO tzg_private.developer_event_catalog(kind,key) VALUES ('currency','fp'),('currency','rc'),('parts','snow-block'),('parts','log-block'),('parts','wood-planks'),('parts','concrete-white'),('parts','concrete-gray'),('parts','concrete-charcoal'),('parts','concrete-black'),('parts','concrete-red'),('parts','concrete-orange'),('parts','concrete-yellow'),('parts','concrete-lime'),('parts','concrete-green'),('parts','concrete-cyan'),('parts','concrete-blue'),('parts','concrete-indigo'),('parts','concrete-purple'),('parts','concrete-pink'),('parts','concrete-brown'),('parts','concrete-sand'),('parts','tnt'),('parts','door'),('parts','ladder'),('parts','torch'),('parts','glass'),('warp','Sun'),('warp','Mercury'),('warp','Venus'),('warp','Earth'),('warp','Moon'),('warp','Mars'),('warp','Jupiter'),('warp','Saturn'),('warp','Uranus'),('warp','Neptune'),('warp','Ceres'),('warp','Pluto'),('warp','Eris'),('warp','Haumea'),('warp','Makemake'),('warp','Phobos'),('warp','Deimos'),('warp','Io'),('warp','Europa'),('warp','Ganymede'),('warp','Callisto'),('warp','Titan'),('warp','Enceladus'),('warp','Mimas'),('warp','Rhea'),('warp','Dione'),('warp','Tethys'),('warp','Iapetus'),('warp','Miranda'),('warp','Ariel'),('warp','Umbriel'),('warp','Titania'),('warp','Oberon'),('warp','Triton'),('warp','Proteus'),('warp','Nereid'),('warp','Charon'),('warp','Nix'),('warp','Hydra'),('warp','Dysnomia'),('warp','Hiʻiaka'),('warp','Namaka'),('warp','Proxima Centauri'),('warp','Proxima b'),('warp','TRAPPIST-1'),('warp','Barnard’s Star'),('warp','Epsilon Eridani'),('warp','51 Pegasi'),('warp','Kepler-186'),('warp','Kepler-452'),('warp','HR 8799'),('warp','Alpha Centauri'),('warp','Sirius A'),('warp','Sirius B'),('warp','Vega'),('warp','Altair'),('warp','Deneb'),('warp','Betelgeuse'),('warp','Rigel'),('warp','Antares'),('warp','Arcturus'),('warp','Polaris'),('warp','Aldebaran'),('warp','Procyon'),('warp','Wolf 359'),('warp','Tau Ceti'),('warp','Ross 128'),('warp','Luyten’s Star'),('warp','Sagittarius A*'),('warp','M87*'),('warp','Cygnus X-1'),('warp','V404 Cygni'),('warp','TRAPPIST-1 b'),('warp','TRAPPIST-1 c'),('warp','TRAPPIST-1 d'),('warp','TRAPPIST-1 e'),('warp','TRAPPIST-1 f'),('warp','TRAPPIST-1 g'),('warp','TRAPPIST-1 h'),('warp','Orcus'),('warp','Quaoar'),('warp','Sedna'),('warp','Gonggong'),('warp','Salacia'),('warp','Varda'),('warp','Actaea'),('warp','Ilmarë'),('warp','Vanth'),('warp','Xiangliu'),('warp','Proxima c'),('warp','Proxima d'),('warp','Zoozve'),('warp','Vesta'),('warp','Pallas'),('warp','Hygiea'),('warp','Eros'),('warp','Ida'),('warp','Gaspra'),('warp','Itokawa'),('warp','Bennu'),('warp','Ryugu'),('warp','Arrokoth'),('warp','Varuna'),('warp','Ixion');

