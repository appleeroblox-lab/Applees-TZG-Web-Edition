# World and interface update 98

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

Distant fields use 13,000 points total. Nearby rocks use eight shared Blender templates and eight instanced draw calls. Bounds are 54 rocks on mobile/compatibility or Low, 81 on desktop Medium, and 250 on desktop High. Neighbor-cell placement is deterministic. No local field rebuilding occurs while warping or travelling above 3,000 game units/s. Labels are capped at six nearby field rocks and can be disabled separately through Asteroids Labels. Solid terrain, grass and building budgets retain their prior controls.

## Collision and settlements

A spatial hash indexes solid blocks/doors, visible scenery components and station/base geometry. The index rebuilds only when its body or source revisions change. Crew movement queries nearby cells, supports rock/block surfaces, respects door rotation and checks overhead solids. Grass triangles never enter this index.

Ship motion sweeps its rotated full wing/hull envelope against candidates, so a frame's endpoint cannot skip a thin wall. Contact cancels inward velocity. Descending onto a supporting roof parks the ship with stable subsequent ground contact. Base collision bounds come from the exported Blender objects. Base footprints are reserved against scenery and resource-node spawns. Collision is conservative around tree canopies and rounded base components.

Village house footprints and the original six house positions remain unchanged. Six more houses and connected local streets extend each settlement. Existing generated block identities remain stable; removed blocks and doors continue to persist through the prior compact world-save mechanism. Earth has ten villages so all five biome themes occur; other solid worlds retain eight. Village loading remains bounded around the viewer and solid blocks remain instanced.

## Validation

Passed the complete `npm test` gameplay suite, the new `tests/world-update.mjs`, the shared-auth integration tests, and startup checks covering delayed ship loading and authentication before preloading. New coverage includes thin-wall ship sweeps, roof parking, immediate door updates, tree/rock collision, grass exclusion, 12 unchanged-size houses, all biome themes, valid Blender data, native base bounds, three local belt regions, deterministic instancing, mobile caps and saved asteroid-label settings. Model renders were visually inspected. Every preload asset exists and authored JavaScript syntax checks pass.

The existing social v79/v81 assertions described in `ROBLOX_MEDIA.md` remain unrelated baseline failures. Real browser/device FPS and a live-account playthrough were not measured in this environment; DOM/startup tests and Blender renders do not substitute for physical-device testing.

No new SQL is required. The existing Supabase setup, player inventory/currency saves, account requirements and sound import status are unchanged.
