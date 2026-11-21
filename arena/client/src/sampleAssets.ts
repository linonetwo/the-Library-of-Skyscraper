import { Assets, type Texture } from "pixi.js";
import type { RegisteredClip } from "./animationCatalog";
import type { SampleRig } from "./RegisteredCargo";
export type SampleDefinition = {
  root: string;
  clip: RegisteredClip;
  rig: SampleRig;
  activeLayers: string[];
  pages: Record<string, string[]>;
  decodedBytes: number;
  routeLength: number;
};
const definitions = new Map<string, Promise<SampleDefinition>>();
const textureBanks = new Map<string, Record<string, Texture>>();
export function loadSampleDefinition(variant: "four" | "sixteen") {
  let pending = definitions.get(variant);
  if (!pending) {
    pending = (async () => {
      const root =
        variant === "sixteen"
          ? "/assets/iso-v030-walk-16-study"
          : "/assets/iso-v030-walk-study";
      const pose = await fetch(root + "/pose.json").then((r) => r.json());
      const budget =
        variant === "sixteen"
          ? await fetch(root + "/atlas-budget.json").then((r) => r.json())
          : null;
      const layers = budget
        ? budget.layers.filter((layer: { active: boolean }) => layer.active)
        : pose.previewLayers.map((layer: string) => ({
            layer,
            pages: [{ json: `walk-${layer}.json` }],
          }));
      return {
        root,
        rig: pose,
        activeLayers: layers.map((l: { layer: string }) => l.layer),
        pages: Object.fromEntries(
          layers.map((l: { layer: string; pages: { json: string }[] }) => [
            l.layer,
            l.pages.map((p) => p.json),
          ]),
        ),
        decodedBytes: budget?.decodedBytes ?? 0,
        routeLength: variant === "sixteen" ? 12 : 8,
        clip: {
          frameCount: pose.frameCount ?? pose.directions.NE.poses.length,
          frameDurationsMs: pose.directions.NE.poses.map(
            (p: { durationMs: number }) => p.durationMs,
          ),
          playback: "loop" as const,
          cycleWorldStride:
            typeof pose.cycleWorldStride === "number"
              ? pose.cycleWorldStride
              : Math.hypot(...pose.cycleWorldStride),
          groundPivot: pose.groundPivot,
          renderScale: pose.renderScale,
        },
      };
    })();
    definitions.set(variant, pending);
  }
  return pending;
}
/** Only selected, nonempty atlas layers are fetched; Pixi owns the shared texture cache. */
export async function loadSampleLayers(
  definition: SampleDefinition,
  layers: string[],
) {
  let bank = textureBanks.get(definition.root);
  if (!bank) {
    bank = {};
    textureBanks.set(definition.root, bank);
  }
  const sheets = await Promise.all(
    layers.flatMap((layer) =>
      definition.pages[layer].map((page) =>
        Assets.load(definition.root + "/" + page),
      ),
    ),
  );
  Object.assign(bank, ...sheets.map((sheet) => sheet.textures));
  return bank;
}
