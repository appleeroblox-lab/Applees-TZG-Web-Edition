# Profile images, account management and global chat (v64)

## One-time setup

The existing Supabase project, URL, public key and developer allowlist remain in use. Apply **supabase/migrations/202610250003_social_accounts.sql** in Supabase SQL Editor as the project owner, after migrations 001 and 002. Run the whole file, including BEGIN and COMMIT. The migration is repeatable and preserves existing player saves. No secret key belongs in the website.

Until that migration runs, the new social endpoints are unavailable. Existing login and saves continue to use the prior endpoints. After success, reload the game once.

## Accounts

- The smaller Account dialog keeps UID copying, display-name editing, manual Save Data and sign out.
- Upload JPEG/PNG/WebP, maximum 5 MB input. The browser crops/resizes to 128×128 JPEG, strips original metadata through canvas, and uploads at most 40,000 characters. The database verifies the JPEG data URL and byte markers; it stores one image per profile. No Storage bucket or additional service is needed. Developers can remove inappropriate images. This is not automated image content moderation.
- New signups require a permanent, case-insensitive username with 3–36 ASCII letters/numbers/underscores. Availability checks help the UI; an Auth insert trigger and database unique index enforce uniqueness even for simultaneous/direct API signups. Usernames beginning `p_` are reserved by the public availability check for generated names. Existing users get a stable `p_` + UUID username; display names may repeat. Login still uses email/password.
- Supabase passwords are never returned in directories or stored in chat.

## Developer sidebar

**Manage Accounts** is a separate page from Developer Panel. Search/paginate all accounts; select one to see image, username, UUID, email, created date, current data, active ban and last 20 moderation actions.

Actions: edit display name/FP/RC/inventory; ban for 1 hour, 1/3/7/30 days, or permanently; unban; remove profile image; permanently delete. Every action requires a category/reason and writes an audit record. Delete additionally requires the exact username. Enabled developer accounts cannot be banned or deleted here. The user interface does not itself execute a deletion without this explicit form submission.

Data edits reuse the catalogue/currency bounds and require the current server revision. They increment that revision so a stale player cannot overwrite them. A connected client notices server updates or suspension on its next heartbeat (approximately 5 seconds while visible) or protected request. Suspended accounts cannot load/save/play/chat/report; the account gate displays the reason and an appeal link to https://discord.gg/rPdRRHSkmw. Temporary bans expire automatically on the next request.

Permanent deletion removes the Auth user and their profile/save/image/session records through database foreign keys. It preserves moderation history and report evidence for review. Chat names remain on historical messages, without an email or active profile. If future features create Supabase Storage objects owned by users, those objects must be removed through the Storage API before deleting the Auth user; this feature does not create any.

## Global chat and reports

The Chat button opens a compact shared chat, updated by polling while visible. Only confirmed, signed-in, unbanned players can read/send/report. The server selects author IDs/names, filters text before storing it, caps messages at 200 characters, and allows at most 10 messages per minute with a 3-second gap. Stable mutation IDs prevent duplicated sends after an uncertain network response. Only the latest 1,000 messages are retained, and the client displays up to 100.

The enabled filter is a **basic rule-based English/Burmese profanity and personal-information filter**, including common leetspeak/separator variants, links, emails and phone-like numbers. It is not Roblox TextService or a comprehensive multilingual/age-aware moderation service. It can miss abusive text and reject innocent text. Public launches serving children should use a suitable managed moderation service and human review. Profile images need human moderation as well. Names use the same rule filter; existing historical names are preserved. Rendering uses textContent, never chat/profile HTML, and images accept bounded JPEG data URLs only.

Report a message with a category and optional details. The database copies the actual message and both account IDs/usernames; clients cannot invent the evidence or reported identity. Duplicate reports by the same user on the same message are idempotent; reports are limited to five per hour. Reports cannot target your own message.

**Reports** in the developer sidebar lists open/reviewed/dismissed/all reports, the original message, category, notes, reporter and reported profiles. Each profile opens Manage Accounts with the same actions. Review/dismiss/reopen is recorded with reviewer/time. The Reports badge checks for new open reports approximately every 20 seconds while an authorized debug session is active. A report is evidence for review, not an automatic ban.

## Validation

- `npm run test:accounts`, `npm run test:debug`, `npm run test:social`, `npm run test:ui`.
- `npm run test:social:sql`: optional PostgreSQL integration tests using PGlite. Install `@electric-sql/pglite` separately, or set `TZG_PGLITE_MODULE` to its installed ESM entry point. The test creates its own isolated database and never contacts the live Supabase project.
- SQL tests cover repeatable migration, username races/uniqueness, owner isolation, server text filtering, rate limits, JPEG restrictions, reports/evidence, permission denial, admin data validation/revisions, temporary/permanent ban checks, unban, developer protection, account deletion, revoked access and retained reports.
- Browser UI tests use a mocked DOM/WebGL; real Android layout, real image selection, email signup and live cross-account chat still need device checks after migration.

## v65: compact panels and private public profiles

Apply `202610250004_compact_private_profiles.sql` after 003, then reload with `index.html?v=65`. It preserves saves and adds a filtered bio plus atomic display-name/bio edits.

The public chat response now includes only message ID, display name, avatar, body, timestamp and whether the message belongs to the current player. It omits player UUIDs, emails and usernames. Clicking a display name resolves a profile through the message ID; the profile RPC returns only display name, username, bio, joined date and avatar. Identity resolution for reports remains on the server; authorized developer pages still expose the private account identifiers required for management.

The compact chat toggle sits beside the title/settings button. Chat has stable DOM rows, touch/scrollbar history browsing, auto-scroll only when near the bottom, and a New messages button while reading older messages. The top-right report action opens a message picker, then a reason/evidence page. Reports show an explicit Chat Message heading in the developer page.

Account is a nonmodal floating window with a bounded height and scrolling. It does not pause simulation, block ship/foot controls, enable the screen shield, or inert the game. Focused text fields consume keyboard input while typing. Login/recovery still requires authentication before gameplay. Account, chat and login share the Settings blue gradient/borders.

The current player's UPID starts masked with Show/Hide, re-masks on close and is copyable only through an explicit action. Public profile/chat payloads contain no player UPID or email. Change password uses the authenticated Supabase Auth `updateUser` endpoint with the current password and new password; inputs clear before the network call. No password enters the game's database or developer console.

Photo selection auto-uploads and also has a manual upload/retry action, visible progress/error text outside the disclosure, and a local preview. It supports empty/Android MIME values when the extension is a supported image and falls back to an Image/blob decoder if createImageBitmap is unavailable or rejects the photo. Stale heartbeat responses cannot overwrite a newly saved local profile. Missing/failed images use the bundled default-profile SVG, including chat, public profiles, personal profiles and developer account rows.

Additional tests exercise the decoder fallback, upload/preview/removal, masked UPID toggles, cleared current/new password payloads, report message selection/evidence, history scroll preservation, public response allowlists and absent peer UUID/email keys. The game smoke test opens Account and verifies keyboard steering and rendering continue. Real phone file selection and the actual password provider still need device testing after the SQL migration.

## v66: native mobile photo picker, report delivery and editable usernames

Run **202610250005_mobile_reports_usernames.sql** after 003. It also includes the 004 privacy/bio changes, so users who missed 004 need only run 005. No existing save, image, report or username is deleted.

Photo selection temporarily unlocks orientation and suppresses the game's rotate prompt, GPU frames and resize work while the native picker is active. Returning/cancelling settles once; the account panel remains usable in portrait. Fullscreen is never automatically requested on return, which could interrupt the chooser. Use **Resume landscape** after selecting a photo, or close Account and use the existing rotation controls. Account is now centered in both orientations.

Mobile/network work is reduced: empty chat responses no longer cause a layout pass; chat requests run only when Chat is open; hidden pages/pickers skip polling; the heartbeat runs at most once per 20 seconds and returns only revision/profile timestamp. The full own profile/image is fetched only when that timestamp changes. Resize events are coalesced and unchanged viewport dimensions avoid graphics reconfiguration. Debug telemetry is not regenerated on other sidebar pages, and report-status checks use a small feed without avatars. These target known unnecessary work; they are not a measured FPS guarantee on the user's phone.

Reports default to **All reports**, so reviewed/dismissed entries remain visible. Successful submission must receive `{ok:true}` before the UI shows success; the database also returns a report number. An authorized debug session checks on opening/unlock and polls while visible. New report entries are logged with reporter, reported name and Chat Message. Same-page successful reporting triggers an immediate refresh; other accounts/devices appear on the normal polling cycle. Server/migration errors are displayed rather than silently appearing as an empty report list. The server-side report pipeline remains developer-only and stores the original message as evidence.

Signup has an availability check on the username field; login continues to use email/password, and no public username-to-email lookup is exposed. Account → **Change username** allows choosing a new permanent username. Case-insensitive uniqueness, filtering, reserved-prefix checks and a rolling **24-hour cooldown** are enforced in PostgreSQL under a row lock. Initial existing/generated usernames can be changed immediately. Selecting the same username does not consume another change. The next allowed time is shown locally, and a self-service name change is recorded in private moderation history.

Tests cover native chooser/change/cancel lifecycle, no fullscreen re-entry, portrait prompt suppression and paused GPU work while choosing; a submitted report appearing in the developer feed; lean heartbeat responses; duplicate/case-insensitive name denial; same-name no-op; server cooldown rejection; and successful change after 24 hours. Real Android file-picker behavior and mobile FPS still require a device check.

## v67: photo edit badge and robust native selection

The photo edit control is a small pencil badge over the profile image's upper-right corner. Its transparent native file input remains directly clickable/tappable. Selecting a photo is observed through both input/change events and again on chooser return; a selection token deduplicates those events into one upload. Opening the chooser resets the native value so the same file can be selected again. The selected File remains available until the return handler has run.

Image preparation now prefers FileReader/data URLs for Android content-provider files. Bitmap and object-URL image decoding remain bounded fallbacks, with progress text and timeouts so a stalled decoder cannot leave an indefinite silent operation. The upload must echo the exact saved image before success is shown; otherwise the UI shows an error/retry action. No database change is needed for this frontend update.

After a selected photo's native chooser closes, the client automatically requests landscape/fullscreen using the existing game callback. Browsers that require another user gesture may reject that attempt; the Landscape button stays visible as a fallback. The chooser remains protected from orientation/fullscreen re-entry while it is open.

Tests simulate native input/change/return, verify exactly one upload, support choosing the same File again, automatic landscape callback after return, and the FileReader path with an Android-style MIME type. Real phone selection remains a device verification step.

## v69: visible signup validation and an actual crop editor

Supabase's public Auth settings were checked read-only: signup is enabled, email auth is enabled, and email confirmation is required. The client signup form now bypasses silent native constraint blocking and explicitly validates email, username, display name, password length (12–128) and confirmation. Status/progress is above the fields and sticky while scrolling. An unavailable SDK or in-flight request produces a visible message; signup has a bounded SDK timeout and displays confirmation/email instructions or the backend error. No test accounts were created in the live project.

The photo pencil badge is reduced to 18 px. Selection opens a separate visible crop panel, with a circular preview, drag-to-position, zoom, 90-degree rotation, Cancel and Save photo. It performs no server write until Save photo. Network failures keep the editor/source open for retry; cancellation releases the selected image and preserves the saved profile. The output is still a bounded 128×128 JPEG. The old automatic center crop remains only as a reusable helper, not the player-facing upload flow.

Tests validate the crop geometry, zoom/rotate, explicit save-only upload, cancellation and retry; native selection/reselection still opens the editor once; signup tests verify explicit invalid-email/password handling, SDK readiness feedback, and a valid request reaching the mocked Auth service. Real Android layout/file selection and live signup remain device checks.

## v70: native mobile crop dialog and private moderation notices

Apply **202610250006_moderation_notices.sql** after 003. It includes 004/005 for users who missed them, preserves account/save data unless an explicit deletion action is performed, and is repeatable.

The small pencil is now an explicit button which opens a hidden `image/*` file input in the same user gesture. Selection events are captured, the crop editor is a native modal dialog above game/fullscreen overlays, and the preview is promoted again after orientation restoration. This addresses overlay/file-input interference without claiming a completed PC/Android device test. The picker accepts image formats generally; decoding depends on browser support. Inputs up to 20 MB are allowed; larger originals first attempt a bounded bitmap resize. Unsupported formats produce an error inside the crop panel. Only a rasterized, bounded JPEG is saved to the server. A real saved player photo is returned by the public profile RPC and displayed instead of the default avatar.

Signed-in players with an active moderation decision receive a private blue Account Review screen: reason, decision date, temporary access end or removal status, Discord appeal and Check access again. No actor IDs, peer player IDs or emails are included in public profiles/notices. The notice endpoint accepts no target ID and derives the owner from the verified JWT. Game access/save/chat remain blocked by server-side checks.

**Delete game account now means deleting its server save (inventory/currencies), avatar and bio, while retaining its Auth identity and username so it can sign in to view its moderation reason and appeal.** Developer UI uses that exact label. Restoring the game account removes its deletion status and starts with an empty server save; bans remain separate. Browser-local world data is not a server save and is not removed by this action. Reasons and actions remain in private moderation history. This is a change from the earlier permanent Auth-user deletion action.

A previously hard-deleted Auth identity cannot authenticate from a fresh login. If that user still has a valid, signed token, the own-notice RPC can return the historical deletion reason; it never offers an unauthenticated email/username lookup. New deletions use the retained-identity design described above.

Tests cover the explicit pencil/native input interaction, `image/*`, crop modal promotion without losing the photo, a real avatar value returned/rendered in public profiles, owner-only ban/deletion notice content, server denial while removed, and restoration with zero inventory/currencies. The SQL integration test applies 006 directly after 003 and repeats it, validating the combined upgrade path.

### v73: Files browser and in-game photo library

The pencil now opens a dedicated game photo library with a visible native file
control. The input is unfiltered and supports multiple selection, allowing Android
to offer its document browser instead of forcing the image-only Photos picker.
The game cannot enumerate private device photos without a user selection. Up to
eight selected images appear as thumbnails; one selected image opens Crop directly.
Non-images and files over 20 MB show feedback. Browser-supported image codecs are
still required. Only Save photo uploads the cropped JPEG to the existing avatar RPC.
Returning from selection promotes the crop dialog without requesting fullscreen or
landscape. Landscape remains a separate explicit action. No new SQL is required.
Tests cover duplicate input/change/focus events, thumbnail selection, error feedback,
resource cleanup, crop/save and account behavior; actual Android picker behavior
still requires device verification.

### v74: session ownership, bio confirmation and desktop lighting

Run `supabase/migrations/202610250007_game_sessions_profile.sql` in
https://supabase.com/dashboard/project/zwtcytzaozysxiqixihk/sql/new .
This includes 006 (and its 004/005 prerequisites), so users with 003 installed
only need this latest file. It is repeatable.

The most recent authenticated device connection claims the account's game session.
Ownership is bound to the signed Supabase session ID and checked inside each player
RPC. The previous device cannot save, edit profiles or read game/chat data after
replacement. The foreground client detects this on its next heartbeat (normally
6–8 seconds), stops cloud saves/chat, signs out with `scope: local` and displays
“Duplicate Game Session.” Returning from a background tab triggers a check.
No global sign-out is used, so the winning device stays signed in. Tabs sharing
the same browser Auth session count as the same device session. Local world state
remains local; only the already-supported inventory/currency data is cloud saved.
The row lock protects in-flight save/claim ordering. Apply SQL before testing the
two-device behavior. The client tolerates the missing start RPC for rollout, but
server session enforcement requires this migration.

Bio edits return the persisted bio and display name; the client confirms both
before announcing success. The latest migration installs the bio-enabled profile
RPC for users who skipped earlier profile SQL. Reloaded profile/peer responses
still expose no private IDs or email addresses.

All normals in the uploaded ship JSON were zero. The shared model loader now
reconstructs missing/invalid normals from triangles, preserving the supplied
materials, texture coordinates, geometry and model. This repairs GPU lighting
without changing world brightness. Auth fields use 30px heights, matching opaque
blue backgrounds and explicit spacing; portrait HUD currencies get a separate
row; desktop scroll areas use thin rounded blue scrollbars.

Validation: account/social/debug suites; PGlite integration including repeat
migration, second-device takeover, rejected old-device writes, private-table
permissions and saved bio reload; nondegenerate ship faces have unit normals;
mobile and desktop mocked-render startup/control/resume tests. Real GPU/device
visual verification remains outstanding.

### v75: current-play chat, screenshots and presence

Run `202610250008_chat_images_presence.sql` in
https://supabase.com/dashboard/project/zwtcytzaozysxiqixihk/sql/new . It includes
004–007 and can be applied after 003 even if those updates were skipped.

Chat takes a server cursor when gameplay connects and displays only messages
sent after that cursor. Opening/closing the chat does not reset the cursor.
Authenticated players can select screenshots through the game gallery, preview
and remove an attachment, then explicitly send it. Images are rasterized to JPEG,
kept at their original aspect ratio (up to 768px, 160000 data-URL characters),
and retrieved separately from message polling. Existing text filter and rate limits
also apply to screenshot captions. Image pixels are not automatically moderated.
Reports preserve screenshot evidence even after the original chat message expires.
Developer-only Reports renders that evidence; public chat returns no IDs/emails
or usernames. Server-generated name colors depend on usernames without exposing
them. Closed chat accumulates an unread badge and plays a short notification tone
once browser audio has been enabled by a player gesture.

Developer account rows/details show recently active Online/Offline state. A valid
current game/Auth session plus a heartbeat within 30 seconds is required. Explicit
logout clears presence; abruptly closed/offline devices age out. Gameplay heartbeats
run every 6–8 seconds while visible. The account menu now uses a person icon.

New preferences default to look sensitivity 5, rotation speed 2, left ship controls
125%, right 100%, Jump 100px and Thumbstick 118px. Existing explicitly saved
preferences remain adjustable and retained. Debug UI uses the main blue palette.
The standing ship model bounds are centered over the launch pad. Landable rocky
planet categories use game radius 32, just below Mars (33.9); Mars, moons, asteroids,
stars and gas/ice giants keep their radii. This is a gameplay scale, not physical size.

Validation includes fresh-session cursor, image preview/send/render, unread reset,
colors, new defaults/exempt bodies, desktop model/pad centering, integration SQL
repeatability, image validation/report retention, online/logout and existing
account/chat/moderation/control regression checks. Actual mobile picker, sound and
GPU visual appearance still require device verification.

### v76: friends, private chats, owner-managed groups and privacy controls

Run `supabase/migrations/202610250009_friends_groups.sql` in
https://supabase.com/dashboard/project/zwtcytzaozysxiqixihk/sql/new . It includes
004–008, so it can be applied after the existing 003 setup even if intermediate
updates were skipped. Re-running the migration preserves friend/group records.

The personal email is now a readonly masked field with Show/Hide; it remasks when
the account menu closes or reopens. Settings contains a 0–100% chat background
transparency slider, stored locally. Text and controls remain opaque. Public
profiles return Online/Offline using the same recent-heartbeat/session rules as
the developer directory. Email addresses and player UUIDs are never returned by
the new friend/group/profile RPCs. Room UUIDs identify conversations, not players.

Friends appears beside Account, with Friend chats, Group chats, Requests and
Blocked tabs. Find players by exact public username; send/cancel requests,
accept/decline incoming requests, unfriend, block and unblock. Blocking removes
friendship, disables direct chats in both directions and hides blocked senders'
global/group messages. Unblocking does not automatically restore friendship.
Friend chats require an accepted friendship and retain conversation history.
Global chat retains its current-gameplay-session display behavior.

A group has at most ten members including its owner. The owner can add accepted
friends, edit the name/bio/photo, remove a photo, kick, ban/unban, transfer ownership
to an existing member, or delete the group. Other members can leave. Owners must
transfer ownership or delete before leaving. Ownership transfer immediately
removes the old owner's privileges. All membership and ownership checks are server
side; row locks serialize changes and enforce the member cap. Invited friends are
added directly and may leave. Group bans block re-addition until explicitly lifted.
Deleted game-account members remain removable via the owner's roster.

Private/group messages support text, screenshot gallery selection and reporting
into the existing developer Reports page, including retained screenshot evidence.
Only members can read messages/images; kicked/banned/nonmembers are rejected.
Text filtering, bounded JPEGs, idempotent sends and per-sender rate limits apply.
Recent history is capped at 500 messages per room; clients show the most recent
50. Screenshots are cached across visible-menu refreshes; typing and open owner
controls preserve their forms. Lists/messages refresh every eight seconds while
the menu is visible. This is polling, not push delivery or end-to-end encryption.

Validation: real PostgreSQL-compatible integration tests cover private access,
request/accept/block/unblock/unfriend, reports/images, owner-only editing,
kick/ban/unban, ten-member rejection, ownership transfer/leave/delete and anonymous
access denial. UI fixtures cover email remasking, transparency, owner-control
removal after transfer, image caching and logout cleanup. Existing account,
social, debug and mocked desktop/startup checks pass. Actual mobile/GPU visual
checks remain device-dependent.

### v77: party UI, shared profiles, verification, voice and message history

Run `supabase/migrations/202610260010_social_updates.sql` in
https://supabase.com/dashboard/project/zwtcytzaozysxiqixihk/sql/new . It includes
004–009 and is tested both from 003 and when repeated. Existing social data remains.

The transparency slider now affects only Global Chat. Friends uses an opaque,
bottom-right Party & Friends layout with more space between controls. Player
profiles from global chat, friends and group members share the same centered panel
and friend-action controls. The account editing panel remains separate.

A server-owned `verified` flag defaults false. Only the existing authorized Debug
Manage Accounts actions Grant verified badge / Remove verified badge can change
it, with a required reason and moderation history. Signup metadata and normal
profile editing cannot grant it. Public profile snapshots, chat names, friend/member
cards, own account headings and developer account rows/details render the badge
from that flag. Player UUIDs and emails remain private.

Earth has two lightweight animated aurora curtains after dark. Strength fades with
daylight, cloud cover and altitude. They use world-space geometry, additive colors
and the renderer's logarithmic-depth chunks, without adding scene render passes.
Actual GPU appearance must be checked on a real device.

Private friend/group chats support optional voice messages when MediaRecorder,
a microphone and an allowed recording format are available. Record is an explicit
user action; maximum client recording time is 20 seconds. Stop produces a local
preview; Send voice explicitly uploads it. Cancel, closing/changing chat, logout
and backgrounding stop microphone tracks and discard unfinished recordings.
Supported data payloads are bounded WebM/MP4/Ogg audio (350000 data-URL characters).
Only current authorized chat members can fetch them. Recording and playback are
browser/device dependent; no automatic voice transcription/filter is claimed.

Friend/group unread messages and incoming requests poll every eight seconds while
the game is visible, including when the Party panel is closed. Initial history is
used as a baseline to avoid old-message notification sounds. A badge and a short
sound indicate new events after browser audio has been enabled by a gesture.

Players may edit/delete their own messages in global, friend and group chats.
The editor can replace/remove the screenshot and edit the caption. Deleting leaves
a named `deleted a message` notice and removes public media. Global polling also
synchronizes edits/deletions of already displayed messages. Private message access
still requires current membership/friendship. Repeating a deletion or an unchanged
edit is a no-op; changes are limited to 60 per account per hour.

Every actual edit/delete stores the original text and full sent screenshot/voice
in a private append-only application audit table. Deleting a group also archives
its remaining nondeleted messages before cascading removal. Authorized developers
can inspect all versions under Debug Message Logs, including image/audio previews;
ordinary players and anonymous clients cannot fetch the audit records. These are
the sent, prepared media bytes, not the unprocessed original device files. Existing
reports keep their own evidence snapshots independently.

Validation: account/social/debug suites and mocked desktop/startup checks; PostgreSQL
integration tests cover developer-only verification, member-only voice/idempotency,
notifications, cross-user edit/delete rejection, tombstone synchronization and full
text/image/voice/group-delete audit retention; UI fixtures cover shared badge/profile,
notification sound/badge, edit payloads, voice preview/cancel/track cleanup and aurora
night/day behavior. Actual mobile mic, picker, playback and GPU visuals remain to
be verified on physical devices.

## v78 — conversation layout and message controls

Friend and group conversations now share the Chats inbox. Room details and group owner controls open from Details, leaving space for a flexible message log. Own messages align right; other players' messages align left. Deleted notices use 65% opacity in global and private chats.

Own message actions live in a collapsed “…” menu. Editing opens in the conversation composer with the complete text and existing photo; text-only messages hide image-replacement controls. Delete and report confirmations use in-game panels. Chat, social, profile and account overlays are hidden during startup and rotate-device warnings.

No additional SQL is required beyond migration 010. This update preserves the existing server authorization and original-message moderation audit.

## v79 — pinned composer, header details and conversation previews

The conversation uses three grid rows: compact header, flexible scrolling messages, and a composer anchored to the bottom. The stale height limit on the conversation body is removed. A “…” menu beside the conversation title opens member details and group controls without occupying a permanent row.

Chats shows friend and group conversations with latest-message previews instead of type labels. Authorized message reads run with at most three concurrent requests; previews are cached briefly and invalidated by notification cursors. Newest visible conversations sort first. Friends has its own page/button, separate from Chats, Requests and Blocked. No new SQL is required.

Checked the rendered layout at 1536×690 and 844×390, including composer position, scrolling, details toggle and rotation-warning overlay behavior. These browser checks use fixture account data and do not exercise real-device media or the live database.
