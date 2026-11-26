import { useEffect, useRef, useState } from "react";
import { freshGraphId, type GraphPatch, type RuleGraph } from "../../../behavior-modules/graph";
import { BehaviorModuleCard } from "../BehaviorModuleCard";
import { CompositionModuleFields } from "../rule-graph/CompositionModuleFields";
import type { GraphSelection } from "../rule-graph/graphObjects";
import { roleNames } from "../types";
import { moduleCatalog, type ModuleRequest } from "./moduleCatalog";
export function GraphModuleComposer({ graph, request, onChange, onApply, onSelect }: {
  graph: RuleGraph; request: ModuleRequest; onChange: (request: ModuleRequest | null) => void;
  onApply: (patch: GraphPatch) => void; onSelect: (selection: GraphSelection) => void;
}) {
  const [targetId, setTargetId] = useState("");
  const [expanded, setExpanded] = useState(true);
  const preview = useRef<HTMLElement>(null);
  const target = graph.states.find(state => state.id === targetId);
  const module = request.type === "new" ? request.module : graph.modules.find(module => module.moduleId === request.moduleId);
  useEffect(() => { preview.current?.focus(); }, [request.type, module?.moduleId]);
  const cancel = () => { onChange(null); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".module-catalog > button")?.focus()); };
  if (!module) return <p>请选择当前图中的模块实例。<button onClick={cancel}>返回编排</button></p>;
  const references = graph.nodes.filter(node => node.type === "module" && node.moduleId === module.moduleId);
  const instanceId = request.type === "new" ? freshGraphId(graph, module.moduleId) : module.moduleId;
  const confirm = () => {
    if (!target) return;
    const next = { ...module, moduleId: instanceId };
    const withModule = { ...graph, modules: request.type === "new" ? [...graph.modules, next] : graph.modules };
    const nodeId = freshGraphId(withModule, `${instanceId}-node`);
    onApply({ graphId: graph.graphId, baseRevision: graph.revision, operations: [
      ...(request.type === "new" ? [{ type: "putModule" as const, module: next }] : []),
      { type: "putNode", node: { id: nodeId, type: "module", moduleId: instanceId, fallback: target.treeId } },
      { type: "putState", state: { ...target, treeId: nodeId } },
    ] });
    onSelect({ kind: "states", id: target.id }); onSelect({ kind: "nodes", id: nodeId }); onSelect({ kind: "modules", id: instanceId }); onChange(null);
    requestAnimationFrame(() => document.querySelector<HTMLInputElement>(".graph-inspector input")?.focus());
  };
  return <section ref={preview} tabIndex={-1} className="module-composer" aria-label="模块接入预览">
    <h3>{request.type === "new" ? "添加独立实例" : "引用共享实例"} · {moduleCatalog[module.kind].name}</h3>
    <p>{moduleCatalog[module.kind].description}</p>
    <p>实例 {instanceId} · 当前 {references.length} 个引用。{request.type === "existing" ? "参数沿用当前实例；接入后修改参数会影响所有引用。" : "参数确认后与接入一并保存。"}</p>
    {request.type === "new" && (module.kind === "scout" || module.kind === "patrol" || module.kind === "escort" ? <CompositionModuleFields module={module} onChange={module => onChange({ type: "new", module })} /> : <BehaviorModuleCard module={module} expanded={expanded} onToggle={() => setExpanded(!expanded)} onChange={module => onChange({ type: "new", module })} />)}
    <label>接入状态<select aria-label="模块接入状态" value={target?.id ?? ""} onChange={event => setTargetId(event.target.value)}><option value="">选择状态入口</option>{graph.states.map(state => <option key={state.id} value={state.id}>{state.name} · {state.id}</option>)}</select></label>
    {target && <p>直接入口岗位：{graph.roles.filter(role => role.initialStateId === target.id || role.fallbackStateId === target.id).map(role => roleNames[role.role]).join(" / ") || "由状态转移进入"}；条件不足 → {target.treeId}（原持续树）。</p>}
    <div className="module-actions"><button disabled={!target} onClick={confirm}>确认接入模块</button><button onClick={cancel}>返回编排</button></div>
  </section>;
}
