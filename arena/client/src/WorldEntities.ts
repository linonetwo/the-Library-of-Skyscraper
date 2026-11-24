import { EnemyScene, loadEnemyAssets } from "./EnemyScene";
import { cueActive, resolveAnimation } from "./resolveAnimation";
import type { ActionCue } from "./types";
import { buildingModules, worldSprite, type WorldAssets } from "./worldAssets";
import { Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import type { Snapshot } from "./types";
import { project } from "./isoGeometry";
import { roomCenter } from "./mapLayout";
const names = {
  core: "据点核心",
  warehouse: "前线仓库",
  tower: "防御塔",
  catalog: "编目台",
};
/** Battlefield feedback independent of the cached floor. */
export class WorldEntities {
  private enemies?: EnemyScene;
  private enemyReady?: Promise<void>;
  private roomLabels = new Map<string, Text>();
  private annotations = new Container();
  private roomAnnotations = new Container();
  private nodes = new Map<string, Container>();
  private enemyFeedback: {
    cue?: ActionCue | null;
    impact?: ActionCue | null;
    body: Sprite;
    slash: Graphics;
    tickMs: number;
  }[] = [];
  private buildingHp = new Map<string, { hp: number; lastHitTick?: number }>();
  private buildingSnapshot?: { sessionId: string; tick: number };
  private buildingFeedback: { shot: Graphics; hit: Graphics; shotTick?: number; hitTick?: number; tickMs: number }[] = [];
  constructor(
    private parent: Container,
    private textures: Record<string, Texture>,
    private assets: WorldAssets,
  ) {
    this.annotations.zIndex = Number.MAX_SAFE_INTEGER;
    this.roomAnnotations.zIndex = Number.MAX_SAFE_INTEGER;
    this.parent.addChild(this.annotations, this.roomAnnotations);
  }
  prepare(snapshot: Snapshot) {
    if ((snapshot.simulationVersion ?? 0) < 4) return Promise.resolve();
    return this.enemyReady ??= loadEnemyAssets().then(assets => {
      this.enemies = new EnemyScene(this.parent, assets);
    });
  }
  update(snapshot: Snapshot, simulationTime = snapshot.tick * (snapshot.tickDurationMs || 500), now = simulationTime) {
    this.enemies?.update(snapshot, simulationTime, now);
    if (this.buildingSnapshot?.sessionId !== snapshot.sessionId ||
        snapshot.tick < this.buildingSnapshot.tick) this.buildingHp.clear();
    this.buildingSnapshot = { sessionId: snapshot.sessionId, tick: snapshot.tick };
    const worldMap =
      (snapshot.simulationVersion ?? 0) >= 3 ? snapshot.worldMap : undefined;
    for (const child of this.annotations.removeChildren()) child.destroy();
    this.enemyFeedback = [];
    this.buildingFeedback = [];
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
      title.position.set(node.x, node.y + y);
      this.annotations.addChild(title);
    };
    const bar = (
      node: Container,
      hp: number,
      max: number,
      y: number,
      color: number,
    ) => {
      const graphic = new Graphics();
      graphic.position.copyFrom(node.position);
      this.annotations.addChild(graphic);
      graphic
        .rect(-26, y, 52, 5)
        .fill(0x173438)
        .rect(-26, y, 52 * Math.max(0, hp / max), 5)
        .fill(color);
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
        this.roomAnnotations.addChild(title);
      }
      const c =
        worldMap?.rooms.find((r) => r.id === room.id)?.center ??
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
    for (const room of snapshot.rooms.filter(
      (r) => r.kind === "resource" && r.resources > 0,
    )) {
      const c =
        worldMap?.rooms.find((r) => r.id === room.id)?.center ??
        roomCenter(room.q, room.r);
      const p = project(c.x, c.y),
        node = nodeFor("resource:" + room.id);
      node.position.copyFrom(p);
      node.zIndex = p.y;
      node.addChild(worldSprite(this.assets, "resource-cache"));
    }
    for (const enemy of (snapshot.simulationVersion ?? 0) < 4 ? snapshot.enemies ?? [] : []) {
      const node = nodeFor(enemy.id),
        p = project(enemy.worldPosition.x, enemy.worldPosition.y);
      node.position.copyFrom(p);
      node.zIndex = p.y;
      node.addChild(
        new Graphics()
          .ellipse(0, 1, 19, 9.5)
          .fill({ color: 0x081b22, alpha: 0.3 }),
      );
      const resolved = resolveAnimation(
        { ...enemy, state: enemy.state ?? "idle" },
        snapshot.tick * (snapshot.tickDurationMs || 500),
        {
          moving: false,
          direction: "SW",
          tickDurationMs: snapshot.tickDurationMs || 500,
          motionDistanceMilli: enemy.motionDistanceMilli ?? 0,
          worldPosition: enemy.worldPosition,
        },
      );
      const target = enemy.actionCue?.targetPosition;
      const direction =
        target &&
        project(
          target.x - enemy.worldPosition.x,
          target.y - enemy.worldPosition.y,
        ).y < 0
          ? "NE"
          : "SW";
      const body = worldSprite(
        this.assets,
        "inkguard-" +
          ((snapshot.simulationVersion ?? 0) >= 4
            ? resolved.direction.includes("N")
              ? "NE"
              : "SW"
            : direction),
      );
      node.addChild(body);
      node.alpha = enemy.hp > 0 ? 1 : 0.3;
      label(
        node,
        enemy.hp <= 0 ? "守卫已倒地" : "敌方 · 书库守卫",
        -107,
        0xf4ad98,
      );
      bar(node, enemy.hp, enemy.maxHp, -94, 0xe8907d);
      const slash = new Graphics()
        .moveTo(-30, -30)
        .lineTo(30, -60)
        .stroke({ color: 0xf9c784, width: 4, alpha: 0.8 });
      slash.visible = false;
      node.addChild(slash);
      this.enemyFeedback.push({
        cue: enemy.actionCue,
        impact: enemy.impactCue,
        body,
        slash,
        tickMs: snapshot.tickDurationMs || 500,
      });
    }
    for (const building of snapshot.buildings) {
      const room = snapshot.rooms.find((r) => r.id === building.roomId)!;
      const center =
        worldMap?.rooms.find((r) => r.id === room.id)?.center ??
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
      const modules: { base: string; upper?: string } = buildingModules[building.kind];
      const sprite = new Sprite(this.textures[modules.base]);
      sprite.anchor.set(0.5, 160 / 192);
      sprite.alpha = complete ? 1 : 0.45;
      if (!complete)
        node.addChild(worldSprite(this.assets, "construction-site-back"));
      node.addChild(sprite);
      if (modules.upper) {
        const upper = worldSprite(this.assets, modules.upper);
        upper.alpha = sprite.alpha;
        node.addChild(upper);
      }
      if (!complete)
        node.addChild(worldSprite(this.assets, "construction-site-front"));
      if (building.kind === "tower") {
        const anchors = this.assets.specs["tower-upper"].attachments!;
        const [mx, my] = anchors.muzzle.offsetScreen;
        const [hx, hy] = anchors.hitAnchor.offsetScreen;
        const event = complete ? [...snapshot.events].reverse().find(e =>
          e.kind === "tower-attack" && e.message.startsWith(building.id + " ")) : undefined;
        const shot = new Graphics().circle(mx, my, 9).fill({ color: 0xffe5a0, alpha: 0.9 });
        const target = event && snapshot.enemies?.find(e =>
          e.impactCue?.startedTick === event.tick &&
          e.impactCue.targetPosition?.x === position.x && e.impactCue.targetPosition?.y === position.y);
        if (target) {
          const end = project(target.worldPosition.x, target.worldPosition.y);
          shot.moveTo(mx, my).lineTo(end.x - p.x, end.y - p.y - 45)
            .stroke({ color: 0xffdf91, width: 3, alpha: 0.8 });
        }
        const hit = new Graphics().circle(hx, hy, 14).stroke({ color: 0xff937f, width: 3 });
        const previous = this.buildingHp.get(building.id);
        const lastHitTick = previous && (building.hp ?? 100) < previous.hp
          ? snapshot.tick : previous?.lastHitTick;
        this.buildingHp.set(building.id, { hp: building.hp ?? 100, lastHitTick });
        shot.visible = hit.visible = false;
        node.addChild(shot, hit);
        this.buildingFeedback.push({ shot, hit, shotTick: event?.tick,
          hitTick: lastHitTick,
          tickMs: snapshot.tickDurationMs || 500 });
      }

      if (!complete)
        node.addChild(
          new Graphics()
            .rect(-32, -50, 64, 36)
            .stroke({ color: 0xe4c582, width: 2 }),
        );
      label(node, `${names[building.kind]}${complete ? "" : " · 施工中"}`, 30);
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
        this.buildingHp.delete(id);
      }
  }
  render(simTimeMs: number, now = simTimeMs) {
    const enemies = this.enemies?.render(simTimeMs, now) ?? [];
    for (const fx of this.buildingFeedback) {
      fx.shot.visible = fx.shotTick !== undefined && simTimeMs >= fx.shotTick * fx.tickMs && simTimeMs < (fx.shotTick + 1) * fx.tickMs;
      fx.hit.visible = fx.hitTick !== undefined && simTimeMs >= fx.hitTick * fx.tickMs && simTimeMs < (fx.hitTick + 1) * fx.tickMs;
    }
    for (const fx of this.enemyFeedback) {
      fx.slash.visible =
        fx.cue?.kind === "attack" && cueActive(fx.cue, simTimeMs, fx.tickMs);
      const impact = fx.impact ?? (fx.cue?.kind === "hit" ? fx.cue : null);
      fx.body.tint =
        impact?.kind === "hit" && cueActive(impact, simTimeMs, fx.tickMs)
          ? 0xff937f
          : 0xffffff;
    }
    return enemies;
  }
}
