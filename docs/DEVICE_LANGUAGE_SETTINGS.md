# Device preferences and UI languages (v82)

Settings → Language saves the preferred language on the current browser/device. The selector offers the ISO language catalogue (180+ choices) and an extra language-code field for provider-supported RFC language tags. This is broad language selection, not a claim that every language in the world has a machine translation. English stays available immediately, including while offline or after a provider error.

Common Myanmar menu/settings labels are bundled with the game, alongside a SIL OFL licensed Noto Sans Myanmar font. Other missing labels use MyMemory's documented anonymous GET API. The implementation does not use unofficial Google endpoints or embed a Google Cloud key. Google Cloud Translation requires an enabled/billed project and credentials; that integration is not configured here.

Only source-controlled UI phrases are eligible for translation. UI translation excludes account fields, credentials, profiles, chat messages, usernames, bios and inventory values. The separate Auto Translate Chats option described below explicitly enables incoming message-body translation. Provider responses are applied as plain text, never HTML. Translation results are cached locally (up to eight language caches). API requests are capped to three concurrent calls, eight seconds per request, a 500-byte source limit, and a conservative 4,500 source-character device budget per UTC day. MyMemory also imposes its own anonymous limit (5,000 characters/day), which may be shared by the user's public IP. On failure, cached translations remain and English fills missing text. Retry translation is explicit.

Source documentation:
- https://mymemory.translated.net/doc/spec.php
- https://mymemory.translated.net/doc/usagelimits.php
- https://docs.cloud.google.com/translate/docs/setup

Device settings now have their own `tzg-device-settings-v1` snapshot, independent of a valid flight save. Changes save immediately and restore through the real control handlers. Covered settings include controls/sensitivity/rotation, graphics/shadows/terrain, assist, audio preference/volume, camera FOV/exposure/labels/paths/time scale, adaptive graphics/speed, weather cycle/mode/day length, maximum speed and chat transparency. Existing layouts, control-size, sound, terrain and environment stores are retained. Engine audio waits for a user gesture on reload as required by browsers. Storage failures are reported in Settings.

Tests cover refresh persistence, zero/false values, coupled-control restoration, blocked storage, known-label-only requests, Myanmar/English switching, language catalogue and caching. Headless browser fixtures at 1536×690 and 844×390 validate real reloads and dynamic translation; provider responses are mocked in those tests. Existing social and startup checks also pass. No new SQL or server deployment is needed.


## v83 fixes and opt-in chat translation

Language changes synchronously restore original English or the selected language's available text. Reverse source mappings also repair copied/recreated translated nodes. UI API responses are committed together after a batch instead of rewriting the screen per response. Language choices are named in the selected language; the heading no longer permanently contains Burmese. Deleted-message text is tagged as a system label and follows UI language while sender names remain unchanged.

Settings → Auto Translate Chats is off by default, saved per device, and includes an explanation that incoming message text is sent to MyMemory. It translates visible incoming text in global, friend and group conversations to the game language. It never translates names, outgoing text, deleted notices or image/voice payloads. Report evidence and edit payloads keep original server text. Each translated message offers Show original / Show translation. Turning it off restores originals and cancels outstanding work. Chat results have a bounded RAM-only cache, cleared on disable/logout; message text is not written into the UI translation cache or any device-settings file.

Source-language detection runs locally (script checks and a bundled MIT-licensed franc-min model for longer Latin text). Short messages and mixed-language text can be ambiguous; failures retain originals. Chat translation shares the existing provider/device daily budget with UI labels and splits text into bounded UTF-8 segments. Provider outages/limits leave original text visible. No additional SQL is required.

Public-group discovery and New group buttons use explicit gaps and wrap on narrow layouts. Tests cover immediate language reset, localized tombstones, no chat calls while disabled, incoming-only translation, original toggles, cancellation of late responses, and desktop/mobile render behavior.
