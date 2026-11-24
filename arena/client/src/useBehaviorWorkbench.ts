import { useEffect, useState } from "react";
import {
  recoverBehaviorPlan,
  createDefaultBehaviorPlan,
  toRuleSourceProject,
  type BehaviorPlan,
} from "../../behavior-modules";
import { useScriptWorkbench } from "./useScriptWorkbench";
import { draftKey, type RuleDraft } from "./ruleDraft";
import { recallSource } from "./scriptTemplates";

export function useBehaviorWorkbench() {
  const workbench = useScriptWorkbench();
  const backupKey = `${draftKey(workbench.session)}:before-modules`;
  const [backup, setBackup] = useState<RuleDraft | null>(() => {
    const saved = localStorage.getItem(backupKey);
    return saved ? JSON.parse(saved) : null;
  });
  const stock =
    !workbench.draft.baseVersion &&
    workbench.draft.entry === "main.ts" &&
    Object.keys(workbench.draft.files).length === 1 &&
    workbench.draft.files["main.ts"] === recallSource;
  const plan =
    recoverBehaviorPlan(workbench.draft) ??
    (stock ? createDefaultBehaviorPlan() : null);
  useEffect(() => {
    if (stock)
      workbench.loadProject(toRuleSourceProject(createDefaultBehaviorPlan()));
  }, [stock]);
  const updatePlan = (next: BehaviorPlan) =>
    workbench.loadProject(
      toRuleSourceProject(next),
      workbench.draft.baseVersion,
    );
  const createPlan = () => {
    if (!backup) {
      localStorage.setItem(backupKey, JSON.stringify(workbench.draft));
      setBackup(workbench.draft);
    }
    workbench.loadProject(toRuleSourceProject(createDefaultBehaviorPlan()));
  };
  const restoreBackup = () => {
    if (!backup) return;
    workbench.loadProject(
      { files: backup.files, entry: backup.entry },
      backup.baseVersion,
    );
    localStorage.removeItem(backupKey);
    setBackup(null);
  };
  return { ...workbench, plan, updatePlan, createPlan, backup, restoreBackup };
}
