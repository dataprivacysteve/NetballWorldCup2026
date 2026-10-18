# LOC roster photo release

The LOC instruction received on 5 October 2026 authorizes publication of team roster portraits. Migration 0043 records that decision and enables the Americas Qualifier release. Individual website-consent approval records are no longer required to display these portraits. Accreditation and its consent records are unchanged.

## Publication behavior

The public squad and lineup expose the latest uploaded JPEG for players on approved registrations and approved rosters. Portraits continue to come through `GET /public/players/{playerId}/photo` from the private photo bucket. No identity documents or storage keys are exposed in the squad response. An individual withdrawal takes precedence over the release, including after a replacement upload.

The LOC platform's **Player images** screen shows the recorded release decision and published portrait count. LOC officers can disable the whole release with a recorded decision, withdraw an individual portrait, or restore it. The authenticated controls write audit entries. Existing per-player approvals remain historical records, rather than publication prerequisites.

Demo portraits remain served from `athletes/`. A person without a published portrait appears as a compact name card. Failed image requests also collapse the photo space.

## Deployment

Deploy the updated API, website and LOC platform together. Apply migrations 0042 and 0043 using the configured release's database connection:

```sh
pnpm --filter api db:migrate
pnpm --filter api build
pnpm --filter web build
pnpm --filter platform build
```

Restart the corresponding production services using the installation's existing Supervisor configuration. Migration 0043 enables the release specifically for `americas-qualifier-2026`; it does not change other events' release switches.

After deployment, confirm the Player images screen reports Enabled and real roster portraits return public image paths. Check one image, individual withdrawal/restoration and the whole-release switch. Fixture feeds should start on 19 October, include the final 26 October evening in Barbados time, and exclude the old February fixtures. The website shows one match day at a time and has no shop links or merchandise banner.

Local migration and application checks do not deploy changes to the live server.
