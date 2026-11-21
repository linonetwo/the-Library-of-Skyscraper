import { Assets, type Texture } from "pixi.js";
import { animationActions } from "./animationCatalog";
import { animationLayerNames } from "./walkLayers";
import type { DollTextures } from "./DollRenderer";
export async function loadDollTextures(
  sample: Record<string, Texture> | undefined,
): Promise<DollTextures> {
  if (sample) return { idle: sample, walk: sample };
  const entries = await Promise.all(
    animationActions.map(async (action) => {
      const sheets = await Promise.all(
        animationLayerNames[action].map((layer) =>
          Assets.load(`/assets/animation/${action}-${layer}.json`),
        ),
      );
      return [
        action,
        Object.assign({}, ...sheets.map((sheet) => sheet.textures)),
      ] as const;
    }),
  );
  const textures = Object.fromEntries(entries) as DollTextures;
  return textures;
}
