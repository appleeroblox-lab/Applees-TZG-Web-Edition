# Mining catalogue update — v0.0.106

Status: **live SQL018 behavior verified on 28 October 2026** on the configured project `zwtcytzaozysxiqixihk`. Both the expanded private validator and the legacy save delegate were already installed when checked. A non-mutating live test accepted all 108 supported solid bodies and 81 item types, and rejected unknown IDs, oversized quantities and duplicate stacks. Private function permissions, the public authenticated save wrapper and player-table RLS were also checked. No existing player saves were modified.

The Supabase migration-history list is empty, so this confirmation is based on installed function definitions and behavior, not a recorded migration entry. GitHub Pages does not run database migrations. The local SQL fixture additionally tests real save/load, mutation retry, revision conflict and account guards; a signed-in browser save/reload on the live project remains a manual end-to-end check.

The existing save delegate and private inventory validator both used older exact body allowlists. Resources mined on newer bodies such as Bennu or Vesta were rejected as “Unknown item or celestial body.” The client then incorrectly treated that data error as a sign-in failure.

The web client now retains the signed-in game and its pending save for catalogue/connection errors. It explicitly reports that a server catalogue update is needed. Pending inventory remains in the open session; this change does not claim it has reached the server or guarantee recovery after closing/reloading the page. Actual authentication, duplicate-session and cloud conflict failures retain their existing handling.

## Apply to another deployment or restore the catalogue

1. Use an authorized Supabase connection for the existing game project.
2. Run `supabase/migrations/202610280018_mining_catalog.sql`. SQL013 resource XP must already be installed. The migration is repeatable and replaces only the catalogue validator and its legacy save delegate; it keeps the public XP wrapper and authentication/session/revision guards.
3. Mine a resource on Bennu or Vesta. In Account → Save Data, confirm that the save succeeds, then reload and verify the inventory quantity and body identity are retained. Repeat for a normal Earth resource.

The migration enumerates the current 108 solid-body IDs and 81 item IDs. Unknown IDs, extra fields, invalid quantities, duplicate stacks, wrong-account writes and stale revisions remain rejected.

Validation: `npm run test:settings-save-recovery`; `npm run test:mining-catalog:sql` (requires `@electric-sql/pglite@0.5.12`, as do other SQL fixtures). SQL tests reproduce the old Bennu rejection, apply the migration twice, save every supported body/item, exercise mutation retry and verify the existing account/schema/revision guards. These local tests do not certify live database activation.
