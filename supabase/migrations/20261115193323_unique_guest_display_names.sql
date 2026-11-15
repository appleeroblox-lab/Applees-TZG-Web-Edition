CREATE OR REPLACE FUNCTION public.tzg_guest_identity(p_visitor uuid,p_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE name text:=tzg_private.clean_text(p_name);
BEGIN
 IF p_visitor IS NULL OR name IS NULL OR length(name)<2 OR length(name)>32 THEN
 RAISE EXCEPTION 'Use a display name with 2–32 characters.'; END IF;
 PERFORM pg_advisory_xact_lock(951027001);
 IF EXISTS(SELECT 1 FROM tzg_private.guest_identities WHERE lower(btrim(display_name))=lower(btrim(name)) AND visitor<>p_visitor) THEN
 RAISE EXCEPTION 'That guest display name is already taken. Choose another.'; END IF;
 INSERT INTO tzg_private.guest_identities(visitor,display_name) VALUES(p_visitor,name)
 ON CONFLICT(visitor) DO UPDATE SET display_name=excluded.display_name;
END; $$;
REVOKE ALL ON FUNCTION public.tzg_guest_identity(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tzg_guest_identity(uuid,text) TO anon,authenticated;
