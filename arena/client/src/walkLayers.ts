import type { Appearance } from "./types";
import type { AnimationAction } from "./animationCatalog";
export type { AnimationAction } from "./animationCatalog";
const layerNames = [
  "body",
  "body-front",
  "outfit-scholar",
  "outfit-warden",
  "hair-ivory",
  "hair-ivory-back",
  "hair-ivory-front",
  "hair-midnight",
  "hair-midnight-back",
  "hair-midnight-front",
  "weapon-staff",
  "weapon-staff-back",
  "weapon-staff-front",
  "hand-grip",
];
export const walkLayerNames = layerNames;
export const animationLayerNames: Record<AnimationAction, string[]> = {
  idle: layerNames,
  walk: layerNames,
};
export type DollAppearance = {
  outfit: Appearance["outfit"] | "none";
  hair: Appearance["hair"] | "none";
  weapon: boolean;
};
/** Actual registered layers determine sleeve and natural/gripping hand availability. */
export function animationLayers(
  action: AnimationAction,
  appearance: DollAppearance,
  available: readonly string[] = animationLayerNames[action],
) {
  const { outfit, hair, weapon } = appearance;
  const layers = [
    ...(weapon ? ["weapon-staff-back"] : []),
    ...(hair !== "none" ? [`hair-${hair}-back`] : []),
    "body",
    ...(outfit !== "none" ? [`outfit-${outfit}`] : []),
    ...(weapon ? ["weapon-staff-front"] : []),
    "body-front",
    ...(outfit !== "none" ? [`outfit-${outfit}-front`] : []),
    weapon ? "hand-grip" : "hand-front",
    ...(hair !== "none" ? [`hair-${hair}-front`] : []),
  ];
  return layers.filter((layer) => available.includes(layer));
}
export const walkLayers = (appearance: Appearance) =>
  animationLayers("walk", appearance);
