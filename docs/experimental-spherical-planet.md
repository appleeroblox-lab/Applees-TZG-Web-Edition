# Experimental spherical planet (v0.0.156)

Start the game, open Settings → Debug, and authenticate with an existing authorized developer account. In the Developer tab, use **Experimental**. No new account role, password, database migration or player-save format is introduced.

## Travel and diagnostics

- **Warp to Experimental System**: arrive 9 km above the north-pole terrain.
- **Warp to Sphere Test / Planet Orbit**: arrive 2 km above terrain with a circular orbital velocity. Flight assist is off so radial gravity can sustain the orbit.
- **Warp to Planet Surface**: arrive parked at a dry, level polar site.
- **Return to Previous System**: restore the original system, target, ship position, orientation, velocity and controls. The original surface session and walking state remain frozen in memory throughout the experiment.
- **Toggle Gravity Vectors**, **Show Planet Coordinates**, **Show Active Terrain Chunks**, and **Regenerate Test Terrain** operate exclusively on the experimental scene. Regeneration increments its in-memory seed; no normal terrain or saved world edits are changed.

Travel uses the existing `Flight.stepNavigation`, curved `WarpTunnel`, timer and white warp transition on a separate transit object. It never calls the paid normal navigation path. All experimental trips cost **0 FP / 0 RC**, regardless of distance or the original player's balance/location. Finish a debug warp before starting another. Normal navigation and economy actions are unavailable until return.

## Planet and controls

Sphere Test has a 2,000 m sea-level radius, continuous deterministic 3D terrain, dry plains, ridged mountains, valleys, forests/deserts, polar ground and oceans. Six cube-sphere faces subdivide into terrain chunks. Neighboring samples share the same height function; skirts conceal mixed-LOD edges. A parent remains visible until all four children have geometry. Generation is limited to 4 chunks per frame on PC / 2 on mobile, with cache caps of 640 / 320 nodes and explicit disposal on return/regeneration. The same curved surface is used at every altitude; there is no flat surface or duplicate ground sphere.

Gravity is radial and follows inverse-square acceleration, with 9.81 m/s² at sea level. Walking and ship collision use the continuous terrain function rather than individual mesh bounds. Movement uses 120 Hz substeps and a floating rendering origin. Local camera up follows the planet without replacing the existing camera implementation.

- Ship: existing steering/roll controls, Space/Ctrl or touch forward/reverse for thrust, climb/descent controls, G gear, V assist, B boost, X brake.
- L / Launch lifts a parked ship. Land starts a guided descent below 800 m over dry, suitably level terrain. A gentle gear-down contact can also park the ship.
- F / Leave ship starts walking after landing. WASD/left stick walks; Shift/Run runs; Space/Jump jumps. Return within 12 m of the ship and use F / Board.
- C / Camera cycles Chase, Cockpit, Orbit and Flyby. Drag and pinch/wheel retain camera/look controls.
- A moving star provides a four-minute day/night cycle. A lightweight atmosphere/cloud shell and existing reentry plume/audio are reused. Test atmosphere height is 1 km; effect-stage altitude is scaled only in this isolated scene.

## Authorization and isolation

The debug menu authorizes the command remotely before execution. The controller additionally requests a server-authorized `experimental heartbeat` before lazy-loading/entering the scene and for every experimental action. While active, it renews a 45-second lease every 30 seconds. Local developer logout/expiry restores the prior location immediately; failed renewal or lease expiry also restores it. The existing Supabase `tzg_debug_authorize` checks the enabled developer allowlist and live authenticated session. The existing server debug-service path checks its own developer session. No client allowlist, URL parameter, public warp entry or new public destination RPC grants access.

The public body catalog, system registry, search, map and normal warp destinations never receive experimental bodies. Like all static browser game code, the implementation files are inspectable; they are not secret server assets or a protection against a modified offline client. Authorization protects the supported online debug entry path.

Normal simulation, progression ticks and save writes pause while the experiment owns rendering. Original terrain, Globe Mode, accounts, inventory, currency and Supabase player data are not modified by experimental travel. Original world objects stay in memory and resume after return. Experimental resources and UI overlays are disposed; asynchronous ship loading also disposes resources if the scene has already closed.

## Current experimental limits

This is a separate development sandbox, not a progression destination. Original mining/buildings/settlements and the flat-world minimap do not run on Sphere Test; their normal-game behavior resumes on return. The test world/seed is not persisted. Water provides a simplified surface movement model, not an underwater/swimming simulation. Terrain uses procedural biome colors rather than the original planets' texture assets. WebGL is required; compatibility rendering continues to work for normal gameplay. Chunk skirts cover visual LOD joins, while analytic collision remains continuous; coarse distant mesh heights are approximations of the continuous collision surface.

Automated checks cover radial gravity and collision on all hemispheres, shared terrain edges, local-up walking/jumping and a full planetary walking circuit, circular orbit, complete bounded mobile/PC LOD coverage, authorization denial/revocation, the real runtime/tunnel/camera integration in mobile and desktop DOM fixtures, normal-state/currency/save isolation and cleanup. These fixtures do not measure physical mobile GPU performance or replace a real-device visual review.
