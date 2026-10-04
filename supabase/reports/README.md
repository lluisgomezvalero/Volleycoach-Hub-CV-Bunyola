# Match reports v1

Reports reuse `public.match_statistics`: one row per `event_id` (existing unique constraint), `payload.report`, `status`, `published_at`, `created_at`, `updated_at` (existing update trigger). No additional table or persisted derived percentages.

Staff can import from Statistics → Importar informe. The original manual editor, publication status, archived events, team identity, calendar and historical values remain supported. Report updates merge the existing payload.

## JSON contract

`version`: `cvbunyola_match_report_v1`

- `match`: `{event_id?: uuid, opponent: string, round: integer, result: {ours: integer, theirs: integer}}`
- `headline`: short match summary
- `totals`: raw stats
- `sets`: `[{number: 1, score?: "25-21", stats: rawStats}]`; empty list allowed if unavailable
- `players`: `[{player_id?: uuid, name: string, position?: string, stats: rawStats}]`; empty list allowed if unavailable. Names/IDs must match the active team roster.
- `conclusions`: up to four short strings, `headline`, `positive`, `key_issue`, `next_objective`

Raw stats:

```json
{
  "reception": {"positive": 20, "exclamative": 30, "errors": 10},
  "attack": {"int": 89, "points": 33, "errors": 17},
  "serve": {"int": 80, "aces": 10, "errors": 9},
  "block": {"points": 6},
  "opponent_errors": 29
}
```

`block.total`, `block.errors`, `defense: {positive,errors}` and `setting: {positive,errors}` are optional. Omit player fundamentals with no participation. Match totals/sets require reception, attack, serve and block points. Counts must be nonnegative integers. No percentage fields are accepted.

Sets are sequential and their sum must match match totals whenever a field is provided for every set. Individual recorded counts must not exceed match totals. A report with sets must include as many sets as the result indicates. Invalid JSON never enables publication.

Attack and serve `int` already include points/aces and errors. Continuities are `int - points/aces - errors`. Attack efficacy is `(points-errors)/int * 100`. Reception total is `positive+exclamative+errors`. Zero denominator produces an unavailable percentage, not zero. Negative attack efficacy remains negative.

## Security and notifications

Existing `stats_staff_write` RLS protects writes by club and staff role. Existing RPC `get_published_match_statistics` now includes `report` only for a published row belonging to the caller's club/team, while retaining the legacy visible metric filtering. No new direct player SELECT policy was added.

First report publication sets `published_at`; editing an already published report preserves it. The existing minute-based notification function records `match_report_published` independently from legacy `match_statistics_published`. The unique event/player/kind log prevents repeated edit notifications. Push permissions are still required.

`published_report_read.sql` records the deployed RPC change. Tests: `node tests/match-report.test.cjs`. Database permissions were tested using authenticated player claims in rolled-back transactions: published report visible, draft hidden, player update affects zero rows.
