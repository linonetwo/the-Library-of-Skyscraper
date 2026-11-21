import { project, type GridPoint } from "./isoGeometry";
import type { Room, Snapshot } from "./types";
export type FloorTile = GridPoint & { roomId: string; corridor?: boolean };
export const roomCenter = (q: number, r: number): GridPoint => ({
  x: 8 * q + 4 * r,
  y: 8 * r,
});
export function mapRoomCenter(
  room: Room,
  worldMap?: Snapshot["worldMap"],
): GridPoint {
  return (
    worldMap?.rooms.find((r) => r.id === room.id)?.center ??
    roomCenter(room.q, room.r)
  );
}
export function corridor(from: GridPoint, to: GridPoint) {
  const points: GridPoint[] = [from];
  let { x, y } = from;
  while (x !== to.x || y !== to.y) {
    if (x !== to.x) {
      x += Math.sign(to.x - x);
      points.push({ x, y });
    }
    if (y !== to.y) {
      y += Math.sign(to.y - y);
      points.push({ x, y });
    }
  }
  return points;
}
export function mapLayout(rooms: Room[], worldMap?: Snapshot["worldMap"]) {
  const tiles = new Map<string, FloorTile>();
  const links: { from: string; to: string; points: GridPoint[] }[] = [];
  for (const room of rooms) {
    const center = mapRoomCenter(room, worldMap);
    for (let x = -2; x <= 2; x++)
      for (let y = -2; y <= 2; y++) {
        const tile = { x: center.x + x, y: center.y + y, roomId: room.id };
        tiles.set(`${tile.x},${tile.y}`, tile);
      }
  }
  const edges =
    worldMap?.links ??
    rooms.flatMap((a, i) =>
      rooms
        .slice(i + 1)
        .filter((b) => {
          const q = a.q - b.q,
            r = a.r - b.r;
          return (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2 === 1;
        })
        .map((b) => ({
          from: a.id,
          to: b.id,
          points: [roomCenter(a.q, a.r), roomCenter(b.q, b.r)],
        })),
    );
  for (const edge of edges) {
    const points = edge.points.flatMap((p, i) =>
      i === 0 ? [p] : corridor(edge.points[i - 1], p).slice(1),
    );
    links.push({ ...edge, points });
    points.forEach((p, index) => {
      for (const dy of [-1, 0, 1]) {
        const tile = { x: p.x, y: p.y + dy };
        const key = `${tile.x},${tile.y}`;
        if (!tiles.has(key))
          tiles.set(key, {
            ...tile,
            roomId: index < points.length / 2 ? edge.from : edge.to,
            corridor: true,
          });
      }
    });
  }
  return { tiles: [...tiles.values()], links };
}
export function actorSlot(room: Room, index: number) {
  const p = roomCenter(room.q, room.r);
  return project(
    p.x + ((index % 3) - 1) * 0.65,
    p.y + (Math.floor(index / 3) - 0.5) * 0.65,
  );
}
