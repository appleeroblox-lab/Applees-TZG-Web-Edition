# Compact UI and progression v88

Global chat is 350x270px maximum; Party & Friends 510x420px; Player Account 580x440px, with smaller viewport limits and scrolling bodies. Buttons align supplied icons with their text, remove legacy duplicate glyphs and retain readable multiline labels. The profile card and Settings are compact. Jump/Run are icon-only with accessible names.

Universe Map is a nonmodal overlay: simulation, rendering, keyboard input and unobstructed touch controls continue. It includes every catalog system and an All systems choice; selecting a search result switches to its actual system. The selection card separates information and actions with spacing. Textures load progressively; no false texture is substituted for bodies without observed artwork.

Friend/group message options no longer offer translation. Global translation stays available. The image viewer is full-screen black with one close button, original image, drag, wheel zoom and pinch; double-click resets zoom. Sessions and password changes open separate dialogs.

Verified Accounts is a developer-only page listing verified players. Search finds accounts to grant/revoke verification through the existing audited moderation RPC. Chat readers use the current profile's verified flag. No player email, UPID or passwords are added to public chat/profile displays.

Resource progression: successful accepted save transitions award 10 XP per sold resource, 25 XP per crafted recipe; purchased items give no crafting XP. Shared ingredient budgets prevent awarding the same consumed resource twice. Mutation retries and rejected/conflicting saves give no extra XP. Existing exploration XP remains. Maximum level 10,000; the former flight-assist status bar shows level/XP. Progress is calculated on the server and returned with the confirmed inventory save. Because gameplay uses client-simulated economy snapshots, rewards reflect accepted net inventory/currency transitions; activity canceled out between saves cannot be reconstructed. This is not a new authoritative anti-cheat economy.

## SQL setup
Run `supabase/migrations/202610260013_compact_ui_resource_xp.sql` after SQL012 in https://supabase.com/dashboard/project/zwtcytzaozysxiqixihk/sql/new . GitHub Pages does not apply database migrations. Until installed, the UI is updated but new verified-directory/resource-XP functions need the migration.

## Validation
PostgreSQL-compatible PGlite tests apply SQL013 twice and verify crafting/sale XP, purchase exclusion, idempotent retries, revision conflicts, account scoping, 10,000 level cap and developer-only verified search/grant/removal. Existing SQL012 account protections remain tested. Browser layout checks at 1536x690 and 844x390 cover compact panels, readable scroll regions, private fields, separate sessions dialog and map action bounds. Game smoke tests prove movement/rendering continues with map open and all catalog systems/bodies are selectable. Account, debug, social and language suites pass. Mobile performance work removes repeated unchanged currency text writes and limits localization mutation scans to changed subtrees. These checks are simulated mobile viewports, not a physical-device performance guarantee.
