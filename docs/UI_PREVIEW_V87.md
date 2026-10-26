# UI preview update v87

Uses the 15 supplied PNG icons, optimized to 192px for runtime. Missing utility icons use small local SVGs. Original ZIP is not shipped.

Global chat has avatar/name/time rows, independent message options, pin persistence and a fixed composer. Party & Friends has a mixed recent inbox, unread badges, timestamps, centered conversations with own messages on the right and a fixed composer. Existing reporting, edit/delete, GIFs, voice previews and media viewing are retained.

Player Account has Profile, Account, Security and Data pages. Private email and UPID remain masked. Profile editing, username cooldown, password changes, email verification status, actual sessions, blocked users, inventory/currencies and manual saving use existing account data. New actions include password-confirmed session revocation, deactivation/reactivation and permanent deletion. Deletion requires typing DELETE. Owned groups transfer to another member; empty groups are removed. Historical moderation evidence is retained. No passwords are stored or exposed to developers.

Universe Map keeps its interactive 3D canvas and filters, adding selected-body preview, description, system/type, actual game radius/gravity/distance, lock destination and route actions. Values describe the game's scale.

## Supabase setup
Run `supabase/migrations/202610260012_account_pages_progress.sql` after migration 011 in https://supabase.com/dashboard/project/zwtcytzaozysxiqixihk/sql/new . This migration is not automatically applied by GitHub Pages. Existing gameplay works before it is installed; new account dashboard/actions need it.

Exploration progress awards 100 XP once per recognized visited solid world. Level thresholds grow by 100 XP per level. Visits are client reported and validated against the catalog, not an authoritative anti-cheat system. Account actions are scoped to the authenticated caller; sensitive actions check a recent password AMR and a live auth session. Deactivation preserves saves and supports reactivation. Developer moderation remains enforced.

## Validation
SQL012 tested twice for repeatability using PostgreSQL-compatible PGlite, with private dashboard/session isolation, exploration idempotency, recent-password enforcement, session revocation, deactivation/reactivation, ban preservation, deletion/group transfer and anonymous denial. Browser checks at 1536x690 and 844x390 cover all four account pages, private fields, message options, inbox/conversation layout, password-confirmed revocation, deletion cancellation and the actual map canvas. Existing account, social, language/device persistence, desktop startup/input, and map-related regression suites pass. Browser tests use fixture accounts and do not delete live users.
