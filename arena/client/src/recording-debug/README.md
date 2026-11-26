# Recorded node evidence (A3 first slice)

`indexRecording(recording, ownerId)` consumes the existing authorized owner timeline's
`ruleHistory.changes`, not snapshots or `projectRuleHistory` output. Its identity is
session + owner. Each decision keeps the recorded source hash, actor, operation and
tick. The model rejects a different history owner; HTTP authorization remains with
the existing timeline endpoint.

- `nextNode(index, {sourceHash, actorId, nodeId, kind}, cursor, direction)` finds the
  strictly next/previous original operation with a recorded visit or selection.
- `nodeCoverage(index, namedRange, actorId, nodeId)` counts an inclusive operation
  interval for one session/owner/source hash. Counts expose their original operation
  lists; repeated visits also retain the actual boolean/number values.
- A UI can map the returned operation to the existing timeline frame, pause its
  local replay cursor and use that source hash to open archived source. There is no
  clock change, command, comparison request or live-world mutation in this model.

Three evidence dimensions stay separate: `visited` proves recorded node access;
`selectedNodeId` proves a recorded selection (not authority acceptance or arrival);
legacy module outcome is **unrecorded**. Neither a module ID nor a reason string
proves fallback. Missing `aiTrace`, absent node visits and unavailable owner history
have distinct outputs. A bounded legacy visited list has no completeness flag, so
`noRecordedVisitOperations` does not mean certainly unexecuted; `unvisitedCount`
remains null. Module queries use A1's shared `ModuleVisit` type through `modules.ts`; legacy
node evidence itself still never infers a module outcome.

Resets retain their original operation boundaries. Equal ticks across reset or
version changes are never merged. A carried memory value displayed on later frames
adds no visit; an actual new decision delta, even if its contents match, does.

The fixture extracts exact owner decision facts from the accepted v0.5 package's
M5 `ai-mobility-fresh/timeline.json`, with provenance/hash. No credentials or world
snapshot are included. Tests use that real trace for indexing, plus explicitly
controlled reset/version/foreign-owner/missing-data cases; those variations are
regressions, not claimed multiplayer live trials.

## Module visits

`moduleEvidence`/`nextModule` filter source hash + actor + optional node/module.
`hit` includes `selected` and `hold`; `fallback` uses the explicit visit outcome,
not the final selected leaf. Reason code, original reference, resolved ID, observed
facts and fallback node are retained without recomputing the decision.

`moduleCoverage` reports visit/hit/fallback/hold counts and original operation lists.
A complete recorded list with no matching visit proves that module/node unvisited
for that actor decision. A missing field means unrecorded, an empty array means no
recorded module access, and truncation leaves absent entries unknown. Listed
visits still count when the list is truncated. Missing graph trace is separate.
These facts do not prove authority acceptance, later arrival, damage or delivery.

The additional v0.6 fixture is the genuine A1 independent V8 output, not a timeline:
its provenance explicitly says no recording operation is available. Tests supply
controlled operation envelopes to exercise the adapter; a real normal-clock owner
timeline will be added when the coordinated live case is recorded.
