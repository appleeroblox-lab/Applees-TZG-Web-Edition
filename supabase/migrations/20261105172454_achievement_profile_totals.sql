create or replace function public.tzg_profile_banner(p_username text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('banner',b.image,'achievements_unlocked',(select count(*) from tzg_private.achievement_progress ap where ap.user_id=p.user_id and ap.completed_at is not null))
 from tzg_private.player_profiles p left join tzg_private.profile_banners b using(user_id)
 where p.username=lower(btrim(p_username)) and length(p_username)<=64
 and not exists(select 1 from tzg_private.account_deletions d where d.user_id=p.user_id)
 and not exists(select 1 from tzg_private.self_account_state a where a.user_id=p.user_id and a.deactivated_at is not null)
$$;
