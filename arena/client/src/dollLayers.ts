import type { Appearance } from "./types";

export const dollLayers = ({ outfit, hair, weapon }: Appearance) => [
  "body",
  `outfit-${outfit}`,
  `hair-${hair}`,
  ...(weapon ? ["weapon-staff"] : []),
];
