import { frameAt, type ClipTiming } from "./animationTiming.ts";
export type Clip =
  | "idle"
  | "walk"
  | "carry"
  | "collect"
  | "build-catalog"
  | "attack"
  | "hit"
  | "unload"
  | "down";
export type RegisteredClip = ClipTiming & {
  cycleWorldStride?: number;
  groundPivot: readonly [number, number];
  renderScale?: number;
  releaseFrame?: number;
};
/** Only actions with complete registered atlases are exposed to players. */
export const animationCatalog = {
  idle: {
    type: "idle",
    label: "待机",
    frameCount: 4,
    frameMs: 250,
    playback: "loop",
    groundPivot: [96, 172.8],
  },
  walk: {
    type: "walk",
    label: "行走",
    frameCount: 4,
    frameMs: 125,
    playback: "loop",
    groundPivot: [96, 172.8],
    cycleWorldStride: 0.75,
  },
} as const satisfies Record<
  string,
  RegisteredClip & { type: string; label: string }
>;
export type AnimationAction = keyof typeof animationCatalog;
export const animationActions = Object.keys(
  animationCatalog,
) as AnimationAction[];
export const animationFrame = (action: AnimationAction, elapsed: number) =>
  frameAt(animationCatalog[action], elapsed);
