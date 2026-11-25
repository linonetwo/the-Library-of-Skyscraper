import type { ActorRole, BehaviorModule } from '../types';
export type GraphField = 'hp' | 'cargo' | 'cargoCapacity' | 'materials' | 'roomEnemyHp' | 'targetEnemyHp' | 'tickInState';
export type GraphCondition =
  | { type: 'compare'; field: GraphField; op: 'lt' | 'lte' | 'eq' | 'gte' | 'gt'; value: number; missing: boolean; roomId?: string }
  | { type: 'atRoom'; roomId: string; missing: boolean }
  | { type: 'all'; conditions: GraphCondition[] }
  | { type: 'any'; conditions: GraphCondition[] }
  | { type: 'not'; condition: GraphCondition };
export type GraphEffect =
  | { type: 'remember'; key: string; value: string | number | boolean | null }
  | { type: 'reason'; reason: string }
  | { type: 'task'; taskId: string; roomId: string; kind: 'move' | 'gather' | 'deliver' | 'build' | 'attack' | 'capture'; priority: number };
export type MobilityAction =
  | { type: 'run'; viaRoomId: string; roomId: string }
  | { type: 'jump' | 'climb'; edgeId: string };
export type RuleNode =
  | { id: string; type: 'mobility'; action: MobilityAction; priority: number; fallback: string }
  | { id: string; type: 'check'; condition: GraphCondition }
  | { id: string; type: 'condition'; condition: GraphCondition; yes: string; no: string }
  | { id: string; type: 'priority' | 'sequence'; children: string[]; fallback: string }
  | { id: string; type: 'score'; candidates: { id: string; nodeId: string; weight: number; when?: GraphCondition }[]; fallback: string }
  | { id: string; type: 'log'; reason: string; next: string }
  | { id: string; type: 'module'; moduleId: string; fallback: string }
  | { id: string; type: 'pass'; reason: string }
  | { id: string; type: 'hold'; reason: string };
export interface GraphState { id: string; name: string; treeId: string; entry: GraphEffect[]; exit: GraphEffect[] }
export interface GraphTransition { id: string; from: string; to: string; priority: number; condition: GraphCondition; cooldownTicks: number; minStateTicks: number }
export interface GraphRole { id: string; role: ActorRole; initialStateId: string; fallbackStateId: string }
export interface RuleGraph {
  schemaVersion: 2; graphId: string; revision: number;
  roles: GraphRole[]; states: GraphState[]; transitions: GraphTransition[];
  nodes: RuleNode[]; modules: BehaviorModule[];
}
export type GraphOperation =
  | { type: 'putNode'; node: RuleNode } | { type: 'removeNode'; id: string }
  | { type: 'putState'; state: GraphState } | { type: 'removeState'; id: string }
  | { type: 'putTransition'; transition: GraphTransition } | { type: 'removeTransition'; id: string }
  | { type: 'putRole'; role: GraphRole } | { type: 'removeRole'; id: string }
  | { type: 'putModule'; module: BehaviorModule } | { type: 'removeModule'; id: string };
export interface GraphPatch { graphId: string; baseRevision: number; operations: GraphOperation[] }
export interface GraphDiagnostic { severity: 'error' | 'warning'; objectId: string; code: string; message: string; sourceRef?: GraphSourceRef }
export interface GraphSourceRef { file: string; line: number; column: number }
export interface GraphActorTrace {
  actorId: string; startStateId: string; endStateId: string; transitionId: string | null;
  visited: { nodeId: string; value?: boolean | number }[];
  selectedNodeId: string | null; moduleId: string | null; reason: string;
}
export interface GraphTrace { v: 2; tick: number; graphId: string; actors: GraphActorTrace[] }
