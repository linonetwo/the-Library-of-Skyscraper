import type { Appearance } from "./types";

import type { AnimationAction } from "./animationCatalog";
export type { AnimationAction } from "./animationCatalog";
const layerNames = ["body", "body-front", "outfit-scholar", "outfit-warden",
 "hair-ivory", "hair-ivory-back", "hair-ivory-front", "hair-midnight", "hair-midnight-back", "hair-midnight-front",
 "weapon-staff", "weapon-staff-back", "weapon-staff-front", "hand-grip"];
export const walkLayerNames = layerNames;
export const animationLayerNames: Record<AnimationAction,string[]> = {idle:layerNames,walk:layerNames};
export const walkLayers = (appearance:Appearance) => animationLayers("walk",appearance);
export const animationLayers = (action: AnimationAction, appearance: Appearance) => {
  const { outfit, hair, weapon } = appearance;
  return [...(weapon ? ["weapon-staff-back"] : []), `hair-${hair}-back`,
    "body", `outfit-${outfit}`, ...(weapon ? ["weapon-staff-front"] : []),
    "body-front", ...(weapon ? ["hand-grip"] : []), `hair-${hair}-front`];
};
