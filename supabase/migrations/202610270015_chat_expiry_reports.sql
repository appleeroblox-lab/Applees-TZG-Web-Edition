-- v96: each message expires from its own send time; reports delete manually or after 7 days.
begin;
create or replace function tzg_private.cleanup_temporary_chat() returns void language plpgsql security definer set search_path='' as $$
begin
 if not pg_try_advisory_xact_lock(951027001) then return;end if;
 delete from tzg_private.chat_messages where created_at<now()-interval '5 minutes' or (deleted and updated_at<now()-interval '1 minute');
 delete from tzg_private.social_messages where created_at<now()-interval '5 hours' or (deleted and updated_at<now()-interval '1 minute');
 delete from tzg_private.chat_reports where created_at<now()-interval '7 days';
 delete from tzg_private.message_change_limits where window_start<now()-interval '1 day';
 delete from tzg_private.chat_limits where window_start<now()-interval '1 day';
end;$$;
create or replace function public.tzg_debug_report_delete(p_report bigint) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.tzg_debug_authorize(null);
 if p_report is null or p_report<1 then raise exception 'Invalid report ID.';end if;
 delete from tzg_private.chat_reports where id=p_report;
 return jsonb_build_object('ok',true);
end;$$;
revoke all on function public.tzg_debug_report_delete(bigint) from public,anon;
grant execute on function public.tzg_debug_report_delete(bigint) to authenticated;
revoke all on function tzg_private.cleanup_temporary_chat() from public,anon,authenticated;
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
 return jsonb_build_object('id',existing::text);
end; $$;
create or replace function public.tzg_social_send(p_room uuid,p_body text,p_image text,p_mutation uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();r tzg_private.social_rooms:=tzg_private.social_member(p_room,caller);msg bigint;body text;
begin
 if p_mutation is null then raise exception 'Missing message ID.';end if;
 perform pg_advisory_xact_lock(hashtextextended(caller::text,16));
 select id into msg from tzg_private.social_messages where sender=caller and mutation=p_mutation;if found then return jsonb_build_object('id',msg::text);end if;
 if exists(select 1 from tzg_private.social_messages where sender=caller and created_at>now()-interval '3 seconds') or (select count(*) from tzg_private.social_messages where sender=caller and created_at>now()-interval '1 minute')>=10 then raise exception 'Wait a moment before sending again.';end if;
 if p_image is not null and (not tzg_private.valid_chat_image(p_image)) then raise exception 'Invalid screenshot.';end if;
 body:=tzg_private.clean_text(case when btrim(coalesce(p_body,''))='' and p_image is not null then '[Screenshot]' else p_body end);
 insert into tzg_private.social_messages(room,sender,body,image,mutation) values(r.id,caller,body,p_image,p_mutation) returning id into msg;
 return jsonb_build_object('id',msg::text);
end;$$;
select tzg_private.cleanup_temporary_chat();
commit;
