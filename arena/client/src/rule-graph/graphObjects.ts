import {
  freshGraphId,
  cloneGraphFragment,
} from "../../../behavior-modules/graph";
import type {
  RuleGraph,
  RuleNode,
  GraphOperation,
  GraphState,
  GraphTransition,
  GraphRole,
} from "../../../behavior-modules/graph";
export type GraphSelection = {
  kind: "nodes" | "states" | "transitions" | "roles" | "modules";
  id: string;
};
export const nodeNames = {
  condition: "条件分支",
  check: "条件检查",
  priority: "优先选择",
  sequence: "顺序尝试",
  score: "评分选择",
  log: "原因记录",
  module: "官方模块",
  hold: "保持",
  pass: "未命中",
};
export function nodeEdges(node: RuleNode): { label: string; target: string }[] {
  switch (node.type) {
    case "condition":
      return [
        { label: "满足", target: node.yes },
        { label: "不满足", target: node.no },
      ];
    case "priority":
    case "sequence":
      return [
        ...node.children.map((target, i) => ({ label: String(i + 1), target })),
        { label: "回退", target: node.fallback },
      ];
    case "score":
      return [
        ...node.candidates.map((c) => ({
          label: `权重${c.weight}`,
          target: c.nodeId,
        })),
        { label: "回退", target: node.fallback },
      ];
    case "log":
      return [{ label: "然后", target: node.next }];
    case "module":
      return [{ label: "未命中", target: node.fallback }];
    case "hold":
    case "check":
    case "pass":
      return [];
  }
}
export const freshId = freshGraphId;
export function makeNode(graph: RuleGraph, type: RuleNode["type"]): RuleNode {
  const id = freshId(graph, type);
  const fallback = graph.nodes.find((n) => n.type === "hold")?.id ?? "";
  switch (type) {
    case "check":
      return {
        id,
        type,
        condition: {
          type: "compare",
          field: "cargo",
          op: "gte",
          value: 6,
          missing: false,
        },
      };
    case "condition":
      return {
        id,
        type,
        condition: {
          type: "compare",
          field: "cargo",
          op: "gte",
          value: 6,
          missing: false,
        },
        yes: fallback,
        no: fallback,
      };
    case "priority":
    case "sequence":
      return { id, type, children: [], fallback };
    case "score":
      return { id, type, candidates: [], fallback };
    case "log":
      return { id, type, reason: "说明选择原因", next: fallback };
    case "module":
      return { id, type, moduleId: graph.modules[0]?.moduleId ?? "", fallback: graph.nodes.find(n => n.type === "pass")?.id ?? fallback };
    case "pass":
      return { id, type, reason: "候选未命中" };
    case "hold":
      return { id, type, reason: "无适用动作" };
  }
}
export function putObject(
  kind: GraphSelection["kind"],
  value:
    | RuleNode
    | GraphState
    | GraphTransition
    | GraphRole
    | RuleGraph["modules"][number],
): GraphOperation {
  switch (kind) {
    case "nodes":
      return { type: "putNode", node: value as RuleNode };
    case "states":
      return { type: "putState", state: value as GraphState };
    case "transitions":
      return { type: "putTransition", transition: value as GraphTransition };
    case "roles":
      return { type: "putRole", role: value as GraphRole };
    case "modules":
      return {
        type: "putModule",
        module: value as RuleGraph["modules"][number],
      };
  }
}
export function removeObject(selection: GraphSelection): GraphOperation {
  switch (selection.kind) {
    case "nodes":
      return { type: "removeNode", id: selection.id };
    case "states":
      return { type: "removeState", id: selection.id };
    case "transitions":
      return { type: "removeTransition", id: selection.id };
    case "roles":
      return { type: "removeRole", id: selection.id };
    case "modules":
      return { type: "removeModule", id: selection.id };
  }
}
/** Copy a selected decision fragment, remapping every edge within that fragment. */
export function copyFragment(
  graph: RuleGraph,
  selection: GraphSelection,
): { operations: GraphOperation[]; selection: GraphSelection } {
  if (selection.kind === "modules") {
    const value = graph.modules.find((m) => m.moduleId === selection.id)!;
    const id = freshId(graph, `${value.moduleId}-copy`);
    return {
      operations: [
        {
          type: "putModule",
          module: { ...structuredClone(value), moduleId: id },
        },
      ],
      selection: { kind: "modules", id },
    };
  }
  if (selection.kind === "roles" || selection.kind === "transitions") {
    const value = graph[selection.kind].find((o) => o.id === selection.id)!;
    const id = freshId(graph, `${value.id}-copy`);
    return {
      operations: [
        putObject(selection.kind, { ...structuredClone(value), id }),
      ],
      selection: { kind: selection.kind, id },
    };
  }
  const state =
    selection.kind === "states"
      ? graph.states.find((s) => s.id === selection.id)
      : undefined;
  const cloned = cloneGraphFragment(graph, state?.treeId ?? selection.id);
  const operations = [...cloned.patch.operations];
  if (state) {
    const id = freshId(graph, `${state.id}-copy`);
    operations.push({
      type: "putState",
      state: {
        ...structuredClone(state),
        id,
        name: `${state.name} 副本`,
        treeId: cloned.rootId,
      },
    });
    return { operations, selection: { kind: "states", id } };
  }
  return { operations, selection: { kind: "nodes", id: cloned.rootId } };
}
