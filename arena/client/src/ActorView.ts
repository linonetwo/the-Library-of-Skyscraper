import type { AnimationAction } from "./animationCatalog";
import { Container, Graphics, Sprite, Texture, Rectangle } from "pixi.js";
import type { Actor } from "./types";
import { animationLayers } from "./walkLayers";
import { ActorMotion, type Point } from "./actorMotion";

export type DollTextures = Record<AnimationAction, Record<string, Texture>>;

export class ActorView {
  readonly node = new Container();
  readonly motion: ActorMotion;
  private doll = new Container();
  private halo = new Graphics();
  private health = new Graphics();
  private sprites: Sprite[] = [];
  private actor: Actor;
  private appearance = "";
  private frameKey = "";

  constructor(actor: Actor, position: Point, private textures: DollTextures, onSelect: (id: string) => void) {
    this.actor = actor;
    this.motion = new ActorMotion(position);
    this.halo.ellipse(0, 0, 24, 8)
      .stroke({ color: 0xf5d18a, width: 2 }).fill({ color: 0xf5d18a, alpha: 0.15 });
    this.node.addChild(this.halo, this.doll, this.health);
    // Input follows the visible head/body column rather than transparent atlas cells.
    this.node.hitArea = new Rectangle(-20, -145, 40, 145);
    this.node.interactiveChildren = false;
    this.node.eventMode = "static";
    this.node.cursor = "pointer";
    this.node.on("pointertap", event => { event.stopPropagation(); onSelect(actor.id); });
  }

  update(actor: Actor, selected: boolean, destination: Point, now: number, snap: boolean, path:Point[] = []) {
    this.actor = actor;
    this.motion.move(destination, now, snap,path);
    this.halo.visible = selected;
    this.health.clear().roundRect(-16, 5, 32, 3, 1).fill(0x20353a)
      .roundRect(-16, 5, Math.max(0.1, 32 * actor.hp / actor.maxHp), 3, 1)
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
    const action = pose.moving ? "walk" : "idle";
    const key = `${pose.direction}/${String(pose.frame).padStart(2, "0")}`;
    if (`${action}/${key}` !== this.frameKey) {
      this.frameKey = `${action}/${key}`;
      const layers = animationLayers(action, this.actor.appearance);
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
        sprite.texture = this.textures[action][`${action}/${layers[index]}/${key}`];
        sprite.scale.set(176 / sprite.texture.height);
      });
    }
    return { id: this.actor.id, ...pose, animation: action };
  }
}
