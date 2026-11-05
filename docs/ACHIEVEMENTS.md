# Achievements

This change adds the 80-entry catalog, compact searchable/filterable menu, rarity accents, guest read-only view, queued top-layer notification, supplied MP3 and server-confirmed automatic reward claims. The final request for auto-claim supersedes manual-only claiming: a Claim / Retry button remains for interrupted confirmations.

## Availability and tracking limits

**18 entries are enabled:** 019, 061–072, 074, 076, 078–080. System unlocks, existing server XP levels, accepted friendships and group membership are read from existing private server records. Existing milestones are credited when the account syncs. Play-day tracking starts with this update, uses UTC dates and requires a logged-in server play session with at least 30 seconds; reconnects on the same date do not add days.

**62 entries are visibly unavailable.** The browser simulates flight, boost, warp, landing, mining and crafting locally. There is no independent authoritative flight/warp/mining/crafting/trade event stream or material provenance. Party chat membership does not establish cooperative travel. An inventory increase cannot prove mining; wallet deltas cannot prove gameplay earnings. This implementation deliberately does not expose a client progress increment API or infer those accomplishments from client submissions. Exploration queries are prepared for verified landing records, but entries 021–030 remain unavailable because the current public exploration RPC cannot establish those verification flags. Trusted server event producers are required before enabling these entries. No new gameplay systems were added to circumvent these limits.

The level requirements use the game's existing server XP calculation; the underlying game's existing save validation remains unchanged. This is not an independent authoritative simulation or an anti-cheat overhaul. All-time availability and catalog totals are separate: the full catalog still sums to exactly 100,000 FP and 10,000 RC.

## Database

`supabase/migrations/20261105122716_achievements.sql` was applied to project `zwtcytzaozysxiqixihk` using the connected Supabase tool. **Do not run it again on that project.** For a different database, apply the existing account/social/XP/onboarding migrations and `docs/sql/v168-system-progression.sql` first, then run this achievement migration in the Supabase SQL editor or your normal migration workflow. It creates only achievement tables/functions and does not erase player data.

New tables are in `tzg_private`, have RLS enabled and deny direct client table access. Three authenticated public SECURITY INVOKER RPC wrappers call narrowly granted private functions, which require the existing verified identity and current game session. Guests and revoked sessions cannot use them. The private schema remains outside the PostgREST exposed schemas.

Claims take the existing wallet row lock, check its expected revision, re-read server milestones, mark each completion claimed once, add the fixed catalog rewards and advance the revision in one transaction. A mutation receipt returns the same response for a lost-response retry. The UI uses the existing CloudSave serverMutation protocol so local gameplay changes are retained. Achievement payout does not feed any gameplay-earnings counters. Claimed/completed timestamps persist across sessions/devices. Notices have a separate server timestamp: retrieving a notice consumes it once across devices; reloading can discard an already retrieved queued toast, but cannot repeat it or pay twice.

## UI and audio

The button is in the existing top-right header navigation immediately after Account. Toast position follows that header group's actual rendered bottom edge every animation frame, including resizes/safe areas. Notifications use the browser top layer (manual popover), move into the most recently opened modal to remain interactive, and are raised after modal changes. No description, progress or rewards appear in a toast. Clicking opens the matching card. Notifications hold for five seconds, queue serially and respect reduced motion.

`public/sounds/achievement-unlocked.mp3` is the exact supplied MP3. It plays through the existing GameSound AudioContext, buffer cache, effects mix, master volume/mute and node lifecycle. Playback requires the existing browser audio unlock and a running AudioContext. No HTML media player or audio page is added. Decode/autoplay failures do not report successful playback.

## Validation

- `npm ci --prefix tests`
- `node tests/achievements-sql.mjs`
- `node tests/node_modules/playwright/cli.js install chromium`
- `node tests/achievements-ui.mjs` (starts its own localhost fixture server)
- `npx eslint public/achievements.js public/achievement-catalog.js tests/achievements-sql.mjs tests/achievements-ui.mjs`
- `npm run build`

SQL tests use PGlite with the existing migrations and exercise catalog totals, server milestones, persistent notice consumption, idempotent claims/retries, stale revisions, account isolation, direct table denial, guest denial and revoked sessions. A live Supabase transaction also tested a synthetic account's completion/claim/retry/no-second-payout and rolled back every fixture change.

Browser tests use the real page styles, real achievement module, existing CloudSave and GameSound with a mocked account RPC. They cover 1280×800, 844×390 and 667×375, safe bounds, scrolling/search/filter, rarity color equality, auto-claim, queued toasts, click hit-testing above a modal minimap fixture, focused cards, actual bundled MP3 decoding/source playback, mute and reduced motion. These are not live signed-in end-to-end gameplay tests or physical-device tests.

The repository-wide lint/type checks have preexisting failures outside these changes (including Deno imports/globals in push-dispatch and vite.config.ts's r2 type). They were left outside this strict scope. No deployment configuration changes are included.

## Changed files

- `public/achievement-catalog.js`: exact IDs, names, requirements, rarities, rewards and runtime total validation.
- `public/achievements.js` and `public/achievements.css`: menu, filtering, automatic claim/retry, queue, layering, click focus and game audio integration.
- `public/icons/achievement.svg` and `public/sounds/achievement-unlocked.mp3`: trophy icon and supplied sound asset.
- `public/game.js`: achievement import and constructor wiring only (two lines).
- `supabase/migrations/20261105122716_achievements.sql`: private persistence, server-derived progress, notice consumption and atomic wallet claims.
- `tests/achievements-sql.mjs`, `tests/achievements-ui.mjs`, `tests/package.json`, `tests/package-lock.json`: SQL/browser verification and pinned browser-test dependency.
- `docs/ACHIEVEMENTS.md`: setup, behavior, test coverage and limitations.

The Supabase security advisor reports informational “RLS enabled, no policy” entries for the five private achievement tables. This is intentional default-deny access; no table grants are provided to browser roles, and owner/session-checked RPCs are the only access path. No new achievement-related warning-level findings were returned. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
