import { useEffect, useState, type ReactNode } from "react";
import {
  renameGraphObject,
  type RuleGraph,
  type GraphPatch,
  type GraphOperation,
  type GraphDiagnostic,
  type RuleNode,
  type GraphTrace,
} from "../../../behavior-modules/graph";
import { GraphCanvas } from "./GraphCanvas";
import { GraphInspector } from "./GraphInspector";
import {
  freshId,
  makeNode,
  copyFragment,
  nodeNames,
  removeObject,
  type GraphSelection,
} from "./graphObjects";
import { createDefaultBehaviorPlan } from "../../../behavior-modules";
import { roleNames } from "../types";
import "./graph.css";
const groups = [
  ["roles", "岗位入口"],
  ["states", "状态"],
  ["transitions", "状态转移"],
  ["nodes", "决策节点"],
  ["modules", "官方模块"],
] as const;
export function GraphEditor({
  graph,
  trace,
  diagnostics,
  onApply,
  onLocate,
  selection,
  onSelect,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  goalEditor,
  comparisonEditor,
}: {
  graph: RuleGraph;
  trace?: GraphTrace | null;
  diagnostics: GraphDiagnostic[];
  onApply: (patch: GraphPatch) => void;
  onLocate: (id: string) => void;
  selection: GraphSelection | null;
  onSelect: (selection: GraphSelection | null) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  goalEditor?: ReactNode;
  comparisonEditor?: ReactNode;
}) {
  const [treeState, setTreeState] = useState(graph.states[0]?.id ?? "");
  useEffect(() => {
    setRename(selection?.id ?? "");
  }, [selection?.id]);
  const [mode, setMode] = useState<"states" | "tree">("states");
  const [newKind, setNewKind] = useState("state");
  const [rename, setRename] = useState("");
  const [error, setError] = useState("");
  const edit = (operations: GraphOperation[]) =>
    onApply({
      graphId: graph.graphId,
      baseRevision: graph.revision,
      operations,
    });
  const choose = (next: GraphSelection) => {
    onSelect(next);
    setRename(next.id);
    if (next.kind === "states") {
      setMode("states");
      setTreeState(next.id);
    }
    if (next.kind === "nodes") {
      setMode("tree");
      setTreeState("");
    }
  };
  const add = () => {
    let operation: GraphOperation;
    let next: GraphSelection;
    const root = graph.nodes.find((n) => n.type === "hold")?.id ?? "";
    if (newKind === "state") {
      const id = freshId(graph, "state");
      operation = {
        type: "putState",
        state: { id, name: "新状态", treeId: root, entry: [], exit: [] },
      };
      next = { kind: "states", id };
    } else if (newKind === "transition") {
      const id = freshId(graph, "transition");
      operation = {
        type: "putTransition",
        transition: {
          id,
          from: graph.states[0]?.id ?? "",
          to: graph.states[1]?.id ?? "",
          priority: 10,
          condition: {
            type: "compare",
            field: "cargo",
            op: "gte",
            value: 6,
            missing: false,
          },
          cooldownTicks: 0,
          minStateTicks: 0,
        },
      };
      next = { kind: "transitions", id };
    } else if (newKind === "role") {
      const id = freshId(graph, "role");
      operation = {
        type: "putRole",
        role: {
          id,
          role: "gatherer",
          initialStateId: graph.states[0]?.id ?? "",
          fallbackStateId: graph.states[0]?.id ?? "",
        },
      };
      next = { kind: "roles", id };
    } else if (newKind.startsWith("binding:")) {
      const kind = newKind.slice(8);
      const template = createDefaultBehaviorPlan().modules.find(m => m.kind === kind)!;
      const moduleId = freshId(graph, `${kind}-binding`);
      operation = {type:"putModule",module:{...template,moduleId}};
      next = {kind:"modules",id:moduleId};
    } else {
      const node = makeNode(graph, newKind as RuleNode["type"]);
      operation = { type: "putNode", node };
      next = { kind: "nodes", id: node.id };
    }
    edit([operation]);
    choose(next);
  };
  const action = (run: () => void) => {
    try {
      setError("");
      run();
    } catch (cause) {
      setError((cause as Error).message);
    }
  };
  return (
    <section
      data-rule-graph
      data-graph-state={JSON.stringify({graph, selection, diagnostics, trace, view:mode, treeState})}
      className="rule-graph-editor"
      aria-label="规则图编辑器"
      onKeyDown={(e) => {
        const tag = (e.target as HTMLElement).tagName;
        if (["INPUT", "SELECT", "TEXTAREA"].includes(tag)) return;
        if ((e.ctrlKey || e.metaKey) && e.key === "z") {
          e.preventDefault();
          e.shiftKey ? onRedo() : onUndo();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === "d" && selection) {
          e.preventDefault();
          action(() => {
            const copy = copyFragment(graph, selection);
            edit(copy.operations);
            choose(copy.selection);
          });
        }
      }}
    >
      <header>
        <div>
          <strong>{graph.graphId}</strong>
          <small>草图修订 {graph.revision} · 跨步状态 + 单步决策</small>
        </div>
        <button onClick={onUndo} disabled={!canUndo}>
          撤销图修改
        </button>
        <button onClick={onRedo} disabled={!canRedo}>
          重做图修改
        </button>
      </header>
      <div className="graph-tools">
        <select
          aria-label="新增规则对象类型"
          value={newKind}
          onChange={(e) => setNewKind(e.target.value)}
        >
          <option value="state">状态</option>
          <option value="transition">状态转移</option>
          <option value="role">岗位入口</option>
          {createDefaultBehaviorPlan().modules.map(m => <option key={m.kind} value={`binding:${m.kind}`}>模块绑定 · {m.kind}</option>)}
          {Object.entries(nodeNames).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <button onClick={add}>新增规则对象</button>
        <button
          disabled={!selection}
          onClick={() =>
            selection &&
            action(() => {
              const copy = copyFragment(graph, selection);
              edit(copy.operations);
              choose(copy.selection);
            })
          }
        >
          复制所选片段
        </button>
        <button
          disabled={!selection}
          onClick={() => {
            if (selection) {
              edit([removeObject(selection)]);
              onSelect(null);
            }
          }}
        >
          删除所选对象
        </button>
      </div>
      <div className="graph-workspace">
        <nav aria-label="本规则对象树" className="graph-object-tree">
          {groups.map(([kind, name]) => (
            <details open key={kind}>
              <summary>
                {name} · {graph[kind].length}
              </summary>
              {graph[kind].map((value) => {
                const id = kind === "modules" ? (value as RuleGraph["modules"][number]).moduleId : (value as {id:string}).id;
                const label =
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
                    aria-pressed={
                      selection?.kind === kind && selection.id === id
                    }
                    onClick={() => choose({ kind, id })}
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
            <p>
              节点的「定位源码」打开同一生成工程；试跑与版本在工作台中操作。
            </p>
          </details>
        </nav>
        <div className="graph-main">
          <div role="tablist" aria-label="规则图画布模式">
            <button
              role="tab"
              aria-selected={mode === "states"}
              onClick={() => setMode("states")}
            >
              状态图
            </button>
            <button
              role="tab"
              aria-selected={mode === "tree"}
              onClick={() => setMode("tree")}
            >
              决策树
            </button>
          </div>
          {mode === "tree" && (
            <label>
              查看状态持续树
              <select
                value={treeState}
                onChange={(e) => setTreeState(e.target.value)}
              >
                <option value="">全部决策节点</option>
                {graph.states.map((state) => (
                  <option key={state.id} value={state.id}>
                    {state.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <GraphCanvas
            rootId={graph.states.find((s) => s.id === treeState)?.treeId}
            graph={graph}
            trace={trace}
            mode={mode}
            selected={selection}
            onSelect={choose}
          />
          <p>
            点击节点或用对象列表选择；连接在参数区按类型选择。Ctrl/⌘ Z
            撤销，Ctrl/⌘ D 复制片段。图上顺序仅用于排版。
          </p>
        </div>
        <aside>
          {selection ? (
            <>
              <label>
                稳定对象ID
                <input
                  aria-label="对象新ID"
                  value={rename}
                  onChange={(e) => setRename(e.target.value)}
                />
              </label>
              <button
                disabled={!rename || rename === selection.id}
                onClick={() =>
                  action(() => {
                    onApply(renameGraphObject(graph, selection.id, rename));
                    choose({ ...selection, id: rename });
                  })
                }
              >
                更名并重连引用
              </button>
              <GraphInspector
                key={`${selection.kind}:${selection.id}`}
                graph={graph}
                selection={selection}
                onEdit={edit}
                onLocate={onLocate}
              />
            </>
          ) : (
            <p>选择对象，查看输入、参数与合法连接出口。</p>
          )}
        </aside>
      </div>
      {error && <p role="alert">{error}</p>}
      <section className="graph-diagnostics" aria-label="规则图诊断">
        <h4>模型诊断</h4>
        {diagnostics.length ? (
          diagnostics.map((diagnostic, i) => (
            <button
              key={i}
              data-severity={diagnostic.severity}
              onClick={() => {
                const kind = groups.find(([key]) =>
                  graph[key].some(
                    (o) =>
                      ("id" in o ? o.id : o.moduleId) ===
                      diagnostic.objectId,
                  ),
                )?.[0];
                if (kind) choose({ kind, id: diagnostic.objectId });
              }}
            >
              {diagnostic.severity === "error" ? "错误" : "提示"} ·{" "}
              {diagnostic.objectId} · {diagnostic.message}
            </button>
          ))
        ) : (
          <p>当前图无模型诊断；编译、试跑和运行结果以各自返回为准。</p>
        )}
      </section>
      {goalEditor}
      {comparisonEditor}
    </section>
  );
}
