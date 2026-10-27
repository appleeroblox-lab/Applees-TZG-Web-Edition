# Game polish v96

Messages expire individually from each message's send time. Global messages last 5 minutes and party/friend/group messages last 5 hours. Earlier count-based deletion is removed, so newer messages are not purged just because a chat is busy. Each chat displays the retention rule. The existing background cleanup checks every minute; browser rows expire on individual timers, and active reads also clean expired server rows. Reports expire after 7 days or can be permanently deleted by a developer using the new Delete report button and confirmation.

## Required SQL

After the v95 storage migration, run `supabase/migrations/202610270015_chat_expiry_reports.sql` in:
https://supabase.com/dashboard/project/zwtcytzaozysxiqixihk/sql/new

It updates the existing scheduled cleanup function and adds the developer-only report deletion RPC. Do not rerun the older v95 migration afterward, as that would restore its previous retention settings.

## Sign in before game loading

`auth-first.js` loads only the account SDK and sign-in interface before the model/texture/source preloader runs. Login, sign-up, email confirmation, password-reset links and existing-session Continue are supported. The authenticated SDK client is handed directly to the in-game account menu, preserving the same session/storage key and avoiding duplicate token-refresh clients. Passwords are never stored by this interface. Game account/ban/session checks still run after the game starts.

## World and UI

- A miniature ship on a pedestal at local (12, 0), just east of each solid world's launch pad, offers a touch/click or E proximity prompt within 4 m. It returns only the ship to Pad 01, clears its movement/navigation and leaves the on-foot player's position, camera and motion unchanged. The pedestal has a small collision footprint.
- The Crafting Center now loads a real Blender-built workshop with a counter, cabinets, tool display, side windows and Fredoka title. The model fits the existing footprint and rain shelter height. Source: `assets/blender/crafting-center-v96.blend`; reproducible builder: `assets/blender/build_crafting_v96.py`; runtime mesh: `public/models/crafting-center-v96.json`. It uses 7 material batches and 2,692 triangles.
- The game icon and browser/app icons are rendered from the existing Blender rocket. The user's uploaded FP/RC currency PNGs are preserved unchanged. Currency art and the global-chat upload icon use centered contain sizing.
- Grass defaults to 30%; 100% uses a dense, stratified distribution on eligible grassy biomes. Roads, pads and buildings stay clear. Grass remains in bounded nearby chunk batches, has no collision, and does not animate or allocate geometry every frame. Device quality limits still apply. Upgrading old density settings resets the density to the new 30% default once.

## Verification

`tests/game-polish-v96.mjs` covers independent lifetimes, ship-only respawn and range guards, bounded grass, finite Blender model data, and login/Continue sequencing with an Auth fixture. `tests/chat-expiry-v96.mjs` runs the SQL twice against PGlite and verifies individual expiry, preservation beyond previous count caps, actual send RPC behavior, and developer-only report deletion. The report-delete UI confirmation and auth-before-preload sequence have separate tests. Existing social UI, friends UI, device settings, surface lifecycle, global GIF and delayed ship initialization suites are retained. Visual renders of the actual model and icon were inspected. Live account login, device touch input and device FPS require testing on a physical device.
