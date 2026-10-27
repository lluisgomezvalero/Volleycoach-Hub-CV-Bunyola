# App iconography

The active application uses Tabler Icons outline SVGs, pinned to upstream commit
`a4ce1404bc6d24d3c365afe7b258d6bf6f48d62d` from https://github.com/tabler/tabler-icons.
The complete MIT copyright and permission notice is retained in
`assets/icons/tabler/LICENSE`. Original SVGs and a semantic migration map are
kept beside it; no CDN, webfont, or third-party runtime request is required.

The bundled app has no unbundled original React sources. Its shared SVG factory
and the icon node arrays have therefore been updated in place, preserving
component exports, caller sizes, colors, handlers, and layout. Shared icons use
an optically lighter default stroke of 1.8 on a 24 × 24 grid. Explicit caller
stroke widths are preserved. Decorative SVGs are hidden from assistive
technology by default; callers can override this with an accessible SVG label.
Buttons keep their existing text and accessible names.

Navigation: home / volleyball / calendar / heartbeat / trophy / dots.
Other screens use the same outline family, including the previously separate
Eye, History, Send, performance, roster, and statistics icons. Low-fatigue
sparkles become a smile. Japos uses the licensed trophy and a local volleyball
SVG; the decorative sparkle attached to the empty trophy is removed.
Data visualizations, club crests, player photographs, and the scoring and load
models are unchanged.

Every active import uses the same `runtime-20261027-icons` query, including the
shared React export shim, to avoid loading two runtimes after a cache update.
The service worker version is bumped as well.

Validation: JavaScript syntax, all repository Node tests, SVG XML validity,
source geometry checks, and a rendered SVG contact sheet. A real authenticated
mobile screen review is still required: Chromium download was unavailable in
the editing environment. No database migration is needed.
