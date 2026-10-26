# Device preferences and UI languages (v82)

Settings → Language saves the preferred language on the current browser/device. The selector offers the ISO language catalogue (180+ choices) and an extra language-code field for provider-supported RFC language tags. This is broad language selection, not a claim that every language in the world has a machine translation. English stays available immediately, including while offline or after a provider error.

Common Myanmar menu/settings labels are bundled with the game, alongside a SIL OFL licensed Noto Sans Myanmar font. Other missing labels use MyMemory's documented anonymous GET API. The implementation does not use unofficial Google endpoints or embed a Google Cloud key. Google Cloud Translation requires an enabled/billed project and credentials; that integration is not configured here.

Only source-controlled UI phrases are eligible for translation. Account fields, credentials, profiles, chat messages, usernames, bios, inventory values and other user content are not sent to the provider. Provider responses are applied as plain text, never HTML. Translation results are cached locally (up to eight language caches). API requests are capped to three concurrent calls, eight seconds per request, a 500-byte source limit, and a conservative 4,500 source-character device budget per UTC day. MyMemory also imposes its own anonymous limit (5,000 characters/day), which may be shared by the user's public IP. On failure, cached translations remain and English fills missing text. Retry translation is explicit.

Source documentation:
- https://mymemory.translated.net/doc/spec.php
- https://mymemory.translated.net/doc/usagelimits.php
- https://docs.cloud.google.com/translate/docs/setup

Device settings now have their own `tzg-device-settings-v1` snapshot, independent of a valid flight save. Changes save immediately and restore through the real control handlers. Covered settings include controls/sensitivity/rotation, graphics/shadows/terrain, assist, audio preference/volume, camera FOV/exposure/labels/paths/time scale, adaptive graphics/speed, weather cycle/mode/day length, maximum speed and chat transparency. Existing layouts, control-size, sound, terrain and environment stores are retained. Engine audio waits for a user gesture on reload as required by browsers. Storage failures are reported in Settings.

Tests cover refresh persistence, zero/false values, coupled-control restoration, blocked storage, known-label-only requests, Myanmar/English switching, language catalogue and caching. Headless browser fixtures at 1536×690 and 844×390 validate real reloads and dynamic translation; provider responses are mocked in those tests. Existing social and startup checks also pass. No new SQL or server deployment is needed.
