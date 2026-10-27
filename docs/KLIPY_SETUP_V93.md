# KLIPY setup for The Zero Gravity – Web (v93)

The browser uses the signed-in player's Supabase session to call `klipy-gifs`. Only the Edge Function reads `KLIPY_API_KEY`. Original KLIPY media URLs remain unchanged in chat; images are loaded directly from KLIPY, never downloaded into database image blobs. Game reactions remain a separate picker view. Disable Ads for this platform in the KLIPY Partner Panel: this implementation deliberately reports a configuration error if an ad object is returned rather than displaying or silently dropping ads.

## 1. Secret

In Supabase → Edge Functions → Secrets, save `KLIPY_API_KEY` with your KLIPY application key. Do not put it in GitHub or browser configuration. The standard `SUPABASE_URL` and `SUPABASE_ANON_KEY` variables are supplied by Supabase.

## 2. Deploy the function

Open your project: https://supabase.com/dashboard/project/zwtcytzaozysxiqixihk/functions

Choose **Deploy a new function → Via Editor** (or **Open Editor**). Name it **klipy-gifs**. Replace all the starter `index.ts` code with the complete contents of `supabase/functions/klipy-gifs/index.ts` from this branch, then deploy.

In the function's settings, turn **Verify JWT / Enforce JWT Verification** off. The function still requires a signed-in user's Bearer token and verifies it through Supabase Auth on every request. This supports newer Auth signing keys without relying on the legacy gateway check. Do not remove the handler's authentication code.

CLI alternative: `supabase functions deploy klipy-gifs --project-ref zwtcytzaozysxiqixihk --no-verify-jwt`.

The only browser origin allowed by default is `https://appleeroblox-lab.github.io`. For a different host, set `TZG_ALLOWED_ORIGIN` to that exact origin (no path).

## 3. Allow KLIPY URLs in existing chat messages

Open https://supabase.com/dashboard/project/zwtcytzaozysxiqixihk/sql/new and run `supabase/migrations/202610270013_klipy_urls.sql` once. It preserves existing JPEG/GIF validation and permits HTTPS GIF URLs only from `static.klipy.com`, `static1.klipy.com` and `static2.klipy.com`. Existing authorization, message rate limits and reporting continue to apply.

## 4. Publish and test

After the function and SQL are ready, merge this change to `main`; GitHub Pages publishes the `public` directory. Reopen the game, sign in and open GIFs. Explore shows KLIPY trending, search uses KLIPY, Load more requests subsequent pages. Select a GIF, then press the chat Send button. Try both global chat and a friend/group conversation. Confirm another signed-in player sees the image and that deletion/reporting still work.

The picker uses the required **Search KLIPY** placeholder and a **Powered by KLIPY** source link. URL delivery avoids the old cross-origin fetch-to-upload failure, but a network that blocks KLIPY's media hosts still cannot display its images. The separate Game GIFs button remains usable.

Testing keys are limited to 100 API calls/hour by KLIPY; request production access in its Partner Panel when ready. The handler has an additional per-user, per-isolate 20 requests/minute burst limit; it is not a durable global quota. No media or search responses are cached server-side.

## Validation

Run `npm run test:klipy`, `npm run test:gifs` and `node tests/social-world-v90.mjs`. Optional SQL validation: install `@electric-sql/pglite` locally and run `npm run test:klipy:sql`. These use fixtures; the live application key is neither available to the development environment nor needed for tests. Live provider/account testing must follow dashboard deployment.

References: https://docs.klipy.com/gifs-api , https://klipy.com/support/api-terms , https://supabase.com/docs/guides/functions/secrets , https://supabase.com/docs/guides/functions/function-configuration .
