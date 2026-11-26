import { useEffect, useRef } from "react";
import { fromBehaviorPlan } from "../../../behavior-modules/graph";
import type { BehaviorPlan } from "../../../behavior-modules";
export function RuleGraphConversionPreview({ plan, onConfirm, onCancel }: { plan: BehaviorPlan; onConfirm: () => void; onCancel: () => void }) {
  const graph = fromBehaviorPlan(plan);
  const preview = useRef<HTMLElement>(null);
  useEffect(() => { preview.current?.focus(); }, []);
  return <section ref={preview} tabIndex={-1} className="module-composer" aria-label="五卡转换预览">
    <h3>转换为可扩展编排</h3>
    <p>保留当前 {plan.modules.length} 个实例、启用状态、岗位及优先顺序，生成 {graph.roles.length} 个岗位入口。确认后继续设置新模块，原五卡保存在替换历史中。</p>
    <p>{plan.modules.map(module => `${module.moduleId} · 优先级 ${module.priority}`).join("；")}</p>
    <div className="module-actions"><button onClick={onConfirm}>确认转换并继续添加</button><button onClick={onCancel}>返回五卡</button></div>
  </section>;
}
