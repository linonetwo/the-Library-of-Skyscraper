/** Only actions with registered atlases are exposed to players. */
export const animationCatalog = {
  idle: { type: "idle", label: "待机", frameCount: 4, frameMs: 250 },
  walk: { type: "walk", label: "行走", frameCount: 4, frameMs: 125 },
} as const;
export type AnimationAction = keyof typeof animationCatalog;
export const animationActions = Object.keys(animationCatalog) as AnimationAction[];
export const animationFrame = (action: AnimationAction, elapsed: number) => {
  const { frameCount, frameMs } = animationCatalog[action];
  return Math.floor(elapsed / frameMs) % frameCount;
};
