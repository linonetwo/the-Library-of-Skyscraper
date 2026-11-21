import { Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import type { Snapshot } from "./types";
import { project } from "./isoGeometry";
import { roomCenter } from "./mapLayout";
const names = { warehouse: "前线仓库", tower: "防御塔", catalog: "编目台" };
/** Battlefield feedback independent of the cached floor. */
export class WorldEntities {
  private roomLabels = new Map<string, Text>();
  private nodes = new Map<string, Container>();
  constructor(
    private parent: Container,
    private textures: Record<string, Texture>,
  ) {}
  update(snapshot: Snapshot) {
    const ids = new Set<string>();
    const nodeFor = (id: string) => {
      ids.add(id);
      let node = this.nodes.get(id);
      if (!node) {
        node = new Container();
        node.label = "dynamic:" + id;
        this.nodes.set(id, node);
        this.parent.addChild(node);
      }
      for (const child of [...node.children]) child.destroy();
      return node;
    };
    const label = (
      node: Container,
      text: string,
      y: number,
      color = 0xf3e3b6,
    ) => {
      const title = new Text({
        text,
        style: {
          fontSize: 13,
          fill: color,
          stroke: { color: 0x132c30, width: 4 },
        },
      });
      title.anchor.set(0.5);
      title.y = y;
      node.addChild(title);
    };
    const bar = (
      node: Container,
      hp: number,
      max: number,
      y: number,
      color: number,
    ) => {
      node.addChild(
        new Graphics()
          .rect(-26, y, 52, 5)
          .fill(0x173438)
          .rect(-26, y, 52 * Math.max(0, hp / max), 5)
          .fill(color),
      );
    };
    for (const room of snapshot.rooms) {
      let title = this.roomLabels.get(room.id);
      if (!title) {
        title = new Text({
          text: "",
          style: {
            fontSize: 16,
            fill: 0xf1dec0,
            stroke: { color: 0x19343a, width: 4 },
          },
        });
        title.anchor.set(0.5);
        title.eventMode = "none";
        this.roomLabels.set(room.id, title);
        this.parent.addChild(title);
      }
      const c =
        snapshot.worldMap?.rooms.find((r) => r.id === room.id)?.center ??
        roomCenter(room.q, room.r);
      const p = project(c.x, c.y);
      title.position.set(p.x, p.y + 115);
      title.zIndex = p.y + 115;
      title.text =
        room.name +
        " · " +
        (room.enemyHp > 0
          ? "守卫 " + room.enemyHp
          : room.kind === "resource"
            ? "建材 " + room.resources
            : room.id === snapshot.scenarioConfig?.targetRoomId
              ? "编目 " +
                snapshot.scenario?.catalogProgress +
                "/" +
                snapshot.scenarioConfig.catalogGoal
              : "安全");
    }
    for (const enemy of snapshot.enemies ?? []) {
      const node = nodeFor(enemy.id),
        p = project(enemy.worldPosition.x, enemy.worldPosition.y);
      node.position.copyFrom(p);
      node.zIndex = p.y;
      node.addChild(
        new Graphics()
          .ellipse(0, 0, 24, 12)
          .fill({ color: 0xe28675, alpha: 0.25 })
          .poly([0, -83, 24, -57, 18, -14, 0, 0, -18, -14, -24, -57])
          .fill(0x663d43)
          .stroke({ color: 0xe8a08b, width: 2 })
          .circle(-7, -57, 3)
          .fill(0xffd69c)
          .circle(7, -57, 3)
          .fill(0xffd69c),
      );
      node.alpha = enemy.hp > 0 ? 1 : 0.3;
      label(
        node,
        enemy.hp <= 0 ? "守卫已倒地" : "敌方 · 书库守卫",
        -107,
        0xf4ad98,
      );
      bar(node, enemy.hp, enemy.maxHp, -94, 0xe8907d);
      if (enemy.state === "fighting")
        node.addChild(
          new Graphics()
            .moveTo(-30, -30)
            .lineTo(30, -60)
            .stroke({ color: 0xf9c784, width: 4, alpha: 0.8 }),
        );
    }
    for (const building of snapshot.buildings) {
      const room = snapshot.rooms.find((r) => r.id === building.roomId)!;
      const center =
        snapshot.worldMap?.rooms.find((r) => r.id === room.id)?.center ??
        roomCenter(room.q, room.r);
      const position = building.worldPosition ?? {
        x: center.x + 1.5,
        y: center.y + 1,
      };
      const p = project(position.x, position.y),
        node = nodeFor(building.id);
      node.position.copyFrom(p);
      node.zIndex = p.y;
      const complete =
        (building.constructionTicks ?? 0) >= (building.requiredTicks ?? 0);
      node.addChild(
        new Graphics()
          .ellipse(0, 2, 24, 12)
          .fill({ color: 0x102827, alpha: 0.22 }),
      );
      const sprite = new Sprite(
        this.textures[building.kind === "catalog" ? "lectern" : "plinth"],
      );
      sprite.anchor.set(0.5, 160 / 192);
      sprite.alpha = complete ? 1 : 0.45;
      node.addChild(sprite);
      if (building.kind === "tower")
        node.addChild(
          new Graphics()
            .rect(-9, -90, 18, 48)
            .fill(0xb5c9ba)
            .circle(0, -95, 11)
            .fill(0xf2d18a),
        );
      if (!complete)
        node.addChild(
          new Graphics()
            .rect(-32, -50, 64, 36)
            .stroke({ color: 0xe4c582, width: 2 }),
        );
      label(
        node,
        `${names[building.kind]}${complete ? "" : " · 施工中"}`,
        -124,
      );
      if (!complete) {
        bar(
          node,
          building.constructionTicks ?? 0,
          building.requiredTicks ?? 16,
          -111,
          0xe8cc89,
        );
        label(
          node,
          `${Math.floor(((building.constructionTicks ?? 0) / (building.requiredTicks ?? 16)) * 100)}%`,
          -96,
        );
      } else
        bar(node, building.hp ?? 100, building.maxHp ?? 100, -111, 0xabcda0);
    }
    for (const [id, node] of this.nodes)
      if (!ids.has(id)) {
        node.destroy({ children: true });
        this.nodes.delete(id);
      }
  }
}
