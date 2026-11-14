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

Known limitations: sessions and recordings are memory-only and capped at 128; there is no
session expiry, persistent replay storage, matchmaking, Steam identity,
encrypted external transport, fog of war, production rate limiting, distributed
simulation or crash recovery. Latest 100 events are diagnostic history only.
All participants see the same room state. Towers restore allied occupants' HP;
catalog buildings generate points. These simplified mechanics are an initial
playable slice, not final balance or a complete wiki implementation.
