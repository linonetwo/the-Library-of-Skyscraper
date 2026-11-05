# Arena V8 rule runner

Independent Rust process backed by `deno_core` 0.413 and V8. The authority owns
world state; this process evaluates a compiled rule and returns its decision.

```sh
cargo build --manifest-path arena/script-runner/Cargo.toml
cargo test --manifest-path arena/script-runner/Cargo.toml
```

Run the `skyscraper-arena-script-runner` executable and send JSONL on stdin:

```json
{"bundle":{"sourceHash":"example-v1","code":"var __arenaRule = {decide: ctx => ({intents: []})};"},"context":{"tick":7}}
```

One line is emitted on stdout per request:

```json
{"decision":{"intents":[]},"durationMs":1.2}
```

Failures use `failure: {kind, message}` with kind `protocol`, `runtime`, `timeout`
or `heap`. The next request starts in a fresh isolate, including after an
exception, time exhaustion or heap exhaustion. `durationMs` includes isolate
creation and teardown preparation; its measurement belongs to diagnostics.

## Execution contract

- Input JavaScript is the toolchain's IIFE with global `var __arenaRule`.
- The synchronous entry point is `__arenaRule.decide(context)`.
- `ScriptEngineAdapter` is separate from the JSONL transport.
- Every request gets a new isolate. A watchdog interrupts execution after
  100 ms. V8 receives a 32 MiB managed-heap limit; its near-limit callback
  interrupts execution and supplies 16 MiB unwind headroom.
- `Date.now()` and zero-argument `new Date()` derive from `context.tick * 500`.
  `Math.random()` requests explicit deterministic choices through a runtime
  exception; the seeded context helper remains a subsequent SDK addition.
- The platform registers no game filesystem, network or clock operations.
  The bootstrap removes the Deno and console globals; stdout remains JSONL.
- Bundle `sourceHash` carries the compiler's revision identity. Authority-side
  publication owns revision storage and intent validation.

The process currently runs one request at a time. Worker pooling, compilation
caching, source-map translation and OS-level total-process memory limits remain
follow-up work. The V8 managed-heap budget covers JavaScript heap allocations;
external backing stores such as ArrayBuffer require the total-process budget.
Script promises, timers and async entry points remain outside the synchronous
decision contract. Full clock determinism across locale/timezone APIs also
requires a frozen platform profile before competitive publication.

Official API references:
[JsRuntime](https://docs.rs/deno_core/0.413.0/deno_core/struct.JsRuntime.html),
[RuntimeOptions](https://docs.rs/deno_core/0.413.0/deno_core/struct.RuntimeOptions.html).
