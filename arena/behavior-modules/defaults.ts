import type { BehaviorPlan } from './types';
export function createDefaultBehaviorPlan(): BehaviorPlan {
  return {
    schemaVersion: 1, compositionId: 'official-logistics-v1', mode: 'priority', fallbackModuleId: 'hold',
    modules: [
      { moduleId: 'retreat', kind: 'retreat', enabled: true, priority: 100, config: { hpThreshold: 30 } },
      { moduleId: 'haul', kind: 'haul', enabled: true, priority: 80, roleFilter: ['gatherer'], config: { minCargo: 1 } },
      { moduleId: 'defend', kind: 'defend', enabled: true, priority: 60, roleFilter: ['guard'], config: {} },
      { moduleId: 'build', kind: 'build', enabled: false, priority: 40, roleFilter: ['gatherer'], config: { roomId: 'room-3', buildingKind: 'catalog', minMaterials: 40 } },
      { moduleId: 'gather', kind: 'gather', enabled: true, priority: 20, roleFilter: ['gatherer'], config: {} },
    ],
  };
}

/** Seed-42 first expedition: logistics, guardian clearing, then catalog construction. */
export function createFirstExpeditionPlan(): BehaviorPlan {
  return {
    schemaVersion: 1, compositionId: 'first-expedition-v1', mode: 'priority', fallbackModuleId: 'hold',
    modules: [
      { moduleId: 'retreat', kind: 'retreat', enabled: true, priority: 100, config: { hpThreshold: 20 } },
      { moduleId: 'haul', kind: 'haul', enabled: true, priority: 80, roleFilter: ['gatherer'], config: { minCargo: 8 } },
      { moduleId: 'build', kind: 'build', enabled: true, priority: 60, roleFilter: ['scout'], config: { roomId: 'room-3', buildingKind: 'catalog', minMaterials: 25 } },
      { moduleId: 'defend', kind: 'defend', enabled: true, priority: 40, roleFilter: ['guard', 'scout'], config: { roomId: 'room-3' } },
      { moduleId: 'gather', kind: 'gather', enabled: true, priority: 20, roleFilter: ['gatherer'], config: { targetRoomId: 'room-1' } },
    ],
  };
}
