# Mobile notifications — v0.0.103

The page can show native notifications while open. Delivery after all game tabs are closed needs a deployed push server, an active browser subscription and notification permission. This repository includes that implementation; it is **not yet activated on the live Supabase project**. GitHub Pages alone cannot send a message after its page closes.

## Activate on the existing game project

1. Apply migrations through 015 as usual, then run `supabase/migrations/202610270016_mobile_push.sql` and `202610270017_exploration_worlds.sql` in the existing game Supabase project. The project must support `pg_net` and `pg_cron`.
2. Deploy `supabase/functions/push-dispatch/index.ts` as **push-dispatch**, with JWT verification disabled as specified in `supabase/config.toml`. The handler validates player authorization for configuration and a private dispatch secret for delivery. Standard Supabase URL, anon key and service-role environment variables are injected by Supabase; never paste the service-role key into the game.
3. Sign in on the published HTTPS game. In Settings → Chat, tap **Enable Mobile Notifications** and accept the native permission request. The first authorized setup creates VAPID keys and dispatch configuration privately in the database. No manual keys are needed. Verify Settings reports active delivery.
4. From a second account, send a friend request and party message. Verify the pending badge/sound while open, then close **all** game windows and verify native delivery on the enrolled phone. Enable global notifications separately and test them too. Repeat after switching accounts and after logging out; logged-out subscriptions must receive no further messages.
5. Confirm the `tzg-push-retry` cron job and Edge Function logs show successful dispatch; verify stale subscriptions are removed and the short-lived outbox drains. Only then mark closed-site push as deployed here and in START_HERE.md.

An authorized Supabase connection is needed to perform steps 1–2. No project-management credentials are stored in this repository.

## Player behavior and limits

- Global notifications default off. Party and friend requests default on, but native notification permission must still be granted by an explicit tap. Preferences are scoped to the signed-in account on each device.
- iPhone/iPad web push requires a supported iOS version and an installed Home Screen web app. Android requires a supporting browser. Browser/OS notification permissions and battery/network policies can prevent or delay delivery. Force-stopping a browser can stop push. Custom notification sounds cannot be guaranteed while the website is closed; the OS controls the alert sound. The open game plays the existing message sound for new friend requests.
- The worker uses no fetch handler or asset cache, so it does not pin an old game revision. It suppresses duplicate native notifications when the game is focused and wakes the existing chat/request reader instead.
- Notification clicks only open this game's `index.html` and an allowed global/party/friends destination. Push delivery excludes the sender and blocked users, checks current room membership and active accounts, and respects per-device preferences. Logout removes the subscription.
- Push keys and endpoint subscriptions are private, RLS-protected server data. Only the public VAPID key reaches the browser. The outbox is short lived, retries at most five times and deletes delivered payloads. Providers must be from the supported HTTPS push-provider allowlist.
- An unavailable push transport must not prevent sending chat or friend requests. The minute retry job attempts remaining queued events.

## Validation

`npm run test:release` checks payment/defaults/permission flow, request counts and sound, closed-window service-worker delivery behavior, safe notification links, startup and prior planned-update regressions. `npm run test:push` checks SQL privileges/preferences/queue triggers and the Edge handler with mocked providers. SQL tests require `@electric-sql/pglite` (tested with 0.5.12), installed separately if not already present. These checks do not replace the two-device live push test above.

Actual Chromium QA on 844×390 touch and 1280×720 desktop verified bootstrap revision 103, centered/scrollable logs, screenshot PNG containing the interface, More toggle, exact 100 RC charge, insufficient-funds denial and airless fog, with no page errors. Cloud authentication was stubbed only in the local browser harness; live account and device delivery still require the backend activation check.
