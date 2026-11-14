/** Authored floor anchors in the 1536×1024 library illustration. */
export const libraryLayout = {
  width: 1536,
  height: 1024,
  scale: 0.6,
  floors: {
    "0,0": [768, 445],
    "1,0": [1190, 270],
    "0,1": [1190, 655],
    "-1,1": [768, 825],
    "-1,0": [335, 655],
    "0,-1": [335, 270],
    "1,-1": [768, 150],
  } as Record<string, [number, number]>,
};
export function floorPoint(q: number, r: number) {
  const [x, y] = libraryLayout.floors[`${q},${r}`];
  return {
    x: (x - libraryLayout.width / 2) * libraryLayout.scale,
    y: (y - libraryLayout.height / 2) * libraryLayout.scale,
  };
}
