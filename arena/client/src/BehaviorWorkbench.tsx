import { WorkbenchRunPanel } from "./WorkbenchRunPanel";
import { graphTrace } from "./rule-comparison/TraceView";
import { RuleComparison } from "./rule-comparison/RuleComparison";
import { GraphEditor } from "./rule-graph/GraphEditor";
import { useRuleGraphDraft } from "./rule-graph/useRuleGraphDraft";
import type { GraphSelection } from "./rule-graph/graphObjects";
import { getGraphSourceRef } from "../../behavior-modules/graph";
import { RuleGoalEditor } from "./rule-goals/RuleGoalEditor";
import { scriptTemplates } from "./scriptTemplates";
import { lazy, Suspense, useState } from "react";
import { getModuleSourceRef } from "../../behavior-modules";
import { useBehaviorWorkbench } from "./useBehaviorWorkbench";
import { BehaviorModuleCard } from "./BehaviorModuleCard";
import { BehaviorFlow } from "./BehaviorFlow";
import { ScriptFiles } from "./ScriptFiles";
import { ScriptHistory } from "./ScriptHistory";
import { ScriptRuntime } from "./ScriptRuntime";
import { ScriptVersion } from "./ScriptVersion";
import "./styles/scripts.css";
import "./styles/behavior-workbench.css";
const MonacoRuleEditor = lazy(() => import("./MonacoRuleEditor"));
export default function BehaviorWorkbench({
  onBack,
  view,
  onViewChange,
}: {
  onBack?: () => void;
  view?: "modules" | "graph" | "source" | "versions";
  onViewChange?: (view: "modules" | "graph" | "source" | "versions") => void;
}) {
  const w = useBehaviorWorkbench();
  const g = useRuleGraphDraft(w);
  const [graphSelection, setGraphSelection] = useState<GraphSelection | null>(
    null,
  );
  const [sourcePosition, setSourcePosition] = useState<{
    file: string;
    line: number;
    column: number;
  }>();
  const locateGraph = (id: string) => {
    const ref = getGraphSourceRef(w.draft, id);
    if (ref) {
      setTab("source");
      w.jump({ ...ref, message: "规则图对象", code: 0, severity: "warning" });
    }
  };
  const selectSourceObject = () => {
    if (!g.graph || !sourcePosition) return;
    const groups = [
      "roles",
      "states",
      "transitions",
      "nodes",
      "modules",
    ] as const;
    for (const kind of groups)
      for (const item of g.graph[kind]) {
        const id = "id" in item ? item.id : item.moduleId;
        const ref = getGraphSourceRef(w.draft, id);
        if (
          ref?.file === sourcePosition.file &&
          ref.line === sourcePosition.line
        ) {
          setGraphSelection({ kind, id });
          setTab("graph");
          return;
        }
      }
  };
  const [selectedModuleId, setSelectedModuleId] = useState<string>();
  const [localTab, setLocalTab] = useState<
    "modules" | "graph" | "source" | "versions"
  >("modules");
  const tab = view ?? localTab;
  const setTab = (next: "modules" | "graph" | "source" | "versions") => {
    setLocalTab(next);
    onViewChange?.(next);
  };
  const locate = (moduleId: string) => {
    const ref = getModuleSourceRef(
      { files: w.draft.files, entry: w.draft.entry },
      moduleId,
    );
    setTab("source");
    if (ref)
      w.jump({ ...ref, message: "模块配置", code: 0, severity: "warning" });
  };
  const graphPreview = graphTrace(
    w.preview?.execution?.decision?.memoryPatch?.set?.aiTrace,
  );
  const currentGraphTrace =
    graphPreview?.graphId === g.graph?.graphId &&
    w.preview?.sourceHash === w.compilation?.bundle?.sourceHash
      ? graphPreview
      : null;
  return (
    <div
      className={`script-workbench behavior-workbench ${tab === "graph" ? "graph-workbench" : ""}`}
    >
      {tab !== "graph" && (
        <header>
          <div>
            <span className="eyebrow">AUTONOMOUS DOCTRINE · PRIORITY</span>
            <h2>编排小队的下一步。</h2>
          </div>
          {onBack && <button onClick={onBack}>返回</button>}
        </header>
      )}
      {tab !== "graph" && (
        <p>
          按优先级尝试模块，首个满足条件的模块选择动作。修改草稿后试跑，再发布到战场。
        </p>
      )}
      {tab !== "graph" && w.backup && (
        <button onClick={w.restoreBackup}>撤销上次替换</button>
      )}
      {tab === "modules" && (
        <label className="behavior-template">
          官方组合{" "}
          <select
            aria-label="载入官方行为组合"
            value=""
            onChange={(event) =>
              w.createPlan(event.target.value as "expedition" | "logistics")
            }
          >
            <option value="" disabled>
              选择组合 · 替换草稿并保留撤销历史
            </option>
            <option value="expedition">
              首场远征 · 清守卫、建目录馆、编目
            </option>
            <option value="logistics">物流循环 · 采集与入库</option>
          </select>
        </label>
      )}
      {g.blocked && (
        <p className="graph-source-status" role="alert">
          草图待修；模型诊断阻止编译、试跑与发布。源码与当前草图同步保存。
        </p>
      )}
      <ScriptVersion busy={w.busy} onDisable={() => void w.run("disable")} />
      {!view && (
        <div className="behavior-tabs" role="tablist" aria-label="AI 编辑视图">
          {(["modules", "graph", "source", "versions"] as const).map(
            (id, i) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
              >
                {["行为模块", "规则图", "TypeScript 源码", "发布版本"][i]}
              </button>
            ),
          )}
        </div>
      )}
      {tab === "graph" && (
        <>
          <div className="graph-tools">
            {w.backup && (
              <button onClick={w.restoreBackup}>撤销上次替换</button>
            )}
            <button onClick={() => g.replace("logistics")}>
              载入物流状态图
            </button>
            <button onClick={() => g.replace("retreat")}>载入撤退冷却图</button>
            {w.plan && (
              <button onClick={() => g.replace("priority")}>
                从当前五卡显式创建规则图
              </button>
            )}
          </div>
          {!g.graph && (
            <p>
              当前工程保留为五卡或手写源码。选择示例或显式转换会记录替换历史，可撤销。
            </p>
          )}
          {g.error && <p role="alert">{g.error}</p>}
          {g.graph && (
            <GraphEditor
              graph={g.graph}
              trace={currentGraphTrace}
              traceSourceHash={
                currentGraphTrace ? w.preview?.sourceHash : undefined
              }
              diagnostics={g.diagnostics}
              selection={graphSelection}
              onSelect={setGraphSelection}
              onApply={g.apply}
              onLocate={locateGraph}
              onUndo={g.undo}
              onRedo={g.redo}
              canUndo={g.canUndo}
              canRedo={g.canRedo}
              comparisonEditor={
                <RuleComparison session={w.session!} draftProject={w.draft} />
              }
              goalEditor={
                <RuleGoalEditor
                  graph={g.graph}
                  onApply={g.apply}
                  onLocate={(id) => {
                    const graph = g.graph!;
                    for (const kind of [
                      "roles",
                      "states",
                      "transitions",
                      "nodes",
                      "modules",
                    ] as const)
                      if (
                        graph[kind].some(
                          (o) => ("id" in o ? o.id : o.moduleId) === id,
                        )
                      ) {
                        setGraphSelection({ kind, id });
                        break;
                      }
                  }}
                />
              }
            />
          )}
        </>
      )}
      {tab === "modules" &&
        (w.plan ? (
          <>
            <BehaviorFlow plan={w.plan} />
            <div className="behavior-cards">
              {w.plan.modules
                .slice()
                .sort((a, b) => b.priority - a.priority)
                .map((m) => (
                  <BehaviorModuleCard
                    key={m.moduleId}
                    module={m}
                    expanded={selectedModuleId === m.moduleId}
                    onToggle={() =>
                      setSelectedModuleId(
                        selectedModuleId === m.moduleId
                          ? undefined
                          : m.moduleId,
                      )
                    }
                    onSource={() => locate(m.moduleId)}
                    onChange={(next) =>
                      w.updatePlan({
                        ...w.plan!,
                        modules: w.plan!.modules.map((current) =>
                          current.moduleId === m.moduleId ? next : current,
                        ),
                      })
                    }
                  />
                ))}
            </div>
          </>
        ) : (
          <section className="behavior-start">
            <h3>创建官方行为组合</h3>
            <p>
              当前草稿为 TypeScript
              项目，无法恢复为模块组合。可以继续编辑源码，或明确替换草稿为官方组合。
            </p>
            <button onClick={() => setTab("source")}>继续编辑当前源码</button>
            <button onClick={() => w.createPlan()}>替换草稿为官方组合</button>
          </section>
        ))}
      {tab === "source" && (
        <>
          <select
            aria-label="载入规则模板"
            value=""
            disabled={w.busy}
            onChange={(event) =>
              w.replaceProject(scriptTemplates[event.target.value].project)
            }
          >
            <option value="" disabled>
              载入模板 · 替换草稿
            </option>
            {Object.entries(scriptTemplates).map(([id, template]) => (
              <option key={id} value={id}>
                {template.name}
              </option>
            ))}
          </select>
          {g.graph && (
            <div className="graph-source-locate">
              <button disabled={!sourcePosition} onClick={selectSourceObject}>
                从当前源码行定位图对象
              </button>
              <small>
                仅对象定义所在行可定位；当前位置 {sourcePosition?.file}:
                {sourcePosition?.line}
              </small>
            </div>
          )}
          <ScriptFiles
            draft={w.draft}
            selectFile={w.selectFile}
            addFile={w.addFile}
            setEntry={w.setEntry}
          />
          <Suspense fallback={<p>正在加载源码编辑器…</p>}>
            <MonacoRuleEditor
              files={w.draft.files}
              activeFile={w.draft.activeFile}
              onChange={w.edit}
              diagnostics={w.compilation?.diagnostics ?? []}
              location={w.location}
              onPositionChange={setSourcePosition}
            />
          </Suspense>
        </>
      )}
      {
        <ScriptHistory
          draft={w.draft}
          busy={w.busy}
          onLoad={w.loadProject}
          onRestore={(hash) => void w.run("rollback", hash)}
        />
      }
      <WorkbenchRunPanel
        hasSession={!!w.session}
        ready={w.ready}
        busy={w.busy}
        blocked={g.blocked}
        error={w.error}
        compilation={w.compilation}
        preview={w.preview}
        currentGraphTrace={currentGraphTrace}
        onRun={(mode) => void w.run(mode)}
        onDiagnostic={(d) => {
          setTab("source");
          w.jump(d);
        }}
        onLocateModule={locate}
        onLocateGraph={locateGraph}
      />
      <ScriptRuntime key={`${w.session?.sessionId}:${w.session?.playerId}`} />
    </div>
  );
}
