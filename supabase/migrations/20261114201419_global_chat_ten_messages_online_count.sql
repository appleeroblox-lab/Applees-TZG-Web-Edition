CREATE OR REPLACE FUNCTION tzg_private.cleanup_temporary_chat()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not pg_try_advisory_xact_lock(951027001) then return;end if;
 delete from tzg_private.chat_messages where id IN (SELECT id FROM tzg_private.chat_messages ORDER BY id DESC OFFSET 10);
 delete from tzg_private.social_messages where created_at<now()-interval '5 hours' or (deleted and updated_at<now()-interval '1 minute');
 delete from tzg_private.chat_reports where created_at<now()-interval '7 days';
 delete from tzg_private.message_change_limits where window_start<now()-interval '1 day';
 delete from tzg_private.chat_limits where window_start<now()-interval '1 day';
end;$function$
;
CREATE OR REPLACE FUNCTION public.tzg_chat_read(p_after bigint DEFAULT 0, p_ids bigint[] DEFAULT '{}'::bigint[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller uuid:=tzg_private.require_player();result jsonb;
begin perform tzg_private.cleanup_temporary_chat();
 if coalesce(array_length(p_ids,1),0)>100 then raise exception 'Too many message IDs.';end if; if p_after is null or p_after<0 then raise exception 'Invalid chat cursor.';end if;
 select coalesce(jsonb_agg(jsonb_build_object('verified',m.verified,'deleted',m.deleted,'updated_at',m.updated_at,'id',m.id::text,'display_name',m.display_name,'avatar',m.avatar,'body',m.body,'created_at',m.created_at,'own',m.user_id=caller,'image_available',m.has_image,'name_color',(array['#ffb8b8','#9bd2ff','#b9f6af','#e4c1ff','#ffd68e','#99eee7','#ffb5dc','#e7ee98'])[1+abs(hashtextextended(m.username,0)%8)::integer]) order by m.id),'[]'::jsonb) into result from (
 select c.id,c.user_id,c.deleted,c.updated_at,p.verified,coalesce(p.username,c.username) as username,coalesce(p.display_name,c.display_name) as display_name,p.avatar,c.body,c.created_at,exists(select 1 from tzg_private.chat_images i where i.message_id=c.id) as has_image from tzg_private.chat_messages c left join tzg_private.player_profiles p on p.user_id=c.user_id where not tzg_private.social_blocked(caller,c.user_id) order by c.id desc limit 10)m;
 return result;
end; $function$
;
CREATE OR REPLACE FUNCTION public.tzg_chat_send(p_body text, p_mutation uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller uuid:=tzg_private.require_player(); body text:=tzg_private.clean_text(p_body); profile tzg_private.player_profiles; existing bigint; limits tzg_private.chat_limits;
begin
 perform pg_advisory_xact_lock(951027001);
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
 return jsonb_build_object('id',existing::text);
end; $function$
;
CREATE OR REPLACE FUNCTION public.tzg_guest_chat(p_after bigint DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;begin
 if p_after is null or p_after<0 then raise invalid_parameter_value using message='Invalid cursor.';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id::text,'username',p.username,'display_name',coalesce(p.display_name,m.display_name),'avatar',p.avatar,'verified',coalesce(p.verified,false),'body',m.body,'created_at',m.created_at,'online',tzg_private.guest_online(p.user_id)) order by m.id),'[]'::jsonb) into result from (select * from tzg_private.chat_messages where not deleted and id>p_after order by id desc limit 10)m left join tzg_private.player_profiles p on p.user_id=m.user_id;
 return result;end;$function$
;
SELECT tzg_private.cleanup_temporary_chat();
CREATE OR REPLACE FUNCTION public.tzg_online_players() RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT count(DISTINCT CASE WHEN user_id IS NOT NULL THEN 'user:'||user_id::text ELSE 'guest:'||visitor::text END)
 FROM tzg_private.play_sessions WHERE ended_at IS NULL AND last_seen>now()-interval '90 seconds'
$$;
REVOKE ALL ON FUNCTION public.tzg_online_players() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tzg_online_players() TO anon,authenticated;
