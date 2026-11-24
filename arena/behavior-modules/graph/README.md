# G1 shared interface (v2)

Public exports are under `arena/behavior-modules/graph/index.ts`:
`RuleGraph`, `GraphCondition`, `RuleNode`, `GraphPatch`, `GraphOperation`,
`GraphDiagnostic`, `GraphTrace`; `createLogisticsGraph()`, `createRetreatGraph()`,
`diagnoseGraph(graph)`, `applyGraphPatch(graph, patch)`,
`toGraphSourceProject(graph)`, `recoverRuleGraph(project)`,
`getGraphSourceRef(project, objectId)`.

Patches serialize as JSON. A patch must match graphId and baseRevision. Applying
one creates a new graph revision; a rejected baseline never mutates the input.
put operations replace the object with the same stable ID, or append a new one.
Deletion may leave a diagnostic so editing can continue. Diagnostics block source
generation on errors. Draft undo remains the workbench's existing history.

No layout is stored in the executable graph. Graph array order breaks equal
priorities/weights. Node IDs, state IDs, role IDs, transition IDs and module IDs
are globally unique. Entry/exit effects never produce intents. Existing v1 module
runtime supplies all module actions. v2 memory uses graphState and aiTrace.v=2;
sourceHash and operationIndex remain supplied by the authority shell.

`pass` is an explicit unavailable candidate. Selectors continue after pass; a
selected `hold` terminates them. A module used inside priority/score should route
its unavailable fallback to pass when the parent should try the next candidate.
Sequence evaluates checks in order and discards its pending result/logs if any gate
fails; it never commits two actions. Scoring computes weights/guards without
committing candidate actions; only the selected outcome is returned.

`serializeGraphDraft` persists even invalid typed drafts and exact matching drafts
can be recovered. Use `toGraphSourceProject` for preview/publication: this is the
shared diagnostics gate. Diagnostic source coordinates also exist on invalid
models through `graphDraftSourceRef`. Archived source lookup remains read-only.
