# The Zero Gravity — Web Edition

Current game version: **v0.0.106** (source/cache revision **106**), 28 October 2026. The default branch is `main`.

## v0.0.106 settings and mining recovery

The visible Graphics quality dropdown exposes all five presets, including Ultra and Ultra+. Current modules repair older HTML shells and keep the legacy slider in sync. Locked destinations use normal onscreen labels; edge markers are removed. Inventory validation and transient save errors keep the signed-in game running with a visible pending-save status. Real session/authentication failures and cloud revision conflicts retain their existing account protections.

**Backend step still pending:** apply `supabase/migrations/202610280018_mining_catalog.sql` after SQL013 on the existing Supabase project. This update is prepared and tested but has not been applied to the live database. It expands both catalogue-validation paths without weakening schema, ownership, revision, session or XP checks. Until applied, newer bodies can still be rejected by cloud save; keep the game open if progress is pending. See `docs/MINING_CATALOG.md`.

Play: https://appleeroblox-lab.github.io/Applees-TZG-Web-Edition/index.html

## v0.0.105 graphics and navigation

Ultra and Ultra+ increase scenery/cloud/star budgets, image resolution and sharpness, and shadow resolution when Global Shadow is enabled. Mobile budgets remain bounded. Airless terrain uses dark-gray radial fog in WebGL and the compatibility renderer. Free Camera requires a 100 RC confirmation; its payment is rechecked on acceptance. Only Settings pauses simulation among menus.

Cross-system warps always cost 1000 FP plus 5–10 RC based on the destination’s schematic distance from Sol; repeat visits do not discount this, and Earth return remains free. The selected destination remains labeled across systems with a screen-edge marker and Ly distance on the schematic game map. Empty-space clicks only select visible bodies at their current relative position.

Validation: `npm run test:graphics-navigation`, the full gameplay and UI suites, release startup checks, and previous world regressions. UI tests mock WebGL; physical-device rendering is not covered.

## v0.0.104 fixes

A nearby village now streams at mobile spawn without relocating older villages. Ship obstacle contacts are silent and trigger guided landing; TNT blasts replace a hit ship at this world’s pad without moving an on-foot player. Tower collision matches each visible part. Held minerals follow the camera like tools, TNT beeps once per second, and UI sounds share a short duplicate guard.

Checks: `npm run test:world-polish`, `npm run test:world`, `npm run test:release`, and `npm run test:ui`. Closed-site push still requires the Supabase activation described in `docs/MOBILE_PUSH.md`.

## Play and publish

Game: https://appleeroblox-lab.github.io/Applees-TZG-Web-Edition/index.html

GitHub Actions publishes the contents of `public/` whenever `main` changes. Set **Settings → Pages → Source → GitHub Actions**. The workflow is `.github/workflows/github-pages.yml`; it uploads the static game directly, without a Node build. Keep all files inside `public/` together. Use the Actions run result to confirm each deployment.

To play locally, run from the repository root:

```sh
python -m http.server 8000 --directory public
```

Then open http://localhost:8000/. ES modules and assets require HTTP; opening `index.html` directly does not work reliably.

## Latest changes

- **v0.0.103 release fixes:** Update Logs is centered on phone and desktop, scrolls within the screen, and uses first-person release wording. Early-history provenance is available in a collapsed details section.
- Airless terrain fades into dark horizon fog to hide the streamed ground edge. The star sky remains clear.
- More no longer shows Favorite Places. Entering Free Camera costs **100 RC per use**; returning to Ship is free. Insufficient funds prevents entry. Reloading does not restore unpaid Free Camera.
- Background exploration no longer prints an unsupported destination error across the account header. Migration 017 updates the trusted destination list for the newer named worlds.
- Chat settings add **Mobile Global Chat Notification** (off by default), **Party Chat Notification** (on by default), and an explicit **Enable Mobile Notifications** action. Friend requests have a separate pending count and a message sound.
- **Closed-site phone notifications need backend activation:** the client, service worker, SQL migration and push Edge Function are prepared and tested, but have not been deployed to the connected game database in this release session. Until activation, Settings reports that server setup is needed. See [Mobile Push setup](docs/MOBILE_PUSH.md). Do not advertise closed-site push as live before completing that checklist.


- **Update Logs** is available from More and Settings → Display. Either button toggles the same scrollable menu. It lists 91 recoverable releases from **v0.0.3** through **v0.0.103**, using historical README notes and Git commits. Missing early entries are explicitly identified; legacy source revision N displays as v0.0.N.
- Screenshot now saves the visible game viewport **including HUD, currency, controls, chat and open menus**. It freezes visible canvases before cloning the interface, then renders locally to PNG using bundled MIT-licensed html2canvas. It captures in-game content, not the phone status bar or browser chrome; browser font/filter/CORS support can affect exact appearance. No screen-sharing permission is requested by this local composition path.
- A shared label filter hides generated belt/hash names in space, surface skies and Universe Map; named bodies remain available. Legacy belt-label containers and custom install overlays are removed and hidden defensively.
- Settings Install Game retains only the native browser prompt. Startup reads uncached release metadata, then imports the matching game revision while retaining normal caching for unchanged assets.


- Update 101 removes the custom install invitation. Only the native browser install dialog is used; after sign-in it opens on the next available user tap (or immediately if browser activation is still available). Settings → Install Game triggers the same native dialog. Unsupported browsers get no substitute popup.
- Procedural belt rocks no longer display generated hash-name labels. Named catalog body labels and their setting remain.
- Water pools fade over 80–140 m and also fade their transparency with scene fog. Distant pools are culled; Canvas fallback uses the same fade. Snow layers also fade into scene fog.


- Update 100 caches and spatially indexes village weather blockers, sends only active weather vertices to the GPU, and updates only changed tree snow colors. Mobile High retains its visual preset with a 512px shadow map at four updates/second and a 64-patch ground-weather budget at two updates/second.
- Villages start at least 650 m from the launch area and 650 m apart. All five Earth biomes use the same old wooden six-house village. Procedural villages regenerate at the wider spacing; player-placed blocks remain saved in their original positions.
- Snow patches follow the actual six-meter terrain triangles; biome texture channels blend directly, and spruce snow caps fit their trees.



- Update 99 separates mining health/resource changes from village rendering, collision indexing and scenery rebuilds. Guided Land searches for clear ground nearby and redirects descent there. Named main asteroids are landable; Zoozve, Kuiper objects, fictional Oort objects and procedural belt rocks are flyby-only. Distant belt point clouds are removed. Villages return to six houses without shrinking houses.

- The supplied game artwork now appears in the loading poster, settings button, browser icon, install icon and link preview. The original sign-in menu uses the loading screen background. Currency icons, the mobile game-logo button and global/party chat retention notices are compact.
- Phobos, Deimos, Haumea and its moons, additional irregular moons, Zoozve, named asteroids and Kuiper objects use local Blender-authored meshes. The catalog includes Vesta, Pallas, Hygiea, Eros, Ida, Gaspra, Itokawa, Bennu, Ryugu, Arrokoth, Varuna and Ixion. Zoozve is identified as Venus's asteroid quasi-satellite. Oort Survey destinations are explicitly fictional.
- The Asteroid Belt, Kuiper Belt and spherical Oort Cloud show only nearby instanced Blender rocks; distant rings and point fields are hidden. **Asteroids Labels** is a saved setting. Mobile/compatibility uses at most 54 nearby rocks; desktop High uses at most 250, sharing eight mesh templates.
- Indexed surface collision now covers village/player blocks and doors, trees, rocks, cactus, scenery structures, pad buildings, signs and planet bases. Ships use a swept wing/hull box to prevent tunnelling, and can settle on block roofs. Grass remains collision-free.
- Villages now contain **6 houses of the existing size**. Each house keeps its original size and local layout. Earth has ten spaced villages across all five biomes with one shared wooden style. Other solid worlds retain eight settlements.
- Six Blender base designs cover lunar research, Mars habitats, Mercury mining, raised Venus thermal stations, icy-world outposts and Proxima greenhouses. They appear on appropriate landable worlds and share the collision system.

Details, model generation and validation: `docs/WORLD_UPDATE.md`.

### Retained account and audio changes

- The original account menu now appears before game source/model/texture loading. Its same DOM element and Supabase client are reused by the game. Startup waits for server inventory hydration before announcing readiness, preventing the second sign-in screen. Account connection errors, moderation notices and deliberate sign-outs can still require account attention.
- Ship recall uses the current `player-ship` mesh, scaled to its pedestal. The proximity prompt tracks the current camera every rendered frame with no CSS movement transition, uses consistent pedestal height checks, and hides during blocked interaction.
- The runtime Crafting Center mesh no longer displays the two decorative tools on its front. The Blender generation script is updated too. The existing `.blend` remains the earlier source scene; rerun `assets/blender/build_crafting_v96.py` in Blender to regenerate it.
- Gameplay sounds now have explicit mappings for all requested Roblox SoundIds: countdown, takeoff, landing, star/core contact, warnings, pickaxe swing/hit, shovel interaction, resource/item gains, currency changes, UI buttons/open/close, stopping and chat notifications. Ambient tracks play sequentially when their media is available.
- **Two exact Roblox audio assets were downloaded:** Boom `3149249837` and Explosion `2814355743`. They are bundled under `public/sounds/roblox/` and are used for collision feedback and TNT blasts.
- **Still awaiting exported media:** the other 20 requested sound entries and all three sunshine images. Roblox Asset Delivery returned HTTP 401 for those requests. Existing bundled effects remain as fallbacks; no replacement is presented as the original Roblox recording. Sunshine layers and ambient playback activate after their actual media is imported.

## Import the remaining Roblox media

An `rbxassetid://` reference is not a browser audio/image URL. The game uses real, locally hosted media files, rather than sending visitors to Roblox asset endpoints.

For accessible assets, retry:

```sh
python scripts/import-roblox-assets.py
```

For media exported by the owner, place the files in one folder. Name each file after its listed sound name or numeric asset ID, retaining `.ogg`, `.mp3`, `.wav`, `.png` or `.jpg`. Then run:

```sh
python scripts/import-roblox-assets.py --from-dir /path/to/exported-media
```

The importer verifies file headers, handles compressed Roblox responses, reuses shared IDs, saves local media and updates `public/roblox-assets.json` and `public/roblox-assets.js`. Commit those updated files and media, then reload the game with a fresh browser cache. It never requests or stores Roblox account credentials.

See `docs/ROBLOX_ASSET_IMPORT.json` for the actual retrieval results and `docs/ROBLOX_MEDIA.md` for the complete ID/event mapping.

## Accounts, saves and chat

Accounts use Supabase Auth. Inventory items and currencies use server-backed saves. Device UI preferences and local world edits have separate storage; changing browser or website origin changes that local storage. Passwords are handled by Supabase Auth.

Setup references:

- `docs/PLAYER_ACCOUNTS_SETUP.md`
- `docs/SOCIAL_ACCOUNTS_SETUP.md`
- `docs/SUPABASE_DEBUG_SETUP.md`
- `docs/KLIPY_SETUP_V93.md`
- `docs/TEMPORARY_CHAT_V95.md`
- `docs/GAME_POLISH_V96.md`

Keep the existing Supabase migrations applied in order. The latest required migration from update 96 is `supabase/migrations/202610270015_chat_expiry_reports.sql`. This update adds **no new SQL migration**. Project source alone cannot confirm which migrations have been applied to a live database.

GitHub Pages hosts static files; it cannot run the included original `/api/debug/*` backend. Supabase features need the configured project, RPCs and access policies. Never put service-role keys, private credentials or live database exports in this public repository.

## Source and checks

`public/` contains the playable game, local Three.js, fonts, textures, sounds and models. `assets/blender/` contains source models and generators. `supabase/` contains database migrations. The original framework/server code remains in `app/`, `server/`, `worker/`, `db/` and `drizzle/`.

For the optional framework application, use the Node and pnpm versions declared in `package.json`. For the static game, no Node installation is needed.

Useful checks after installing the declared development dependencies:

```sh
node tests/world-update.mjs
node tests/update-v97.mjs
node tests/game-polish-v96.mjs
node --experimental-vm-modules tests/auth-boot-v96.mjs
node --experimental-vm-modules tests/ui-smoke.mjs --startup-race-only
npm run test:accounts
npm run test:social
```

`EXPORT_MANIFEST.json` describes the original October 25 export, not current repository checksums. `public/source-manifest.json` is the current loading manifest. Older package/export labels are historical; this guide identifies the current source update.

Third-party asset credits remain in `public/credits.html` and the license files alongside their assets.


## Update history and screenshot checks

`public/update-history.json` is the user-facing history, generated by `python scripts/build-update-history.py`. The history dates for versions before Git imports are deliberately omitted. Do not fabricate creation notes for missing versions.

Run `npm run test:planned` for label policy, legacy overlay removal, update log toggle/history, screenshot composition and auth-first startup checks. The complete `npm test` suite includes these feature checks. Real Chromium QA at 844×390 verified that exported PNGs contain the rendered game, HUD and open Update Logs menu, with no page errors. The real-browser fixture stubs cloud account activation only; live account and physical-phone capture behavior were not measured.

Screenshot dependency: `public/vendor/html2canvas.min.js` 1.4.1 and `public/vendor/html2canvas.LICENSE`. It is loaded only when taking a screenshot; its license remains bundled. API reference: https://html2canvas.hertzen.com/configuration
