# v0.6.0 development preview candidate

This candidate adds AI composition to the existing squad expedition workbench.
Release approval and whole-package acceptance are recorded separately after the
complete feature batch is frozen and exercised.

## Open the workbench

The package runs on Linux x64 with Node.js 24, `setsid` (util-linux), and a
WebGL-capable browser. Extract it and run `./start.sh`.

- Game: http://127.0.0.1:5173/
- AI workbench: http://127.0.0.1:5173/?view=rules or **AI 模块编辑**.
- Default web / authority ports: **5173 / 8787**.

Choose listeners with `ARENA_WEB_PORT`, `ARENA_PORT`, and `ARENA_BIND_ADDR`.
`ARENA_PROXY_TARGET` selects the authority; the default follows `ARENA_PORT`.
Forward the web port for remote play. Saves belong to this package's `data/`;
logs are in `logs/authority.log`. See the included README for connection and MCP
setup.

## Compose module instances

The original gather, haul, build, defend and retreat modules remain available.
Schema-2 graphs additionally support:

- **Scout**: visit an authorized room, respect a configured risk limit, and report
  only after actual arrival.
- **Patrol**: visit an ordered room list with configured dwell time. Each actor
  and module instance keeps its own cursor.
- **Escort**: resolve a living own-role cargo carrier deterministically and follow
  its authoritative room or travel destination. Same-room threats reuse the
  existing defend behavior.

Module IDs distinguish instances from kinds. Typed room and own-role references
retain explicit fallbacks when the current world cannot resolve a target.
Named local subtree fragments include their module dependencies; insertion
explicitly maps references and preserves shared instances within the fragment.
Existing five-card plans, ordinary graphs, mobility graphs and handwritten
TypeScript keep their established execution and source-recovery behavior.

Composition records bounded reasons under the original owner/source/operation
recording: at most eight actual module visits per actor. A missing visit field in
older recordings means unrecorded data; truncation is explicit. A selected intent
is a rule decision, while the authority determines its actual outcome. These
capability notes do not certify the recorded-debugger UI or full-batch acceptance.

New expeditions continue to use **simulationVersion7** and **library-v5.0**.
疾跑 / 跃桥 / 攀梯 use the same authoritative movement path. Existing saves and
replays retain their recorded simulation behavior, including versions ≤6.
The manifest hashes the shipped dist descriptors, SDK, map and locks. Inherited
v0.3 art and v0.4 rule provenance retain their original approval scopes; final
v0.6 acceptance is separate. The desktop shell follows the Steam productization plan.
