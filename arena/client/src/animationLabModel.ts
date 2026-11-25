import type { Clip } from "./animationCatalog";
import type { ClipTiming } from "./animationTiming";
export const labActionLabels: Record<Clip, string> = {
  idle: "待机", walk: "行走", run: "奔跑", jump: "跳跃", climb: "攀爬",
  carry: "搬运", collect: "采集", build: "建造", catalog: "编目",
  attack: "攻击", hit: "受击", unload: "入库", down: "倒地",
};
export function labFrameTime(clip: ClipTiming, frame: number) {
  return clip.frameDurationsMs
    ? clip.frameDurationsMs.slice(0, frame).reduce((sum, ms) => sum + ms, 0)
    : frame * clip.frameMs!;
}
