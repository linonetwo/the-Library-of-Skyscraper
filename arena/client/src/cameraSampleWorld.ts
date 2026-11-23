import type { Clip } from "./animationCatalog";
import type { Snapshot } from "./types";
import type { DollAppearance } from "./walkLayers";
export function cameraSampleWorld({
  variant,
  action,
  durationMs,
  tickMs,
  direction,
  tick,
  moving,
  distance,
  length,
  cargo,
  outfit,
  hair,
  weapon,
}: {
  action: Clip;
  durationMs: number;
  tickMs: number;
  variant: string;
  direction: "NE" | "SW";
  tick: number;
  moving: boolean;
  distance: number;
  length: number;
  cargo: boolean;
} & DollAppearance): Snapshot {
  const y =
    action === "walk"
      ? direction === "NE"
        ? length - distance
        : distance
      : length / 2;
  const cue = {
    startedTick: 0,
    durationTicks: durationMs / tickMs,
    targetPosition: { x: 0, y: y + (direction === "NE" ? -2 : 2) },
  };
  return {
    sessionId: "camera-sample",
    mode: "training",
    seed: 1,
    tick,
    paused: !moving,
    phase: "running",
    tickDurationMs: tickMs,
    mapVersion: `camera-${variant}`,
    simulationVersion: 4,
    worldMap: {
      version: `camera-${variant}`,
      rooms: [
        { id: "sample-a", center: { x: 0, y: 0 }, floorHalfSize: 1 },
        { id: "sample-b", center: { x: 0, y: length }, floorHalfSize: 1 },
      ],
      props: [
        {
          id: "u",
          roomId: "sample-a",
          asset: "bookcase-u",
          position: { x: -1, y: -1 },
          footprint: { width: 1, depth: 1 },
        },
        {
          id: "v",
          roomId: "sample-b",
          asset: "bookcase-v",
          position: { x: 1, y: length - 1 },
          footprint: { width: 1, depth: 1 },
        },
      ],
      links: [
        {
          from: "sample-a",
          to: "sample-b",
          points: [
            { x: 0, y: 0 },
            { x: 0, y: length },
          ],
        },
      ],
    },
    rooms: [
      {
        id: "sample-a",
        q: 0,
        r: 0,
        name: "相机样板",
        kind: "base",
        resources: 0,
        enemyHp: 0,
        owner: null,
      },
      {
        id: "sample-b",
        q: 1,
        r: 0,
        name: `${length}格路端`,
        kind: "catalog",
        resources: 0,
        enemyHp: 0,
        owner: null,
      },
    ],
    players: [],
    actors: [
      {
        id: "camera-pose",
        owner: "sample",
        role: "scout",
        roomId: "sample-a",
        worldPosition: { x: 0, y },
        actionCue: action === "attack" ? { ...cue, kind: "attack" } : null,
        impactCue:
          action === "hit"
            ? { ...cue, kind: "hit" }
            : action === "down"
              ? { ...cue, kind: "down", durationTicks: 0 }
              : null,
        motionDistanceMilli: distance * 1000,
        lastMoveDirection: { x: 0, y: direction === "NE" ? -1 : 1 },
        hp: action === "down" ? 0 : 100,
        maxHp: 100,
        cargo: cargo ? 4 : 0,
        cargoCapacity: 12,
        state: "idle",
        appearance: {
          outfit: outfit === "none" ? "scholar" : outfit,
          hair: hair === "none" ? "ivory" : hair,
          weapon,
        },
      },
    ],
    buildings: [
      {
        id: "lectern",
        owner: "sample",
        roomId: "sample-b",
        worldPosition: { x: 1, y: length },
        kind: "catalog",
        hp: 100,
        maxHp: 100,
      },
    ],
    events: [],
    result: null,
  };
}
