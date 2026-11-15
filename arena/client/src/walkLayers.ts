import type { Appearance } from "./types";

export const walkLayerNames = [
  "body", "outfit-scholar", "outfit-warden", "body-front", "hair-ivory", "hair-midnight",
  "weapon-staff-back", "weapon-staff-front",
];

/** Front/back atlases encode directional weapon occlusion using transparent cells. */
export const walkLayers = ({ outfit, hair, weapon }: Appearance) => [
  ...(weapon ? ["weapon-staff-back"] : []),
  "body",
  `outfit-${outfit}`,
  ...(weapon ? ["weapon-staff-front"] : []),
  "body-front",
  `hair-${hair}`,
];

export type AnimationAction = "idle" | "walk";
export const animationLayerNames = {
  walk: walkLayerNames,
  idle: [...walkLayerNames.filter(layer => !layer.startsWith("hair-")),
    "hair-ivory-back", "hair-ivory-front", "hair-midnight-back", "hair-midnight-front"],
};
export const animationLayers = (action: AnimationAction, appearance: Appearance) => {
  if (action === "walk") return walkLayers(appearance);
  const { outfit, hair, weapon } = appearance;
  return [...(weapon ? ["weapon-staff-back"] : []), `hair-${hair}-back`,
    "body", `outfit-${outfit}`, ...(weapon ? ["weapon-staff-front"] : []),
    "body-front", `hair-${hair}-front`];
};
