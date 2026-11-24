import { Assets } from "pixi.js";
import { animationActions } from "./animationCatalog";
import { animationLayerNames } from "./walkLayers";
import type { DollTextures } from "./DollRenderer";
export async function loadDollTextures(sample: boolean): Promise<DollTextures> {
  if (sample) return { idle: {}, walk: {} };
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

import { loadAssetSet, loadClipLayers, type AssetSetIndex, type LoadedAssetSet } from "./assetSetLoader";
import { animationLayers, type DollAppearance } from "./walkLayers";
let mainDefinition: Promise<LoadedAssetSet> | undefined;
export function loadMainDefinition() {
  return mainDefinition ??= fetch("/assets/iso-v030-base/index.json")
    .then((response) => {
      if (!response.ok) throw new Error(`角色资源索引 ${response.status}`);
      return response.json() as Promise<AssetSetIndex>;
    }).then(loadAssetSet).catch((cause) => { mainDefinition = undefined; throw cause; });
}
export async function prepareMainLayers(set: LoadedAssetSet, appearances: DollAppearance[], idleOnly = false) {
  await Promise.all(Object.entries(set.clips).filter(([action]) => !idleOnly || action === "idle").map(async ([, clip]) => {
    const layers = [...new Set(appearances.flatMap((appearance) =>
      animationLayers("walk", appearance, clip.descriptor.activeLayers, clip.descriptor)))];
    await loadClipLayers(clip, layers);
  }));
  return set;
}
