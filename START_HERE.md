# The Zero Gravity – Web: complete source export

Export date: 2026-10-25. Latest saved Site version: **61**.
Source commit: `cd1f7937a6267d0b07a36396c36d459da3c0f01d`.
The internal game/package version is 59; this is preserved exactly. Site version numbers and game version numbers are separate.

## Included

Every tracked source file from this commit, byte-for-byte: `public/` HTML, CSS and JavaScript; bundled Three.js; local textures, sky images, sounds, icons, Fredoka fonts, exported models and ship textures; both native Blender scenes and model-generation scripts in `assets/blender/`; server/API source, database schema, project configuration, dependency lockfile, tests and original documentation.
`EXPORT_MANIFEST.json` records the original paths, byte sizes and SHA-256 checksums. This export adds only this guide, that manifest and a GitHub Pages workflow. No gameplay code or recent fix was rewritten.

## Upload to GitHub

1. Extract this ZIP.
2. Upload the **contents** of `The-Zero-Gravity-Web/` to your repository root, including `.github/`, `.openai/` and `.gitignore`. Git command-line upload includes these hidden folders reliably.
3. Keep the default branch named `main`, or update the workflow's branch setting.
4. For a playable static site, open repository **Settings → Pages → Source → GitHub Actions**.
5. Push to `main` or run **Actions → Publish game to GitHub Pages → Run workflow**. The deployment provides the game URL.

The workflow publishes `public/` directly. No Node package installation or build is required for the static game. Local module and asset paths remain relative so repository subdirectory hosting is supported. Keep all files inside `public/` together.

## Play locally

From the extracted project root:

```sh
python3 -m http.server 8000 --directory public
```

Open `http://localhost:8000/`. Use an HTTP server; double-clicking `index.html` is insufficient for module and asset loading.

## Server-backed features

GitHub Pages serves static files only. The current developer Debug Menu authorization uses `/api/debug/*`, trusted identity headers, a D1 database and server environment configuration. Its original client/server code and schema are included unchanged, but its login and authorized commands require a compatible backend and authenticated hosting. GitHub Pages alone cannot run these endpoints. Do not bypass those checks or trust identity headers supplied directly by a visitor.

For the original server application, use Node 22.13+ and the pnpm version declared in `package.json`, install with the lockfile, then use the existing `dev`/`build` scripts. See `README.md`, `vite.config.ts`, `.openai/hosting.json`, `worker/`, `app/api/`, `server/` and `drizzle/`. The existing Site ID is retained as source provenance; do not reuse it to create an unrelated hosted Site. Backend deployment requires its own database, identity integration and environment configuration.

Live database contents, authentication sessions and hosting secrets are not project assets and are not exported. Existing browser saves remain on their original browser and origin; a new GitHub Pages origin starts with separate browser-local storage. Player account/global chat requests are not implemented in this saved source version.

## Verification

- Original tracked files compared byte-for-byte to the source commit.
- All loading-manifest assets are present.
- Authored top-level JavaScript modules pass `node --check`.
- Recent v57/v58/v59 regression checks and debug-service security checks passed.
- The full `npm test` run passed its initial simulation checks, then stopped at the missing development dependency `linkedom`; remaining DOM/UI checks and a browser play-through were not performed for this export. Install declared dependencies before running the full suite.
- ZIP integrity and archived source checksums verified.

The original asset credits and licenses remain included. See `public/credits.html` and the source/license files beside their assets. Review those terms before redistributing third-party assets.
