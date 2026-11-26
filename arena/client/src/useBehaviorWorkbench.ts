import { useEffect, useState } from "react";
import {
  recoverBehaviorPlan,
  createDefaultBehaviorPlan,
  createFirstExpeditionPlan,
  toRuleSourceProject,
  type BehaviorPlan,
} from "../../behavior-modules";
import { useScriptWorkbench } from "./useScriptWorkbench";
import { draftKey, isStockDraft, projectDraft, type RuleDraft } from "./ruleDraft";
import type { RuleSourceProject } from "./scriptTypes";

export function useBehaviorWorkbench() {
  const workbench = useScriptWorkbench();
  const historyKey = `${draftKey(workbench.session)}:replacement-history`;
  const [history, setHistory] = useState<RuleDraft[]>(() =>
    JSON.parse(localStorage.getItem(historyKey) ?? "[]"),
  );
  const stock = isStockDraft(workbench.draft);
  const plan =
    recoverBehaviorPlan(workbench.draft) ??
    (stock ? createFirstExpeditionPlan() : null);
  useEffect(() => {
    if (stock)
      workbench.loadProject(toRuleSourceProject(createFirstExpeditionPlan()));
  }, [stock]);
  const updatePlan = (next: BehaviorPlan) =>
    workbench.loadProject(
      toRuleSourceProject(next),
      workbench.draft.baseVersion,
    );
  const saveHistory = (next: RuleDraft[]) => {
    localStorage.setItem(historyKey, JSON.stringify(next));
    setHistory(next);
  };
  const replaceProject = (project: RuleSourceProject, activeFile?: string) => {
    saveHistory([...history, workbench.draft]);
    if (activeFile) workbench.restoreDraft({ ...projectDraft(project), activeFile });
    else workbench.loadProject(project);
  };
  const createPlan = (template: "expedition" | "logistics" = "expedition") =>
    replaceProject(
      toRuleSourceProject(
        template === "expedition"
          ? createFirstExpeditionPlan()
          : createDefaultBehaviorPlan(),
      ),
    );
  const backup = history.at(-1);
  const restoreBackup = () => {
    if (!backup) return;
    workbench.restoreDraft(backup);
    saveHistory(history.slice(0, -1));
  };
  return {
    ...workbench,
    plan,
    updatePlan,
    createPlan,
    replaceProject,
    backup,
    restoreBackup,
  };
}
