# Bounded Chinese goals (G4)

`RuleGoalEditor` accepts `{ graph, onApply, onLocate }`. The G2 host renders it in
its goalEditor slot, applies GraphPatch through its existing draft history, and
owns preview/publication. This component never calls the session API.

Each line or Chinese semicolon is a separate goal. The displayed grammar includes
role-specific cargo-return / low-health-retreat sentences, explicit numeric
conditions, condition yes/no wiring, and module role/room targets. Natural role
sentences inspect the actual role initial state, require one matching transition
leading to an enabled haul/retreat module, and refuse ambiguity or missing paths.
They never create an absent retreat strategy. Cargo-return can propose both the
FSM transition and initial tree threshold; each change has its stable object ID
and can be selected independently.

Proposals retain graph ID, revision and exact source graph; a changed baseline
requires generating a new proposal. Selected operations run the shared G1 graph
diagnostics before the host callback. Undo restores only this accepted change and
refuses if any subsequent graph edit occurred; the host's draft undo remains
available. Invalid/unknown lines remain visible alongside recognized changes.

`arena/tools/browser-goals.mjs` exports goalActionSchemas, performGoalAction and
readGoalState for the existing browser MCP registry. Every action operates on
visible controls in the open G2 workbench; it cannot set hidden graph state,
publish, or run a separate decision engine.
