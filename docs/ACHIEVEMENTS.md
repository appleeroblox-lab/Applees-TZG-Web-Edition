# Achievements

The full catalog contains **80 enabled achievements**, totaling **100,000 FP and 10,000 RC** across one-time claims. Completed achievements auto-claim after server confirmation. Claim / Retry remains available for interrupted confirmations. Guests can browse but cannot submit activity, progress, receive unlock notices or claim rewards.

## UI and audio

The toggle sits immediately after Account in the existing top-right header group. The compact menu has a completion count, progress bar, search, rarity filter and individual scrolling cards. Rarity controls card borders, labels, icon accents and toast borders. Mobile landscape uses a smaller layout with internal scrolling.

The toast contains only icon, “Achievement Unlocked!” and name. Its position follows the actual bottom of the top-right header group, including resize and safe areas. A manual popover uses the browser top layer, moves into the most recently opened modal to remain clickable, and is raised after modal changes. It slides in/out from the right, holds five seconds, queues serially and respects reduced motion. Clicking opens and highlights the matching card. Server-consumed notice timestamps prevent repeats across reloads/devices; reloading can discard a notice already retrieved into the local queue.

`public/sounds/achievement-unlocked.mp3` is byte-for-byte the supplied file. It uses the existing GameSound AudioContext, buffer cache, effects mix, master mute/volume and node lifecycle. Playback needs the browser’s existing audio unlock and a running context. Decode/autoplay failures never report successful playback. No media player or separate audio page is added.

## Gameplay tracking and validation

`public/achievement-tracking.js` observes successful existing methods without changing their arguments, results, physics or economy rules. The render loop supplies activity-mode transitions only, so paused/free/debug intervals cannot be folded into later active time. Opening the menu clears held controls. Events carry an action and movement observation, never a progress increment, currency reward, completion flag or date. Supabase derives progression from its private rules, receipts, sequence state and wall clock:

- Flight, boost, atmospheric/low-altitude distance and deep-space time require moving manual input, bounded displacement and fresh server intervals. Idle, paused, debug, experimental, free-camera and navigation/warp movement earn no manual-flight distance/time. Boost uses a 20-second server budget and recharge interval. Terrain altitude is calculated on the server for distance counters.
- Launch requires a previously observed parked state, countdown and timed ignition. Landing needs a validated airborne state and touchdown. Entry/exit and public body/system transitions are checked; spawn/reset observations do not count as landings. Unique public bodies, planets, moons, exoplanets, atmospheric worlds and system completion use stable catalog IDs.
- A warp needs an unlocked target, source exclusion checks, a fresh matching wallet-spend receipt when payment applies, a server-timed ticket and a plausible arrival. Cancellations, early arrivals, receipt reuse and duplicate completions do not count. Warp displacement never becomes flight distance.
- Pickaxe mining uses the generated real node catalog, proximity, owned-tool damage, cooldowns and persistent per-cycle HP/depletion. Reconnects do not replenish nodes. Verified collections record mineral rarity, body/system/type and material origin budgets.
- TNT collection additionally requires a consumed-TNT save receipt, a nearby placement, an owned torch, a valid fuse or chain reaction and server-calculated blast damage. A consumed explosive cannot be replayed.
- Crafting requires recent presence at the existing Crafting Center and accepted inventory changes that consume the exact recipe. Purchases grant no crafting progress. Consumed material budgets establish self-mined crafting and source planets; the same material cannot be reused after crafting, selling or discarding. Distinct tools and every current recipe are tracked.
- Trading counts validated NPC sales at the existing Earth Trade building: consumed resources and both currency changes must match the current sale prices. Self-trading is not an available game mechanic. Only these validated sale proceeds count toward gameplay earnings; achievement/welcome/daily/debug currency additions never feed those counters.
- Party travel requires two distinct live members of the same existing group on the same genuinely visited body. Merely joining an empty group does not satisfy cooperative travel or active party time. Party time also requires recent active presence from another member.
- Play days use server UTC dates and actual active observations, never client dates or reconnect counts. Existing server XP levels, accepted friendships, group membership, unlocked systems and previously verified landing records can be credited retroactively. New counters and material provenance start with this update.

All current set targets are checked against the game: 96 public landable bodies, 48 obtainable minerals and 31 recipes. The hidden Experimental System is excluded.

### Practical limits

The browser still runs the original simulation. Movement validation uses sequenced, rate/speed/transition-bounded observations rather than independently replaying the complete game physics on a server. This is not a claim that browser automation or every possible fabricated input is prevented. The legacy inventory save API and existing XP validation are retained; this change does not certify them as an independent anti-cheat system. Craft/trade validation checks accepted inventory transactions against recipes/prices and location observations, rather than trusting submitted achievement totals.

Initial tracking needs one observation at the Earth launch pad to establish a server checkpoint. An account loaded at an unverifiable old location should return there once; gameplay remains available. Restored movement, old damaged nodes and old materials cannot all be reconstructed as trusted past activity. Large network gaps are not credited retroactively; rejected/stale actions report a retry/status message rather than inventing progress. Existing non-sale gameplay RC is not inferred from wallet increases. Browser tests are fixtures, not a claim of testing hundreds of live hours or physical devices.

## Persistence, rewards and SQL

Private achievement tables have RLS enabled and deny direct browser access. Public SECURITY INVOKER RPCs call narrowly granted private functions. All use the existing verified account identity/current game-session checks. Event run IDs and monotonic sequences prevent replay; mining and provenance state survive reconnects. Experimental/debug events are excluded.

Claims lock the existing wallet row, check its revision, re-evaluate server progress, mark each achievement claimed once, add catalog rewards and advance the revision atomically. Lost-response retries return the stored mutation receipt. The UI uses CloudSave.serverMutation, retaining unsaved local gameplay changes. No new account wallet or replacement balance system is introduced.

Migrations:

1. `supabase/migrations/20261105122716_achievements.sql`: catalog, progress, notices and atomic auto-claims (already applied).
2. `supabase/migrations/20261105134834_achievements_tracking.sql`: validation, private event/material/payment records, all 80 progress mappings and save-receipt wiring (applied and verified on the connected project).

3. `supabase/migrations/20261105135845_achievements_event_guards.sql`: reject non-playing action submissions and preserve legitimate paused TNT fuses (applied).

For a fresh database, apply prior account/social/XP/onboarding migrations and `docs/sql/v168-system-progression.sql` first, then the achievement migrations in order. Use the Supabase SQL editor or the normal migration workflow. Never re-run a migration already recorded on that project. The catalog and tracking migrations are applied to the connected project. The live catalog reports 80 enabled entries and the exact reward totals. A rolled-back synthetic live-account test verified launch/flight/landing, claim/retry and no second payout. No migration deletes existing player saves or balances.

`supabase/achievement-rules.json` is generated from the current existing game catalog/economy using `node scripts/generate-achievement-rules.mjs`. The tracking migration embeds that release snapshot. `docs/sql/achievement-tracking-functions.sql` keeps the readable function source; future rule changes require a new migration rather than editing an already applied release.

The security advisor’s informational “RLS enabled, no policy” finding is intentional for private default-deny tables. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Verification

Run `npm ci --prefix tests`, install the test browser with `node tests/node_modules/playwright/cli.js install chromium`, then run `npm run test:achievements`.

SQL tests cover real representative validated events, node HP/cooldowns/tool ownership/depletion, TNT consumption/fuses, recipe inputs and provenance, sale price matching, idempotent save/claim retries, warp payment/timing/replay/interstellar validation, boost budgets, active party co-presence, idle exclusion, guests and private table permissions. Private test fixtures exercise every one of the 80 thresholds, and claiming the entire catalog pays exactly 100,000 FP / 10,000 RC once. Those accelerated fixtures are not client-accessible shortcuts.

Browser tests cover 1280×800, 844×390 and 667×375, menu toggle/close, list scrolling/search/filter, rarity colors, auto-claims, top-layer hit-testing above a modal minimap fixture, click-to-focus, queue timing, actual MP3 Web Audio playback, mute and reduced motion. Client tracking tests preserve original method behavior and verify successful-action wiring, baseline ordering, payment-before-warp tracking, replay-safe lost-response retries and guest exclusion.

Also run `node tests/cloud-save.mjs`, `node tests/profile-banner-sql.mjs`, targeted ESLint, `git diff --check` and `npm run build`. Repository-wide lint/type checks have existing unrelated failures, including Deno imports/globals in push-dispatch and vite.config.ts’s r2 type; they remain outside this change.

## Changed files

Achievement UI/catalog/style/audio/icon files; `public/achievement-tracking.js`; the achievement migrations and rules snapshot; `scripts/generate-achievement-rules.mjs`; the achievement SQL/client/browser tests and pinned test browser dependency; this documentation. `public/game.js` contains achievement imports, constructor wiring and activity-mode notifications; simulation rules are unchanged. `package.json` adds the focused test command. The source manifest and loader import cache tokens advance to 174 so clients request the new achievement wiring; loading-screen behavior is unchanged. Deployment configuration and unrelated gameplay rules are unchanged.
