export type Direction = "S" | "SW" | "W" | "NW" | "N" | "NE" | "E" | "SE";
const compass: Direction[] = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
export function facing(
  from: { x: number; y: number },
  to: { x: number; y: number },
): Direction {
  const sector = Math.round(
    Math.atan2(to.y - from.y, to.x - from.x) / (Math.PI / 4),
  );
  return compass[(sector + 8) % 8];
}
