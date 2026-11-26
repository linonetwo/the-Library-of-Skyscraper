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
controlled operation envelopes to exercise the adapter; a separate normal-clock owner
fixture now preserves exact per-actor facts from operations4,16,18,21. Its source
commit, original-recording hash and omitted data are documented in provenance.

## UI integration

`RecordingDebugger` reads the current session's timeline/version archive through
existing API methods. Props are `session`, `onSeekOperation({sessionId, ownerId,
sourceHash, operationIndex})` and optional `onOpenSource({sourceHash, objectId})`.
The host owns opening/seeking the existing replay; map the original operation to
that timeline's frame index. If no source callback is provided, the panel opens the
matching archive with the existing `ReadOnlySource` view. It never navigates a
same-ID node in the current draft.

The panel's object denominator uses `readArchivedRuleGraph` on the selected
archive's actual graph-plan declaration (not the current-generator editing recovery), while actor
and count evidence comes from that owner's original deltas. Named inclusive ranges
store only local session/owner/hash/name/operation metadata, without credentials or
runtime memory. Decision tick and post-operation scene tick are displayed separately.

Visible controls: `录制源版本`, `录制角色`, `录制对象类型`, `录制对象`,
`录制命中类型`, `录制操作游标`, `上一次记录`, `下一次记录`, `具名录制名称`,
`录制区间起点`, `录制区间终点`, `已存具名录制`. The section is named
`录制断点与覆盖`; its read-only `data-recording-state` exposes the same public
selection identity/cursor. Tools should operate these controls and original replay,
not recompute counts or change the authority clock.

Archived V1/V2 graph-plan fixtures come from the same real owner recording before
and after the cargo-reason helper correction. Both supply node/module objects and
original source lines without copying an old generator. A separate readback of the
original full projects confirms V1 is readable but not editable by the current
generator; V2 is both readable and editable. Declared structure is the query
denominator, not evidence that a handwritten helper actually executed it.
