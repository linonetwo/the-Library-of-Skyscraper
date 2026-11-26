import { GraphModuleComposer } from "../rule-modules/GraphModuleComposer";
import type { ModuleRequest } from "../rule-modules/moduleCatalog";
import { GraphFragmentLibrary } from "../rule-fragments/GraphFragmentLibrary";
import {
  GraphObjectActions,
  GraphObjectBrowser,
  GraphDiagnostics,
} from "./GraphObjectBrowser";
import { useEffect, useState, type ReactNode } from "react";
import {
  renameGraphObject,
  type RuleGraph,
  type GraphPatch,
  type GraphOperation,
  type GraphDiagnostic,
  type GraphTrace,
} from "../../../behavior-modules/graph";
import { GraphCanvas } from "./GraphCanvas";
import { GraphInspector } from "./GraphInspector";
import { copyFragment, type GraphSelection } from "./graphObjects";
import "./graph.css";
export function GraphEditor({
  graph,
  trace,
  traceSourceHash,
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
  moduleRequest,
  onModuleRequestChange,
}: {
  graph: RuleGraph;
  trace?: GraphTrace | null;
  traceSourceHash?: string;
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
  moduleRequest?: ModuleRequest | null;
  onModuleRequestChange?: (request: ModuleRequest | null) => void;
}) {
  const [treeState, setTreeState] = useState(graph.states[0]?.id ?? "");
  useEffect(() => {
    setRename(selection?.id ?? "");
  }, [selection?.id]);
  const [mode, setMode] = useState<"states" | "tree">("states");
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
    }
  };
  const action = (run: () => void) => {
    try {
      setError("");
      run();
    } catch (cause) {
      setError((cause as Error).message);
    }
  };
  const copySelected = () => {
    if (selection)
      action(() => {
        const copy = copyFragment(graph, selection);
        edit(copy.operations);
        choose(copy.selection);
      });
  };
  return (
    <section
      data-rule-graph
      data-graph-state={JSON.stringify({
        graph,
        selection,
        diagnostics,
        trace,
        traceSourceHash,
        view: mode,
        treeState,
      })}
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
          copySelected();
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
      <GraphObjectActions
        graph={graph}
        selection={selection}
        onEdit={edit}
        onSelect={(next) => (next ? choose(next) : onSelect(null))}
        onCopy={copySelected}
      />
      {moduleRequest && onModuleRequestChange && <GraphModuleComposer graph={graph} request={moduleRequest} onChange={onModuleRequestChange} onApply={onApply} onSelect={choose} />}
      <GraphFragmentLibrary graph={graph} selection={selection} onApply={onApply} onSelect={choose} />
      <div className="graph-workspace">
        <GraphObjectBrowser
          graph={graph}
          selection={selection}
          onSelect={choose}
        />
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
                aria-label="查看状态持续树"
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
                onSelect={choose}
              />
            </>
          ) : (
            <p>选择对象，查看输入、参数与合法连接出口。</p>
          )}
        </aside>
      </div>
      {error && <p role="alert">{error}</p>}
      <GraphDiagnostics
        graph={graph}
        diagnostics={diagnostics}
        onSelect={choose}
      />
      {goalEditor}
      {comparisonEditor}
    </section>
  );
}
