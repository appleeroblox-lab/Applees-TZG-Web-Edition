# The Zero Gravity — Web Edition

Current source update: **97**, 27 October 2026. The default branch is `main`.

## Play and publish

Game: https://appleeroblox-lab.github.io/Applees-TZG-Web-Edition/

GitHub Actions publishes the contents of `public/` whenever `main` changes. Set **Settings → Pages → Source → GitHub Actions**. The workflow is `.github/workflows/github-pages.yml`; it uploads the static game directly, without a Node build. Keep all files inside `public/` together. Use the Actions run result to confirm each deployment.

To play locally, run from the repository root:

```sh
python -m http.server 8000 --directory public
```

Then open http://localhost:8000/. ES modules and assets require HTTP; opening `index.html` directly does not work reliably.

## Latest changes

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
node tests/update-v97.mjs
node tests/game-polish-v96.mjs
node --experimental-vm-modules tests/auth-boot-v96.mjs
node --experimental-vm-modules tests/ui-smoke.mjs --startup-race-only
npm run test:accounts
npm run test:social
```

`EXPORT_MANIFEST.json` describes the original October 25 export, not current repository checksums. `public/source-manifest.json` is the current loading manifest. Older package/export labels are historical; this guide identifies the current source update.

Third-party asset credits remain in `public/credits.html` and the license files alongside their assets.
