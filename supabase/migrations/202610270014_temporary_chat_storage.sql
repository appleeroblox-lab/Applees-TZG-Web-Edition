-- v95: bounded temporary chat, text-only party messages, no message history.
-- Removes existing party attachments and original edit/delete message archives.
begin;
create table if not exists tzg_private.message_change_limits(user_id uuid primary key references auth.users(id) on delete cascade,window_start timestamptz not null default now(),count integer not null default 0);
alter table tzg_private.message_change_limits enable row level security;
revoke all on tzg_private.message_change_limits from public,anon,authenticated;
create index if not exists tzg_chat_expiry on tzg_private.chat_messages(created_at);
create index if not exists tzg_party_expiry on tzg_private.social_messages(created_at);
create index if not exists tzg_party_room_recent on tzg_private.social_messages(room,id desc);

-- Stop all archival writes, including callers using an older RPC implementation.
drop trigger if exists audit_group_delete on tzg_private.social_rooms;
truncate table tzg_private.message_audit;
create or replace rule tzg_no_message_archive as on insert to tzg_private.message_audit do instead nothing;

delete from tzg_private.social_messages where (image is not null or voice is not null) and body ~* '^\[(screenshot|image|photo|gif|voice message|audio)\]$';
update tzg_private.social_messages set image=null,voice=null where image is not null or voice is not null;
update tzg_private.chat_reports set evidence_image=null where evidence_image is not null;

create or replace function tzg_private.party_text_only() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.image is not null or new.voice is not null then raise exception 'Party chats support text only.';end if;
 return new;
end;$$;
drop trigger if exists tzg_party_text_only on tzg_private.social_messages;
create trigger tzg_party_text_only before insert or update on tzg_private.social_messages for each row execute function tzg_private.party_text_only();

create or replace function tzg_private.small_global_media() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if length(new.image)>160000 then raise exception 'Temporary global chat images must be smaller than 120 KB. KLIPY GIF links are supported.';end if;
 return new;
end;$$;
drop trigger if exists tzg_small_global_media on tzg_private.chat_images;
create trigger tzg_small_global_media before insert or update on tzg_private.chat_images for each row execute function tzg_private.small_global_media();
delete from tzg_private.chat_images where length(image)>160000;

create or replace function tzg_private.report_image_evidence() returns trigger language plpgsql security definer set search_path='' as $$
begin new.evidence_image:=null;return new;end;$$;
create or replace function tzg_private.small_report() returns trigger language plpgsql security definer set search_path='' as $$
begin new.evidence_image:=null;new.evidence:=left(new.evidence,200);return new;end;$$;
drop trigger if exists tzg_small_report on tzg_private.chat_reports;
create trigger tzg_small_report before insert or update on tzg_private.chat_reports for each row execute function tzg_private.small_report();

create or replace function tzg_private.cleanup_temporary_chat() returns void language plpgsql security definer set search_path='' as $$
begin
 if not pg_try_advisory_xact_lock(951027001) then return;end if;
 delete from tzg_private.chat_messages where created_at<now()-interval '5 minutes' or (deleted and updated_at<now()-interval '1 minute');
 delete from tzg_private.chat_messages where id in(select id from tzg_private.chat_messages order by id desc offset 100);
 delete from tzg_private.chat_images where message_id in(select message_id from tzg_private.chat_images order by message_id desc offset 10);
 delete from tzg_private.social_messages where created_at<now()-interval '24 hours' or (deleted and updated_at<now()-interval '1 minute');
 delete from tzg_private.social_messages where id in(select id from(select id,row_number() over(partition by room order by id desc) as n from tzg_private.social_messages)t where n>100);
 delete from tzg_private.chat_reports where created_at<now()-interval '7 days';
 delete from tzg_private.chat_reports where id in(select id from tzg_private.chat_reports order by id desc offset 100);
 delete from tzg_private.message_change_limits where window_start<now()-interval '1 day';
 delete from tzg_private.chat_limits where window_start<now()-interval '1 day';
end;$$;
revoke all on function tzg_private.cleanup_temporary_chat() from public,anon,authenticated;
create or replace function tzg_private.cleanup_chat_on_write() returns trigger language plpgsql security definer set search_path='' as $$
begin perform tzg_private.cleanup_temporary_chat();return null;end;$$;
drop trigger if exists tzg_chat_cleanup on tzg_private.chat_messages;
create trigger tzg_chat_cleanup after insert on tzg_private.chat_messages for each statement execute function tzg_private.cleanup_chat_on_write();
drop trigger if exists tzg_party_cleanup on tzg_private.social_messages;
create trigger tzg_party_cleanup after insert on tzg_private.social_messages for each statement execute function tzg_private.cleanup_chat_on_write();
drop trigger if exists tzg_media_cleanup on tzg_private.chat_images;
create trigger tzg_media_cleanup after insert on tzg_private.chat_images for each statement execute function tzg_private.cleanup_chat_on_write();
drop trigger if exists tzg_report_cleanup on tzg_private.chat_reports;
create trigger tzg_report_cleanup after insert on tzg_private.chat_reports for each statement execute function tzg_private.cleanup_chat_on_write();
create or replace function public.tzg_message_change(p_kind text,p_message bigint,p_action text,p_body text default '',p_image text default null,p_replace_image boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();sender uuid;rid uuid;old_body text;old_image text;old_voice text;was_deleted boolean;next_body text;
begin
 if p_kind='private' and p_image is not null then raise exception 'Party chats support text only.';end if;
 if p_kind='global' then select user_id,body,deleted into sender,old_body,was_deleted from tzg_private.chat_messages where id=p_message for update;select image into old_image from tzg_private.chat_images where message_id=p_message;
 elsif p_kind='private' then select room,social_messages.sender,body,image,voice,deleted into rid,sender,old_body,old_image,old_voice,was_deleted from tzg_private.social_messages where id=p_message for update;perform tzg_private.social_member(rid,caller);
 else raise exception 'Invalid chat.';end if;
 if sender is distinct from caller then raise insufficient_privilege using message='You can only change your own messages.';end if;
 if p_action not in ('edit','delete') then raise exception 'Invalid message action.';end if;
 if was_deleted then if p_action='delete' then return jsonb_build_object('ok',true);else raise exception 'This message was deleted.';end if;end if;
 if p_replace_image and p_image is not null and (not tzg_private.valid_chat_image(p_image)) then raise exception 'Choose a smaller screenshot.';end if;
 perform pg_advisory_xact_lock(hashtextextended(caller::text,17));insert into tzg_private.message_change_limits as limits(user_id,window_start,count) values(caller,now(),1) on conflict(user_id) do update set window_start=case when limits.window_start<now()-interval '1 hour' then now() else limits.window_start end,count=case when limits.window_start<now()-interval '1 hour' then 1 else limits.count+1 end;
 if (select count from tzg_private.message_change_limits where user_id=caller)>60 then raise exception 'Message change limit reached. Try again later.';end if;next_body:=case when p_action='delete' then 'deleted a message' else tzg_private.clean_text(case when btrim(coalesce(p_body,''))='' and (case when p_replace_image then p_image else old_image end) is not null then '[Screenshot]' when btrim(coalesce(p_body,''))='' and old_voice is not null then '[Voice message]' else p_body end) end;
 if p_action='edit' and next_body is not distinct from old_body and (not p_replace_image or p_image is not distinct from old_image) then return jsonb_build_object('ok',true);end if;
 if p_kind='global' then
  update tzg_private.chat_messages set body=next_body,deleted=p_action='delete',updated_at=clock_timestamp() where id=p_message;
  if p_action='delete' or p_replace_image then delete from tzg_private.chat_images where message_id=p_message;if p_action='edit' and p_image is not null then insert into tzg_private.chat_images values(p_message,p_image);end if;end if;
 else update tzg_private.social_messages set body=next_body,deleted=p_action='delete',image=case when p_action='delete' then null when p_replace_image then p_image else image end,voice=case when p_action='delete' then null else voice end,updated_at=clock_timestamp() where id=p_message;end if;
 return jsonb_build_object('ok',true);
end;$$;
create or replace function public.tzg_chat_read(p_after bigint default 0,p_ids bigint[] default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();result jsonb;
begin perform tzg_private.cleanup_temporary_chat();
 if coalesce(array_length(p_ids,1),0)>100 then raise exception 'Too many message IDs.';end if; if p_after is null or p_after<0 then raise exception 'Invalid chat cursor.';end if;
 select coalesce(jsonb_agg(jsonb_build_object('verified',m.verified,'deleted',m.deleted,'updated_at',m.updated_at,'id',m.id::text,'display_name',m.display_name,'avatar',m.avatar,'body',m.body,'created_at',m.created_at,'own',m.user_id=caller,'image_available',m.has_image,'name_color',(array['#ffb8b8','#9bd2ff','#b9f6af','#e4c1ff','#ffd68e','#99eee7','#ffb5dc','#e7ee98'])[1+abs(hashtextextended(m.username,0)%8)::integer]) order by m.id),'[]'::jsonb) into result from (
 select c.id,c.user_id,c.deleted,c.updated_at,p.verified,coalesce(p.username,c.username) as username,coalesce(p.display_name,c.display_name) as display_name,p.avatar,c.body,c.created_at,exists(select 1 from tzg_private.chat_images i where i.message_id=c.id) as has_image from tzg_private.chat_messages c left join tzg_private.player_profiles p on p.user_id=c.user_id where (c.id>p_after or c.id=any(p_ids)) and not tzg_private.social_blocked(caller,c.user_id) order by c.id asc limit 150)m;
 return result;
end; $$;
create or replace function public.tzg_social_messages(p_room uuid,p_after bigint default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=tzg_private.require_player();r tzg_private.social_rooms:=tzg_private.social_member(p_room,caller);result jsonb;
begin perform tzg_private.cleanup_temporary_chat();
 select coalesce(jsonb_agg(jsonb_build_object('id',id::text,'profile',tzg_private.social_profile(sender),'body',body,'image_available',image is not null,'own',sender=caller,'created_at',created_at,'deleted',deleted,'updated_at',updated_at,'voice_available',voice is not null) order by id),'[]') into result from (select * from tzg_private.social_messages where room=r.id and id>greatest(0,p_after) and not tzg_private.social_blocked(caller,sender) order by id desc limit 50)m;return result;
end;$$;

create or replace function public.tzg_social_voice_send(p_room uuid,p_voice text,p_mutation uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform tzg_private.require_player();raise exception 'Party chats support text only.';end;$$;
create or replace function public.tzg_debug_message_logs(p_offset integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform public.tzg_debug_authorize(null);return jsonb_build_object('total',0,'logs','[]'::jsonb);end;$$;
create or replace function public.tzg_debug_message_log(p_log bigint) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform public.tzg_debug_authorize(null);return null;end;$$;
-- Trigger helpers stay inaccessible to clients.
revoke all on function tzg_private.party_text_only(),tzg_private.small_global_media(),tzg_private.small_report(),tzg_private.cleanup_chat_on_write() from public,anon,authenticated;
select tzg_private.cleanup_temporary_chat();
commit;

-- SCHEDULER: scheduled cleanup also runs when nobody has the game open.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('tzg-temporary-chat-cleanup','* * * * *',$job$select tzg_private.cleanup_temporary_chat(); delete from cron.job_run_details where jobid in(select jobid from cron.job where jobname='tzg-temporary-chat-cleanup') and start_time<now()-interval '1 hour';$job$);
