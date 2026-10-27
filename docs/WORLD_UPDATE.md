# World and interface update 100

Play: https://appleeroblox-lab.github.io/Applees-TZG-Web-Edition/index.html

The user's supplied square image is retained visually as a 512px WebP game icon, with 192px/32px PNG app/browser variants. No new art was substituted. The loading poster and top-left settings button use that image. The original sign-in card remains, with the loading screen's dark background and repeating rocket pattern. Wallet art is 24px on desktop and 20px on mobile; the game-logo button is 26px on mobile. Chat retention text occupies one compact 16px line, leaving message lists flexible.

## Models and destinations

Run the source generator with Blender 4.2 or compatible:

```sh
blender --background --factory-startup --python assets/blender/build_world_models.py
```

`assets/blender/small-bodies.blend` contains 35 independently editable shapes. `base-lunar.blend`, `base-mars.blend`, `base-mining.blend`, `base-venus.blend`, `base-ice.blend` and `base-garden.blend` are native base scenes. The corresponding browser meshes and base collision bounds are under `public/models/`. Meshes use local material colors and do not depend on external texture servers.

Named irregular/ellipsoidal bodies use their own meshes. Haumea is elongated; Arrokoth uses two joined lobes. Phobos has a crater depression. Shapes for poorly resolved objects are artistic illustrations, not measured reconstructions. Existing Phobos/Deimos surface maps remain usable on their new geometry.

Zoozve appears near Venus for accessible gameplay, with a clear quasi-satellite description. It is not presented as a bound natural moon. Background fields and orbital phases are schematic. Oort Survey 01–08 are fictional examples of icy objects, not claims of eight observed Oort Cloud bodies.

Science references used for classification and shape context:

- https://science.nasa.gov/venus/venus-facts/
- https://science.nasa.gov/dwarf-planets/haumea/
- https://science.nasa.gov/mars/moons/deimos/

## Belts and performance

The main belt is represented between 2.1 and 3.4 AU, the Kuiper Belt between 30 and 50 AU, and the spherical Oort field between 2,000 and 50,000 AU. These are illustrative regions rather than a live ephemeris. Named destinations remain searchable in Universe Map, and its asteroid filter includes Kuiper and Oort objects.

Distant point fields are removed: belts have no visible overview ring. Nearby rocks use eight shared Blender templates and eight instanced draw calls. Bounds are 54 rocks on mobile/compatibility or Low, 81 on desktop Medium, and 250 on desktop High. Neighbor-cell placement is deterministic. No local field rebuilding occurs while warping or travelling above 3,000 game units/s. Labels are capped at six nearby field rocks and can be disabled separately through Asteroids Labels. Solid terrain, grass and building budgets retain their prior controls.

## Collision and settlements

A spatial hash indexes solid blocks/doors, visible scenery components and station/base geometry. The index rebuilds only when its body or source revisions change. Crew movement queries nearby cells, supports rock/block surfaces, respects door rotation and checks overhead solids. Grass triangles never enter this index.

Ship motion sweeps its rotated full wing/hull envelope against candidates, so a frame's endpoint cannot skip a thin wall. Contact cancels inward velocity. Descending onto a supporting roof parks the ship with stable subsequent ground contact. Base collision bounds come from the exported Blender objects. Base footprints are reserved against scenery and resource-node spawns. Collision is conservative around tree canopies and rounded base components.

Village house footprints and the original six house positions remain unchanged. Each settlement has six houses and a short central street. Generated settlements are selected at the update-100 wider spacing. Player-placed blocks stay at their saved positions; removals/doors at retained site IDs still use the compact world-save mechanism. Earth has ten villages across all five biomes with the same wooden style; other solid worlds retain eight. Village loading remains bounded around the viewer and solid blocks remain instanced.

## Validation

Passed the complete `npm test` gameplay suite, the new `tests/world-update.mjs`, the shared-auth integration tests, and startup checks covering delayed ship loading and authentication before preloading. New coverage includes thin-wall ship sweeps, roof parking, immediate door updates, tree/rock collision, grass exclusion, 6 unchanged-size houses, all biome themes, valid Blender data, native base bounds, three local belt regions, deterministic instancing, mobile caps and saved asteroid-label settings. Model renders were visually inspected. Every preload asset exists and authored JavaScript syntax checks pass.

The existing social v79/v81 assertions described in `ROBLOX_MEDIA.md` remain unrelated baseline failures. Real browser/device FPS and a live-account playthrough were not measured in this environment; DOM/startup tests and Blender renders do not substitute for physical-device testing.

No new SQL is required. The existing Supabase setup, player inventory/currency saves, account requirements and sound import status are unchanged.


## Update 99 corrections

Mining hits increment the economy/save revision without invalidating village meshes or static collision cells. Mineral depletion no longer invalidates every streamed tree/grass mesh. Tree removal has its own scenery revision. Mineral collision candidates are checked dynamically so collected nodes disappear immediately. The redundant forced inventory rebuild on every pickaxe strike is removed.

Guided Land searches concentric rings up to 160 meters for an unobstructed full ship footprint. If necessary it climbs, moves above the safe site and descends. Existing manual-flight collision remains solid. The search can decline when no clear site exists in that radius.

Vesta, Pallas, Hygiea, Eros, Ida, Gaspra, Itokawa, Bennu and Ryugu are landable named main asteroids. Other newly added minor objects are flyby-only, while existing planets, dwarf planets and moons retain landing. Procedural belt rocks never generate a surface session. Main/Kuiper/Oort regions retain nearby instanced rocks and optional nearby labels, without an artificial distant luminous ring.

Regression coverage checks retained scenery/collision allocations while mining, safe landing beside an obstacle through the actual simulation, named asteroid landing restrictions and absence of distant overview geometry. Real device FPS remains unmeasured.


## Update 100: mobile village, snow and installation

Village centers are at least 650 m from launch and each other, within 1900 m. Six original-size houses use the same wooden walls/floors and log roofs in every Earth biome. Existing hand-placed blocks are unaffected by procedural site selection.

Weather blockers cache block bounds by body, placement revision and source array, with 8 m cells. Repeated stationary queries retain the same result/index; roof and patch clipping use nearby cells instead of scanning thousands of blocks for every patch. Mobile village residency uses a one-chunk discovery radius and village solids render within 180 m (130 m for fine details), avoiding work on settlements hidden in fog. Mobile ground weather is bounded to 64 patches at two updates per second. Active buffer ranges replace full weather-buffer uploads. Tree snow uploads only changed canopy vertices once the snow-cover change reaches 1%, and never re-uploads grass colors each second. Mobile High shadows use 512px maps and a four-Hz update budget. Other High settings remain selected.

Snow/water polygons split on the actual terrain grid and triangle diagonal, avoiding large fans crossing slopes. Four-channel terrain texture weights prevent the previous numeric interpolation from passing through sand at grass/snow borders. Spruce snow cap geometry now matches its 0.8-scale canopy.

The boot loader captures `beforeinstallprompt` before account/loading waits. Successful account hydration emits `tzg-signed-in`; after loading, an automatic in-game install invitation appears once. Settings → Display → Install Game is always available unless already installed. A button tap invokes a saved native browser prompt once. Unsupported browsers receive menu instructions; dismissals snooze automatic invitations for seven days. This adds no offline-play promise or service-worker caching of account data.

Browser references:
- https://web.dev/learn/pwa/installation-prompt
- https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent/prompt

Validation: `tests/mobile-world-update.mjs` checks village spacing/style, cached shelter identities and bounded candidates, GPU upload ranges, triangle-plane agreement, biome weights, early install capture, deferred sign-in invitation, user-action native prompt, dismissal/manual fallback and installed state. `node scripts/benchmark-ground-weather.mjs` exercises mobile High weather against a real generated village and reports median/p95 CPU update time. It uses a stub Canvas context and does not measure device FPS or GPU timing.
