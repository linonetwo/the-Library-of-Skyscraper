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

/** Reserved context slot: v0 has no executable task queue. */
export interface TaskQueueView {
  readonly items: readonly never[];
}

export type MemoryValue =
  | null | boolean | number | string
  | readonly MemoryValue[]
  | { readonly [key: string]: MemoryValue };

/** Read-only JSON snapshot; memory patch persistence is a later runtime feature. */
export interface RuleMemory {
  readonly [key: string]: MemoryValue;
}
