# Coach wellbeing layout and training RPE entry

The wellbeing overview no longer hosts the staff manual RPE editor. Individual
load calculations and the player's read-only history still include all existing
additional activities. No data is moved or rewritten.

The training detail mounts the shared editor after the session RPE panel, for
staff only. It reuses the current active roster, fetches fresh individual RPE
and attendance rows plus existing additional activities, and refreshes the
session mean after save. Related local caches are invalidated on a successful
mutation, before refreshing reads, so returning to wellbeing reloads load data.

Selecting a player defaults to the current session only when it has a confirmed
end in the past, validated present/late attendance, and no player-submitted RPE.
Extra activity retains its own date/time and is not attached to the training
used to open the form. Minutes and score stay blank; provenance, duplicate
checks, source protection, RLS and the save RPC are reused unchanged.

The coach overview has a shorter heading, a labelled icon refresh button, four
compact summary tiles, the existing expandable response list and shorter
weekly bars with the same values, coverage and explanations. CSS is scoped to
the coach overview. Existing player screens and temporal calculations are
unchanged. No schema migration is required.

Validation: 103 Node tests pass. The actual bundled components were mounted in
Chromium against a local in-memory fixture (no production data writes), at
320, 393 and 768 CSS pixels. Verified no horizontal page overflow, response
accordion, removal of staff entry from wellbeing, current-session selection,
individual team RPE save, extra-activity save, and zero browser page errors.
Production permissions and DB write paths are unchanged; this browser check
uses mocked reads and writes and is not an authenticated production test.
