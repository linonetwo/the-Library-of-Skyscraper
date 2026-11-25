import { Assets, type Texture } from "pixi.js";
import type { Clip, RegisteredClip } from "./animationCatalog";
import type { Direction } from "./directions";
import type { SampleRig } from "./RegisteredCargo";
export type AtlasDescriptor = {
  clip: Omit<RegisteredClip, "groundPivot" | "renderScale"> & { action: Clip };
  renderScale: number;
  groundPivot: [number, number];
  sourceSize: [number, number];
  directions: Direction[];
  activeLayers: string[];
  handMode?: "natural" | "grip";
  layerOrderByDirection?: Partial<Record<Direction, string[]>>;
  layers: {
    layer: string;
    active: boolean;
    pages: { json: string; image: string }[];
  }[];
  decodedBytes: number;
};
export type AssetSetIndex = {
  assetSetId: string;
  clips: { action: Clip; root: string; descriptor: string }[];
};
export type RegisteredDollClip = {
  assetSetId: string;
  root: string;
  descriptor: AtlasDescriptor;
  timing: RegisteredClip;
  textures: Record<string, Texture>;
  rig?: SampleRig;
};
export type LoadedAssetSet = {
  assetSetId: string;
  clips: Partial<Record<Clip, RegisteredDollClip>>;
  catalog: Partial<Record<Clip, RegisteredClip>>;
};
const sets = new Map<string, Promise<LoadedAssetSet>>();

/** atlas-budget is the only clip description; an index merely locates its descriptors. */
export function loadAssetSet(index: AssetSetIndex) {
  let pending = sets.get(index.assetSetId);
  if (!pending) {
    pending = (async () => {
      const entries = await Promise.all(
        index.clips.map(async (entry) => {
          const descriptor: AtlasDescriptor = await fetch(
            entry.root + "/" + entry.descriptor,
          ).then((r) => r.json());
          // One legacy descriptor retains its original vector stride.
          if (Array.isArray(descriptor.clip.cycleWorldStride))
            descriptor.clip.cycleWorldStride = Math.hypot(
              ...descriptor.clip.cycleWorldStride,
            );
          return [
            entry.action,
            {
              assetSetId: index.assetSetId,
              root: entry.root,
              descriptor,
              textures: {},
              timing: {
                ...descriptor.clip,
                directions: descriptor.directions,
                groundPivot: descriptor.groundPivot,
                renderScale: descriptor.renderScale,
              },
            },
          ] as const;
        }),
      );
      return {
        assetSetId: index.assetSetId,
        clips: Object.fromEntries(entries),
        catalog: Object.fromEntries(
          entries.map(([key, value]) => [key, value.timing]),
        ),
      };
    })();
    sets.set(index.assetSetId, pending);
  }
  return pending;
}

/** Calls Pixi only for actual selected pages; empty whole layers have no fetch. */
export async function loadClipLayers(
  clip: RegisteredDollClip,
  layers: string[],
) {
  const selected = clip.descriptor.layers.filter(
    (entry) => entry.active && layers.includes(entry.layer),
  );
  const sheets = await Promise.all(
    selected.flatMap((entry) =>
      entry.pages.map((page) => Assets.load(clip.root + "/" + page.json)),
    ),
  );
  Object.assign(clip.textures, ...sheets.map((sheet) => sheet.textures));
  return clip;
}
