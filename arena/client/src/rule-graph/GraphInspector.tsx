import { CompositionModuleFields } from "./CompositionModuleFields";
import { useState } from "react";
import type {
  RuleGraph,
  GraphOperation,
} from "../../../behavior-modules/graph";
import { BehaviorModuleCard } from "../BehaviorModuleCard";
import { putObject, type GraphSelection } from "./graphObjects";
import { NodeFields } from "./NodeFields";
import { StateMachineFields } from "./StateMachineFields";
export function GraphInspector({
  graph,
  selection,
  onEdit,
  onLocate,
}: {
  graph: RuleGraph;
  selection: GraphSelection;
  onEdit: (operations: GraphOperation[]) => void;
  onLocate: (id: string) => void;
}) {
  const [moduleExpanded, setModuleExpanded] = useState(true);
  const save = (value: Parameters<typeof putObject>[1]) =>
    onEdit([putObject(selection.kind, value)]);
  let body;
  if (selection.kind === "nodes") {
    const node = graph.nodes.find((n) => n.id === selection.id);
    if (!node) return null;
    body = <NodeFields graph={graph} node={node} onChange={save} />;
  } else if (selection.kind === "states") {
    const state = graph.states.find((value) => value.id === selection.id);
    if (!state) return null;
    body = (
      <StateMachineFields
        graph={graph}
        object={{ kind: "states", value: state }}
        onChange={save}
      />
    );
  } else if (selection.kind === "transitions") {
    const transition = graph.transitions.find(
      (value) => value.id === selection.id,
    );
    if (!transition) return null;
    body = (
      <StateMachineFields
        graph={graph}
        object={{ kind: "transitions", value: transition }}
        onChange={save}
      />
    );
  } else if (selection.kind === "roles") {
    const role = graph.roles.find((value) => value.id === selection.id);
    if (!role) return null;
    body = (
      <StateMachineFields
        graph={graph}
        object={{ kind: "roles", value: role }}
        onChange={save}
      />
    );
  } else {
    const module = graph.modules.find((m) => m.moduleId === selection.id);
    if (!module) return null;
    body = module.kind === "scout" || module.kind === "patrol" || module.kind === "escort" ? (
      <CompositionModuleFields module={module} onChange={save} />
    ) : (
      <BehaviorModuleCard
        module={module}
        expanded={moduleExpanded}
        onToggle={() => setModuleExpanded(!moduleExpanded)}
        onChange={save}
        onSource={() => onLocate(module.moduleId)}
      />
    );
  }
  return (
    <section className="graph-inspector" aria-label="选中规则对象参数">
      <header>
        <code>{selection.id}</code>
        <button onClick={() => onLocate(selection.id)}>定位源码 ↗</button>
      </header>
      {body}
      <small>
        连接选择器只列出对应类型；选择「断开」会保留草稿并报告引用诊断。
      </small>
    </section>
  );
}
