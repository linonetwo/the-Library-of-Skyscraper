import {
  loadAssetSet,
  loadClipLayers,
  type AssetSetIndex,
  type LoadedAssetSet,
} from "./assetSetLoader";
import { animationLayers, type DollAppearance } from "./walkLayers";
import type { Clip } from "./animationCatalog";
import type { SampleRig } from "./RegisteredCargo";
export type SampleStudy = {
  set: LoadedAssetSet;
  routeLength: number;
  decodedBytes: number;
};
const studies = new Map<string, Promise<SampleStudy>>();
export function loadSampleDefinition(variant: "four" | "sixteen") {
  let pending = studies.get(variant);
  if (!pending) {
    pending = (async () => {
      const index: AssetSetIndex = await fetch(
        "/assets/iso-v030-action-study/index.json",
      ).then((r) => r.json());
      if (variant === "four") {
        index.assetSetId += "-legacy-four";
        index.clips = index.clips.filter(
          (entry) => entry.action === "idle" || entry.action === "walk",
        );
        index.clips.find((entry) => entry.action === "walk")!.root =
          "/assets/iso-v030-walk-study";
      }
      const set = await loadAssetSet(index);
      return {
        set,
        routeLength: variant === "four" ? 8 : 12,
        decodedBytes: Object.values(set.clips).reduce(
          (sum, clip) => sum + clip!.descriptor.decodedBytes,
          0,
        ),
      };
    })();
    studies.set(variant, pending);
  }
  return pending;
}
export async function loadSampleLayers(
  study: SampleStudy,
  appearance: DollAppearance,
  cargo: boolean,
  action: Clip,
) {
  await Promise.all(
    [action, "idle"]
      .filter((key, index, all) => all.indexOf(key) === index)
      .map(async (key) => {
        const clip = study.set.clips[key as Clip]!;
        const layers = animationLayers(
          "walk",
          appearance,
          clip.descriptor.activeLayers,
        );
        await loadClipLayers(clip, layers);
        if (cargo && !clip.rig)
          clip.rig = (await fetch(clip.root + "/pose.json").then((r) =>
            r.json(),
          )) as SampleRig;
      }),
  );
  return study;
}
