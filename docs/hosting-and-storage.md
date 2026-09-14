# Hosting and student storage

The simulator runs entirely in the browser. Its Three.js view, Java subset
interpreter, 120 Hz robot simulation, editor, and telemetry require no backend.
`standalone/main.tsx` mounts the existing app with React; `vite.pages.config.ts`
builds static assets with the GitHub Pages repository base path.

| Deployment | Runs the current simulator | Student work |
| --- | --- | --- |
| GitHub Pages | Yes, publicly over HTTPS | Latest Java draft and applied robot configuration in that browser's localStorage |
| Local Vite server on PC/Mac/Linux | Yes, while the server runs | The same localStorage behavior, under a separate localhost origin |
| Original private Sites deployment | Yes, behind its existing access policy | Separate localStorage for its origin |
| Future local service or desktop app | Requires additional development | Could manage named project folders, import, backups, and history |

Browser storage is specific to a browser profile and origin. Clearing site data
or using private browsing can discard saved work. Sequence steps and unapplied
settings are not persisted. Java and robot configuration downloads are manual
backups; the app currently has no import, accounts, or synchronization.

For durable student projects, a future local service could manage `.java` and
`robot.json` files with optional SQLite indexing/history. A browser-only extension
could use IndexedDB plus project export/import. Neither is implemented here.

The current interpreter accepts only the documented Java subset; it is not a JVM
or the FTC SDK. Real SDK compatibility requires a separate Java runtime and
hardware abstraction adapter. Changing the hosting platform does not add that
compatibility.

## Source recovery

The initial GitHub commit contained only the README. The simulator source and
CAD assets were recovered from the existing FTC Field Lab Sites source repository
on 2026-09-14. A standalone entry point, subpath-aware asset loading, and a Pages
build/deployment workflow were then added. No private deployment binding or
source credentials are included.
