# Sphere Test planetary sandbox (v0.0.158)

Open Settings → Debug, authenticate with an existing authorized developer account, choose Developer → Experimental. The separate **Experimental System** contains **Sphere Test** (2,000 m sea-level radius) and its lighting star. It never joins the public body catalog, map, search, routes or paid warp destinations. No account/schema migration is required.

## Bugs found in v156

- Experimental rendering bypassed the normal HUD updater without providing a full replacement. Entering from parked Earth left mobile flight pads hidden and brake/boost controls disabled; gear, altitude and speed displays remained stale. The experimental HUD now derives all control visibility and telemetry from its own ship/walker state and restores the previous UI on return.
- WASD was used both for walking and camera steering. W pitched the view toward the ground; A/D turned it while strafing. Walking and look inputs now have separate bindings, tested through the real keyboard/controller path.
- The orbital camera recreated its basis from fixed global -Z. Passing through that direction could reverse the basis. It now parallel-transports the existing frame across poles/equator. The previous chase framing also left the planet entirely outside the viewport at orbit arrival; altitude-aware framing now keeps it visible. Terrain camera correction is followed by exact recentering.
- The old terrain rendered separate patches, switched their topology without morphing and hid mixed-LOD gaps with skirts. Collision used an independent analytic noise radius, rather than the displayed triangles. Terrain is now batched, edge-welded and morphed, with collision sampled from the same positions and morph fraction as rendering.
- Gravity was canceled by flight assist; a supposedly orbital craft could lose its trajectory to damping. Vacuum gravity is now always inverse-square; assist does not cancel it or damp orbital velocity. Launch/landing orientation changes gradually.
- The fixed 4.23 m contact height belonged to the original game's upright parked pose, while the experiment displayed a horizontal hull. The experiment now measures its own loaded model and uses orientation-dependent hull support, preventing that hovering gap and nose/wing penetration of a local ground plane.

## World and physics

Positions, velocities, terrain samples and gravity use planet-centered meters. Rendering subtracts the ship/walker's position as a floating origin; cameras, model placement and terrain use that same origin. No original flat terrain or fake Globe Mode is used for Sphere Test.

The continuous deterministic 3D height field generates mountains, valleys, plains, deserts, polar terrain and ocean basins. Six cube faces cover the entire surface. Balanced neighboring LOD patches differ by at most one level, and T-junction vertices match the adjacent coarse triangle. Both the start and end geometry of a transition are welded to the replacement topology, including coarsening. A complete replacement is generated before activation; geometry morphs for half a second. Surface collision includes that exact morph, independently checked against Three.js raycasts. Distant coarsening uses smaller projected detail; this is not a promise of pixel-identical geometry at every LOD.

Terrain uses one mesh draw, plus one optional chunk-boundary draw. Mobile builds two patches/frame with resolution 12 and maximum level 6; PC builds four/frame with resolution 16 and maximum level 7. Active leaf caps are 384 / 640; one pending replacement may coexist while streaming. Unchanged patch positions are reused when packing replacements. Old GPU geometry is disposed after activation, and all experimental resources are released on return. Regeneration also builds a replacement incrementally. Warp time prewarms the destination terrain.

Gravity is 9.81 m/s² at sea level and decreases with inverse-square distance. Integration uses substeps no longer than 1/120 s. Circular orbit arrivals use the matching tangential velocity and ship heading. Atmosphere/clouds, a four-minute day/night lighting cycle, reentry flares and the existing audio/postprocessing pipeline are retained in this isolated scene. Test atmosphere height is 1 km; effect-stage altitude is scaled only here. Experimental flight tuning uses a smooth 450 m/s atmospheric cap transitioning to 2,000 m/s in space, or 4,000 m/s with boost. Original gameplay physics and speed limits are untouched.

## Controls and debug travel

All nine existing Experimental buttons remain functional:

- Warp to Experimental System: 9 km above the polar terrain.
- Warp to Sphere Test / Planet Orbit: circular orbit, 2 km above polar terrain.
- Warp to Planet Surface: parked on the dry polar site.
- Return to Previous System: restore the original location, velocity, orientation, target and UI; resume the frozen original surface/walking session.
- Toggle Gravity Vectors; Show Planet Coordinates; Show Active Terrain Chunks; Regenerate Test Terrain.

Debug travel uses the original curved warp tunnel, timer and white transition on an isolated transit object. Arrival/return reveals the ready scene through a short white fade. Travel costs **0 FP / 0 RC**, including from the atmosphere or with an empty wallet, without invoking the normal paid navigation path. Finish one transition before starting another.

Ship: Space/Ctrl or Thrust/Slower pads for forward/reverse thrust; WASD/roll controls for attitude; climb/descent thrusters; G gear; V assist; X brake; B boost in space. L / Launch lifts a landed ship and smoothly prepares its climb attitude. Land works below 800 m over dry, suitably level terrain. Fly retrograde to reduce orbital velocity before descent. There is no automatic deorbit/orbital-insertion autopilot.

F / Leave ship after landing. WASD or the left stick walks, Shift/Run runs, Space/Jump jumps. Walking does not turn/pitch the view; drag/right-stick look remains separate. Return within 12 m to board. C / Camera cycles Chase, Cockpit, Orbit and Flyby; orbit drag and pinch/wheel zoom remain available.

## Authorization, data and original-game isolation

The existing developer service authorizes every command. Before loading/entering, each experimental action and periodic heartbeats receive remote authorization. A 45-second lease renews every 30 seconds; logout, expiry, denied renewal or timeout restores the original location. Existing Supabase enabled-admin/live-session checks and the private server developer-session path are reused. No new allowlist, public destination RPC or account permission is added. The browser implementation files are public static code, not secret server assets or protection against a modified offline client.

Normal physics, progression ticks and save writes pause while the experiment owns rendering. The original world is retained in memory, never replaced. Travel does not spend currency, award progression, change inventory or write experimental state into player/account saves. Main-game navigation/economy actions resume after return. Normal planets, terrain, Globe Mode, public Universe Map and backend schemas are unchanged.

## Verification and current limits

`npm run test:experimental` verifies shared spherical coordinates, pole transport, welded boundaries, actual mesh/morph raycast collision, complete bounded PC/mobile terrain, deferred regeneration, resource disposal, native deorbit/landing/launch, orbital conservation and a full planetary walking circuit. Main-game UI fixtures test authorization denial/expiry/revocation, live WASD controls, mobile pad visibility, all camera modes, free travel, state restoration and unchanged save/currency data.

`npm run test:experimental:webgl` runs an optional real Chromium/WebGL main-game fixture at mobile and desktop sizes. It loads the actual model/shaders/assets, performs native retrograde descent and landing, keyboard walking without view drift, launch/thrust back to space, all debug actions, free return with an empty wallet, and original Earth Globe Mode. Its local HTTP response substitutes offline account/debug gateways only for testing; production authentication is not modified. It records screenshots in the temporary directory (or `TZG_WEBGL_OUTPUT`). Install Playwright/Chromium separately and set `TZG_PLAYWRIGHT_MODULE` and `TZG_CHROMIUM_PATH` if they are outside the project. `TZG_CHROMIUM_ARGS` optionally supplies a JSON array of launch flags.

Real WebGL checks here use headless Chromium/SwiftShader, not a physical mobile GPU or a live developer login. Physical-device FPS and driver-specific behavior remain unmeasured. This is a single-planet development sandbox with scripted stellar lighting, not Juno's complete orbital/N-body engine. Terrain has procedural biome colors, not high-resolution planetary texture maps. Water surface movement is simplified; there is no underwater/swimming simulation. Original mining, buildings, settlements and the flat-world minimap do not run on Sphere Test. They remain available in normal gameplay after return. Experimental terrain/position is not persisted across reloads.

The final v158 camera-clearance guard is covered by the CI camera fixtures, including an opposing radial/chase-offset pose and near-ground orbit correction. The headless WebGL journey runs described above were performed for the v157 rework; the hosted workspace became unavailable before another browser run of this final guard.
