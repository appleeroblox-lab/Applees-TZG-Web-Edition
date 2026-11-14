CREATE OR REPLACE FUNCTION public.tzg_debug_event(p_request uuid,p_scope text,p_kind text,p_key text,p_amount integer DEFAULT 0,p_local_user uuid DEFAULT NULL,p_local_visitor uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
  ELSIF p_local_visitor IS NOT NULL THEN
   INSERT INTO tzg_private.developer_event_recipients(event,recipient,visitor) VALUES(eid,'guest:'||p_local_visitor::text,p_local_visitor);
  ELSE RAISE EXCEPTION 'Sign in before giving local rewards.';END IF;
 ELSE
  INSERT INTO tzg_private.developer_event_recipients(event,recipient,user_id,visitor)
  SELECT DISTINCT eid,CASE WHEN user_id IS NOT NULL THEN 'user:'||user_id::text ELSE 'guest:'||visitor::text END,user_id,CASE WHEN user_id IS NULL THEN visitor ELSE NULL END
  FROM tzg_private.play_sessions WHERE ended_at IS NULL AND last_seen>now()-interval '90 seconds';
 END IF;
 GET DIAGNOSTICS recipients=ROW_COUNT;
 RETURN jsonb_build_object('event',eid,'recipients',recipients);
END;$$;
CREATE OR REPLACE FUNCTION public.tzg_event_poll(p_visitor uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'kind',e.kind,'key',e.key,'amount',e.amount) ORDER BY e.created_at,e.id),'[]'::jsonb)
 FROM tzg_private.developer_event_recipients r JOIN tzg_private.developer_events e ON e.id=r.event
 WHERE r.handled_at IS NULL AND e.expires_at>now() AND (r.user_id=auth.uid() OR (auth.uid() IS NULL AND r.visitor=p_visitor))
$$;
CREATE OR REPLACE FUNCTION public.tzg_event_warp_ack(p_event uuid,p_visitor uuid DEFAULT NULL) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE tzg_private.developer_event_recipients r SET handled_at=now() FROM tzg_private.developer_events e
 WHERE e.id=r.event AND e.id=p_event AND ((e.kind='warp' AND r.user_id=auth.uid()) OR (auth.uid() IS NULL AND r.visitor=p_visitor))
$$;
