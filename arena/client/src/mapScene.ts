import { Container, Graphics, Sprite, Polygon, Texture } from "pixi.js";
import type { Snapshot } from "./types";
import { project, diamond } from "./isoGeometry";
import { mapLayout, mapRoomCenter } from "./mapLayout";
export type MapProps = {
  focusIntent?: import("./cameraController").FocusIntent;
  snapshot: Snapshot | null;
  samplePose?: "NE" | "SW";
  sampleOutfit?: boolean;
  sampleHair?: boolean;
  selected: string | null;
  selectedRoom: string | null;
  zoom: number;
  showRoutes: boolean;
  onSelect: (id: string) => void;
  onRoom: (id: string) => void;
};

export function paintMap(
  ground: Container,
  p: MapProps,
  entities: Container,
  textures: Record<string, Texture>,
) {
  const snapshot = p.snapshot;
  if (!snapshot) return;
  const worldMap =
    (snapshot.simulationVersion ?? 0) >= 3 ? snapshot.worldMap : undefined;
  const layout = mapLayout(snapshot.rooms, worldMap);
  const occupied = new Set(layout.tiles.map((t) => `${t.x},${t.y}`));
  const foundations = new Graphics();
  for (const tile of layout.tiles) {
    const p = project(tile.x, tile.y);
    // Only exposed front edges receive a low foundation; shared seams stay flat.
    for (const [dx, dy, a, b] of [
      [1, 0, { x: p.x + 64, y: p.y }, { x: p.x, y: p.y + 32 }],
      [0, 1, { x: p.x, y: p.y + 32 }, { x: p.x - 64, y: p.y }],
    ] as const) {
      if (occupied.has(`${tile.x + dx},${tile.y + dy}`)) continue;
      foundations
        .poly([a.x, a.y, b.x, b.y, b.x, b.y + 16, a.x, a.y + 16])
        .fill(dx ? 0x3e4137 : 0x756753);
      foundations
        .moveTo(a.x, a.y + 20)
        .lineTo(b.x, b.y + 20)
        .stroke({ color: 0x081e20, width: 7, alpha: 0.18 });
    }
  }
  foundations.eventMode = "none";
  ground.addChild(foundations);
  for (const tile of layout.tiles) {
    const point = project(tile.x, tile.y);
    const sprite = new Sprite(
      textures[
        tile.corridor
          ? "floor-worn"
          : (tile.x + tile.y) % 4 === 0
            ? "floor-inlay"
            : "floor-stone"
      ],
    );
    sprite.anchor.set(0.5);
    sprite.position.copyFrom(point);
    sprite.hitArea = new Polygon(diamond(0, 0));
    sprite.eventMode = "static";
    sprite.cursor = "pointer";
    sprite.on("pointertap", () => p.onRoom(tile.roomId));
    ground.addChild(sprite);
    if (p.selectedRoom === tile.roomId)
      ground.addChild(
        new Graphics()
          .poly(diamond(point.x, point.y))
          .fill({ color: 0xe3c286, alpha: 0.17 })
          .stroke({ color: 0xe3c286, alpha: 0.35, width: 1 }),
      );
  }
  if (p.showRoutes) {
    const routes = new Graphics();
    for (const link of layout.links) {
      link.points.forEach((v, i) => {
        const v2 = project(v.x, v.y);
        if (i === 0) routes.moveTo(v2.x, v2.y);
        else routes.lineTo(v2.x, v2.y);
      });
      routes.stroke({ color: 0xf2d493, width: 2, alpha: 0.3 });
    }
    ground.addChild(routes);
  }
  if (snapshot.worldMap?.props) {
    for (const entry of snapshot.worldMap.props) {
      const foot = project(entry.position.x, entry.position.y);
      const shadow = new Graphics()
        .ellipse(foot.x, foot.y + 2, 30, 15)
        .fill({ color: 0x122827, alpha: 0.2 });
      shadow.zIndex = foot.y - 0.1;
      shadow.label = "shelf:shadow:" + entry.id;
      shadow.eventMode = "none";
      entities.addChild(shadow);
      const prop = new Sprite(textures[entry.asset]);
      prop.anchor.set(0.5, 160 / 192);
      prop.position.copyFrom(foot);
      prop.zIndex = foot.y;
      prop.eventMode = "none";
      prop.label = "shelf:" + entry.id;
      entities.addChild(prop);
    }
    return;
  }
  for (const room of snapshot.rooms) {
    const c = mapRoomCenter(room, snapshot.worldMap);
    const point = project(c.x, c.y);
    for (const [dx, dy, axis] of [
      [-2, -2, "u"],
      [-1, -2, "u"],
      [0, -2, "u"],
      [2, -2, "v"],
      [2, -1, "v"],
      [2, 0, "v"],
    ] as const) {
      if (
        layout.links.some((link) =>
          link.points.some((p) => p.x === c.x + dx && p.y === c.y + dy),
        )
      )
        continue;
      const foot = project(c.x + dx, c.y + dy);
      const prop = new Sprite(textures["bookcase-" + axis]);
      prop.anchor.set(0.5, 160 / 192);
      prop.position.copyFrom(foot);
      prop.zIndex = foot.y;
      prop.eventMode = "none";
      prop.label = "shelf:" + room.id + ":" + dx;
      entities.addChild(prop);
    }
  }
}
