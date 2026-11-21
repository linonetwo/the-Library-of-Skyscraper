import type { AnimationAction } from "./animationCatalog";
import { Container, Graphics, Sprite, Texture, Rectangle, Text } from "pixi.js";
import { roleNames } from "./types";
import type { Actor } from "./types";
import { animationLayers } from "./walkLayers";
import { ActorMotion, type Point } from "./actorMotion";

export type DollTextures = Record<AnimationAction, Record<string, Texture>>;

export class ActorView {
  readonly node = new Container();
  readonly motion: ActorMotion;
  samplePose?: "NE" | "SW";
  private doll = new Container();
  private halo = new Graphics();
  private health = new Graphics();
  private activity = new Graphics();
  private hitAt = -1000;
  private previousHp = 0;
  private status = new Text({
    text: "",
    style: {
      fontSize: 12,
      fill: 0xf3e3b6,
      stroke: { color: 0x102228, width: 3 },
    },
  });
  private sprites: Sprite[] = [];
  private actor: Actor;
  private appearance = "";
  private frameKey = "";

  constructor(
    actor: Actor,
    position: Point,
    private textures: DollTextures,
    onSelect: (id: string) => void,
  ) {
    this.actor = actor;
    this.motion = new ActorMotion(position);
    this.halo
      .ellipse(0, 0, 24, 12)
      .stroke({ color: 0xf5d18a, width: 2 })
      .fill({ color: 0xf5d18a, alpha: 0.15 });
    this.node.addChild(
      this.halo,
      this.doll,
      this.health,
      this.activity,
      this.status,
    );
    this.previousHp = actor.hp;
    this.status.anchor.set(0.5);
    this.status.position.set(0, -135);
    // Input follows the visible head/body column rather than transparent atlas cells.
    this.node.hitArea = new Rectangle(-20, -125, 40, 125);
    this.node.interactiveChildren = false;
    this.node.eventMode = "static";
    this.node.cursor = "pointer";
    this.node.on("pointertap", (event) => {
      event.stopPropagation();
      onSelect(actor.id);
    });
  }

  update(
    actor: Actor,
    selected: boolean,
    destination: Point,
    now: number,
    snap: boolean,
    path: Point[] = [],
    duration = 500,
  ) {
    if (actor.hp < this.previousHp) this.hitAt = now;
    this.previousHp = actor.hp;
    this.actor = actor;
    this.motion.duration = duration;
    this.motion.move(destination, now, snap, path);
    this.status.text =
      actor.hp <= 0
        ? "倒地"
        : actor.state === "retreating"
          ? "↩ 撤退"
          : actor.state === "gathering"
            ? `采集 · ${actor.cargo}/${actor.cargoCapacity}`
            : actor.state === "fighting"
              ? "⚔ 交战"
              : actor.cargo > 0
                ? `运输 ${actor.cargo}`
                : actor.task?.stage === "building"
                  ? "施工中"
                  : "";
    this.status.text = `${actor.owner.toUpperCase()} · ${roleNames[actor.role]}${this.status.text ? " · " + this.status.text : ""}`;
    this.status.style.fill = actor.owner === "p1" ? 0xc7e7c0 : 0xb1d7f3;
    this.doll.alpha = actor.hp <= 0 ? 0.45 : 1;
    this.doll.rotation = actor.hp <= 0 ? -Math.PI / 2 : 0;
    this.halo.visible = selected;
    this.health
      .clear()
      .roundRect(-16, 5, 32, 3, 1)
      .fill(0x20353a)
      .roundRect(-16, 5, Math.max(0.1, (32 * actor.hp) / actor.maxHp), 3, 1)
      .fill(actor.hp > actor.maxHp * 0.35 ? 0xabcda0 : 0xe18c75);
    const appearance = JSON.stringify(actor.appearance);
    if (appearance === this.appearance) return;
    this.appearance = appearance;
    this.frameKey = "";
  }

  render(now: number) {
    const pose = this.motion.sample(now);
    this.node.position.set(pose.x, pose.y);
    this.node.zIndex = pose.y;
    this.activity.clear();
    const hit = now - this.hitAt < 350;
    this.doll.tint = hit ? 0xff937f : 0xffffff;
    if (hit)
      this.activity
        .circle(0, -55, 40)
        .stroke({ color: 0xf49a80, width: 3, alpha: 0.7 });
    if (this.actor.cargo > 0)
      this.activity
        .roundRect(14, -40, 13, 18, 3)
        .fill(0xc9a56d)
        .stroke({ color: 0xf3dfb7, width: 1 });
    if (this.actor.state === "gathering")
      this.activity
        .arc(
          0,
          0,
          23,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * ((now % 2000) / 2000),
        )
        .stroke({ color: 0xdac489, width: 3 });
    if (this.actor.state === "fighting")
      this.activity
        .moveTo(20, -55)
        .lineTo(40, -85)
        .stroke({ color: 0xf3d28a, width: 3 });
    const action = pose.moving ? "walk" : "idle";
    const key = this.samplePose
      ? `${this.samplePose}/00`
      : `${pose.direction}/${String(pose.frame).padStart(2, "0")}`;
    if (`${action}/${key}` !== this.frameKey) {
      this.frameKey = `${action}/${key}`;
      const layers = this.samplePose
        ? ["body", "body-front"]
        : animationLayers(action, this.actor.appearance);
      while (this.sprites.length < layers.length) {
        const sprite = new Sprite();
        sprite.anchor.set(0.5, 0.9);
        sprite.position.set(0, 0);
        this.doll.addChild(sprite);
        this.sprites.push(sprite);
      }
      this.sprites.forEach((sprite, index) => {
        sprite.visible = index < layers.length;
        if (!sprite.visible) return;
        sprite.texture =
          this.textures[action][`${action}/${layers[index]}/${key}`];
        sprite.scale.set(this.samplePose ? 1 : 136 / sprite.texture.height);
      });
    }
    return { id: this.actor.id, ...pose, animation: action };
  }
}
