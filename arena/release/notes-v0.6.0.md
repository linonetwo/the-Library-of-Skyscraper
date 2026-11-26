# v0.6.0 · Programmable squad composition

Build and reuse your squad's AI through the existing rule workbench. This batch
expands the catalog from five to eight module kinds, with named subtree fragments
and recorded rule debugging.
The final ACCEPTANCE report records package verification and release approval.

## Open the workbench

Use Linux x64, Node.js 24, `setsid` (util-linux), and a WebGL-capable browser.
Extract the package and run `./start.sh`.

- Game: http://127.0.0.1:5173/
- AI workbench: http://127.0.0.1:5173/?view=rules or **AI 模块编辑**.
- Default web / authority ports: **5173 / 8787**.

Choose listeners with `ARENA_WEB_PORT`, `ARENA_PORT`, and `ARENA_BIND_ADDR`.
`ARENA_PROXY_TARGET` selects the authority; its default follows `ARENA_PORT`.
Forward the web port for remote play. Package saves stay in `data/`, and authority
logs in `logs/authority.log`. The included README covers server and MCP setup.

## Compose and reuse behavior

The module catalog contains **gather, haul, build, defend, retreat, scout, patrol
and escort**. Existing five-card plans remain available; explicitly convert a
plan to a graph when you want graph composition. Graph authoring keeps the
existing undo path, rather than silently replacing an old plan or handwritten
TypeScript draft.

Scout visits an authorized room within its configured risk limit and reports
only after arrival. Patrol follows ordered rooms with configured dwell time.
Escort resolves a living cargo carrier from the selected own-team role, follows
its authoritative destination, and reuses defend behavior for same-room threats.
Cargo below the threshold and a missing target have distinct recorded reasons.

Module IDs identify instances separately from their kinds. Multiple nodes may
share an instance, while copies can carry independent configurations. Runtime
state stays separate for each actor and module instance, including a patrol
instance shared by two actors. Typed room and own-role references have explicit
fallbacks when the current world cannot resolve a target.

Save a selected subtree as a named local fragment together with its referenced
module dependencies. Preview insertion, map room and role bindings, then attach
it in one graph edit. Internal sharing is retained; imported IDs avoid collisions
and undo restores the previous graph.

## Inspect the recorded decision

Named recording ranges query existing owner-scoped decision deltas by source
version and operation. Inspect the state before and after the selected operation,
recorded module reasons, visited nodes and coverage. Query breakpoints locate
recorded matches by changing only the local cursor; they do not change the
authority's running or paused state.

Coverage distinguishes an observed visit, an unvisited declared object and data
that was never recorded. Composition keeps at most eight actual module visits
per actor; truncation is explicit. Old recordings with no visit field remain
unrecorded evidence. An intent records the rule's choice; subsequent authority
state determines the actual outcome.

Open the source archived with that version and jump to its original object line.
Archived graph declarations remain readable across generator versions without
granting editable recovery to changed or handwritten projects. Same-operation
A/B preview runs alternatives against the same recorded world and tasks, with
empty initial script memory for both; it is not a replay of either version's
private memory. Graphs and TypeScript use the same server compiler and independent
V8 execution path as
published rules; there is no separate graph simulator.

## Runtime continuity

This batch retains **simulationVersion7**, **library-v5.0**, the v0.5 artwork and
the original 疾跑 / 跃桥 / 攀梯 authority path. Existing saves and replays preserve
their recorded simulation behavior, including versions ≤6. Existing ordinary
and mobility graph projects retain their generated source bytes.

The manifest records exact source/recipe commits and hashes shipped resources,
SDK, map and dependency locks. Inherited v0.3 art and v0.4 rule provenance keep
their original scopes. The package runs through a local server and WebGL browser;
the desktop shell follows the Steam productization plan.
