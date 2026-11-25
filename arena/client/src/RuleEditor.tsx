import { ScrollText, ArrowUpRight, Check } from "lucide-react";
import { lazy, Suspense, useState } from "react";

import { useArena, presetNames } from "./ArenaWorkspace";
import { readDraft, isStockDraft } from "./ruleDraft";
import { recoverBehaviorPlan } from "../../behavior-modules";
import { recoverRuleGraph } from "../../behavior-modules/graph";
const BehaviorWorkbench = lazy(() => import("./BehaviorWorkbench"));

export default function RuleEditor() {
  const {
    command,
    preset,
    setPreset,
    threshold,
    setThreshold,
    player,
    ready,
    session,
  } = useArena();
  const [view, setView] = useState<
    "modules" | "graph" | "source" | "versions" | "presets"
  >(() => {
    const draft = readDraft(session);
    if (recoverRuleGraph(draft)) return "graph";
    return isStockDraft(draft) || recoverBehaviorPlan(draft) ? "modules" : "source";
  });
  const coding = view !== "presets";
  return (
    <div className="ai-workbench">
      <h2>AI 工作台</h2>
      <div className="ai-mode-tabs" role="tablist" aria-label="AI 工作台模式">
        <button
          role="tab"
          id="ai-modules-tab"
          aria-controls="ai-editor-panel"
          aria-selected={view === "modules"}
          onClick={() => setView("modules")}
        >
          行为模块
        </button>
        <button
          role="tab"
          id="ai-graph-tab"
          aria-controls="ai-editor-panel"
          aria-selected={view === "graph"}
          onClick={() => setView("graph")}
        >
          规则图
        </button>
        <button
          role="tab"
          id="ai-typescript-tab"
          aria-selected={view === "source"}
          aria-controls="ai-editor-panel"
          onClick={() => setView("source")}
        >
          TypeScript
        </button>
        <button
          role="tab"
          id="ai-versions-tab"
          aria-controls="ai-editor-panel"
          aria-selected={view === "versions"}
          onClick={() => setView("versions")}
        >
          发布版本
        </button>
        <button
          role="tab"
          id="ai-presets-tab"
          aria-selected={!coding}
          aria-controls="ai-editor-panel"
          onClick={() => setView("presets")}
        >
          行动预设
        </button>
      </div>
      <div
        id="ai-editor-panel"
        role="tabpanel"
        aria-labelledby={
          {
            modules: "ai-modules-tab",
            graph: "ai-graph-tab",
            source: "ai-typescript-tab",
            versions: "ai-versions-tab",
            presets: "ai-presets-tab",
          }[view]
        }
      >
        {coding ? (
          <Suspense fallback={<p>正在加载 AI 工作台…</p>}>
            <BehaviorWorkbench
              view={
                coding
                  ? (view as "modules" | "graph" | "source" | "versions")
                  : "modules"
              }
              onViewChange={setView}
              key={`${session?.sessionId}:${session?.playerId}`}
              onBack={() => setView("presets")}
            />
          </Suspense>
        ) : (
          <div className="rule-editor">
            <span className="eyebrow">AUTONOMOUS DOCTRINE</span>
            <h2>把意图交给小队。</h2>
            <p>
              角色依照已发布的行动规则自主探索、采集与守卫。调整策略，观察每一步的真实结果。
            </p>
            <label className="field-label">行动预设</label>
            <div className="presets">
              {(["gather", "defend", "explore"] as const).map((item, i) => (
                <button
                  key={item}
                  className={preset === item ? "chosen" : ""}
                  onClick={() => setPreset(item)}
                >
                  <span>0{i + 1}</span>
                  <strong>{presetNames[item]}</strong>
                  <small>
                    {item === "gather"
                      ? "优先收集藏材，发展据点"
                      : item === "defend"
                        ? "在据点附近防守与恢复"
                        : "前往未知房间，接触威胁"}
                  </small>
                  {preset === item && <Check size={16} />}
                </button>
              ))}
            </div>
            <label className="field-label" htmlFor="retreat">
              生命值撤退阈值 <b>{threshold}%</b>
            </label>
            <input
              id="retreat"
              type="range"
              min="0"
              max="100"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
            <div className="range-labels">
              <span>坚持作战</span>
              <span>优先生存</span>
            </div>
            <div className="rule-summary">
              <ScrollText size={17} />
              <span>
                当前规则：
                {player?.script
                  ? `TS · ${player.script.sourceHash.slice(0, 12)} · 发布预设后切换`
                  : player
                    ? `${presetNames[player.rule.preset]} · 低于 ${player.rule.retreatHp}% 生命值撤退`
                    : "尚未创建赛局"}
              </span>
            </div>
            <button
              className="primary wide"
              disabled={!ready}
              onClick={() =>
                void command({
                  type: "rule",
                  preset,
                  retreatHp: threshold,
                  assignTasks: true,
                })
              }
            >
              确认并发布规则 <ArrowUpRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
