import type { MemoryValue, TaskView } from "../../script-sdk/src/views";
import type { RuleMemoryPatch, TaskPatchDraft } from "../../script-sdk/src/contract";

export type RuleHistoryChange = { operationIndex: number } & (
  { reset: true } | {
    tick: number; sourceHash: string | null;
    memoryPatch?: RuleMemoryPatch; taskPatches?: readonly TaskPatchDraft[];
  }
);
export interface RuleHistory { playerId: string; changes: RuleHistoryChange[] }
export interface HistoricalTask { task: TaskView; operationIndex: number }

/** Fold recorded facts; permission and quota rules belong to the authority. */
export function projectRuleHistory(history: RuleHistory, operationIndex: number, sourceHash: string | null) {
  const memories = new Map<string, Record<string, MemoryValue>>();
  const tasks = new Map<string, HistoricalTask>();
  for (const change of history.changes) {
    if (change.operationIndex > operationIndex) break;
    if ("reset" in change) { memories.clear(); tasks.clear(); continue; }
    if (change.memoryPatch) {
      const hash = change.sourceHash!;
      let memory = memories.get(hash);
      if (!memory) { memory = Object.create(null) as Record<string, MemoryValue>; memories.set(hash, memory); }
      for (const key of change.memoryPatch.remove ?? []) delete memory[key];
      Object.assign(memory, change.memoryPatch.set);
    }
    for (const patch of change.taskPatches ?? []) {
      if (patch.type === "remove") tasks.delete(patch.taskId);
      else tasks.set(patch.task.id, {
        operationIndex: change.operationIndex,
        task: { ...patch.task, source: "rule", sourceHash: change.sourceHash!, updatedAtTick: change.tick },
      });
    }
  }
  return {
    memory: sourceHash ? memories.get(sourceHash) ?? {} : {},
    tasks: [...tasks.values()].sort((a, b) => a.task.id < b.task.id ? -1 : a.task.id > b.task.id ? 1 : 0),
  };
}
