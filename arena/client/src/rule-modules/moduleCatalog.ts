import { createDefaultBehaviorPlan } from "../../../behavior-modules";
import { createCompositionGraph, type GraphModule } from "../../../behavior-modules/graph";
export type ModuleKind = GraphModule["kind"];
export type ModuleRequest = { type: "new"; module: GraphModule } | { type: "existing"; moduleId: string };
export const moduleCatalog: Record<ModuleKind, { name: string; description: string }> = {
  gather: { name: "采集藏材", description: "采集岗位前往资源房；资源不可用时回退。" },
  haul: { name: "运输入库", description: "携带达到门槛时返回入库；货量不足时回退。" },
  build: { name: "建造设施", description: "材料充足且房间安全时建造指定设施；条件不足时回退。" },
  defend: { name: "据点防守", description: "前往指定房间清守；无可用行动时回退。" },
  retreat: { name: "低血撤退", description: "生命值低于门槛时返回基地；健康时回退。" },
  scout: { name: "侦察", description: "前往指定房间并定期报告；房内风险超限时回退。" },
  patrol: { name: "巡逻", description: "按顺序巡访并驻留；路线不可用时回退。" },
  escort: { name: "护送", description: "跟随本队有货队友；目标缺失或货量不足时回退。" },
};
/** Defaults come from the official domain examples, including the original five. */
export function moduleTemplate(kind: ModuleKind): GraphModule {
  const templates: GraphModule[] = [...createDefaultBehaviorPlan().modules, ...createCompositionGraph().modules];
  return structuredClone(templates.find(module => module.kind === kind)!);
}
