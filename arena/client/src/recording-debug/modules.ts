import type { ModuleVisit } from '../../../behavior-modules/graph/composition-types';
import type { RecordingIndex } from './index';
import { validateRecordingRange, type NamedRecordingRange } from './coverage';

export interface ModuleQuery {
  sourceHash: string;
  actorId: string;
  nodeId?: string;
  moduleId?: string;
  exitKey?: string;
  kind: 'visit' | 'hit' | 'fallback' | 'hold';
}
export interface ModuleEvidence {
  operationIndex: number;
  tick: number;
  sourceHash: string;
  actorId: string;
  visitIndex: number;
  visit: ModuleVisit;
}

function matches(visit: ModuleVisit, query: ModuleQuery): boolean {
  return (!query.nodeId || visit.nodeId === query.nodeId) && (!query.moduleId || visit.moduleId === query.moduleId)
    && (!query.exitKey || visit.exitKey === query.exitKey)
    && (query.kind === 'visit' || (query.kind === 'hit' ? visit.outcome !== 'fallback' : visit.outcome === query.kind));
}

/** Shared ModuleVisit facts only: a final selected node cannot identify a module fallback. */
export function moduleEvidence(index: RecordingIndex, query: ModuleQuery): ModuleEvidence[] {
  return index.decisions.filter(decision => decision.sourceHash === query.sourceHash && decision.actor.actorId === query.actorId)
    .flatMap(decision => (decision.actor.moduleVisits ?? []).flatMap((visit, visitIndex) => matches(visit, query)
      ? [{operationIndex: decision.operationIndex, tick: decision.tick, sourceHash: decision.sourceHash,
        actorId: decision.actor.actorId, visitIndex, visit}] : []));
}

export function nextModule(index: RecordingIndex, query: ModuleQuery, cursorOperation: number, direction: 'next' | 'previous' = 'next'): ModuleEvidence | null {
  const events = moduleEvidence(index, query);
  return direction === 'next'
    ? events.find(event => event.operationIndex > cursorOperation) ?? null
    : events.slice().reverse().find(event => event.operationIndex < cursorOperation) ?? null;
}

export function moduleCoverage(index: RecordingIndex, range: NamedRecordingRange, query: Omit<ModuleQuery, 'sourceHash' | 'kind'>) {
  validateRecordingRange(index, range);
  const inside = (operation: number) => operation >= range.fromOperation && operation <= range.toOperation;
  const events = moduleEvidence(index, {...query, sourceHash: range.sourceHash, kind: 'visit'}).filter(event => inside(event.operationIndex));
  const decisions = index.decisions.filter(decision => decision.sourceHash === range.sourceHash
    && decision.actor.actorId === query.actorId && inside(decision.operationIndex));
  const unique = (operations: number[]) => [...new Set(operations)];
  const noMatch = decisions.filter(decision => !events.some(event => event.operationIndex === decision.operationIndex));
  return {
    range, ...query,
    visitCount: events.length,
    hitCount: events.filter(event => event.visit.outcome !== 'fallback').length,
    fallbackCount: events.filter(event => event.visit.outcome === 'fallback').length,
    holdCount: events.filter(event => event.visit.outcome === 'hold').length,
    visitOperations: unique(events.map(event => event.operationIndex)),
    hitOperations: unique(events.filter(event => event.visit.outcome !== 'fallback').map(event => event.operationIndex)),
    fallbackOperations: unique(events.filter(event => event.visit.outcome === 'fallback').map(event => event.operationIndex)),
    unvisitedOperations: noMatch.filter(decision => decision.actor.moduleVisits !== undefined && !decision.actor.moduleVisitsTruncated).map(decision => decision.operationIndex),
    // Truncated lists still prove their listed visits; absent entries remain unknown.
    truncatedOperations: decisions.filter(decision => decision.actor.moduleVisitsTruncated).map(decision => decision.operationIndex),
    missingModuleOperations: decisions.filter(decision => decision.actor.moduleVisits === undefined).map(decision => decision.operationIndex),
    missingTraceOperations: index.missingTraces.filter(change => change.sourceHash === range.sourceHash && inside(change.operationIndex)).map(change => change.operationIndex),
    historyAvailable: index.historyAvailable,
  };
}
