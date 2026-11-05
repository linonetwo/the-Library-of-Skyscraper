import type { Appearance } from "./types";

export const walkLayerNames = [
  "body", "outfit-scholar", "outfit-warden", "body-front", "hair-ivory",
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
