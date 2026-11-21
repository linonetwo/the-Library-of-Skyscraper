import { Assets } from "pixi.js";
import { animationActions } from "./animationCatalog";
import { animationLayerNames } from "./walkLayers";
import type { DollTextures } from "./DollRenderer";
const sampleLayers = [
  "body",
  "body-front",
  "outfit-scholar",
  "hair-ivory-back",
  "hair-ivory-front",
];
export async function loadDollTextures(sample: boolean): Promise<DollTextures> {
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
  if (sample) {
    const sheets = await Promise.all(
      sampleLayers.flatMap((layer) => [
        Assets.load(`/assets/iso-v030-sample/${layer}.json`),
        Assets.load(`/assets/iso-v030-walk-study/walk-${layer}.json`),
      ]),
    );
    Object.assign(textures.idle, ...sheets.map((sheet) => sheet.textures));
  }
  return textures;
}
