# Developer authorization on GitHub Pages

The static game uses Supabase Auth for developer email/password sign-in. Each
debug command requires a fresh server check of the signed-in user's ID against
the private admin list. Commands continue to affect only the current device's
browser game save; they do not change other players or create shared balances.

## Dashboard setup

1. Open **SQL Editor**, create a query, paste the contents of
   `supabase/migrations/202610250001_debug_authorization.sql`, and run it.
2. In **Authentication → Users → Add user → Create new user**, create your
   developer account with your own email and a unique password of 12–128
   characters. Enable **Auto Confirm User** for this dashboard-created account.
   This is a game developer account, separate from your Supabase dashboard login
   and database password. Do not share the password in chat or GitHub.
3. Copy the new account's **User UID**. Run the following in SQL Editor after
   replacing the placeholder with that exact UUID:

   ```sql
   insert into tzg_private.debug_admins(user_id)
   values ('REPLACE_WITH_YOUR_USER_UUID'::uuid)
   on conflict (user_id) do update set enabled=true;
   ```

4. Open the game, then **Settings → Debug Menu**. Enter the developer email and
   password. Closing the menu keeps this page's session; **Sign out** locks it.
   Refreshing the page requires signing in again. Expired sessions also require
   signing in again.

The public project URL/key in `public/supabase-config.js` do not grant developer
access. Only SQL Editor can add or remove admin IDs; browser users cannot edit
the admin table. No account automatically becomes an admin by signing up first.
This setup does not implement the general player account or global chat feature.

To revoke access immediately:

```sql
update tzg_private.debug_admins set enabled=false
where user_id='REPLACE_WITH_YOUR_USER_UUID'::uuid;
```

Keep secret/service-role keys and database passwords out of the public repository.
The existing private Site server flow remains available on its original host.
