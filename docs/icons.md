# IconScout iconography

The app now uses publicly available Unicons by IconScout / Design Barn Inc.,
pinned to commit `e394b019a72a75aa370417a447ece41b8d75c2b2` of https://github.com/Iconscout/unicons.
The upstream IconScout Simple License explicitly permits free use and digital
adaptation in personal and commercial projects. Original SVGs, license and
mapping are retained under `assets/icons/iconscout`. Paid site-only assets
were not downloaded. The original files are not offered as a separate icon
collection or competing service.

Monochrome variants are used where available; remaining icons use the matching
line family. The primary, secondary, tertiary and quaternary classes have
explicit opacity values (1, .65, .45, .2) rather than relying on a remote font
or stylesheet. Volleyball, trophy, medical heart and dumbbell receive a subtle
amber interior shape. Layout, inherited status colours, actions and touch
areas stay unchanged. The generic # control retains its MIT-licensed Tabler
geometry because this upstream Unicons release has no equivalent.

The shared SVG factory now renders filled shapes with no inherited stroke.
This avoids outlining the outlines a second time. Japos uses the same trophy
and a local, gold volleyball. Credits and upstream links are accessible from
both mobile menu and desktop sidebar. No CDN or external icon request is used.

All active imports use `runtime-20261027-iconscout`, including the shared React
shim. Service worker: `20261027-iconscout-unicons-v13`. No database migration.

Verification: JavaScript syntax, existing Node regression suite, source-node
parity, and rendered SVG review. Authenticated mobile visual review remains
pending because the environment cannot download Chromium.
