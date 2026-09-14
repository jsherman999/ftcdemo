# FTC Field Lab — BIOBUZZ 2026–2027

A browser programming demo with the official BIOBUZZ field CAD, one configurable training robot, an interpreted FTC Java subset, a beginner sequence editor, and live hardware telemetry. Independent educational software; not an official FIRST product.

## Try it

**[Open FTC Field Lab](https://jsherman999.github.io/ftcdemo/)**

1. Select a Java example.
2. Initialize, then Start.
3. Observe the robot, encoders, front distance, IMU yaw, floor color, and contact sensor.
4. Reset, edit the program, and run again.

For driver control, select TeleOp. W/A/S/D drive, Q/E turn, I/K intake/eject, U/J lift, F launches, and C opens the claw. Touch controls and a standard browser-recognized USB/Bluetooth gamepad feed the same `gamepad1` interface. Escape stops the robot. Switching away from the browser pauses a running simulation.

The program draft and applied hardware calibration are stored only on the current device. Download Java source or export the robot configuration from the UI.

## Run on a Mac, Windows PC, or Linux

Install Node.js 24 LTS and pnpm 11.25.0. From a terminal:

```sh
git clone https://github.com/jsherman999/ftcdemo.git
cd ftcdemo
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm dev:local
```

Open **http://localhost:5173/**. Keep the terminal running while you use the app. This runs the same simulator locally; its saved work still uses browser storage. A local project-file/SQLite service has not been implemented. No Control Hub, Java installation, cloud API key, or Cloudflare account is required for this mode.

## GitHub Pages

The repository includes a standalone static build retaining all current simulator features. The original ChatGPT Sites deployment is at https://ftc-field-lab.jsherman999.chatgpt.site; this repository is independent and carries no binding to that private deployment.

```sh
pnpm build:pages
pnpm preview:local
```

Preview the build at **http://localhost:4173/ftcdemo/**. `dist-pages/` contains the deployable HTML, JavaScript, CSS, and CAD assets. Serve it over HTTP; double-clicking `index.html` is not supported.

The `Publish GitHub Pages` workflow validates TypeScript, runs the simulator behavior checks, builds the static app, and publishes every push to `main`. Pull requests run the same build checks without publishing. To redeploy manually, open **Actions → Publish GitHub Pages → Run workflow** on `main`.

Repository **Settings → Pages → Source** uses **GitHub Actions**. The live app is at **https://jsherman999.github.io/ftcdemo/**. The Pages build uses `/ftcdemo/` as its base path; CAD, scripts, styles, favicon, and home navigation honor this subpath. For a different repository name or a custom domain, update `base` in `vite.pages.config.ts`.

GitHub Pages is public. The source export excludes the private Sites deployment binding and credentials. The original Sites access policy is separate from this deployment.

## Where student work is stored

The current app stores **one latest Java draft and the applied robot configuration in the browser's localStorage**. This persists across ordinary browser restarts. It is separate for each browser profile and site origin; the Sites URL, GitHub Pages, and localhost each have different saved work. Private browsing or clearing site data can discard it. Sequence steps and un-applied settings are not yet persisted.

Downloads provide manual Java/configuration backups. There are no named student projects, accounts, automatic file backups, synchronization, or project import yet. Running on localhost alone does not add those capabilities.

For the longer-term PC/Mac version, the recommended architecture is this same browser UI plus a local service that manages project folders (`.java` plus `robot.json`), with optional SQLite indexing/history and a future JVM adapter. A native desktop wrapper is optional. A browser-only version could instead add IndexedDB and project export/import; a team server could provide shared student storage.

See [the hosting and storage comparison](docs/hosting-and-storage.md) for the tradeoffs and the distinction between the present interpreter and a real Java/FTC adapter.

## What is accurate, and what is approximate

The field meshes come from FIRST's official BIOBUZZ V1 STEP assembly retrieved on 2026-09-14. Assembly placement transforms are preserved. Browser meshes are simplified with a 0.4 mm absolute error target (an algorithmic target, not a certified dimensional bound); the collision polygons are derived before simplification. The model is converted from millimeters to inches, with no scale correction. Fasteners, printed graphics, and original CAD game balls are omitted from the browser model. The displayed balls are simulated separately.

The manual calls the field approximately 144 × 144 inches. **The supplied V1 CAD has an inner wall span of 141.348 inches.** The simulator uses that CAD span for walls and collisions. It displays the manual's 144-inch figure as nominal. Tile dimensions in the manual are likewise nominal; real venues have variation. General manual tolerance is ±1 inch. This is not a field acceptance or robot-fit certification.

Static collision polygons are extracted from the CAD at chassis heights 0–14 inches. Front-distance sensor polygons are taken at four inches. Collision uses a conservative rectangular robot footprint and separating-axis tests; it preserves the passage underneath the hive. It does not model collision by the extended lift, chassis ground clearance, bending, wheel-ground forces, or full 3D rigid-body contact.

The six DC motors expose power, direction, encoder position, target position, run mode, and zero-power behavior. `RUN_TO_POSITION` uses a simplified controller. Mecanum motion uses configurable wheel diameter, encoder ticks, maximum RPM, and a strafe efficiency factor. Encoders can spin while the chassis is blocked, as actual wheel encoders can. Motor current, torque, battery voltage, drivetrain mass, wheel slip, and PIDF tuning are not modeled.

The two positional servos actuate a simplified claw and a pulse launcher. The intake collects nearby balls, the lift moves between 0 and 26 inches, and launched balls follow a ballistic trajectory. Flower capture and hive capture use simplified volumes. The four-element hive-tip threshold is an explicit training assumption; it is **not** an official score or calibrated physical balance. Nectar unlock rules, full scoring, opponents, fouls, flower ownership, and automatic match transitions are not implemented. Practice AUTO and TeleOp run independently for 30 and 120 seconds.

Sensors are idealized: IMU yaw, forward distance, downward tape color, and a virtual contact switch. There is no camera, rendered AprilTag texture, detection pipeline, sensor latency, or noise model.

## Robot hardware

The teaching robot has a 17 × 17 inch mecanum chassis, four drive motors, an intake motor, lift motor, claw servo, launcher servo, distance sensor, IMU, color sensor, and touch sensor. It uses one Control Hub and one Expansion Hub. The device names and drivetrain calibration can be changed. The modeled mechanisms and device count/types are fixed in this first demo; it is not a generic robot builder.

| Hub | Port | Default name | Device |
|---|---|---|---|
| Control | M0 / M1 / M2 / M3 | frontLeft / frontRight / backLeft / backRight | DC motors with encoders |
| Expansion | M0 / M1 | intake / lift | DC motors with encoders |
| Control | S0 / S1 | claw / launcher | Positional servos |
| Control | I2C1 / I2C2 | frontDistance / color | Sensors |
| Control | Internal / D1 | imu / bumper | IMU / virtual touch sensor |

To match a team's actual robot, supply its hardware configuration, dimensions, wheel/gear ratios, encoder specifications, mechanism travel and geometry, sensor models and mounting transforms, and CAD or photographs. Physical measurements and motion/handling logs are needed to calibrate it. Do not treat the default robot as an existing manufacturer's robot or a team's digital twin.

## Programming compatibility

Real FTC supports Blocks, OnBot Java, and Android Studio. This app provides its **own interpreter for a limited Java subset**, not a Java compiler, JVM, Android runtime, or FTC SDK. It does not send anything to a Control Hub.

Supported: local variables, arithmetic and boolean expressions, simple casts, if/else, while and simple for loops, motor/servo/sensor calls listed in the in-app reference, telemetry, waits, runtime, and gamepad1. Standard imports and a class wrapper around one `runOpMode()` body are accepted. Initialize parses the program; all user statements, including hardware mapping, execute after Start. There is no separate user-code INIT phase.

Unsupported: helper methods, arbitrary classes, arrays, Java libraries, exception handling, vision, networking, arbitrary SDK calls, and complete Java semantics. The beginner Sequence tab is not FTC Blocks. Program length is capped at 30,000 characters. Execution is an AST interpreter with a finite per-tick budget; it never evaluates source as JavaScript and exposes no browser globals. Programs always stop at the practice-period limit, and an error stops the motors.

Downloaded `FieldLab.java` must be compiled with the real FTC tools, adapted to the real hardware configuration and API availability, and tested on the physical robot. For true SDK compatibility, the next stage is a separate JVM/FTC hardware abstraction adapter connected to the simulator's device model. That adapter is not implemented here.

## Source layout

- `components/field-view.tsx`: Three.js field CAD, robot, camera, and live overlays.
- `lib/simulator.ts`: deterministic 120 Hz device and movement model.
- `lib/java-runtime.ts`: tokenizer, parser, bounded interpreter, and allowlisted API bridge.
- `lib/cad-physics.json`: CAD-derived wall, flower, tape, and collision coordinates.
- `lib/lessons.ts`: editable example OpModes and sequence-to-Java conversion.
- `scripts/import-field-cad.py`: reproducible STEP-to-GLB conversion (CadQuery/OCP/numpy).
- `scripts/derive-field-physics.py`: derives collision cross sections from the unsimplified field GLB.
- `scripts/optimize-cad.mjs`: reduces browser triangle count after collision extraction.
- `scripts/test-simulator.mjs`: behavioral checks for examples, encoders, sensors, walls, stop, and runtime errors.

## Development and validation

Use `pnpm dev:local` for the standalone app, `pnpm build:pages` for static deployment, `pnpm test` for simulator behavior checks, and `pnpm typecheck` for TypeScript validation. The existing `pnpm dev` and `pnpm build` commands retain the optional original Vinext/Cloudflare wrapper; they are not needed for local practice or Pages.

The pinned package manager and lockfile are retained. The unused starter storage/auth helpers are not part of the static application bundle. Production build output and developer caches are excluded from Git.

The behavioral checks cover examples, encoder travel, sensor stops, wall collisions, gamepad motion, stopping, bounded loops, invalid hardware, and servo release. The static Pages build and subpath asset references were checked locally. Browser smoke testing covers the built app at the Pages subpath, official CAD loading, and running the first Java lesson. Optional WebMCP tools are feature-detected.

## Official references

- [BIOBUZZ Competition Manual V1, pp. 63–77 and 82–84](https://ftc-resources.firstinspires.org/ftc/game/manual)
- [Event Field Setup Guide V1.0](https://ftc-resources.firstinspires.org/ftc/field/eventfieldguide)
- [Official field CAD in Onshape](https://cad.onshape.com/documents/a355e772e3d24813de7852ee/w/f106353168f1f92100b81259/e/95d1e1e442b4138cccaf2d73)
- [Official STEP download](https://ftc-resources.firstinspires.org/ftc/field/field-cad-step)
- [FTC Control System introduction](https://ftc-docs.firstinspires.org/en/latest/programming_resources/shared/control_system_intro/The-FTC-Control-System.html)
- [Choosing a programming tool](https://ftc-docs.firstinspires.org/en/latest/programming_resources/shared/choosing_program_lang/choosing-program-lang.html)
- [Motor modes and encoders](https://ftc-docs.firstinspires.org/en/latest/tech_tips/tech-tips/tech-tip-motor-modes/tech-tip-motor-modes.html)
- [REV Control Hub specifications](https://docs.revrobotics.com/duo-control/control-system-overview/control-hub-basics)
- [FIRST field walkthrough](https://www.youtube.com/watch?v=47X9sYnPijw)

Field geometry is credited to FIRST and AndyMark; their materials and marks remain subject to their terms. No affiliation or endorsement is implied. The original tracked email PDF/video URLs were inaccessible; the official direct resources above were used. The video is linked for users; its audiovisual contents were not analyzed.
