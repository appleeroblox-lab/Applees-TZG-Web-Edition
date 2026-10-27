# Roblox media mapping

Files are used only after the importer validates and bundles their real bytes. Missing audio uses existing game effects; unavailable ambient tracks and sunshine images are omitted. See `ROBLOX_ASSET_IMPORT.json` for the retrieval results.

| Name | Roblox ID | Event | Current media |
| --- | --- | --- | --- |
| Ambient1 | 134743167234703 | Ambient playlist, track 1 | Awaiting owner export; fallback active |
| Ambient2 | 3419187043 | Ambient playlist, track 2 | Awaiting owner export; fallback active |
| Ambient3 | 3179846605 | Ambient playlist, track 3 | Awaiting owner export; fallback active |
| Beep | 1283290053 | Launch countdown | Awaiting owner export; fallback active |
| Boom | 3149249837 | Physical contact feedback | Bundled original |
| Burn | 298181829 | Star/core contact | Awaiting owner export; fallback active |
| Complete | 3198076659 | Inventory item/resource gain | Awaiting owner export; fallback active |
| CurrencyAdded | 1169806635 | FP or RC balance increases | Awaiting owner export; fallback active |
| CurrencyRemoved | 6988710942 | FP or RC balance decreases | Awaiting owner export; fallback active |
| Digged | 139911414972673 | Shovel digging/reclaiming | Awaiting owner export; fallback active |
| Explosion | 2814355743 | TNT explosion | Bundled original |
| Launch | 5199136449 | Takeoff ignition | Awaiting owner export; fallback active |
| Lift | 7204858708 | Ground touchdown | Awaiting owner export; fallback active |
| PickUp | 1788243907 | Picking up collected resources | Awaiting owner export; fallback active |
| Recieved_v1 | 138891370077088 | Incoming chat/party notification | Awaiting owner export; fallback active |
| Stop | 9099672278 | Stop button, X brake, cancel navigation | Awaiting owner export; fallback active |
| Swing | 123796710194563 | Pickaxe/tool swing | Awaiting owner export; fallback active |
| UIClick | 104588974442101 | Button click | Awaiting owner export; fallback active |
| UIClose | 1169806635 | Close game panel | Awaiting owner export; fallback active |
| UIOpen | 1169806635 | Open game panel | Awaiting owner export; fallback active |
| Warn_v1 | 3165700530 | Warning feedback | Awaiting owner export; fallback active |
| normalPickaxeHit | 9120146349 | Pickaxe hits mineral | Awaiting owner export; fallback active |

Sunshine layers: `6281397906`, `5192965045`, `8172510073`. All returned HTTP 401. Real exported images are composited as additive sun layers, with the existing star/terrain/building occlusion mask retained.

Audio honors the existing sound toggle, volume, browser gesture unlock and page visibility. Ambient tracks use one source at a time. Exact imported effects retain up to 10 seconds of their original recording; movement, rain and thunder retain their existing handling.

`Boom` had no specified trigger; it is assigned to physical contact feedback. `Recieved_v1` is assigned to incoming chat notifications. These are implementation choices.

## Validation for this update

Passed: update-v97 integration, account/cloud-save/debug-account suites, auth-before-preload and delayed-ship startup checks, ship/crafting/weather regressions, social UI/live chat/friends UI and social v77/v78/v80 checks. Both downloaded OGG files were decoded by ffprobe (2.79 s and 3.82 s). All preloader files exist and changed JavaScript passed syntax checks.

The combined social suite reaches an existing `social-v79.mjs` assertion that omits the v96 `chatRetentionInfo` element. `social-v81.mjs` also expects the private media UI removed in v95. Both failures reproduce on the unchanged v96 commit. Separate social-v85 and interface-v86 checks pass. A real-browser visual playthrough was unavailable in this environment; live Supabase sign-in and physical-device interaction still need user testing.
