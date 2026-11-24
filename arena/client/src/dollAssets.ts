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
/** Each map gets its own ready-only registration table; descriptors/textures stay cached. */
export async function prepareMainLayers(set: LoadedAssetSet, appearances: DollAppearance[], idleOnly = false) {
  const view: LoadedAssetSet = { assetSetId: set.assetSetId, clips: {}, catalog: {} };
  const entries = Object.entries(set.clips);
  const prepare = async ([action, clip]: typeof entries[number]) => {
    const layers = [...new Set(appearances.flatMap(appearance =>
      animationLayers("walk", appearance, clip.descriptor.activeLayers, clip.descriptor)))];
    await loadClipLayers(clip, layers);
    const key = action as keyof LoadedAssetSet["clips"];
    view.clips[key] = clip;
    view.catalog[key] = clip.timing;
  };
  await Promise.all(entries.filter(([action]) => action === "idle" || (!idleOnly && action === "walk")).map(prepare));
  let started = false;
  return Object.assign(view, {
    startRemaining(onReady: () => void, isCurrent: () => boolean) {
      if (started || idleOnly) return;
      started = true;
      void (async () => {
        for (const entry of entries.filter(([action]) => action !== "idle" && action !== "walk")) {
          if (!isCurrent()) return;
          try {
            await prepare(entry);
            if (!isCurrent()) return;
            onReady();
          } catch (cause) {
            // This view keeps the resolver's existing fallback for a failed clip.
            console.error("工作动作加载失败", entry[0], cause);
          }
        }
      })();
    },
  });
}
