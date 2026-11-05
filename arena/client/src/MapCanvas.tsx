import { useEffect, useRef, useState } from "react";
import {
  Application,
  Assets,
  Container,
  Graphics,
  Sprite,
  Text,
  Texture,
} from "pixi.js";
import type { Actor, Outfit, Room, Snapshot } from "./types";

type Props = {
  snapshot: Snapshot | null;
  selected: string | null;
  selectedRoom: string | null;
  outfits: Record<string, Outfit>;
  hairs: Record<string, "ivory" | "midnight">;
  weapons: Record<string, boolean>;
  zoom: number;
  showRoutes: boolean;
  onSelect: (id: string) => void;
  onRoom: (id: string) => void;
};

const point = (room: Room) => ({
  x: Math.sqrt(3) * 109 * (room.q + room.r / 2),
  y: 109 * 1.5 * room.r,
});
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

function fallbackDoll(outfit: Outfit, selected: boolean) {
  const doll = new Container();
  const color = outfit === "scholar" ? 0x638497 : 0xa88461;
  const g = new Graphics();
  g.ellipse(0, 27, 16, 5).fill({ color: 0x0c1720, alpha: 0.4 });
  g.roundRect(-10, 16, 8, 11, 3)
    .fill(0x33373c)
    .roundRect(3, 16, 8, 11, 3)
    .fill(0x33373c);
  g.poly([-10, -2, 10, -2, 15, 21, -15, 21])
    .fill(color)
    .stroke({ color: 0xe2c99a, width: 1.4 });
  g.circle(0, -13, 14).fill(0xf1d7b1).stroke({ color: 0x594637, width: 1.2 });
  g.arc(0, -15, 14, Math.PI, Math.PI * 2)
    .lineTo(12, -8)
    .lineTo(5, -16)
    .lineTo(-3, -10)
    .lineTo(-13, -8)
    .fill(0x354654);
  g.ellipse(-5, -12, 1.8, 3)
    .fill(0x293946)
    .ellipse(5, -12, 1.8, 3)
    .fill(0x293946);
  g.moveTo(-14, 1).lineTo(-20, 18).stroke({ color: 0xcea66b, width: 3 });
  g.roundRect(8, 4, 11, 13, 2)
    .fill(0xdeb773)
    .stroke({ color: 0x6d5135, width: 1 });
  if (selected) g.circle(-20, -2, 3).fill(0xf2db9b);
  doll.addChild(g);
  return doll;
}

/** The application lives for the entire mounted canvas; snapshots only update its render bridge. */
export default function MapCanvas(props: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const redraw = useRef<() => void>(() => {});
  const [error, setError] = useState("");

  useEffect(() => {
    const host = mount.current!;
    const app = new Application();
    let disposed = false;
    let initialized = false;
    let resize: ResizeObserver | undefined;
    let frames: Record<string, Texture> = {};
    const world = new Container();
    let renderLayer = new Container();
    const paint = () => {
      if (!initialized || disposed) return;
      const p = latest.current;
      world.position.set(host.clientWidth / 2, host.clientHeight / 2 + 16);
      const fit =
        Math.min(host.clientWidth / 730, host.clientHeight / 610, 1.5) * p.zoom;
      world.scale.set(fit);
      renderLayer.destroy({ children: true });
      renderLayer = new Container();
      world.addChild(renderLayer);
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
            alpha: isSelected ? 0.55 : 0.3,
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
        hit.on("pointertap", () => latest.current.onRoom(room.id));
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
        if (
          snapshot.buildings.some((building) => building.roomId === room.id)
        ) {
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
              .moveTo(0, 0)
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
        const room = snapshot.rooms.find((r) => r.id === actor.roomId);
        if (!room) return;
        const { x, y } = point(room);
        const group = grouped[room.id];
        const offset = (group.indexOf(actor) - (group.length - 1) / 2) * 39;
        const selected = actor.id === p.selected;
        const outfit =
          p.outfits[actor.id] ||
          (actor.role === "guard" ? "warden" : "scholar");
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
        const layers = [
          "body",
          `outfit-${outfit}`,
          `hair-${p.hairs[actor.id] || "ivory"}`,
          ...(p.weapons[actor.id] !== false ? ["weapon-staff"] : []),
        ];
        const available = layers
          .map((key) => frames[key] || frames[`${key}.png`])
          .filter(Boolean);
        if (available.length >= 2) {
          available.forEach((texture) => {
            const sprite = new Sprite(texture);
            sprite.anchor.set(0.5, 1);
            sprite.position.set(0, 28);
            sprite.scale.set(64 / texture.height);
            node.addChild(sprite);
          });
        } else node.addChild(fallbackDoll(outfit, selected));
        const health = new Graphics()
          .roundRect(-16, 34, 32, 3, 1)
          .fill(0x20353a)
          .roundRect(
            -16,
            34,
            Math.max(0.1, (32 * actor.hp) / actor.maxHp),
            3,
            1,
          )
          .fill(actor.hp > actor.maxHp * 0.35 ? 0xabcda0 : 0xe18c75);
        node.addChild(health);
        node.eventMode = "static";
        node.cursor = "pointer";
        node.on("pointertap", (event) => {
          event.stopPropagation();
          latest.current.onSelect(actor.id);
        });
        renderLayer.addChild(node);
      });
    };
    redraw.current = paint;
    void (async () => {
      try {
        await app.init({
          backgroundAlpha: 0,
          antialias: true,
          resolution: Math.min(window.devicePixelRatio, 2),
          autoDensity: true,
          resizeTo: host,
          preference: "webgl",
        });
        initialized = true;
        if (disposed) {
          app.destroy(true, { children: true });
          return;
        }
        host.appendChild(app.canvas);
        app.stage.addChild(world);
        resize = new ResizeObserver(() => {
          app.renderer.resize(host.clientWidth, host.clientHeight);
          paint();
        });
        resize.observe(host);
        paint();
        // Optional resources are never allowed to prevent entry into the game.
        const response = await fetch("/assets/doll-atlas.json", {
          method: "HEAD",
        });
        if (
          response.ok &&
          response.headers.get("content-type")?.includes("json")
        ) {
          const sheet = await Assets.load("/assets/doll-atlas.json");
          frames = sheet.textures || {};
          paint();
        }
      } catch (cause) {
        if (!initialized && !disposed)
          setError(
            `地图渲染不可用：${cause instanceof Error ? cause.message : "WebGL 初始化失败"}。仍可使用小队与规则面板。`,
          );
      }
    })();
    const visibility = () => {
      if (initialized && !disposed) document.hidden ? app.stop() : app.start();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true;
      resize?.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      redraw.current = () => {};
      if (initialized) app.destroy(true, { children: true });
    };
  }, []);

  useEffect(() => {
    redraw.current();
  }, [
    props.snapshot,
    props.selected,
    props.selectedRoom,
    props.outfits,
    props.hairs,
    props.weapons,
    props.zoom,
    props.showRoutes,
  ]);

  return (
    <div ref={mount} className="pixi-map" aria-label="六边形书苑地图">
      {error && (
        <div className="map-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
