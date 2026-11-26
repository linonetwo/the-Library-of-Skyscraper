import type { ActorRole, BehaviorModule } from '../types';
export type RoomRef = { type: 'room'; roomId: string };
export type OwnRoleRef = { type: 'ownRole'; role: ActorRole };
export type ModuleRef = RoomRef | OwnRoleRef;
export type CompositionConfig = {
  scout: { target: RoomRef; maxEnemyHp: number; reportIntervalTicks: number };
  patrol: { rooms: RoomRef[]; dwellTicks: number };
  escort: { target: OwnRoleRef; minCargo: number };
};
export type CompositionModule = { [K in keyof CompositionConfig]: {
  moduleId: string; kind: K; enabled: boolean; priority: number;
  roleFilter?: ActorRole[]; config: CompositionConfig[K];
} }[keyof CompositionConfig];
export type GraphModule = BehaviorModule | CompositionModule;
export type ModuleReasonCode = 'disabled' | 'role-filtered' | 'room-missing' | 'risk-exceeded' | 'travel-active' | 'route-unavailable' | 'moving' | 'scout-reported' | 'scout-report-cooldown' | 'patrol-dwelling' | 'patrol-advanced' | 'escort-target-missing' | 'escort-safe' | 'escort-defending';
export interface ModuleVisit {
  nodeId: string; moduleId: string; outcome: 'selected' | 'fallback' | 'hold';
  reasonCode: ModuleReasonCode; ref?: ModuleRef; resolvedId?: string;
  observed?: { tick?: number; enemyHp?: number; threshold?: number; cargo?: number; cursor?: number; arrivedTick?: number };
  fallbackNodeId?: string;
}
/** Each actor keeps at most eight actual module visits; omitted visits are not coverage evidence. */
export const MODULE_VISIT_LIMIT = 8;
export interface GraphFragment { schemaVersion: 1; rootId: string; nodes: import('./types').RuleNode[]; modules: GraphModule[] }
export interface GraphFragmentBindings { rooms: Record<string,string>; ownRoles: Partial<Record<ActorRole,ActorRole>> }
