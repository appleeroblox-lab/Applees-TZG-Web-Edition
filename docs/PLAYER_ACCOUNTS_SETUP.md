# Player accounts and server inventory

## Activate

1. The existing debug migration `202610250001_debug_authorization.sql` must already
   be installed. Keep the existing developer UUID in `tzg_private.debug_admins`.
2. Run the complete file
   `supabase/migrations/202610250002_player_accounts.sql` in Supabase SQL Editor
   as the project owner (postgres role).
3. In Authentication → URL Configuration, use this Site URL and allow this exact
   redirect URL:
   `https://appleeroblox-lab.github.io/Applees-TZG-Web-Edition/index.html`.
4. Keep email confirmation enabled for sign-up. Configure a production email
   sender/SMTP for confirmations and password resets to general players; the
   default Supabase email sender has recipient/rate restrictions. Check delivery
   with a real test signup before opening registration widely.
5. Deploy the matching game source. Open the game and sign in with the existing
   developer email/password, or create a player account and confirm its email.

## Behavior

- Every browser host requires a signed-in, confirmed account and a successful
  server inventory load before Play. The session is restored after refresh.
- Sign-up uses display name, email, password, and confirm password. Login uses
  email/password. Password recovery uses a reset link delivered by Supabase Auth.
- Settings exposes only display-name editing (1–32 characters), read-only user
  ID/email, cloud save status, and sign out.
- Only FP, RC, and inventory stacks are stored as game progress in the server.
  Display names are account profile data, stored separately. Passwords are handled
  exclusively by Supabase Auth; neither plaintext nor password hashes are exposed
  to the developer account directory.
- Flight position, world changes, graphics, and control preferences remain local.
  Local world changes are separated by account UUID and contain no inventory or
  currency fields. Legacy device inventories are not silently imported into a
  newly registered account. The existing device save remains untouched as an
  old backup, but is no longer read or updated by the browser game.
- Inventory/currency changes autosave after a short delay (400 ms). Unchanged
  world updates do not write to the cloud. Sign out and Refresh Game await a save.
  The browser warns before leaving with pending progress; a forcibly terminated
  tab can still lose progress that was not acknowledged by the server.
- Save failure pauses the game and offers a retry without overwriting the server
  with empty data. An optimistic revision check prevents another tab/device from
  silently overwriting newer progress. An uncertain write retries with the same
  mutation UUID. A conflicting tab must reload the latest server save.
- The game simulation still runs in the client. Ownership checks, payload bounds,
  and revisions protect isolation and persistence; they do not make client-earned
  currency or item quantities cheat-proof.

## Developer directory

Settings → Debug Menu → authorized developer login → Developer Panel →
**PlayerDatas · All accounts**. Search and page through global accounts (50 per
page) with display name, user ID, email, and email-confirmation status. Normal
player accounts cannot access this RPC or read the underlying private tables.
There is no password-viewing feature. Supabase Auth handles password resets.

## Checks

`npm run test:accounts`, `npm run test:debug`, `npm test`, and `npm run test:ui`.
UI simulations mock WebGL and network. Verify real email delivery, login,
refresh persistence, and an inventory/currency round trip after dashboard setup.
