import {
  recoverBehaviorPlan,
  createDefaultBehaviorPlan,
  toRuleSourceProject,
  type BehaviorPlan,
} from "../../behavior-modules";
import { useScriptWorkbench } from "./useScriptWorkbench";

export function useBehaviorWorkbench() {
  const workbench = useScriptWorkbench();
  const plan = recoverBehaviorPlan({
    files: workbench.draft.files,
    entry: workbench.draft.entry,
  });
  const updatePlan = (next: BehaviorPlan) =>
    workbench.loadProject(
      toRuleSourceProject(next),
      workbench.draft.baseVersion,
    );
  return {
    ...workbench,
    plan,
    updatePlan,
    createPlan: () => updatePlan(createDefaultBehaviorPlan()),
  };
}
