import { useMemo, useState } from "react";
import {
  applyGraphPatch,
  diagnoseGraph,
  recoverRuleGraph,
  toGraphSourceProject,
  serializeGraphDraft,
  createLogisticsGraph,
  createRetreatGraph,
  createShortcutSupportGraph,
  fromBehaviorPlan,
  type RuleGraph,
  type GraphPatch,
} from "../../../behavior-modules/graph";
import type { useBehaviorWorkbench } from "../useBehaviorWorkbench";
export function useRuleGraphDraft(
  workbench: ReturnType<typeof useBehaviorWorkbench>,
) {
  const [error, setError] = useState("");
  const { past, future } = workbench.draft.graphHistory ?? {
    past: [],
    future: [],
  };
  const graph = useMemo(
    () => recoverRuleGraph(workbench.draft),
    [workbench.draft.files, workbench.draft.entry],
  );
  const diagnostics = useMemo(
    () => (graph ? diagnoseGraph(graph) : []),
    [graph],
  );
  const blocked = diagnostics.some((d) => d.severity === "error");
  const commit = (
    next: RuleGraph,
    history: { past: RuleGraph[]; future: RuleGraph[] },
  ) => workbench.editProject(serializeGraphDraft(next), history);
  const apply = (patch: GraphPatch) => {
    if (!graph) return;
    try {
      const next = applyGraphPatch(graph, patch);
      setError("");
      commit(next, { past: [...past, graph], future: [] });
    } catch (cause) {
      setError((cause as Error).message);
    }
  };
  const replace = (template: "logistics" | "retreat" | "priority" | "shortcut") => {
    const next = template === "shortcut" ? createShortcutSupportGraph() :
      template === "priority" && workbench.plan
        ? fromBehaviorPlan(workbench.plan)
        : template === "retreat"
          ? createRetreatGraph()
          : createLogisticsGraph();
    workbench.replaceProject(toGraphSourceProject(next));
    setError("");
  };
  const undo = () => {
    if (!past.length || !graph) return;
    const previous = past[past.length - 1];
    commit(previous, { past: past.slice(0, -1), future: [graph, ...future] });
  };
  const redo = () => {
    if (!future.length || !graph) return;
    commit(future[0], { past: [...past, graph], future: future.slice(1) });
  };
  return {
    graph,
    diagnostics,
    blocked,
    apply,
    replace,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    error,
  };
}
