import { graphModuleName } from "../rule-modules/moduleCatalog";
import { useState } from "react";
import type {
  RuleGraph,
  GraphOperation,
  GraphDiagnostic,
} from "../../../behavior-modules/graph";
import { createDefaultBehaviorPlan } from "../../../behavior-modules";
import { roleNames } from "../types";
import {
  createGraphObject,
  graphObjectGroups,
  nodeNames,
  removeObject,
  type GraphSelection,
} from "./graphObjects";

export function GraphObjectActions({
  graph,
  selection,
  onEdit,
  onSelect,
  onCopy,
}: {
  graph: RuleGraph;
  selection: GraphSelection | null;
  onEdit: (operations: GraphOperation[]) => void;
  onSelect: (selection: GraphSelection | null) => void;
  onCopy: () => void;
}) {
  const [newKind, setNewKind] = useState("state");
  return (
    <div className="graph-tools">
      <select
        aria-label="新增规则对象类型"
        value={newKind}
        onChange={(e) => setNewKind(e.target.value)}
      >
        <option value="state">状态</option>
        <option value="transition">状态转移</option>
        <option value="role">岗位入口</option>
        {createDefaultBehaviorPlan().modules.map((m) => (
          <option key={m.kind} value={`binding:${m.kind}`}>
            模块绑定 · {m.kind}
          </option>
        ))}
        {Object.entries(nodeNames).map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
      <button
        onClick={() => {
          const { operation, selection: next } = createGraphObject(
            graph,
            newKind,
          );
          onEdit([operation]);
          onSelect(next);
        }}
      >
        新增规则对象
      </button>
      <button disabled={!selection} onClick={onCopy}>
        复制所选片段
      </button>
      <button
        disabled={!selection}
        onClick={() => {
          if (selection) {
            onEdit([removeObject(selection)]);
            onSelect(null);
          }
        }}
      >
        删除所选对象
      </button>
    </div>
  );
}
export function GraphObjectBrowser({
  graph,
  selection,
  onSelect,
}: {
  graph: RuleGraph;
  selection: GraphSelection | null;
  onSelect: (selection: GraphSelection) => void;
}) {
  return (
    <nav aria-label="本规则对象树" className="graph-object-tree">
      {graphObjectGroups.map(([kind, name]) => (
        <details open key={kind}>
          <summary>
            {name} · {graph[kind].length}
          </summary>
          {graph[kind].map((value) => {
            const id =
              kind === "modules"
                ? (value as RuleGraph["modules"][number]).moduleId
                : (value as { id: string }).id;
            const binding = "type" in value && value.type === "module" ? graph.modules.find(module => module.moduleId === value.moduleId) : "kind" in value && value.kind === "custom" ? value : null;
            const label = binding?.kind === "custom" ? `自定义模块 · ${graphModuleName(graph, binding)}` :
              "name" in value
                ? value.name
                : "role" in value
                  ? roleNames[value.role]
                  : "type" in value
                    ? nodeNames[value.type]
                    : id;
            return (
              <button
                key={id}
                data-object-kind={kind}
                data-object-id={id}
                aria-pressed={selection?.kind === kind && selection.id === id}
                onClick={() => onSelect({ kind, id })}
              >
                <span>{label}</span>
                <code>{id}</code>
              </button>
            );
          })}
        </details>
      ))}
      <details>
        <summary>源码与测试场景</summary>
        <p>节点的「定位源码」打开同一生成工程；试跑与版本在工作台中操作。</p>
      </details>
    </nav>
  );
}
export function GraphDiagnostics({
  graph,
  diagnostics,
  onSelect,
}: {
  graph: RuleGraph;
  diagnostics: GraphDiagnostic[];
  onSelect: (selection: GraphSelection) => void;
}) {
  return (
    <section className="graph-diagnostics" aria-label="规则图诊断">
      <h4>模型诊断</h4>
      {diagnostics.length ? (
        diagnostics.map((diagnostic, i) => (
          <button
            key={i}
            data-severity={diagnostic.severity}
            onClick={() => {
              const kind = graphObjectGroups.find(([key]) =>
                graph[key].some(
                  (o) =>
                    ("id" in o ? o.id : o.moduleId) === diagnostic.objectId,
                ),
              )?.[0];
              if (kind) onSelect({ kind, id: diagnostic.objectId });
            }}
          >
            {diagnostic.severity === "error" ? "错误" : "提示"} ·{" "}
            {diagnostic.objectId} ·{" "}
            {diagnostic.code === "tree-cycle"
              ? "决策树不能成环；请修改连接"
              : diagnostic.code === "unreachable"
                ? "当前入口无法到达此对象"
                : diagnostic.message}
          </button>
        ))
      ) : (
        <p>当前图无模型诊断；编译、试跑和运行结果以各自返回为准。</p>
      )}
    </section>
  );
}
