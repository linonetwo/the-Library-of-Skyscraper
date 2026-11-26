import type { GraphActorTrace } from '../../../behavior-modules/graph';
import type { RuleHistory } from '../replayRuleState';
import { graphTrace } from '../rule-comparison/TraceView';

export interface RecordingIdentity { sessionId: string; ownerId: string }
export interface RecordingInput {
  sessionId: string;
  ruleHistory?: RuleHistory;
}
export interface DecisionEvidence {
  operationIndex: number;
  tick: number;
  sourceHash: string;
  graphId: string;
  actor: GraphActorTrace;
}
export interface NodeEvidence {
  operationIndex: number;
  tick: number;
  sourceHash: string;
  actorId: string;
  nodeId: string;
  visits: { value?: boolean | number }[];
  selected: boolean;
}
export interface RecordingIndex extends RecordingIdentity {
  historyAvailable: boolean;
  decisions: DecisionEvidence[];
  nodes: NodeEvidence[];
  missingTraces: { operationIndex: number; tick: number; sourceHash: string }[];
  resetOperations: number[];
}
export interface NodeQuery {
  sourceHash: string;
  actorId: string;
  nodeId: string;
  kind: 'visit' | 'selected';
}

/** Handwritten JSON memory may carry a legacy trace with an unusable module extension. */
function recordedActor(actor: GraphActorTrace): GraphActorTrace {
  if (actor.moduleVisits === undefined) return actor;
  const visits: unknown = actor.moduleVisits;
  const valid = Array.isArray(visits) && visits.every(visit => visit && typeof visit === 'object'
    && typeof visit.nodeId === 'string' && typeof visit.moduleId === 'string'
    && typeof visit.reasonCode === 'string'
    && (visit.outcome === 'selected' || visit.outcome === 'fallback' || visit.outcome === 'hold'));
  return valid ? actor : {...actor, moduleVisits: undefined, moduleVisitsTruncated: undefined};
}

/** Index actual decision deltas once. Projected memory on intervening frames is not an execution. */
export function indexRecording(recording: RecordingInput, ownerId: string): RecordingIndex {
  const history = recording.ruleHistory;
  if (history && history.playerId !== ownerId) throw new Error('Recording owner does not match authorized rule history');
  const index: RecordingIndex = {
    sessionId: recording.sessionId, ownerId, historyAvailable: !!history,
    decisions: [], nodes: [], missingTraces: [], resetOperations: [],
  };
  for (const change of history?.changes ?? []) {
    if ('reset' in change) { index.resetOperations.push(change.operationIndex); continue; }
    // No source attribution means no safe association with a particular graph version.
    if (!change.sourceHash) continue;
    const trace = graphTrace(change.memoryPatch?.set?.aiTrace);
    if (!trace || typeof trace.graphId !== 'string' || !Number.isSafeInteger(trace.tick)) {
      index.missingTraces.push({operationIndex: change.operationIndex, tick: change.tick, sourceHash: change.sourceHash});
      continue;
    }
    for (const rawActor of trace.actors) {
      const actor = recordedActor(rawActor);
      const common = {operationIndex: change.operationIndex, tick: change.tick, sourceHash: change.sourceHash};
      index.decisions.push({...common, graphId: trace.graphId, actor});
      const nodes = new Map<string, NodeEvidence>();
      for (const visited of actor.visited) {
        let node = nodes.get(visited.nodeId);
        if (!node) {
          node = {...common, actorId: actor.actorId, nodeId: visited.nodeId, visits: [], selected: false};
          nodes.set(visited.nodeId, node);
        }
        node.visits.push(visited.value === undefined ? {} : {value: visited.value});
      }
      if (actor.selectedNodeId !== null) {
        let node = nodes.get(actor.selectedNodeId);
        if (!node) {
          node = {...common, actorId: actor.actorId, nodeId: actor.selectedNodeId, visits: [], selected: false};
          nodes.set(actor.selectedNodeId, node);
        }
        node.selected = true;
      }
      index.nodes.push(...nodes.values());
    }
  }
  index.nodes.sort((a, b) => a.operationIndex - b.operationIndex);
  index.decisions.sort((a, b) => a.operationIndex - b.operationIndex);
  return index;
}

export function matchingNodes(index: RecordingIndex, query: NodeQuery): NodeEvidence[] {
  return index.nodes.filter(node => node.sourceHash === query.sourceHash
    && node.actorId === query.actorId && node.nodeId === query.nodeId
    && (query.kind === 'selected' ? node.selected : node.visits.length > 0));
}

/** Strictly before/after the cursor; returns the original operation, never a tick-derived frame. */
export function nextNode(index: RecordingIndex, query: NodeQuery, cursorOperation: number, direction: 'next' | 'previous' = 'next'): NodeEvidence | null {
  const nodes = matchingNodes(index, query);
  return direction === 'next'
    ? nodes.find(node => node.operationIndex > cursorOperation) ?? null
    : nodes.slice().reverse().find(node => node.operationIndex < cursorOperation) ?? null;
}
