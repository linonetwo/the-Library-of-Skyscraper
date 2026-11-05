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
export interface Actor {
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
}
export interface Snapshot {
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
    kind: "tower" | "catalog";
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
