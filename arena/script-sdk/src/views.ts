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

export interface ActorScriptView {
  readonly id: EntityId;
  readonly owner: string;
  readonly role: 'scout' | 'gatherer' | 'guard';
  readonly roomId: EntityId;
  readonly hp: number;
  readonly maxHp: number;
  readonly state: string;
  readonly cargo: number;
  readonly cargoCapacity: number;
  /** Authoritative ground tiles; arrival commits roomId only after travel finishes. */
  readonly worldPosition?: { readonly x: number; readonly y: number };
  readonly travel?: { readonly travelId: string; readonly targetRoomId: string; readonly path: readonly { readonly x: number; readonly y: number }[]; readonly distanceMilli: number; readonly totalDistanceMilli: number; readonly speedMilliPerTick: number; readonly progress: number } | null;
  readonly task?: { readonly kind: 'gather' | 'build' | 'guard' | 'return'; readonly target: string; readonly stage: string; readonly blockedReason: string | null } | null;
  readonly retreating?: boolean;
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
  readonly kind: 'tower' | 'catalog' | 'warehouse';
  readonly hp?: number;
  readonly maxHp?: number;
  readonly constructionTicks?: number;
  readonly requiredTicks?: number;
}

export interface AuthorizedWorldView {
  readonly rooms: readonly RoomScriptView[];
  readonly actors: readonly ActorScriptView[];
  readonly buildings: readonly BuildingScriptView[];
  readonly enemies?: readonly { readonly id: string; readonly roomId: string; readonly hp: number; readonly maxHp: number; readonly worldPosition: { readonly x: number; readonly y: number }; readonly state: string }[];
  readonly worldMap?: unknown;
  readonly scenario?: { readonly catalogProgress: number; readonly remainingTicks: number; readonly blockedReason: string | null; readonly counterattackTick: number | null };
  readonly scenarioConfig?: unknown;
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
