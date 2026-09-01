# GameDay → vMix: live scorebug wiring

One table official records the score in GameDay. vMix reads the same published feed and drives the on-air scorebug, so no separate broadcast score entry is required. Use a separate timekeeper when staffing permits; the trained scorer may also control the clock as the minimum-crew fallback.

## Feed
- **Verified local URL:** `https://api.netballamericas.test/live.xml` (XML; `live.json` is also available)
- **Production target:** `https://api.netballamericas.org/live.xml` after the reviewed release is deployed. The 29 August 21:00 AST activation audit returned HTTP 404, so do not configure the production source yet.
- **vMix XPath:** `/gameday/match`
- **Update interval:** `1000` ms is right for netball. Only drop to `100` ms if the bug shows tenths of a second.
- Field names contain **no spaces** (a vMix requirement) — use them exactly as below.

## Setup (once, in vMix)
1. Build the scorebug as a Title in the **GT Title Designer** (one text field per item below; two image fields for the flags).
2. Open the **Data Sources Manager** (hamburger icon, lower-right) → **+** → **XML**.
3. Paste the feed URL, set **XPath** to `/gameday/match`, set **Update every** to `1000` ms.
4. Add the scorebug Title input → right-click → **Title Editor / Data Source** → map each title field to the column below.
5. Take the bug to a layer/overlay. From then on it updates itself as the score changes — no typing.

## Field map
| Feed field (XML) | vMix Title field | Notes |
|---|---|---|
| `MatchId` | (logic/debug) | Stable fixture identifier; useful for validating the selected match |
| `Status` | (logic) | `LIVE` or `FINAL` — drive a "FT" indicator if wanted |
| `Quarter` | Quarter | e.g. `Q2` |
| `Clock` | Clock | `MM:SS`, or `FT` at full time |
| `TeamAAbbr` | TeamAAbbr | 3-letter code, e.g. `BRB` |
| `TeamAName` | TeamAName | full name, lower-third use |
| `TeamAScore` | TeamAScore | integer |
| `TeamAFlag` | TeamAFlag (image) | flag URL; vMix binds images by URL |
| `TeamBAbbr` | TeamBAbbr | e.g. `JAM` |
| `TeamBName` | TeamBName | |
| `TeamBScore` | TeamBScore | integer |
| `TeamBFlag` | TeamBFlag (image) | |
| `Venue` | Venue | optional |
| `Court` | Court | optional |
| `Provisional` | (logic) | `true` until the result is confirmed |
| `UpdatedAt` | (diagnostic) | Feed-generation timestamp; useful when checking stale updates |

## Notes
- **Same feed, two consumers:** the public website and the vMix bug both read this; the official scores once.
- **Flags:** host the flag PNG/SVGs at a stable URL (the `*Flag` fields point to them). If an image is unavailable, retain the three-letter abbreviation rather than typing a replacement score/team manually.
- **System of record:** the bug and website show the *provisional* live score. The signed umpires' scoresheet remains the official result; the public number is confirmed when the match is marked final.
- **Neutral fixture language:** Netball Americas fixtures use Team A and Team B. Neither side is treated as home or away.
- **Push alternative (not recommended):** vMix also has an HTTP API (`SetText`) GameDay could push to. It is lower-latency but breaks if the vMix machine's address changes — keep Data Sources (pull) as the primary.
