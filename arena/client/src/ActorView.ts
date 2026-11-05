import { Container, Graphics, Sprite, Texture } from "pixi.js";
import type { Actor } from "./types";
import { dollLayers } from "./dollLayers";
import { ActorMotion, type Point } from "./actorMotion";

export type DollTextures = { static: Record<string, Texture>; walk: Record<string, Texture> };

export class ActorView {
  readonly node = new Container();
  readonly motion: ActorMotion;
  private doll = new Container();
  private halo = new Graphics();
  private health = new Graphics();
  private sprites: Sprite[] = [];
  private actor: Actor;
  private animated = false;
  private appearance = "";
  private frameKey = "";
  private layers: string[] = [];

  constructor(actor: Actor, position: Point, private textures: DollTextures, onSelect: (id: string) => void) {
    this.actor = actor;
    this.motion = new ActorMotion(position);
    this.halo.ellipse(0, 29, 24, 8)
      .stroke({ color: 0xf5d18a, width: 2 }).fill({ color: 0xf5d18a, alpha: 0.15 });
    this.node.addChild(this.halo, this.doll, this.health);
    this.node.eventMode = "static";
    this.node.cursor = "pointer";
    this.node.on("pointertap", event => { event.stopPropagation(); onSelect(actor.id); });
  }

  update(actor: Actor, selected: boolean, destination: Point, now: number, snap: boolean) {
    this.actor = actor;
    this.motion.move(destination, now, snap);
    this.halo.visible = selected;
    this.health.clear().roundRect(-16, 34, 32, 3, 1).fill(0x20353a)
      .roundRect(-16, 34, Math.max(0.1, 32 * actor.hp / actor.maxHp), 3, 1)
      .fill(actor.hp > actor.maxHp * 0.35 ? 0xabcda0 : 0xe18c75);
    const appearance = JSON.stringify(actor.appearance);
    if (appearance === this.appearance) return;
    this.appearance = appearance;
    // Select complete registered animation sets; other outfits keep their static layers.
    this.animated = actor.appearance.hair === "ivory" && !actor.appearance.weapon;
    for (const sprite of this.sprites) sprite.destroy();
    this.layers = this.animated
      ? ["body", `outfit-${actor.appearance.outfit}`, "body-front", "hair-ivory"]
      : dollLayers(actor.appearance);
    this.sprites = this.layers.map(layer => {
      const texture = this.animated
        ? this.textures.walk[`walk/${layer}/S/00`] : this.textures.static[layer];
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5, 1);
      sprite.position.set(0, 28);
      sprite.scale.set(86 / texture.height);
      this.doll.addChild(sprite);
      return sprite;
    });
    this.frameKey = "";
  }

  render(now: number) {
    const pose = this.motion.sample(now);
    this.node.position.set(pose.x, pose.y);
    this.node.zIndex = pose.y;
    const key = `${pose.direction}/${String(pose.frame).padStart(2, "0")}`;
    if (this.animated && key !== this.frameKey) {
      this.frameKey = key;
      this.sprites.forEach((sprite, index) => {
        sprite.texture = this.textures.walk[`walk/${this.layers[index]}/${key}`];
      });
    }
    return { id: this.actor.id, ...pose, animation: this.animated ? "walk-prototype" : "static" };
  }
}
