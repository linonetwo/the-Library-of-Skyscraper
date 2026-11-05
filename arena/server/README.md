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
deterministic reset/step, and shared online rooms. Parameterized rules are not
the wiki's eventual arbitrary TypeScript script platform.

Authenticated `GET /api/sessions/{id}/replay` exports a versioned,
credential-free command recording (maximum 10,000 operations / 2 MiB).
`Session::from_replay` reconstructs joins, accepted commands and ticks and
verifies the entire final snapshot. Reconstructed credentials are synthetic:
never register a replay as a live authenticated session. Overflow fails export
explicitly instead of returning a truncated recording.

## Local saves and process restart

`ARENA_DATA_DIR` selects the save directory, defaulting to `data` under the
server's working directory. `ARENA_PORT` selects the local listener port
(default `8787`; `0` allocates a port for process tests).

Each session has an atomic JSON save containing its command replay and its
original bearer-token mapping. On startup the server reconstructs the simulation
from that replay, then restores the mapping, so existing browser credentials
reconnect to the same squad. Paused training stays paused; active matches resume
their 2 Hz clock without advancing the time spent offline.

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

The existing **10,000 operations / 2 MiB** replay limits also apply to saves.
Long-running training with repeated resets can reach them. The server reports
checkpoint errors and retains the last complete save; further play remains
in memory. Start a new session for a fresh recording budget. A future segmented
replay format needs a complete simulation base state (including action cooldowns
and next event ID) to support longer histories while retaining bounded segments.

`cargo test --test restart` launches real server processes on isolated ports,
checks graceful and abrupt restart recovery with the original credentials,
checks private permissions and credential-free exports, and exercises periodic
checkpointing without read-triggered writes.

Known limitations: session expiry, matchmaking, Steam identity,
encrypted external transport, fog of war, production rate limiting, distributed
simulation, and segmented long-history saves remain future work.
Latest 100 events are diagnostic history only.
All participants see the same room state. Towers restore allied occupants' HP;
catalog buildings generate points. These simplified mechanics are an initial
playable slice, not final balance or a complete wiki implementation.
