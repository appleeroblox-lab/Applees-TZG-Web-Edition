# The Zero Gravity Web Studio

## Current change

The Studio access migration creates an empty developer allowlist and private unlock storage. It binds a hashed unlock token to the authenticated game session, expires it after ten minutes of inactivity, and throttles failed password attempts per developer. Deleting the game session revokes its unlocks. The access test runs with `node tests/studio-access.mjs` after installing dependencies in `tests/`.

The private draft migration adds password-verified writes, revision conflicts, draft history, and restoration. It does not promote drafts to the game. The Model Studio material adapter accepts existing model JSON and preserves geometry, part names, and colliders. The isolated Worker entry and protected Model Studio preview currently support editing SolarFlare materials, undo/redo, private draft saves, and restoring a draft revision. UI Studio, Planet Studio, the remaining Model Studio tools, and production publication are still pending. The Worker has not been deployed.

## Public site and Studio routing

The GitHub Pages deployment uploads `public/` wholesale. Keep Studio pages, editor bundles, and private upload storage outside that tree. Route `/studio/*` through a Worker on the existing domain while keeping the current public origin. The editor Worker must gate asset delivery as well as application API calls. Disable alternate public entry points for private assets. The account/password prompt can be a minimal public entry shell.

The game's browser session uses the existing Supabase project and the `tzg-player-session-v1` auth storage configuration in `public/auth-first.js`. Read the same session from the entry shell and present its access token to the server. Keep the Studio unlock in page memory, clear it on sign-out, and avoid background refreshes that extend the idle timeout. Each mutation must validate the unlock and verify the newly submitted password in its write transaction. Provision the owner by verified Supabase Auth UUID, resolved once from game profile `TZG-Id_39`. A provisioned account with no password can set it once through `tzg_studio_set_initial_password` from an active signed-in game session. The database hashes the password and rejects subsequent setup attempts.

## Game adapters

| Editor | Reuse | Work required |
| --- | --- | --- |
| UI | Game markup, styles, and event handlers under `public/` | Identify stable targets in static and dynamically generated menus. Apply validated property overrides without replacing nodes or rewriting handlers. Preview inside an isolated game instance. |
| Planet | `catalog.js`, the additional system modules, and the existing rendering and terrain paths | Expose stable body IDs and body-specific capabilities. Feed the same terrain edits into globe tiles, near terrain, and collision so all views agree. Keep terrain sampling and texture dimensions bounded. |
| Model | `models.js` and the exported assets in `public/models/` | Retain collider data, named parts, and part ranges used by the game. Add adapters for procedurally built models. Convert imports into validated game assets and use a bundled, isolated parser with size limits and external resource loading disabled. |

GLB, glTF, OBJ and FBX need conversion into formats the current runtime consumes. Direct Blender project parsing requires a separate sandboxed conversion pipeline, which this deployment does not currently have.

Drafts should store structured edits against a specific release revision. A publish operation should validate whitelisted targets and values, generate the requested diff, preserve an immutable backup, and promote only after the release checks pass. Keep the main game deploy untouched until the editor route and adapters can be tested against a staging release. Rollback should restore a known revision through the same validation path.
