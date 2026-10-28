# Close icon and collective fatigue overview

The shared X component had retained open Tabler stroke geometry while the
IconScout renderer switched to fill-only SVG. The icon migration's name
matcher required at least two characters and skipped the one-letter X.
It now uses the closed, filled times.svg from the already pinned official
IconScout Unicons source. Existing button actions and accessible labels are
preserved. Regression coverage includes one-letter icon names and explicit
painted geometry for every shared icon.

The weekly team overview now queries and averages fatigue only. The existing
per-player-per-week weighting, time windows, response coverage and record counts
are preserved. The team sleep and pain averages and their miniature cards are
removed, including the redundant scale legend. Sleep and pain still appear
in each player's individual records, forms and today's individual signals.
The fatigue explanation clarifies that a team average does not establish
that training caused a change.

Validation: 106 Node tests; actual bundled components in Chromium with local
fixture data, three close controls verified for nonempty painted area and
successful dismissal, widths 320/393/768 with no horizontal page overflow,
no collective sleep/pain cards and no page errors. No production data was
written during validation. No schema migration or historical data edit.
