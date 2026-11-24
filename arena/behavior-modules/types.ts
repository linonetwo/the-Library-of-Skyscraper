export type ActorRole = 'gatherer' | 'guard' | 'scout';
export type ModuleConfig = {
  gather: { targetRoomId?: string };
  haul: { minCargo: number };
  build: { roomId: string; buildingKind: 'tower' | 'catalog'; minMaterials: number };
  defend: { roomId?: string };
  retreat: { hpThreshold: number };
};
export type BehaviorModule = { [K in keyof ModuleConfig]: {
  moduleId: string; kind: K; enabled: boolean; priority: number;
  roleFilter?: ActorRole[]; config: ModuleConfig[K];
} }[keyof ModuleConfig];
export interface BehaviorPlan {
  schemaVersion: 1;
  compositionId: string;
  mode: 'priority';
  modules: BehaviorModule[];
  fallbackModuleId: 'hold';
}
export interface RuleSourceProject { files: Record<string, string>; entry?: string }
