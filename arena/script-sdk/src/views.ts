export type EntityId = string;

export interface PlayerScriptView {
  readonly id: string;
  readonly name: string;
  readonly materials: number;
  readonly score: number;
  readonly script?: {
    readonly sourceHash: string;
    readonly entry: string;
    readonly publishedAtTick: number;
  } | null;
  readonly rule: {
    readonly preset: 'gather' | 'defend' | 'explore';
    readonly retreatHp: number;
  };
}

export interface MovementView {
  readonly kind: 'walk' | 'run';
  readonly fromRoomId: EntityId;
  readonly viaRoomId?: EntityId;
  readonly toRoomId: EntityId;
  readonly tick: number;
}

export interface ActorScriptView {
  readonly id: EntityId;
  readonly owner: string;
  readonly role: 'scout' | 'gatherer' | 'guard';
  readonly roomId: EntityId;
  readonly lastMovement?: MovementView;
  readonly hp: number;
  readonly maxHp: number;
  readonly state: string;
  readonly cargo: number;
  readonly cargoCapacity: number;
  readonly appearance: {
    readonly outfit: 'scholar' | 'warden';
    readonly hair: 'ivory' | 'midnight';
    readonly weapon: boolean;
  };
}

export interface SquadScriptView {
  readonly actors: readonly ActorScriptView[];
}

export interface RoomScriptView {
  readonly id: EntityId;
  readonly q: number;
  readonly r: number;
  readonly name: string;
  readonly kind: 'base' | 'resource' | 'catalog' | 'ruins';
  readonly resources: number;
  readonly enemyHp: number;
  readonly owner: string | null;
}

export interface BuildingScriptView {
  readonly id: EntityId;
  readonly owner: string;
  readonly roomId: EntityId;
  readonly kind: 'tower' | 'catalog';
}

export interface AuthorizedWorldView {
  readonly rooms: readonly RoomScriptView[];
  readonly actors: readonly ActorScriptView[];
  readonly buildings: readonly BuildingScriptView[];
}

export type TaskKind = 'move' | 'gather' | 'deliver' | 'build' | 'attack' | 'capture';
export type TaskStatus = 'queued' | 'running' | 'blocked' | 'completed' | 'failed' | 'cancelled';

export interface TaskDraft {
  readonly id: string;
  readonly actorId: EntityId;
  readonly roomId: EntityId;
  readonly kind: TaskKind;
  readonly priority: number;
  readonly status: TaskStatus;
  readonly blockedReason: string | null;
}

/** Authority-added provenance; tasks describe plans and do not execute actions. */
export interface TaskView extends TaskDraft {
  readonly source: 'rule';
  readonly sourceHash: string;
  readonly updatedAtTick: number;
}

export interface TaskQueueView {
  readonly items: readonly TaskView[];
}

export type MemoryValue =
  | null | boolean | number | string
  | readonly MemoryValue[]
  | { readonly [key: string]: MemoryValue };

/** Read-only JSON snapshot isolated by player and source version. */
export interface RuleMemory {
  readonly [key: string]: MemoryValue;
}
