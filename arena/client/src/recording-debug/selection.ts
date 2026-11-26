import { nextNode, type NodeEvidence, type RecordingIndex } from './index';
import { nextModule, type ModuleEvidence } from './modules';

export interface RecordingFilter {sourceHash: string; actorId: string; target: 'node' | 'module'; objectId: string; exitKey?: string; kind: 'visit' | 'hit' | 'fallback'}
export type RecordingEvidence = {kind: 'node'; fact: NodeEvidence} | {kind: 'module'; fact: ModuleEvidence};
export function findRecordingEvidence(index: RecordingIndex, filter: RecordingFilter, cursor: number, direction: 'next' | 'previous'): RecordingEvidence | null {
  if (filter.target === 'module' || filter.kind === 'fallback' || filter.exitKey) {
    const fact = nextModule(index, {sourceHash: filter.sourceHash, actorId: filter.actorId, kind: filter.kind, exitKey: filter.exitKey,
      ...(filter.target === 'module' ? {moduleId: filter.objectId} : {nodeId: filter.objectId})}, cursor, direction);
    return fact ? {kind: 'module', fact} : null;
  }
  const fact = nextNode(index, {sourceHash: filter.sourceHash, actorId: filter.actorId, nodeId: filter.objectId,
    kind: filter.kind === 'hit' ? 'selected' : 'visit'}, cursor, direction);
  return fact ? {kind: 'node', fact} : null;
}
