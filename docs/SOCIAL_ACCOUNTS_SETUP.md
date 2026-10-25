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
