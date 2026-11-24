import { scriptTemplates } from "./scriptTemplates";
import { lazy, Suspense, useState } from "react";
import { getModuleSourceRef } from "../../behavior-modules";
import { useBehaviorWorkbench } from "./useBehaviorWorkbench";
import { BehaviorModuleCard } from "./BehaviorModuleCard";
import {
  BehaviorFlow,
  BehaviorTraceView,
  readBehaviorTrace,
} from "./BehaviorFlow";
import { ScriptFiles } from "./ScriptFiles";
import { ScriptHistory } from "./ScriptHistory";
import { ScriptRuntime, PreviewStatePatch } from "./ScriptRuntime";
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
  view?: "modules" | "source" | "versions";
  onViewChange?: (view: "modules" | "source" | "versions") => void;
}) {
  const w = useBehaviorWorkbench();
  const [selectedModuleId, setSelectedModuleId] = useState<string>();
  const [localTab, setLocalTab] = useState<"modules" | "source" | "versions">(
    "modules",
  );
  const tab = view ?? localTab;
  const setTab = (next: "modules" | "source" | "versions") => {
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
  const trace = readBehaviorTrace(
    w.preview?.execution?.decision?.memoryPatch?.set?.aiTrace,
  );
  return (
    <div className="script-workbench behavior-workbench">
      <header>
        <div>
          <span className="eyebrow">AUTONOMOUS DOCTRINE · PRIORITY</span>
          <h2>编排小队的下一步。</h2>
        </div>
        {onBack && <button onClick={onBack}>返回</button>}
      </header>
      <p>
        按优先级尝试模块，首个满足条件的模块选择动作。修改草稿后试跑，再发布到战场。
      </p>
      {w.backup && <button onClick={w.restoreBackup}>恢复替换前草稿</button>}
      <ScriptVersion busy={w.busy} onDisable={() => void w.run("disable")} />
      <div className="behavior-tabs" role="tablist" aria-label="AI 编辑视图">
        {(["modules", "source", "versions"] as const).map((id, i) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {["行为模块", "TypeScript 源码", "发布版本"][i]}
          </button>
        ))}
      </div>
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
            <button disabled={!w.canReplaceProject} onClick={w.createPlan}>
              替换草稿为官方组合
            </button>
          </section>
        ))}
      {tab === "source" && (
        <>
          <select
            aria-label="载入规则模板"
            value=""
            disabled={w.busy || !w.canReplaceProject}
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
      <div className="script-toolbar">
        <button
          disabled={!w.session || w.busy}
          onClick={() => void w.run("compile")}
        >
          编译 TypeScript
        </button>
        <button
          disabled={!w.session || w.busy}
          onClick={() => void w.run("preview")}
        >
          试跑当前快照
        </button>
        <button
          className="primary"
          disabled={!w.ready || w.busy}
          onClick={() => void w.run("publish")}
        >
          发布到战场
        </button>
      </div>
      <section className="script-results" aria-label="脚本运行结果">
        {w.busy && <p>处理中…</p>}
        {w.error && <p role="alert">{w.error}</p>}
        {w.compilation?.diagnostics.map((d, i) => (
          <button
            className="script-diagnostic"
            key={i}
            onClick={() => {
              setTab("source");
              w.jump(d);
            }}
          >
            {d.file}:{d.line}:{d.column} · {d.message}
          </button>
        ))}
        {w.compilation?.bundle && (
          <p>编译通过 · {w.compilation.bundle.sourceHash.slice(0, 12)}</p>
        )}
        {w.preview?.execution && (
          <p>
            T{w.preview.tick} · V8 {w.preview.execution.durationMs.toFixed(2)}{" "}
            ms
          </p>
        )}
        {w.preview && <PreviewStatePatch preview={w.preview} />}
        {w.preview?.execution?.failure && (
          <p role="alert">{w.preview.execution.failure.message}</p>
        )}
        {w.preview?.execution?.decision && (
          <div aria-label="试跑动作意图">
            <strong>
              动作意图 {w.preview.execution.decision.intents.length} 条
            </strong>
            {w.preview.execution.decision.intents.map((intent, i) => (
              <div className="intent-row" key={i}>
                <code>{intent.actorId}</code>
                <b>{intent.type}</b>
                <span>
                  {"roomId" in intent ? intent.roomId : intent.reason}
                </span>
              </div>
            ))}
          </div>
        )}
        {trace && w.preview?.sourceHash && (
          <BehaviorTraceView
            trace={trace}
            sourceHash={w.preview.sourceHash}
            source="试跑当前草稿"
            onLocate={locate}
          />
        )}
      </section>
      <ScriptRuntime key={`${w.session?.sessionId}:${w.session?.playerId}`} />
    </div>
  );
}
