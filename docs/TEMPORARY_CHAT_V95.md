# Temporary chat storage (v95)

Global chat remains a short-lived delivery queue in Postgres, rather than permanent history. It retains at most 100 messages for 5 minutes. Its images expire with their messages; at most 10 images are retained, and each image payload is capped at 160,000 characters (roughly 120 KB before base64). KLIPY GIF URLs remain supported without saving GIF bytes. The browser also drops global messages after 5 minutes.

Party/friend/group conversations support text and plain emojis only. Photo, GIF and voice message controls and media readers are removed from these conversations. The server rejects media from old clients too. Existing party attachments and media-only messages are erased by the migration; text accompanying an old image is preserved. Party text expires after 24 hours, with a maximum of 100 messages per room. Group profile photos and account avatars remain available.

Original edit/delete message archives are erased and disabled. Deleted messages retain only a brief notice for up to a minute so connected clients can display the deletion; the original content is not archived. Edit/delete throttling now uses one small counter per account instead of retaining message versions. Group deletion no longer archives the group's messages. The Message Logs page is hidden and its authenticated APIs return no history.

Reports remain separate: at most 100 short text-only reports are kept for 7 days, with 200-character evidence and no image evidence. Accounts, inventory, currency, friendships and group membership are preserved.

## Apply

Run the complete `supabase/migrations/202610270014_temporary_chat_storage.sql` in the project's Supabase SQL Editor:
https://supabase.com/dashboard/project/zwtcytzaozysxiqixihk/sql/new

The script explicitly removes old party media and message archives. It also enables pg_cron and schedules cleanup every minute, including when no players are online. Active reads/writes also trigger cleanup. Retention cutoffs are applied on cleanup, so a scheduled expiry can occur up to about one minute after the nominal cutoff. The job clears its own run logs older than one hour.

If the scheduler portion reports an error, report it; do not assume unattended cleanup is active. The core migration is rerunnable and the named cron job is updated rather than duplicated on rerun.

Deleting rows frees space for Postgres to reuse after normal vacuuming; the database's allocated disk size need not immediately shrink. This reduces retained chat data, not account storage or Supabase's own platform telemetry.

## Verification

`node tests/temporary-chat-v95.mjs` exercises the migration twice in PGlite, seeded old media/archive cleanup, server-side party media rejection, real edit/delete calls without archive writes, preserved rate limiting, global/party/media caps, TTL deletion and cascading image removal, small reports, cleanup permissions and account preservation. The schedule SQL uses a cron fixture because PGlite does not run pg_cron.

`node tests/friends-ui.mjs`, `node tests/social-ui.mjs` and `npm run test:gifs` cover text-only party UI, hidden GIF tab, no party media fetches, account/moderation UI and retained global GIF functionality. Live SQL execution and the cron scheduler must be confirmed by the project owner.
