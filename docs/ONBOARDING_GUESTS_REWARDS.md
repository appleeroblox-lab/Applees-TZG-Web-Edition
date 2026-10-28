# Guest play, onboarding and rewards v0.0.107

Release date: October 28, 2026.

## Scope

This is an additive update to the existing game. Existing inventory, currencies, placements, account profiles, graphics presets, weather and game controls are retained. The existing discovery RC bonus is retained.

- Play as Guest uses an anonymous, non-persistent Supabase client for narrow public chat/profile reads. Gameplay inventory and currencies stay in memory; signing in replaces them with the member's existing server save. Guest progress is never merged into a member save.
- Global Chat is refreshed by five-second polling while visible. Guests cannot send, report, use friends/private chats/groups, edit accounts or claim rewards. Server grants/RLS deny those operations, independently of hidden controls.
- The short, skippable tutorial has PC/mobile text and highlights existing controls. Completion/skip and tips settings persist per registered account. Guest completion lasts for this page session only. Replay Tutorial is in Settings.
- Daily rewards use UTC calendar dates: 100, 150, 200, 250, 300, 400, then 500 FP plus 10 RC. Missing days do not reset the cycle. Claims lock the existing save row and increment its revision. A unique claim ledger prevents duplicates and a mutation UUID makes uncertain network retries idempotent.
- Only auth users inserted after the migration activates are welcome-eligible. Their one-time gift is 250 FP and 5 RC. Existing accounts are not backfilled or reset, including existing accounts that have never opened the game.
- Reward responses are serialized with normal cloud writes. A lost response retains the pending reward mutation and prevents an ordinary save from overwriting the server reward. The Daily Rewards menu can retry it. Gameplay changes made while the request is in flight are retained.
- New discovery/landing tracking is stored server-side and marked in Universe Map. Existing exploration XP and discovery RC continue to work.

## Exploration FP bonuses are not enabled

The requested 50 FP discovery and 100 FP landing payment paths are implemented and tested behind private `verified_discovery` / `verified_landing` fields. No browser-accessible RPC can set those verification fields. Ordinary players cannot claim these new bonuses until an authoritative gameplay service verifies their travel/landing. This browser game currently has no such trusted simulation service, so enabling claims from client-reported events alone would make the rewards farmable. These bonuses are not advertised as released in Update Logs. No existing reward or progress system is removed.

## Statistics

The existing developer menu displays aggregate unique browser visitors, current registered accounts, active players, UTC daily active players, total gameplay sessions, guest/member session counts and average observed session seconds. No raw visitor IDs or private account information is returned by the statistics API.

Visitor identity is a random browser-local UUID, not a fingerprint or a guarantee of unique humans. Clearing browser storage creates a new visitor. Gameplay sessions begin at Play; guest/member transitions end the previous session. Visible pages heartbeat every 30 seconds. Activity expires after 90 seconds without a heartbeat. Active counts deduplicate registered users across tabs and guests by visitor UUID. Heartbeat gaps contribute at most 90 seconds to duration, so these are lightweight estimates, not fraud-proof analytics or exact stopwatch measurements. Anonymous traffic can be manufactured; a trusted analytics gateway/rate-limiting service would be needed to resist deliberate count inflation.

## Loading

The boot preloader requests CSS, fonts and the player ship first. Other models/textures load through the existing loaders when needed. This reduces the manifest's upfront preload budget from approximately 28 MB to 1 MB without changing model files, terrain quality or any graphics tier. It is an asset-byte comparison, not a measured percentage improvement in wall-clock loading time. Hidden Universe Map thumbnails no longer request textures until the map is opened.

## Database setup

Migration: `supabase/migrations/20261028103514_onboarding_guests_rewards.sql`.

Apply after the existing account/social/progress migrations and SQL018. The migration adds private RLS-protected tables, narrow RPCs and an AFTER INSERT auth hook. It never resets or updates existing player saves during installation. It is repeatable. Do not grant clients direct access to the new private tables or to the exploration verification flags.

SQL Editor for the configured project:
https://supabase.com/dashboard/project/zwtcytzaozysxiqixihk/sql/new

Live activation completed on October 28, 2026. Welcome/daily claims, duplicates, tutorial persistence and guest permissions passed a rolled-back transaction on the live project. Anonymous HTTP calls returned 200 for guest chat/profiles and 401/42501 for rewards/statistics. No QA accounts were retained. The script was executed through the SQL endpoint after the migration API returned expired-request errors, so migration-history registration is not claimed. Deployment status and live verification results are recorded in START_HERE.md. When already applied by the deployment session, no manual SQL step is required. For another deployment, execute the complete migration as postgres in SQL Editor, then verify the public RPC grants and anonymous denials.

## Validation

- `npm test`, `npm run test:accounts`, `npm run test:social`, `npm run test:ui`.
- `npm run test:onboarding` checks guest restrictions, tutorial skip/replay, guest-to-member hydration, lost reward-response retries, pending-reward write protection, atomic reward ledgers, all seven daily rewards/cycle wrap, welcome eligibility, existing save preservation, unauthorized bonus denials, visitor/session separation and active-session expiry.
- `node --experimental-vm-modules tests/auth-boot-v96.mjs` checks source loading waits for login or the guest choice and that critical asset cache versions are respected.
- `scripts/qa-onboarding.mjs` is optional real Chromium QA. Set `TZG_PLAYWRIGHT_MODULE` to an installed Playwright module if it is not installed locally, and optionally `TZG_CHROMIUM_EXECUTABLE` to a compatible Chromium binary. Serve `public/` on port 8080 in the same environment. It tests PC 1280x720 and mobile landscape 844x390 with isolated Auth/RPC fixtures, never production users. It covers guest play/chat/profile/restrictions, tutorial, signup-confirmation UX, member login without reload, saved inventory hydration, daily claim, all five graphics settings and uncaught page errors.

Physical devices, production email delivery and an authoritative travel-verification service are not covered by those browser fixtures. Auth and reward SQL are also checked on the live database in a rolled-back fixture transaction before publication.
