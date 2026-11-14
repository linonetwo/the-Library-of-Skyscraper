import { ScrollText, ArrowUpRight, Check } from "lucide-react";
import { lazy, Suspense, useState } from "react";

import { useArena, presetNames } from "./ArenaWorkspace";
const ScriptWorkbench = lazy(() => import("./ScriptWorkbench"));

export default function RuleEditor() {
  const [coding, setCoding] = useState(false);
  const { command, preset, setPreset, threshold, setThreshold, player, ready } =
    useArena();
  if (coding) return <Suspense fallback={<p>正在加载规则工作台…</p>}>
    <ScriptWorkbench onBack={() => setCoding(false)} />
  </Suspense>;

  return (
    <div className="rule-editor">
      <span className="eyebrow">AUTONOMOUS DOCTRINE</span>
      <h2>把意图交给小队。</h2>
      <button className="text-button" onClick={() => setCoding(true)}>编写 TypeScript 规则 →</button>
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
          {player
            ? `${presetNames[player.rule.preset]} · 低于 ${player.rule.retreatHp}% 生命值撤退`
            : "尚未创建赛局"}
        </span>
      </div>
      <button
        className="primary wide"
        disabled={!ready}
        onClick={() =>
          void command({ type: "rule", preset, retreatHp: threshold })
        }
      >
        确认并发布规则 <ArrowUpRight size={16} />
      </button>
    </div>
  );
}
