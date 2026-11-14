import { Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import type { Actor, Room, Snapshot } from "./types";
import { floorPoint } from "./libraryLayout";
import { dollLayers } from "./dollLayers";
export type MapProps = {
  snapshot: Snapshot | null;
  selected: string | null;
  selectedRoom: string | null;
  zoom: number;
  showRoutes: boolean;
  onSelect: (id: string) => void;
  onRoom: (id: string) => void;
};

const point = (room: Room) => floorPoint(room.q, room.r);
const hex = (x: number, y: number, size: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = ((60 * i - 30) * Math.PI) / 180;
    return [x + Math.cos(a) * size, y + Math.sin(a) * size];
  }).flat();

function label(
  text: string,
  x: number,
  y: number,
  size = 12,
  color = "#f3e4bf",
) {
  const result = new Text({
    text,
    style: {
      fontFamily: '"Noto Serif SC", "Songti SC", serif',
      fontSize: size,
      fill: color,
      dropShadow: { color: "#0c1820", blur: 3, distance: 1, alpha: 0.8 },
    },
  });
  result.anchor.set(0.5);
  result.position.set(x, y);
  return result;
}

export function paintMap(
  renderLayer: Container,
  p: MapProps,
  frames: Record<string, Texture>,
) {
  const snapshot = p.snapshot;
  if (!snapshot) return;
  const grid = new Graphics();
  renderLayer.addChild(grid);
  snapshot.rooms.forEach((room) => {
    const { x, y } = point(room);
    const isSelected = p.selectedRoom === room.id;
    grid
      .poly(hex(x, y, 103))
      .fill({
        color:
          room.enemyHp > 0
            ? 0x5b3331
            : room.kind === "base"
              ? 0x1e494e
              : 0x183437,
        alpha: isSelected ? 0.35 : 0.1,
      })
      .stroke({
        color: isSelected ? 0xf5d08a : 0xd8c59a,
        alpha: isSelected ? 0.95 : 0.48,
        width: isSelected ? 2.3 : 1,
      });
    grid
      .poly(hex(x, y, 97))
      .stroke({ color: 0xd9bd86, alpha: 0.15, width: 0.7 });
    const hit = new Graphics()
      .poly(hex(x, y, 102))
      .fill({ color: 0xffffff, alpha: 0.001 });
    hit.eventMode = "static";
    hit.cursor = "pointer";
    hit.on("pointertap", () => p.onRoom(room.id));
    renderLayer.addChild(hit);
    const name = label(room.name, x, y + 67, 13);
    renderLayer.addChild(name);
    const detail =
      room.enemyHp > 0
        ? `威胁 ${room.enemyHp}`
        : room.kind === "resource"
          ? `藏材 ${room.resources}`
          : room.kind === "catalog"
            ? "编目目标"
            : room.kind === "base"
              ? "据点核心"
              : "待探索区域";
    renderLayer.addChild(
      label(detail, x, y + 84, 9, room.enemyHp > 0 ? "#edb29b" : "#c9cfbd"),
    );
    if (snapshot.buildings.some((building) => building.roomId === room.id)) {
      const building = new Graphics()
        .rect(x - 12, y - 48, 24, 24)
        .fill(0x9a8052)
        .stroke({ color: 0xe1cc95, width: 1 })
        .poly([x - 18, y - 48, x, y - 63, x + 18, y - 48])
        .fill(0xc7b17c);
      renderLayer.addChild(building);
    }
  });
  if (p.showRoutes) {
    const routes = new Graphics();
    snapshot.rooms
      .filter((room) => room.kind === "resource")
      .forEach((room) => {
        const { x, y } = point(room);
        routes
          .moveTo(point(snapshot.rooms[0]).x, point(snapshot.rooms[0]).y)
          .lineTo(x, y)
          .stroke({ color: 0xe0c58a, alpha: 0.25, width: 1.5 });
      });
    renderLayer.addChild(routes);
  }
  const grouped: Record<string, Actor[]> = {};
  snapshot.actors.forEach((actor) =>
    (grouped[actor.roomId] ||= []).push(actor),
  );
  snapshot.actors.forEach((actor) => {
    const room = snapshot.rooms.find((r) => r.id === actor.roomId)!;
    const { x, y } = point(room);
    const group = grouped[room.id];
    const offset = (group.indexOf(actor) - (group.length - 1) / 2) * 39;
    const selected = actor.id === p.selected;
    const node = new Container();
    node.position.set(x + offset, y + 4);
    if (selected)
      node.addChild(
        new Graphics()
          .ellipse(0, 29, 24, 8)
          .stroke({ color: 0xf5d18a, width: 2 })
          .fill({ color: 0xf5d18a, alpha: 0.15 }),
      );
    // Aligned independent body, outfit, hair and accessory frames form the paper doll.
    const layers = dollLayers(actor.appearance);
    layers.forEach((key) => {
      const texture = frames[key];
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5, 1);
      sprite.position.set(0, 28);
      sprite.scale.set(86 / texture.height);
      node.addChild(sprite);
    });
    const health = new Graphics()
      .roundRect(-16, 34, 32, 3, 1)
      .fill(0x20353a)
      .roundRect(-16, 34, Math.max(0.1, (32 * actor.hp) / actor.maxHp), 3, 1)
      .fill(actor.hp > actor.maxHp * 0.35 ? 0xabcda0 : 0xe18c75);
    node.addChild(health);
    node.eventMode = "static";
    node.cursor = "pointer";
    node.on("pointertap", (event) => {
      event.stopPropagation();
      p.onSelect(actor.id);
    });
    renderLayer.addChild(node);
  });
}
