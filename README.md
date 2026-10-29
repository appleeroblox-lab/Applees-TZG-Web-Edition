# The Zero Gravity — Web Edition

Current game: **v0.0.115**. Start with [START_HERE.md](START_HERE.md) for current hosting, backend status and validation instructions. GitHub Pages serves `public/` after the CI checks pass.

## v0.0.115 planet lighting and world-space clouds

Atmospheric in-scattering now follows the star direction and cannot exceed the incoming lit surface brightness. It does not add self-illumination to the planet's night side. Cloud positions no longer include the viewer/player origin. Native and compatibility renderers project the same wind-driven world positions; the screen-space Earth cloud passes were removed. Regressions cover star direction, unchanged material emission, world position invariance, actual ship/on-foot movement and PC/mobile startup. Native WebGL visual/device QA remains unavailable here.

## v0.0.114 shared spherical atmosphere

Terrain, the transition globe and the opaque ground backing now obey local distance fog and share one spherical haze model. It integrates exponential atmospheric density along the view ray using 2–6 samples and the same physical-height conversion in surface and space. This keeps lower-atmosphere haze present when looking down from a dark overhead sky. Fog ranges open continuously with altitude, and horizon clearing follows the 4,000–5,000 m geometry blend. The unfogged legacy halo and black material/fog tint hacks have been removed. Sky light objects retain their existing rendering.

Reference: [Juno's official 1.4 release notes](https://www.simplerockets.com/Releases/View/340106) describe sky/atmosphere scattering, scaled-space lighting and transition fixes. This game's implementation uses a bounded sampling approximation suitable for its existing renderer. Regression tests cover fog bindings on actual transition layers, weather extinction, surface/space optical-depth equivalence, altitude continuity and mobile budgets. Native WebGL visual/device QA remains unavailable in this environment.

## v0.0.113 nearby Earth transition and stronger reentry

The terrain/globe blend now starts strictly above 4,000 m and completes at 5,000 m. A larger near-planet radius keeps Earth against the horizon at exit, with an opaque closed ground shell behind streamed terrain to seal dissolve holes. Sky fading still completes at 3,000 m. Reentry has brighter hull glow, longer turbulent sparks, a second bow-shock layer on desktop Ultra/Ultra+, and stronger bounded translation shake across ship cameras. Native WebGL visual/device verification remains outstanding in this environment.

## v0.0.111 extended atmosphere and reentry

Atmospheric worlds extend to 5,000 m. The sky reaches space colors by 3,000 m, with a depth-preserving terrain/globe dissolve and a matched surface/space planet size. Entry starts at up to 50 m/s; the upper band is limited to 100 m/s. Below 800 m, descending flight can accelerate to 450 m/s; ascending ships ease down before crossing the upper band. Landing remains restricted above 800 m.

Airflow-facing hull glow, thin plasma shells, sparks and fiery streaks peak at 1,500–1,000 m, fade by 800 m, and cause no damage. Ascent effects are weaker. Camera shake uses a smooth local translation after camera placement; entry preserves the selected camera and orbit zoom. High and above add subtle heat distortion; Ultra/Ultra+ increase surface glow detail. Low/Medium disable shell draws and distortion, and mobile particle budgets remain bounded. White space wing trails and their saved toggle are preserved.

Validation: gameplay, accounts, social, onboarding/reward SQL, mining migration, auth-first startup and UI regression suites; PC/mobile atmosphere checks cover globe blending, landing guards and camera preservation. Browser preview in this environment falls back to the compatibility renderer and lacks a secure context, so native WebGL visual/device verification remains outstanding. No Supabase migration is needed for this release.

The notes below are historical release records; older hosting instructions and gameplay values describe those releases.

## v17 visual and mining fixes

Star glare checks opaque planets (including gas giants), ship geometry, local buildings, celestial bodies and terrain. The glare overlay also masks foreground silhouettes so the corona cannot paint over nearby objects. The loading bar stays centered independently of its spinner, which hides at completion. The title button uses the main blue HUD treatment; inventory item art is centered.

Mining reach is 18 m. On-foot mining works with empty hands and other held items as well as the pickaxe, with the same cooldown/range/depletion checks. Runtime names, labels and Blender mineral assets use Mineral instead of Deposit; save IDs and cargo keys remain compatible. The pickaxe stroke moves forward, inward and downward from the right-hand rest pose.

Universe Map replaces the old atlas title. Map grid/orbit segments are clipped to all six frustum planes before perspective division, avoiding the long lines generated by behind-camera points at close zoom. Space engine fire stays visible while coasting and turns off when the ship stops.

## v16 flight, atlas and menu update

Right flight controls are larger: a tall Thrust control, shorter Slower control, and Stop alongside Thrust. Hold or click to change a retained forward speed command; release keeps speed and Slower stops at zero. Normal/boost limits are 150/450 m/s on surfaces and 55/320 game units per second in space. Stop clears the command and velocity. Surface forward follows the Blender rocket’s local nose (+Y after its surface rotation), with no camera dependency. Engine flames pivot exactly at the Blender bell outlet (z=1.56) in both renderers.

The atlas uses a perspective 3D camera, compressed system coordinates, an orbital plane, depth-sorted spheres, drag orbit, pan toggle/right drag, pinch/wheel zoom, focus and fit. Labels avoid collisions. Each external-galaxy exploration scene has a separate illustrated sky profile. Solar and nearby-star scenes retain the ESO Milky Way photograph. Star glare now adds a visible corona and rays, with foreground-planet occlusion in space.

More is a scrollable list containing travel and utility actions. The game-name button opens Settings; the separate settings icon is removed. Leave, Restart and Resume appear at the top, with a graphics slider and four creator links. Free camera uses the default movement thumbstick and a left-side speed slider, with ship controls hidden. Startup preloads all game sources and bundled assets, reports real file progress and percentage, then enables Play.

New Horizons Pluto/Charon, Cassini Titan and Dawn Ceres maps replace the lunar stand-ins. NASA source pages, mission credits and coverage notes are recorded in textures/EXTENDED_SOURCES.json. Unresolved bodies (including Makemake) have distinct illustrations, not claimed real maps. Orcus, Quaoar, Sedna and Gonggong are marked dwarf-planet candidates.

Validation: complete simulation and module UI smoke suites, retained-speed/Stop and body-axis regression tests, atlas projection/sky tests, browser startup/settings/atlas interactions, and an 844×390 landscape UI check. Browser QA used the compatibility renderer; physical touch sensors and native WebGL still need device testing.

## v15 control and inventory fixes

Cargo uses a dedicated vertically scrolling grid, preserving the scroll position while selecting and equipping. All dialogs use the main blue glass palette. The hotbar contains at most seven items including the pickaxe, with keyboard slots 1–7. The inventory toggle is centered above it.

The left flight pad pitches, yaws and rolls the ship; thrust stays on the right. Camera cycles through chase, cockpit and stable orbit, which follows position without rotating with the ship and supports independent drag. Launch and its five-second number countdown are centered; 5–4 is green, 3–2 yellow, 1 red. Board appears at center left only in boarding range. Jump and thumbstick sizes have persistent sliders in Settings; Run sits beside Jump. Mining reach is 30 m and world labels update without button movement transitions.

Validation: simulation and module UI smoke tests pass, including countdown stages, rotation without pad translation, independent stable camera, boarding proximity, seven-slot limit and saved sizes. This revision's cloud browser preview was blocked by the browser security policy, so touch scrolling and visual layout still need an on-device check.

# The Zero Gravity - Web — Reference HUD / Model Rework

The v14 HUD follows Applee’s four reference screenshots: two currencies centered at the top; location beneath; blue and white inventory with an on-foot hotbar; parked Launch/Leave controls; flying direction, roll, thrust and brake controls. Touch camera look uses canvas drag, and the right camera stick has no handlers or visual presence. Boost is a persistent selection beside the speed bar and applies only while moving. Inventory cannot open aboard.

The rocket, curved pickaxe, compact crystal deposits, and Earth trading hall were built with Blender 4.5.14. Rebuild with `blender --background --python assets/blender/build_models.py`; the native scene is `assets/blender/zero_gravity_models.blend`. Exported triangle data loads locally without a GLTF runtime dependency, and the pickaxe thumbnail is rendered from that model. The compatibility renderer projects the same meshes.

Mining reach is 30 m with a strict distance boundary. Resource radii are 0.42–0.54 m, collision bounds follow the reduced meshes, the parked rocket uses a 1.65 m radial collider, and the trading hall has matching wall bounds. Earth Trade appears only as a world-space billboard on the central building ahead of the pad. Existing cargo, balances and saves retain their storage keys. First person renders only the equipped right-hand item.

Outer worlds use smooth textured spheres; adaptive exterior terrain patches and silhouette noise are disabled. Body labels track above the apparent radius each frame. Named stellar systems have distinct light tint/intensity, and the photographic sky has sparse soft glints with stronger stellar halos.

Validation: flight/surface/economy/collision/label tests, finite Blender geometry checks, strict mining-reach tests, DOM integration covering inventory guards and launch/land/boost states, plus desktop and 844×390 compatibility-browser checks. GPU/WebGL and physical device sensor validation are unavailable in the QA browser.

---

# The Zero Gravity - Web — Mining Edition 8

- Earth retains the pilot ship on Pad 01 and adds a separate trading ship at local (18, 0.55, 13). Leave with F; the trading marker and Earth Trade button show distance. Sell from inventory while on foot within 10 m.
- 48 resource types have names, colors, sale values and varying HP (60–300). Each landable body has 24 deterministic deposits with thematic mineral pools. Exoplanet placements and exotic minerals are fictional game content. Deposits show world-positioned name labels, a bar and current/max HP within 48 m on foot.
- Pickaxe is slot 1. Click/tap a visible deposit or aim and press R / Swing. Reach is 6 m, each hit deals 25 HP, with a 0.42 s cooldown. Depleted nodes pay exactly one unit, remain depleted across visits/reloads, and cannot be collected twice. The first-person pickaxe animates; other selected resources appear in hand in 3D.
- I / Inventory opens the cargo grid. Clicking a card or hotbar slot equips/unequips it. Separate selection buttons support multiple sale stacks, select all and deselect all. Search and name/value/quantity sorting are included. Selling a stack sells its full quantity. FP payout is each unit’s catalog value; every sold unit adds 2 RC. Partial sales retain remaining cargo and depleted nodes. When a sale empties cargo, ALL body deposits respawn and partial HP damage resets.
- New accounts start with 0 FP and 0 RC. Earth deposits supply initial funding. Discovery of a new catalog body pays 5 RC once, including arrival or first physical entry; Earth is already discovered. Warping to Earth is always free, including across systems. Other normal warps cost 100 FP. Cross-system warp costs 100 FP + 5 RC. The shared Flight navigation hook also applies to distant approaches, tours and orbit transfers. Bookmarked travel charges the same fee based on its saved coordinate system. Insufficient funds cause no debit or navigation cancellation. Accepted warp charges once; cancelling an already charged warp does not refund it. Manual flight remains free.
- Economy saves under `cosmic-economy-v8`: balances, inventory, claimed discoveries, damage, depleted nodes and respawn cycle. New Flight does not wipe inventory or balances, and distant rescue/reset travel charges the Earth return fee. This remains a single-player browser-local game, without multiplayer/account trading.
- Kenney CC0 sound assets (Interface, Impact, Sci-fi Sounds) supply UI, equip, swing, hit, break, pickup, sale, discovery, warp, countdown, launch, landing, error and footstep effects. Settings includes a persisted effects toggle and volume. The original Google Actions library limits reuse to Google Actions, so it was excluded. Sounds unlock after a pointer/key gesture; audio pools are bounded.
- Tests verify per-body deposits, HP/reach/tool/cooldown, duplicate pickup prevention, inventory equip/selection, full/partial sales, 2 RC/unit, global respawn, one-time discovery, warp charges/denial and safe persistence. Existing flight, terrain, walking and settings/UI regressions are retained. Cloud browser verification uses compatibility graphics; GPU and actual phone audio/motion require device testing.

# The Zero Gravity - Web — Walking Edition 7

- Parked camera look is independent from the ship. Drag the canvas or use the right thumbstick before launching; the grounded hull stays still.
- Leave a parked ship with F or Leave ship. Walk in first person with WASD / the left stick, look by dragging / the right stick, run with Shift and jump with Space (mobile Jump/Run buttons). Terrain, pad steps, ship and base building contact are checked. Board within 8 m with F / Board ship. Launch is blocked while on foot, and leaving is blocked during countdown or flight. Reset returns the player aboard.
- Space and airless surface skies use the photographic 360° Milky Way panorama by ESO/S. Brunier (CC BY 4.0), resized into desktop and mobile assets. The 28,000-point background overlay and fallback synthetic star dots are removed. Atmospheric worlds keep their own daytime skies. Other-system scenery remains artistic; this is an Earth-observed sky panorama reused across destinations.
- UI icons are local Google Material Design SVG assets, Apache 2.0. Icon-only buttons have accessible labels. No Google font/icon CDN is required at runtime.
- Tests cover parked camera separation, leave/board distance and phase guards, walking, jumping, ground/building collision and the existing manual launch/entry behavior. UI smoke checks cover parked drag, first-person controls, launch lock while walking, boarding and loaded icon elements. WebGL is mocked in this suite; browser QA uses the cloud's compatibility renderer. Physical phone sensors and GPU appearance require device testing.

# The Zero Gravity - Web — Surface Edition 6

Serve `dist/` with an HTTP static server. No build step or runtime dependency download is required.

## Current behavior

- First v6 visit spawns on Earth / Pad 01. Use Launch or L for a five-second countdown, VTOL ignition, dust and immediate manual flight control. Abort cancels the countdown or engages guided descent. Land only works inside a landable world. Ground contact applies gravity, removes vertical velocity and damps lateral motion; parked thrust cannot silently launch the ship.
- Crossing a landable sphere boundary enters a separate local meter-scale flat landscape with distant hills. Entry starts airborne at 900 m with manual control. Flight assist counters gravity while airborne; only Land/Return engages guided descent. Airborne saves resume manual flight unless descent was explicitly selected. Local scenes intentionally compress the transition to space: manual climb exits at 1,800 m and places the ship just outside the body. This is a game transition, not an Earth atmosphere simulation.
- Warp, approach, orbit, free camera, saved-location travel, tours and routes are locked while inside. Leave the body to use them. Stars and gas/ice giants remain nonlandable.
- Earth has a blue atmospheric sky and clouds; Mars, Venus and Titan have artistic atmospheric palettes. Airless bodies use the bundled Solar System Scope Milky Way panorama. Unknown worlds default to the space sky rather than asserting an observed atmosphere.
- CF-6 Peregrine has symmetric solid wing geometry, cockpit, twin rear engines, two VTOL thrusters and three landing legs. Fredoka is bundled locally under OFL (see `dist/fonts/OFL.txt`).
- Labels work in ship and camera mode, with separate Solar System, Proxima, TRAPPIST-1, black hole, star cluster, galaxy, nebula and other-system settings. Other-system marker directions are deterministic illustrations, explicitly not measured celestial bearings. Six named galaxies have artistic particle overview destinations; fictional galaxy-themed planets remain separately labeled simulated worlds.
- Optional phone tilt uses a user-gesture permission request where required. Recalibration establishes the neutral pose; screen angle maps pitch/roll controls. Grounded/countdown ships ignore sensor steering. Actual sensor behavior and orientation locks depend on device/browser support.
- Device-local v6 saves preserve surface state safely. Old flight positions are not loaded into the changed surface model. HUD layouts and saved route/place preferences remain available. Saved surface flights resume grounded or descending safely.

## Controls and verification

W/S thrust, A/D strafe, Space/Ctrl vertical, drag look while flying, Q/E roll, Shift boost, L launch, B abort/brake, G gear, J warp, M atlas, C camera. Touch controls and independently draggable/hideable HUD panels are retained.

`npm test` covers flight navigation/collision, terrain and the surface lifecycle. `npm run test:ui` exercises module startup, repeated Settings, independent panel visibility/drag, launch/countdown/abort/ascent restrictions, camera/warp controls, catalog filtering and routes. The UI suite mocks WebGL. Browser QA in the current cloud environment uses the functional 2D compatibility renderer because GPU WebGL is disabled; actual GPU appearance and physical phone sensors require device testing.

Textures and licenses are documented in `dist/credits.html`. Planet spacing uses approximate orbital radii with illustrative phases, not live astronomical positions. Gravity is simplified; warp and all surface landscapes are artistic game simulations.

## Edition 3 — mobile stability, HUD ownership and image assets

Settings no longer composites a blurred WebGL scene; 3D redraws are suspended while any dialog is open. Mobile canvas allocation is capped at 1.1 million pixels even at High. A tiny LRU-style image map cache keeps only two maps (Low/mobile) or three (other mobile quality settings) resident, with serial loading and disposal on eviction. Context loss saves the flight and offers a Safe graphics restart. This addresses identified resource pressure; the original crash cannot be confirmed resolved without a real device test.

Ship information and ship status are independent draggable/hideable panels. Use dotted handles, − buttons, and the persistent ▤ HUD menu. Layout and visibility persist under v3 keys; Reset HUD restores both. The quick visibility menu does not require opening Settings.

The catalog now contains 91 destinations: 26 named stars, four named black holes, five nebula/cluster destinations, the TRAPPIST-1 system, and existing planets/moons/simulated galaxies. Background star geometry supports 28,000 points at High, with reduced counts on other presets; an image-based Milky Way panorama supplies the distant sky. Black-hole radii, accretion disks and bent arcs are artistic approximations. Safe arrivals stay outside the disk. Nebulae can be flown through.

All image maps are bundled in dist/textures. Credits and links are in dist/credits.html and accessible through Settings. Solar System Scope maps are CC BY 4.0, mirrored by homer-jay and Sanghel. The fictional maps are Screaming Brain Studios CC0 assets from OpenGameArt, with the included license. Exoplanet surfaces are imagined. Other moons/dwarf planets borrow a lunar map and explicitly say so. No borrowed texture is represented as measured exoplanet imagery.

Additional verification: npm test runs flight, navigation, collision, black-hole, HUD-bound and pixel-budget checks. After npm install, npm run test:ui uses LinkeDOM plus mocked WebGL to exercise complete startup, repeated Settings open/close, quality changes, render suspension, independent HUD hide/restore, ship-panel drag/persistence and black-hole selection/warp. These checks pass; actual WebGL rendering and phone behavior remain unverified in this environment.


## Edition 4 — planetarium exploration

The default experience now uses a free camera, inspired by the navigation patterns described in the official SpaceEngine user manual (https://spaceengine.org/manual/user-manual-0980/). The Zero Gravity - Web remains its own browser sandbox; SpaceEngine code, UI assets and branding are not included.

Free-camera movement stops immediately when controls are released and supports logarithmic travel speeds from 1 m/s to fictional intergalactic-scale speeds. Use the slider, mouse wheel or +/-; Ctrl+wheel changes FOV. G goes to a selected destination, O starts a persistent orbit, F3 opens object search, H hides the UI, Escape cancels movement/orbit. Existing mobile sticks work in both camera modes. Spacecraft mode preserves the ship simulation, controls and user HUD preferences.

Additional features: compact side toolbar, floating object labels, object centering, constant-radius orbit camera, lower free-camera surface clearance, scene-animation speed, FOV/exposure settings, illustrative Solar System orbit paths, saved viewpoints with deletion/restoration, a seven-destination tour and scene-only PNG downloads. The clean view always provides a Show UI button. Scene animation changes rotation/cloud/disk effects; it is not a date-accurate orbital ephemeris.

Regression tests cover free-camera speed/stopping, navigation event lifecycle, orbit radius/cancellation and speed bounds. UI tests additionally cover camera mode switching, FTL slider, orbit HUD, clean-view recovery, bookmarks and tour entries. GPU rendering is mocked in UI tests; no real browser or physical mobile QA was available. Terrain remains fixed-resolution spheres with image maps and small geometric variation; this is not equivalent to SpaceEngine's terrain streaming or scientific universe simulation.


## Edition 5 — terrain, survey and compatibility

Added six deterministic fictional survey systems containing 30 explicitly marked objects (six stars, eighteen planets, six moons). The catalog contains 121 destinations total. Survey system names and positions are invented, with borrowed texture artwork credited as before.

The WebGL path now replaces the nearest solid world's base sphere with a cube-sphere quadtree terrain group. A deterministic multi-octave height function and crater profiles supply geometry; bounded depth, small tile grids, edge skirts and incremental construction limit resource use. Only one nearby body's detailed terrain is resident. Geometry and material resources are disposed on departure. The height field is fictional even where an observed image map is used; this is not NASA elevation data. Explorer collision clearance uses the same height function. Automatic near-ground speed can be switched off. FPS-based adaptive canvas resolution is bounded by the existing mobile pixel budget.

Refined atmosphere coloring, nearest-star lighting and observer-facing black-hole light arcs. M87* has stylized jets. These remain artistic approximations, not a general-relativistic renderer.

The atlas now supports object-type filters and name/distance sorting. Add up to eight stops to a persistent expedition route. Start visits each destination, pauses briefly, and advances. Cancel/manual navigation stops the route. A survey readout shows world radius, object class and local surface altitude; controls and typography were adjusted for readability.

If WebGL cannot initialize, an explicitly identified Canvas 2D compatibility renderer keeps navigation, atlas, maps, routes and basic planetary views usable with reduced graphics. It does not display the WebGL terrain, ship meshes or full effects. This addresses browser/device configurations where earlier versions could not start at all.

Verification: flight, terrain and UI logic suites pass. Terrain tests verify deterministic heights, bounded subdivisions, finite positions/UVs and disposal. Browser checks ran in the managed Chrome preview: compatibility-mode startup, Settings, atlas selection, adding route stops and starting a route. The managed browser has WebGL disabled, so the full 3D path remains GPU-unverified. Mobile layout uses responsive CSS and existing multitouch handlers; a physical phone was not available.

Body labels are centered at real projected body positions and updated each rendered frame without CSS movement transitions. Only the current stellar system is labeled. Moon labels follow proximity to their parent planet; selecting a distant moon does not expose its labels outside that neighborhood.

Launch revision: 5-second ignition sequence, 120 m/s² vertical input thrust, and per-body compressed exit heights (Earth 800 m, Moon/Europa 180 m, Io 220 m, Mars 450 m, Titan 600 m, Venus 1,000 m). The threshold is shown on the surface panel; these are gameplay distances, not real atmosphere boundaries. Entry and restored saves stay below that body’s threshold. Near-side moon pads face their parent system. Parent planets, rings, sibling moons and the local star render in the surface sky with body-specific image maps in both WebGL and compatibility modes. 18 NASA/JPL/USGS moon mosaics replace the old shared lunar texture; unmapped minor moons use explicitly procedural placeholders.


Version 23 adds a mineral crafting center near Earth Trade, tiered pickaxes, a shovel, and iron-block building. One Iron Ore crafts five blocks; 1000 FP buys 64. Equip blocks outside the ship to preview and place; equip the shovel and double tap the aimed block to reclaim it. Crafted items and placed blocks share the existing inventory save and cannot be sold as mined ore. Terrain uses deterministic 96m chunks with a bounded 25/49-chunk cache, including Earth trees and lunar/Martian rocks and survey equipment. Gas-giant entry uses an illustrative colored fog interior and central core; launch/land are disabled and free Return to Earth remains available. Earth gains thunderstorm weather and original synthesized rain/thunder audio.

Loading now has per-asset timeouts, a bounded preload phase, and no font readiness gate. Optional missing assets no longer prevent Play. Exported mineral and pickaxe-head faces had inward winding; the repaired exports are closed, outward-facing manifold components. The Blender generator now recalculates normals before export. Blender is unavailable in this executor, so the .blend was not regenerated; run `blender --background --python assets/blender/build_models.py` to recreate it from the corrected source. Mesh geometry and topology were verified directly. Browser QA used the compatibility renderer; native GPU and physical mobile testing remain unavailable.

Version 24 reduces Earth scenery rendering overhead: one vertex-colored scenery mesh per nearby chunk instead of separate objects for every tree part; reusable low-poly templates; sparse mobile/Low budgets; scenery culled beyond a bounded distance and while high above ground; compatibility renderer respects hidden parent groups. Star occlusion retains per-part bounds rather than treating a whole batched chunk as a solid box. Tests cover mesh budgets, altitude culling, stable reuse, colors, and disposal. FPS on a physical phone has not been measured.

Version 25 adds Earth distance fog that ends before the nearest streamed terrain edge; a persisted terrain-size setting selects 288–864m across (9–81 chunks). It retains the mobile tree budget. Inventory now only contains search, totals, close and scrollable item/name/stack cards; world simulation and Earth time/weather continue behind it while player input remains blocked. Selling uses a separate Earth Trade window. Crafting shares the inventory panel style and uses rendered tool/concrete thumbnails. Sixteen concrete colors replace iron blocks; old carried and placed blocks migrate to gray concrete without quantity loss. One Quartz crafts five blocks; buying 64 costs 1000 FP. Colored blocks retain their color when placed, recovered, saved and restored. Earth Trade/Crafting use small building-front prompts in reach, available by E or tap. Walking/running now use 4/8 metres per second. Tests cover migration, color refunds, image availability, movement, fog/terrain bounds, and active inventory simulation. Browser QA uses the compatibility renderer; native GPU/mobile performance is unmeasured.

Version 26 fixes jumping onto placed blocks. Jump height now clears a one-metre block with margin; airborne movement can cross onto block tops instead of being rejected by the ground step limit. Support and wall footprints agree, landings stay on block tops, and overhead blocks stop upward head motion. Walking/running remain 4/8 m/s. Regression coverage includes one-block jumps, higher stacked blocks, standing, stepping off, ceilings and held-jump behavior.

Version 27 adds climbable ladder segments, placeable emissive torches with four nearby pooled lights, and black glass with 0.5 opacity. These use the existing crafting, inventory, placement and shovel-recovery save path. Placement previews use 0.3 opacity (0.7 transparency). Mobile inventory/crafting/trade panels are limited to 430px / 76vw. The craft counter faces its eastbound connecting road. Rain particles stop at roofs and are occluded by solid blocks/glass and buildings; ladders and torches are not roofs. On-foot gravity and jump impulse vary by body. The pad radius is 12m; minerals are moved outside its footprint and clear the nearby supported Pad 01 sign board. Tests cover climbing, light/glass state, recipes/save/refunds, different-gravity jumps, shelter, pad clearance, alignment and existing systems. Browser preview uses compatibility graphics; native GPU lighting and a physical phone remain unmeasured.

Version 28 makes ladders attach flush to a solid block side and rejects floor/unsupported placement. Torches can stand on terrain/block tops or lean outward from a supporting wall. Mount IDs/faces persist; removing a support refunds attached items, and legacy unsupported ladders are returned to inventory. Glass is listed as Glass Block and retains black color/0.5 opacity. Gas cores use unlit bright materials with a glow halo; gas exits are radial distance thresholds, with core-distance HUD instead of altitude. Venus/Mars/Titan fog now respects terrain generation boundaries, and twelve low-cost cloud meshes animate with body-specific wind/tint/density on atmospheric bodies. The fallback renderer also animates clouds and brightens gas cores. Tests cover mount geometry, rejection without item loss, saved attachments/refunds, radial exits and cloud/fog behavior. Native GPU/mobile lighting performance remains unmeasured.

Version 29 adds a craftable two-cell Door (2 iron + 1 quartz or 120 FP), screen-tap/E toggling within 5 m, saved door state, physical open/closed collision and blocked-swing guards. Gas exits are 340–480 m radially from the core; core contact restarts at Earth without clearing inventory, and the interior Return to Earth shortcut is removed. Look sensitivity now reaches 6×. Low/Medium/High visibly change cloud count, streamed decoration budgets, resolution and effect passes; mobile budgets stay capped. Space uses brighter neutral fill. Planet Labels Mode saves Overlap or Collision Check (default), with foreground-body occlusion on both space and surface skies. More no longer lists the four legacy panel shortcuts.

Version 30 keeps door leaves inside their cell when opened or closed, so one-block-wide, two-block-tall entrances work. Gas interiors now use the space rocket orientation and forward thrust axis, reset cockpit/orbit state on entry, and render aligned exhaust. TNT can be crafted (2 sulfur + 1 iron) or bought (180 FP), placed, and ignited by clicking with a held torch within 5 m. A persisted four-second flashing fuse triggers a 6 m blast: nearby placed blocks and unsupported attachments return once to inventory, the fired TNT is consumed, nearby TNT chains after 0.6 s, and minerals take distance-based damage with depleted minerals collected. Blast visuals and audio are bounded; terrain, buildings and ships are preserved. All crafted building items have right-hand first-person meshes; pickaxes, minerals and shovels retain their dedicated models.

Version 31 replaces the full-screen blue warp frame with a nonblocking destination title/subtitle and a smoothly animated progress bar directly above the boost bar, plus a left-hand Warp button opposite Boost. Confirmation/payment share the ship-position quote: non-Earth local routes cost 50–300 FP across 0–50 AU of game distance; cross-system routes cost 150–1000 FP plus 5 RC across 0–200 AU of normalized game-route distance. Separate system scenes have deterministic illustrative pricing anchors, not measured interstellar coordinates. Earth remains free. Physical star contact uses swept collision and restarts at Earth while preserving cargo/currency. Settings now includes Refresh Game, which saves then reloads the page.

Version 32 maps PC spacecraft inputs to the on-screen buttons: held Space increases retained thrust speed, Left Ctrl decreases it, W/S pitch down/up, A/D turn left/right, and Q/E roll left/right. E only opens trade/crafting or interacts with blocks while on foot. Walking and free-camera movement retain their existing controls.

Version 33 adds P Warp, B Boost, Tab Settings and X Stop without a B/brake conflict. Crafting, trading and inventory keep the simulation running while movement input stays blocked. Airborne planet entry transforms the incoming space orientation into the local surface frame, sharing the forward-axis model/thrust convention. The five-second launch countdown leads into a four-second smooth 1–40 m/s ramp with steering available; decrease/Stop can interrupt the ramp. Landing descends faster and fully zeros both velocity vectors, retained speed and throttle on touchdown, with an exact parked position hold. Legacy airborne saves convert their old ship axis. Free camera and stable orbit camera stabilize against local planet up near surfaces with a bounded pitch.

### v34 — Body flight minimum
Body entry starts at 5 m/s. Airborne body flight cannot stop or boost, and decreasing speed bottoms out at 5 m/s. Launch ramps from 5 to 40 m/s; landing still parks the ship at zero.

### v35 — Saws and TreeLogs
Craft or buy Iron, Steel and Diamond Saws (25/50/100 damage). Equip a saw and click a tree trunk within 6 m. Trees have 100 HP and drop 4–8 TreeLogs; logs sell for 10 FP + 1 RC each and craft upgraded saws. Trees retain damage/removal through saves and terrain streaming; selling all resource cargo resets trees and minerals together. Centered saw/log inventory images and solid first-person saw models included.

### v36 — Wood building blocks and cutting audio
Craft 1 LogBlock or 4 WoodPlanks from 1 TreeLog, or buy 64 for 1000 FP. Both support placement, collisions, shovel recovery, saved worlds and first-person holding. LogBlock has bark sides and ringed end grain; WoodPlanks has plank seams and grain. TreeLog now uses a solid capped wooden log model in hand. Saw hits and tree felling have dedicated original sounds, separate from mineral impacts.

### v37 — Atmospheres, light, glass and settlements
Sound effects and rain now use Web Audio buffers, pause immediately on blur/hidden/page exit and resume ambient audio only in the foreground. Touching glass blocks omit their shared faces. Placed torches emit wider omnidirectional light; held torches illuminate nearby terrain. Cloud decks stay at a fixed world height so rockets can cross them; upper atmosphere fades toward space, with fades on body entry and exit. Each landable body has two rare deterministic village sites within 1000 m of the launch station, with spaced houses and roads built from recoverable blocks. Village discovery, open doors and TNT/shovel destruction persist in compact saves; nearby village cubes render in batches.

### v38 — Fog and upper sky
Fog keeps its normal body/weather distance above the cloud deck. Space and stars appear only in a small, smoothly blended cap overhead; the lower sky and horizon keep their atmospheric colors. Earth weather fog remains visible at high altitude while precipitation still fades above the cloud layer.

### v39 — Growing upper atmosphere opening
The opening starts wider above the cloud deck, then continuously expands through the remaining ascent. It retains 24% of the body sky tint instead of becoming pure black. Expansion stays strictly above the horizon; lower sky colors, fog and the cloud layer remain unchanged.

### v40 — PC focus and ship steering
Keyboard input clears on tab/window focus loss, page hiding and page exits; stale auto-repeat events cannot restart a released key. Captured key-up handlers release multi-key combinations independently. A saved 0.25–3× Ship rotation speed slider is separate from look sensitivity. Space and body flight share normalized rotation rates, slowing default space steering and speeding up body steering. Post-processing uses a single fullscreen triangle, bounded depth/edge sampling, explicit framebuffer clearing, a minimized-window guard and a direct-render fallback on framebuffer failure.

### v41 — Browser right-click interruption
Right/middle mouse-down clears held input and cannot start a camera drag. Opening a context menu also releases keys and cancels any captured drag, even without window blur. Native context menus are blocked over the running game view/HUD so they cannot interrupt its canvas; text fields and links retain their normal menus.

### v42 — Independent touch UI
Each finger can tap game buttons independently while another finger holds the thumbstick or a flight control. Touch activation tracks pointer IDs, ignores scroll/cancel gestures and suppresses the duplicate native click. Inventory is non-modal for movement input and opening/closing it preserves held movement. Held controls reject pointer takeover; an existing camera drag keeps its original pointer. Mouse and keyboard activation remain native.

Validation: `node --experimental-vm-modules tests/ui-smoke.mjs --multi-touch-only`, the right-click regression, and the full UI smoke suite. Simulated multi-pointer input covers inventory open/equip/close while holding the stick; real phone multi-touch still needs device verification.

### v43 — Tool tap double-activation fix
Touch duplicate suppression now follows pointer IDs, tap position and button identity through inventory/hotbar rerenders, including delayed clicks targeted at replacement buttons or ancestors. Touch click events with zero detail are suppressed too. Mouse, pen, keyboard and programmatic activation remain available. Regression tests cover repeated equip/unequip, tool switching, modern and legacy compatibility clicks, simultaneous taps, cancelled/scrolled gestures, disabled buttons and disconnected buttons.

### v44 — Uploaded TZG Player Ship
Replaced the scout rocket with the supplied `TZG_Player_Ship.blend`, retaining its 124 named exterior/interior parts, UVs, six packed textures, tinted glass, luminous displays and cyan engine/cabin lights. The static mesh uses eleven material batches (4,812 triangles). The original Blender file and deterministic export script are retained under `assets/blender/`. Twin gameplay exhaust emitters align with the two rear nozzles; the static model contains no baked flames. Parked and airborne orientations match; the pilot camera sits inside the actual 3D cockpit, and on-foot collision covers the wider hull/wings while preserving a clear exit and boarding access. Compatibility graphics retain material colors; full textures and lighting use WebGL.

Validation: dedicated uploaded-ship geometry/material/UV/texture/eye/nozzle/ground/collision checks, full gameplay suite and full UI smoke suite. Browser preview verified in compatibility graphics; hardware WebGL and real-device performance remain unverified.

### v45 — Upright landing and warp cockpit
The new ship parks nose-up again, matching its upright liftoff and guided descent. Its model-specific 4.23m contact offset keeps the two tail nozzles just above the ground; cockpit and exhaust transforms follow the parked pose, and on-foot collision follows the upright footprint. Confirmed/paid warp switches immediately to the actual 3D cockpit; cancellation preserves the camera. Labels are hidden when any sampled part of their on-screen rectangle overlaps opaque cockpit geometry, including back faces visible from inside; transparent windows remain clear. This check applies independently of celestial-body label overlap settings.

Validation includes upright spawn/countdown/touchdown/clearance, pilot position, accepted/cancelled warp views, solid/glass/back-face/label-edge occlusion and the actual imported cockpit sightlines, plus gameplay and UI regression suites.

### v46 — Mobile building and camera frame cost
Building sync retains unchanged special-block meshes, crafting-hall geometry and existing solid-block instance buffers. Player solid blocks now share material batches with village blocks; capacity grows only when needed. Door state changes replace only the door, while connected glass refreshes only changed adjacency. A spatial picking grid narrows aiming/interactions to nearby blocks instead of testing every instance in the visible world. Preview aiming is skipped without a block/shovel equipped; ground probes reuse scratch vectors. Torch candidates are cached and nearest-light selection runs at most about seven times a second. Canvas compatibility graphics now render/cull actual instance transforms.

Validation: deterministic 3,000-block stress fixture (one solid batch, 38 nearby ray tests for the fixture), retained geometry/buffer/hall identity on placement, independent door/glass updates, no pickaxe preview raycast, actual instance placement in Canvas fallback, plus gameplay/UI regressions. Real-device FPS and perceived touch latency remain unmeasured.

### v47 — Applee’s Roblox texture selections and added worlds
All 46 supplied IDs map to locally bundled public Roblox preview PNGs. Original asset delivery returned authentication errors; these images are explicitly preview-resolution copies (up to 420px wide), with their source IDs, dimensions and SHA-256 hashes retained in `roblox-texture-assets.js` and `assets/roblox/texture-download-report.json`. Existing full-size maps remain bundled as historical fallback assets. The Moon selection is a transparent cube-cross atlas: face-local cube-sphere UVs prevent the empty corners appearing as black surface patches, and Canvas/atlas thumbnails use an occupied face.

Added nine landable destinations: Salacia, Varda, Actaea (supplied as Actena), Ilmarë, Vanth, Xiangliu, Planet X, Proxima c and Proxima d. Moon parents and local family labels are assigned; Proxima additions belong to the Proxima system. Planet X is explicitly hypothetical/simulated, and the Proxima additions retain candidate descriptions. Sizes and placements are schematic.

Validation covers all 46 IDs/hashes/decoded image dimensions, nine finite landable additions, moon families, Proxima membership, hypothetical flags, seam-safe cube-cross UVs/outward winding/Canvas crops, gameplay and UI regressions.

Catalog references: https://ntrs.nasa.gov/citations/20190026668 ; https://arxiv.org/abs/1505.00510 ; https://exoplanetarchive.ipac.caltech.edu/overview/GJ551 ; https://science.nasa.gov/solar-system/planet-x/ . Surface artwork is user-selected and not asserted to be observed spacecraft mapping.

### v48 — Ship-centered orbit camera / Planet X gas world
Zoomable camera mode now orbits the uploaded ship’s visual bounding-box center, with a level horizon, clamped vertical orbit and 6–120m zoom. Mouse/touch drag rotates the view independently of the ship, right-drag is supported without the browser menu, and existing wheel/pinch/zoom buttons change orbit distance. The ship stays centered after surface-ground clearance adjustment and in chase view. Cockpit and on-foot controls are preserved.

Planet X is an explicitly simulated ice giant with no solid landing surface. Its gas interior follows the existing giant-world rules; older landed saves migrate to a safe gas-entry point.

Validation: subject projection at many angles/distances, upright/moving ship transforms, independent ship rotation, no-roll/pitch/zoom bounds, ground clearance, native right-drag handling and browser-menu suppression, Planet X no-land/no-launch rules and legacy-save migration, plus gameplay/UI regressions.

### v49 — Restore direction-steered Chase camera / Proxima landing rules
Chase uses the original camera quaternion and offset again, preserving pitch/yaw/roll and parked crew look rather than forcing a look-at rotation. Orbit retains its ship-centered independent rotation and zoom. Proxima c is represented as a non-landable gas giant; Proxima b and d remain solid landable worlds. Old landed Proxima c saves safely migrate to gas entry.

Validation covers Chase drag steering, rolled flight orientation, parked look direction, unchanged centered Orbit zoom, Proxima landing/launch guards and save migration, plus gameplay/UI regressions.

### v50 — Proxima b/d atmospheres and readable gas interiors
Proxima b/d use Earth-like blue skies, drifting clouds, fog, atmospheric rims and 800m gameplay exit heights while retaining solid landing. Atmospheres/terrain remain imagined game representations. Gas interiors use palettes sampled from each selected exterior map, including blue cores/haze for ice giants and Proxima c, brighter diffuse ship lighting, and up to 12 soft animated gas-cloud sprites (4/8/12 by quality). The Canvas fallback shares palettes and world-space cloud motion. Core collision and gas exit rules are unchanged.

Validation: all six gas palettes/readability/cloud motion and fallback gradients; both Proxima atmosphere/upper-sky transitions; landing rules, gameplay and UI regressions. Hardware WebGL and physical-phone FPS remain unverified.

### v51 — Server-authorized nonmodal developer tools
Settings → Debug Menu opens a floating, draggable window with Close, Debug Console and Developer Panel tabs. The window does not pause gameplay or shield inventory/other controls. Keyboard focus inside developer inputs clears ship movement and prevents game shortcuts. Console includes runtime errors, command feedback and live renderer/location/position/currency/inventory diagnostics, bounded to 150 messages.

The owner chooses a unique 12–128 character authorization code on first use. Setup checks dispatch-authenticated email against the server-only `DEBUG_OWNER_EMAIL`, requires `DEBUG_BOOTSTRAP_ENABLED`, and binds access to the stable Site user ID. D1 stores only a random salt and PBKDF2-SHA256 hash (100,000 iterations). Login attempts are persistently limited; successful sessions use random opaque tokens stored only as hashes and sent in Secure/HttpOnly/SameSite=Strict cookies, expire after 30 minutes, and are revoked on Close. Each command verifies same-origin JSON, owner identity and session before strict command parsing; there is no eval or arbitrary script execution. Codes are cleared from inputs immediately after submission and never logged/audited.

Supported commands: give/set currency FP|RC amount, give item item-id amount, teleport body name, status, stop, save, help. Mutations affect this browser's existing local game save. This gate protects the developer service and code; the current browser-owned economy is not an authoritative anti-cheat/account economy. No currency synchronization or shared user accounts are introduced.

Hosting migrates static assets into the starter's `public/` directory with a server API and schema-only D1 migrations. Preserve the Site project and audience. Runtime owner-email/bootstrap configuration lives in Sites, never in the source manifest or client assets. Do not place authorization codes in environment examples, source, logs or browser storage.

Validation: authenticated setup/wrong owner, code hashing, cookie flags, identity binding, CSRF, expiry/logout, attempt limits, malformed command rejection, code-free audit; frontend setup/login/tabs/dragging/close; real game currency/save, inventory/render/movement coexistence; full gameplay and UI suites. Hosted first-code creation is left to the owner.

### v52 — Texture-matched Proxima atmospheres and debug window session/size
Proxima b uses a golden sky/haze, and Proxima d uses a warm tan/brown sky/haze, matching the chosen surface artwork. Sky, fog, clouds, exterior atmospheric rim and fill lighting share per-body palettes; both remain landable with Earth-like cloud heights and 800m exits.

The debug window has a visible bottom-right resize grip with mouse/touch pointer capture, minimum sizes, viewport limits and arrow-key resizing. Close hides the window while preserving the current page's authorization. Refresh creates a new cryptographically random in-memory page key and prompts for the code again. The server binds the session-cookie hash to that page key, so an old cookie cannot authorize a refreshed page. Browser-session cookies remain HttpOnly/Secure/SameSite=Strict; page-exit logout revokes the previous page without clearing a newer page's cookie. No code or page key is saved to browser storage.

Validated: resize bounds/cancel/independent pointer IDs, close/reopen without a login, fresh-page prompts and rejection of old cookies with a new page key, matching atmosphere palettes/fog/transitions, plus gameplay/UI suites.

### v53 — Below-cloud precipitation and lightweight ground accumulation
Earth rain, heavy rain and thunderstorms stop above the lowest cloud-base height (222 gameplay meters); rain/snow use terrain/pad/roof impact heights instead of the ship's contact floor. Ground hits add small splash/ripple rings. Existing atmospheric fog remains above the clouds, while rain audio and nearby precipitation stop there. Thunder flashes now illuminate the environment.

New selectable weather: Drizzle, Heavy Rain, Snow, Blizzard, Sleet and Windy. The automatic schedule includes them after the established early phases. Weather changes blend gradually; wind speeds cloud drift. Rain wets/darkens terrain and gradually forms expanding puddles/shallow pools that drain/evaporate after clearing. Snow builds visible terrain-following patches up to about 15cm thick; sunny afternoon patches melt faster, with shaded pockets lasting longer. Wetness, pools and both snow-cover amounts are saved with Earth time/weather and continue evolving while Earth is off-screen. Accumulation is cosmetic rather than fluid or collision simulation.

Performance: fixed quality caps for precipitation, batched Canvas paths and reusable projection vectors, nearby shelter grids instead of all-block checks for each drop, and two reusable ground meshes updated at most four times/second (16/32/48 patches per quality, 16 in Canvas fallback). Fallback geometry drawing now honors drawRange. No reflection passes, particle objects per drop, terrain rebuilds or per-frame snow geometry allocation.

Tests cover cloud ceiling, exact ground/pad impacts, roof/wall shelter, sparse shelter candidates, preset/transition/save behavior, wetness/pooling/drainage, persistent snow and shade retention, rain/snow budgets, retained ground geometry/update cadence and Earth-only effects, plus gameplay/UI regressions. Real-device FPS remains unmeasured.

### v54 — Weather interactions, snow materials and mobile controls
Precipitation now varies its wind direction and speed, checks the uploaded ship's opaque source-part bounds, and respects roofs. Windows retain exterior rain visibility. Reliable nearby ground-impact ripples and drops replace the sparse phase-dependent effect; landing in a rain pool adds a ring and spray. Persistent randomized pool/snow records change with weather episodes, retain harvested depletion, and accumulate on exposed roof surfaces. Ground weather stays visible across a larger bounded range; torches retain a small distant beacon while expensive point lights remain local.

Shoveling a visible snow patch within six meters removes a fraction per click and awards 4–8 SnowBalls. Five clicks exhaust a fresh patch; snowfall can regrow it. SnowBlock crafts from 12 SnowBalls, one block per craft, and the shop sells bundles of ten for 120 FP. Both have inventory artwork and held-item visuals. Pools use a cached sky/cloud/Sun environment map updated every five seconds, plus fallback glints, rather than rendering the entire scene into a mirror.

Debug resizing scales the complete inner interface. A second finger can scroll inventory/catalog/debug content while a thumbstick remains held. Control touch-callouts, selection, dragging and context menus are suppressed; lost capture can be reacquired while the physical touch remains down. Genuine pointer cancellation, release and window blur still stop controls to avoid stuck input. Editable form fields retain native menus; browser/OS UI outside the page cannot be disabled.

Earth's local sky now has a closer virtual Sun and textured Moon, horizon-aware visibility, a warm directional sunrise/sunset band and a glowing untextured Sun. These local sky distances do not change the Universe catalog's orbital positions. Stars use untextured emissive-looking basic materials with type-based colors. The Universe Map independently caches all available body texture thumbnails rather than depending on the space renderer's small active texture set.

Validation: full gameplay, UI and debug suites; dedicated opaque/glass hull masking, changing wind, snow ray picking/depletion/save, crafting/purchase quantities, jump splashes, roof and distance rendering, reflection cache, map thumbnails and star materials. Integrated shovel pickup/UI/save and simultaneous thumbstick/inventory scroll tests pass. Browser compatibility-graphics checks confirm startup, rainfall, debug scaling and Universe Map; hardware WebGL and physical mobile FPS/long-press behavior remain unmeasured.

### v55 — Biome weather, pool geometry, shadows and surface audio
All fifteen follow-up requests are represented in this update. Puddle jump effects use a reusable, depth-tested world mesh: circular rings lie on the water plane and the ring/spray footprint stays inside the pool. Reflection cube faces now represent their actual sky directions; the water shader adds a directional reflected Sun highlight. The fallback draws that highlight only where the reflected Sun ray intersects a pool. This remains a lightweight sky reflection, not a full-scene mirror.

Settings adds persistent Global Shadow and SunRays toggles. Global Shadow controls object/ship self-shadowing in space and surface scenes, plus a shadow-only first-person body. Bounded 512px maps (1024 on High) update at most ten times/second; they are off by default for touch devices. SunRays is an optional occlusion-tested light-ray overlay, also off by default. Compatibility graphics omits GPU shadow maps; hardware rendering and physical-phone FPS remain unverified.

SnowBlock now uses a shared granular snow texture/bump and vertex tint, with no weather pools layered over it. Rain pools no longer form on any block or roof; exposed ordinary roofs can retain snow. Snow harvesting consumes patch area rather than a fixed fraction, so a small patch is exhausted in one click. Rain and snow records drain/melt independently when their own precipitation stops, including old rain during snowfall and old snow during rain. Serialized per-patch coverage/depletion survives refresh.

Earth contains grasslands around the pad, pine forest to the west, desert to the east, tundra to the north and alpine forest to the southeast. These are schematic gameplay regions, not geographic Earth mapping. Terrain colors, desert tree exclusion, HUD biome names and precipitation eligibility agree in both renderers. Warm regions receive rain, cold regions receive snow (rain fronts convert to snow there), and desert regions receive neither. Snow changes cold-region tree canopies through retained vertex colors; canopy snow is cosmetic and is never a shovel target or inventory reward.

Secondary-finger scrolling captures the inventory only after a real drag, preserving item taps while a thumbstick is held. Movement sounds are synthesized variants for grass, sand, snow, water, wood and stone, with distinct step/jump/landing events and normal background-audio cleanup. No extra audio downloads are needed.

Mobile costs: Low rain/snow caps reduced to 180/96, at most 64 native ground patches per kind (48 compatibility), ground rebuilds at most 2.5 times/second on Low, fixed upward patch normals and retained bounds replace full geometry normal/bounding scans, nearby tree lists are cached, and movement material probes run at footfall events rather than every frame. Full gameplay/UI/debug suites and dedicated biome/pool/shadow/audio/multitouch regressions pass. Browser checks confirm startup, biome readout, graphics toggles and saved settings; the cloud preview only supports compatibility rendering.

### v56 — Startup initialization race correction
Initialize movement-audio state with the other initial state, and schedule the first render frame only at the end of module initialization after the ship's asynchronous load completes. Previously the module scheduled rendering, awaited ship loading, and only then initialized `wasWalkingAirborne`; a frame during that wait could throw a temporal-dead-zone ReferenceError and leave the loading screen reporting Unable to start.

A startup regression fixture keeps the ship fetch pending across an event-loop turn, verifies no frame starts during that suspension, then releases it and executes frames before Play and after Play. This fixture is included in `test:ui`. Existing saves and the v55 features are preserved.

### v57 — Orbit, biome weather, map cost and gameplay audio
SunRays is removed from settings, storage writes, the client module graph and source manifest; its module is deleted. The older stellar-glare streaks are also removed while the normal stellar glow remains. Space subject-orbit uses a stable world-up frame instead of changing to a nearby planet's surface normal. Orbit dragging remains available during approach autopilot, mode changes clear stale gestures, and lifting one finger after a pinch hands rotation back to the remaining finger. Chase steering retains its existing behavior.

Earth's former half-plane biomes become compact, slightly irregular rounded regions with 58–70m base radii, smooth terrain-color margins, and guaranteed plains corridors. Desert cannot touch a snowy region directly. Cells are cached to avoid repeating climate hashes for terrain vertices. Plains use broad oak crowns, forests use pale birch trunks, alpine regions use pine, tundra uses smaller spruce, and desert decorations include cacti. Snowy canopies remain cosmetic and unharvestable.

Global weather no longer offers Snow, Blizzard or Sleet. Those old saved modes migrate to Rain/Heavy Rain. A shared rain event becomes snow in cold biomes, rain in plains/forest and no precipitation in desert; traveling between biomes never changes that global event. Settings explains this rule, and the local readout shows Snow where appropriate. Existing per-patch drainage and melting remain independent. Tiny and edge pool jumps now produce a splash; its geometry is clipped into the actual pool ellipse instead of shrinking its entire radius to zero at an edge.

Movement uses 18 pre-generated, quieter foley-style WAVs (step, jump, land for grass/sand/snow/water/wood/stone) instead of the previous runtime pitched tones. Takeoff probes the actual ground material, including pool surfaces. Successful block placement/deletion has separate feedback. TNT uses a four-second fuse hiss and its own bass/noise blast rather than countdown/thunder recordings. These are original generated assets with a reproducible script; no Minecraft recordings are bundled.

Universe Map retains orbit geometry, batches orbit paths, omits distant moon orbit paths while preserving the moon bodies/textures, coalesces input bursts to one requested frame, avoids repainting unchanged thumbnails or resizing an unchanged canvas, limits pixel ratio to 1.25 and thumbnails to 128px, and skips hidden-map redraws. A 100-draw CPU fixture measured approximately 1.83ms/draw before and 0.31ms after; this is not a hardware/mobile FPS result. Boost controls/timer are hidden inside bodies, unavailable space navigation actions are hidden on surfaces, and the surface brake control is hidden.

Server-validated developer commands now include weather, time, daycycle, biome, camera, graphics, speed, position, performance and locate. Numeric/enumerated arguments are bounded; authorization/identity/page-session/CSRF/rate-limit checks remain in front of parsing. Console diagnostics include frame rate, draw calls, triangles, chunk count, ground rebuild count, precipitation counts, camera mode and biome. Rain/Clear/Noon/Performance quick buttons use the same authorized endpoint.

Validation: full gameplay, UI and developer-service suites; targeted rain→cold→desert→plains transitions, small-edge splash bounds, plains corridors, cactus generation, retained/deferred map drawing, new command rejection bounds, all audio files/hooks, stable idle space orbit, dragging during navigation and pinch handoff. Browser checks confirm startup, removed options/boost controls and rotating textured map in compatibility graphics. Real-device audio preference, WebGL appearance and physical-phone FPS remain unmeasured.

### v58 — World weather, medium biomes and bounded puddle effects
Rain, snow and precipitation impacts now occupy fixed world cells around the player/ship. Native graphics renders reusable scene geometry with depth testing and fog; compatibility graphics projects the same time-driven world positions. Camera rotation, zoom and orbit no longer drive particle motion or weather location. Weather remains bounded to nearby cells and stops above the cloud ceiling.

Biome regions now span roughly 240–320m with irregular borders and plains corridors. Water and snow footsteps, takeoff and landings use longer, distinct generated splash/crunch recordings and stronger material-specific gains; snow covering a puddle takes priority. Audio and the changed module graph use release-versioned URLs to avoid stale cached files.

Splash vertices clip to the same sixteen-sided ellipse as the actual puddle and track its shrinking shoreline. Edge jumps retain surface ripples while suppressing airborne spray near the shore. Water, snow and splash materials receive fog, including the reflected Sun highlight and compatibility rendering. The boost timer is shortened to 140px with a responsive maximum.

Validation: full gameplay, UI/startup and developer-service suites, plus dedicated camera-invariance, world-buffer bounds, biome scale, snow/water audio routing, exact shrinking-pool bounds, fog shader placement and compatibility fog checks. Browser preview launches successfully in compatibility graphics. Hardware WebGL appearance and physical-phone FPS/audio playback remain unverified.

## v59 — pools, weather and connected roads

Pools start empty and accumulate slowly, with clipped block/preview footprints and stable pool identities. Grass foley is softer; rain/snow blend across biome borders, including storms, with gusts and uneven lightning followed by thunder. Shared terrain-following roads connect the smaller 16 m pad, Earth shops, and village centers; village approaches meet doorsteps, and scenery avoids roads. Existing village edits remain saved.
