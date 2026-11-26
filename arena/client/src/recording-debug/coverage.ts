import { matchingNodes, type RecordingIdentity, type RecordingIndex } from './index';

/** Named recordings are inclusive operation ranges in one authorized recording/version. */
export interface NamedRecordingRange extends RecordingIdentity {
  name: string;
  sourceHash: string;
  fromOperation: number;
  toOperation: number;
}

export function validateRecordingRange(index: RecordingIndex, range: NamedRecordingRange): void {
  if (range.sessionId !== index.sessionId || range.ownerId !== index.ownerId) throw new Error('Named range belongs to another recording or owner');
  if (!range.name.trim() || !Number.isSafeInteger(range.fromOperation) || !Number.isSafeInteger(range.toOperation)
    || range.fromOperation < 0 || range.toOperation < range.fromOperation) throw new Error('Invalid named operation range');
}

export function nodeCoverage(index: RecordingIndex, range: NamedRecordingRange, actorId: string, nodeId: string) {
  validateRecordingRange(index, range);
  const inside = (operation: number) => operation >= range.fromOperation && operation <= range.toOperation;
  const query = {sourceHash: range.sourceHash, actorId, nodeId, kind: 'visit' as const};
  const visits = matchingNodes(index, query).filter(node => inside(node.operationIndex));
  const selected = matchingNodes(index, {...query, kind: 'selected'}).filter(node => inside(node.operationIndex));
  const decisions = index.decisions.filter(decision => decision.sourceHash === range.sourceHash
    && decision.actor.actorId === actorId && inside(decision.operationIndex));
  const visitOperations = visits.map(node => node.operationIndex);
  return {
    range, actorId, nodeId,
    visitCount: visits.reduce((sum, node) => sum + node.visits.length, 0),
    visitOperations,
    selectedOperations: selected.map(node => node.operationIndex),
    // Legacy bounded visited has no completeness flag: absence is not proof of non-execution.
    noRecordedVisitOperations: decisions.filter(decision => !visitOperations.includes(decision.operationIndex)).map(decision => decision.operationIndex),
    missingTraceOperations: index.missingTraces.filter(change => change.sourceHash === range.sourceHash && inside(change.operationIndex)).map(change => change.operationIndex),
    historyAvailable: index.historyAvailable,
    moduleOutcome: 'unrecorded' as const,
    unvisitedCount: null,
  };
}
