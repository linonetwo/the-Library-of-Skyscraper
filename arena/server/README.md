# Arena authority

```sh
cargo run --manifest-path arena/server/Cargo.toml
cargo test --manifest-path arena/server/Cargo.toml --locked
cargo clippy --manifest-path arena/server/Cargo.toml --all-targets -- -D warnings
```

The HTTP/WebSocket server binds **127.0.0.1:8787** only. Protocol is in
`arena/protocol.md`. Bevy ECS owns actor entities, integer simulation advances at
2 Hz, and each session has an independent world and random bearer credentials.
No renderer, external database, GPU, Steam SDK or JavaScript runtime is required.

## Scope

This is a local vertical-slice authority, not an Internet production service.
It demonstrates gathering, construction, PVE combat, retreat, catalog control,
deterministic reset/step, and shared online rooms. Parameterized rules drive the
current simulation. TypeScript compilation and independent V8 preview are now
available; publishing versions into the tick loop is the next integration stage.

## TypeScript workbench

```sh
npm ci --prefix arena/script-toolchain
cargo build --manifest-path arena/script-runner/Cargo.toml --locked
ARENA_SCRIPT_RUNNER=/absolute/path/to/skyscraper-arena-script-runner \
  cargo run --manifest-path arena/server/Cargo.toml
```

By default the authority looks for the runner beside its own executable.
`ARENA_SCRIPT_TOOLCHAIN` selects an alternate `cli.mjs`; the repository sibling
toolchain is the development default. The frontend's 行动规则 → 编写 TypeScript
规则 opens Monaco with the shared SDK.

Authenticated POST routes `/api/sessions/{id}/scripts/compile` and
`/api/sessions/{id}/scripts/preview` accept `{files, entry}`. Preview captures the
current player context, compiles the source, then runs the bundle in a separate
V8 process. It returns decision intents and diagnostics while leaving the live
simulation unchanged. Source hashes and source maps accompany compiled bundles.

Authenticated `GET /api/sessions/{id}/replay` exports a versioned,
credential-free command recording (maximum 10,000 operations / 2 MiB).
`Session::from_replay` reconstructs joins, accepted commands and ticks and
verifies the entire final snapshot. Reconstructed credentials are synthetic:
never register a replay as a live authenticated session. Overflow fails export
explicitly instead of returning a truncated recording.

## Published TypeScript rules

`POST /api/sessions/{id}/scripts/publish` accepts `{files, entry?}`, compiles the
project, and binds a successful bundle to the authenticated player. Responses
contain `{compilation, snapshot}` on publication, or just `{compilation}` when
the compiler returns diagnostics. `Player.script` exposes only the source hash,
entry point, and publication tick. Source files and executable bundles stay in
private checkpoints.

Clock advancement and training `Step` share the same script driver. The store
holds a per-session execution lock, while unrelated sessions can advance in
parallel. Compilation runs outside session locks. V8 work runs through the
shared JSONL worker pool, with no global store lock held during execution.
Each tick consumes one decision per published player; priority selects one
intent per actor and an already accepted manual action takes precedence.
The existing manual `build` command remains a player-level construction order;
script `build` intents additionally name and consume their builder's action.
Bound players with empty output hold position rather than running presets.
Execution failures also hold for that tick and create a replayable event.

`POST /api/sessions/{id}/scripts/disable` returns the current snapshot and
restores the player's existing preset. Publishing a preset with `Command::Rule`
also removes the TypeScript binding. Training reset retains published code and
its original publication metadata while resetting the simulated world; the
existing preset reset behavior remains unchanged.

Public replays contain publication metadata and actual per-tick decisions,
so reconstruction runs entirely inside Rust, with no compiler or V8 dependency.
Private checkpoints retain source, bundle, and active bindings for restart.

```sh
cargo test publish_drives_steps_clock_hold_disable_and_checkpoint -- --ignored
```

This integration test requires installed script-toolchain dependencies and the
built script-runner binary (or `ARENA_SCRIPT_RUNNER`).

## Local saves and process restart

`ARENA_DATA_DIR` selects the save directory, defaulting to `data` under the
server's working directory. `ARENA_PORT` selects the local listener port
(default `8787`; `0` allocates a port for process tests).

Each session has an atomic JSON save containing a complete `SessionCheckpoint`:
the visible snapshot, original bearer-token mapping, manual-action cooldowns,
next event ID, and public replay recording state. Startup rebuilds the ECS world
directly from this checkpoint, so existing browser credentials reconnect to the
same squad. Paused training stays paused; active matches resume their 2 Hz clock
without advancing the time spent offline.

Older private saves containing `replay` and `tokens` still load through the
original replay reconstruction path. Their next changed-state checkpoint writes
the new format, preserving existing user saves and credentials.

Changed sessions are checkpointed every **2 seconds**. Creation, joins, accepted
commands, and advancing ticks mark a session dirty. HTTP and WebSocket reads
leave saves untouched. SIGINT / SIGTERM stops the clock, closes WebSockets,
drains HTTP requests, and flushes pending changes before exiting. Abrupt process
termination restores the most recent completed checkpoint, with up to 2 seconds
of recent changes to replay manually.

Save files are private local credentials: Unix directories use mode `0700` and
files use `0600`. Temporary `.pending` files are atomically renamed after file
sync; startup reads completed `.json` files. Keep this directory out of published
builds and version control. Public replay exports remain credential-free.
Malformed saves stop startup with their filename and error rather than silently
discarding a squad.

The **10,000 operations / 2 MiB** limits apply to public replay exports,
independently of private saves. Long-running training keeps saving and restoring
its complete current simulation after public recording fills. The recording
overflow flag is preserved across restarts, so replay export continues to report
its limit instead of presenting a partial history as complete. Full-history
segmented replay is a separate future feature.

`cargo test --test restart` launches real server processes on isolated ports,
checks graceful and abrupt restart recovery with the original credentials,
checks private permissions and credential-free exports, and exercises periodic
checkpointing without read-triggered writes.
`cargo test --test long_restart` covers saves after recording overflow, action
cooldowns after restart, subsequent simulation and checkpoints, and migration
from the legacy replay-based save format.

Known limitations: session expiry, matchmaking, Steam identity,
encrypted external transport, fog of war, production rate limiting, distributed
simulation, and segmented long-history saves remain future work.
Latest 100 events are diagnostic history only.
All participants see the same room state. Towers restore allied occupants' HP;
catalog buildings generate points. These simplified mechanics are an initial
playable slice, not final balance or a complete wiki implementation.
