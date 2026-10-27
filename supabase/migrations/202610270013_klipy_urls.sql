-- Allow original KLIPY delivery URLs in global and party chat. Keep existing image validation.
begin;
create or replace function tzg_private.valid_chat_image(value text) returns boolean language plpgsql immutable set search_path='' as $$
declare bytes bytea; w integer;h integer;
begin
 if value is null then return false;end if;
 if length(value)<=2048 and value ~ '^https://static[12]?\.klipy\.com/[A-Za-z0-9._~%/-]+\.gif([?][A-Za-z0-9._~%&=+;:@,/?!-]*)?$' then return true;end if;
 if length(value)<=160000 and value ~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$' then return true;end if;
 if length(value)>1400000 or value !~ '^data:image/gif;base64,[A-Za-z0-9+/=]+$' then return false;end if;
 bytes:=decode(split_part(value,',',2),'base64');if length(bytes)<13 or length(bytes)>1048576 or convert_from(substring(bytes from 1 for 6),'SQL_ASCII') not in ('GIF87a','GIF89a') then return false;end if;
 w:=get_byte(bytes,6)+256*get_byte(bytes,7);h:=get_byte(bytes,8)+256*get_byte(bytes,9);return w between 1 and 1024 and h between 1 and 1024;
 exception when others then return false;
end;$$;
revoke all on function tzg_private.valid_chat_image(text) from public,anon,authenticated;
commit;
