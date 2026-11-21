export interface Room {
  id: string;
  q: number;
  r: number;
  name: string;
  kind: "base" | "resource" | "catalog" | "ruins";
  resources: number;
  enemyHp: number;
  owner: string | null;
}
export type WorldPoint = { x: number; y: number };
export type TaskKind = "gather" | "build" | "guard" | "return";
export type BuildingKind = "warehouse" | "tower" | "catalog";
export interface Actor {
  worldPosition?: WorldPoint;
  travel?: null | {
    travelId: string;
    targetRoomId: string;
    path: WorldPoint[];
    segment: number;
    distanceMilli: number;
    totalDistanceMilli: number;
    startedTick: number;
    speedMilliPerTick: number;
    progress: number;
  };
  task?: null | {
    kind: TaskKind;
    target: string;
    stage: string;
    blockedReason: string | null;
    buildingKind?: BuildingKind | null;
  };
  appearance: Appearance;
  id: string;
  owner: string;
  role: "scout" | "gatherer" | "guard";
  roomId: string;
  hp: number;
  maxHp: number;
  cargo: number;
  cargoCapacity: number;
  state: string;
}
export interface Player {
  id: string;
  name: string;
  materials: number;
  score: number;
  rule: { preset: "gather" | "defend" | "explore"; retreatHp: number };
  script?: {
    sourceHash: string;
    entry: string;
    publishedAtTick: number;
  } | null;
}
export interface Snapshot {
  tickDurationMs?: number;
  mapVersion?: string;
  simulationVersion?: number;
  worldMap?: {
    version: string;
    rooms: { id: string; center: WorldPoint; floorHalfSize?: number }[];
    props?: {
      id: string;
      roomId: string;
      asset: string;
      position: WorldPoint;
      footprint: { width: number; depth: number };
    }[];
    links: { from: string; to: string; points: WorldPoint[] }[];
  };
  scenarioConfig?: {
    durationTicks?: number;
    targetRoomId?: string;
    catalogGoal?: number;
    buildingCosts?: Record<BuildingKind, number>;
    [key: string]: unknown;
  };
  scenario?: {
    catalogProgress: number;
    counterattackTick: number | null;
    counterattackSpawned: boolean;
    remainingTicks: number;
    blockedReason: string | null;
    report: Record<string, unknown> | null;
  };
  enemies?: {
    id: string;
    roomId: string;
    hp: number;
    maxHp: number;
    worldPosition: WorldPoint;
    state: string;
  }[];
  sessionId: string;
  mode: "training" | "online";
  seed: number;
  tick: number;
  paused: boolean;
  phase: "running" | "settled";
  rooms: Room[];
  players: Player[];
  actors: Actor[];
  buildings: {
    id: string;
    owner: string;
    roomId: string;
    kind: BuildingKind;
    hp?: number;
    maxHp?: number;
    constructionTicks?: number;
    requiredTicks?: number;
  }[];
  events: {
    id: number;
    tick: number;
    kind: string;
    message: string;
    playerId: string | null;
  }[];
  result: null | { winner: string; reason: string };
}
export interface Session {
  sessionId: string;
  playerId: string;
  token: string;
}
export type Command =
  | {
      type: "task";
      actorId: string;
      kind: TaskKind;
      target: string;
      buildingKind?: BuildingKind | null;
    }
  | { type: "equip"; actorId: string; appearance: Appearance }
  | { type: "move"; actorId: string; roomId: string }
  | { type: "gather" | "deliver" | "attack" | "capture"; actorId: string }
  | { type: "build"; roomId: string; kind: "tower" | "catalog" }
  | { type: "rule"; preset: Player["rule"]["preset"]; retreatHp: number }
  | { type: "pause"; paused: boolean }
  | { type: "step"; ticks: number }
  | { type: "reset" };
export type Outfit = "scholar" | "warden";
export interface Appearance {
  outfit: Outfit;
  hair: "ivory" | "midnight";
  weapon: boolean;
}
export const roleNames = {
  scout: "巡书使",
  gatherer: "采撷师",
  guard: "守卷人",
};
export const outfitNames = { scholar: "星墨学者", warden: "书库守卫" };
