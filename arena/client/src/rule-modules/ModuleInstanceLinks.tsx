import { useState } from "react";
import { freshGraphId, type GraphOperation, type RuleGraph } from "../../../behavior-modules/graph";
import type { GraphSelection } from "../rule-graph/graphObjects";
export function ModuleInstanceLinks({ graph, moduleId, nodeId, onEdit, onSelect }: {
  graph: RuleGraph; moduleId: string; nodeId?: string;
  onEdit: (operations: GraphOperation[]) => void; onSelect: (selection: GraphSelection) => void;
}) {
  const [selected, setSelected] = useState<string[]>(nodeId ? [nodeId] : []);
  const module = graph.modules.find(module => module.moduleId === moduleId);
  const references = graph.nodes.filter(node => node.type === "module" && node.moduleId === moduleId);
  if (!module) return null;
  const selectedReferences = references.filter(node => selected.includes(node.id));
  return <fieldset className="module-instance-links"><legend>实例 {moduleId} · {references.length} 个引用</legend>
    <p>这些节点共享参数。选择引用点可复制为独立实例。</p>
    {references.map(node => <div key={node.id}><label><input type="checkbox" aria-label={`独立改绑 ${node.id}`} checked={selected.includes(node.id)} onChange={event => setSelected(event.target.checked ? [...selected, node.id] : selected.filter(id => id !== node.id))} />{node.id}</label><button onClick={() => onSelect({ kind: "nodes", id: node.id })}>选择引用节点 {node.id}</button></div>)}
    <button disabled={!selectedReferences.length} onClick={() => {
      const nextId = freshGraphId(graph, `${moduleId}-copy`);
      onEdit([{ type: "putModule", module: { ...structuredClone(module), moduleId: nextId } }, ...selectedReferences.map(node => ({ type: "putNode" as const, node: { ...node, moduleId: nextId } }))]);
      onSelect({ kind: "modules", id: nextId });
    }}>复制独立实例并改绑所选引用</button>
    <small>将改绑：{selectedReferences.map(node => node.id).join("、") || "选择引用节点"}</small>
  </fieldset>;
}
