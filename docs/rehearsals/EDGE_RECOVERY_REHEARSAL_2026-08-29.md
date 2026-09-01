# Venue edge recovery rehearsal — 29 August 2026

## Outcome

**PASS** at approximately 20:34 AST (00:34 UTC on 30 August 2026).

This was an automated technical recovery drill against the local presentation stack. It proves the synchronization protocol behavior; it does not replace the required physical venue network-interruption test.

## Scope and evidence

- Edge node: `7d9bf462-fd86-4b93-a52d-8abf39a4ac16`
- Fixture: `4a144a25-3404-4da6-82c0-2f819badee6d`
- Fixture label: `LOC Presentation Rehearsal`
- Heartbeat authentication: passed
- Bootstrap and fixture scoping: passed
- Match-state and ledger export: passed
- Initial synchronization: accepted
- Simulated lost HTTP response: the identical batch was retried and accepted as a duplicate without a second write
- Changed payload with the same batch ID: rejected with HTTP 409
- Final cloud state, score, version and event count: unchanged and reconciled

The data preparation step deletes receipts only for the deterministic rehearsal-owned edge node, so the drill is repeatable without truncating shared tables.

## Presentation gate after recovery

The full presentation-readiness gate passed immediately afterward at `2026-08-30T00:34:56.166Z`. API, public website, Teams, Platform, GameDay, audience display and analytics returned HTTP 200; JSON and XML broadcast fields agreed; analytics CSV returned 200; and the presentation fixture remained scheduled at 0–0.

## Outstanding human proof

1. Disconnect the actual venue uplink while operators continue the shortened match.
2. Record the scorer console and gymnasium screen during the interruption.
3. Restore connectivity and verify the venue/cloud sequence and version agree.
4. Capture actual vMix output from the same feed.
5. Record tester names, equipment, timestamps and sign-off.
