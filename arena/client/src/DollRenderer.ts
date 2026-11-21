import { Container, Sprite, type Texture } from "pixi.js";
import { RegisteredCargo, type SampleRig } from "./RegisteredCargo";
import { animationLayers } from "./walkLayers";
import type { Appearance } from "./types";
import type { Direction } from "./directions";
import type { AnimationAction } from "./animationCatalog";
import type { WorldAssets } from "./worldAssets";
export type DollTextures = Record<AnimationAction, Record<string, Texture>>;
export type SampleDoll = {
  direction: "NE" | "SW";
  frame: number;
  outfit: boolean;
  hair: boolean;
  rig?: SampleRig;
};

/** Persistent sprites share cached atlas textures; only frame and active layers change. */
export class DollRenderer {
  readonly node = new Container();
  private sprites: Sprite[] = [];
  private key = "";
  private cargo?: RegisteredCargo;
  constructor(
    private textures: DollTextures,
    assets?: WorldAssets,
  ) {
    if (assets) this.cargo = new RegisteredCargo(this.node, assets);
  }
  update(
    action: AnimationAction,
    frame: number,
    direction: Direction,
    appearance: Appearance,
    cargo: number,
    sample?: SampleDoll,
  ) {
    const layers = sample
      ? [
          ...(sample.hair ? ["hair-ivory-back"] : []),
          "body",
          ...(sample.outfit ? ["outfit-scholar"] : []),
          "body-front",
          ...(sample.hair ? ["hair-ivory-front"] : []),
        ]
      : animationLayers(action, appearance);
    const suffix = `${sample?.direction ?? direction}/${String(sample?.frame ?? frame).padStart(2, "0")}`;
    const prefix = sample ? (sample.rig ? "walk" : "sample") : action;
    const key = `${prefix}/${suffix}/${layers.join("/")}`;
    if (key !== this.key) {
      this.key = key;
      while (this.sprites.length < layers.length) {
        const sprite = new Sprite();
        sprite.anchor.set(0.5, 0.9);
        this.node.addChild(sprite);
        this.sprites.push(sprite);
      }
      this.sprites.forEach((sprite, index) => {
        sprite.visible = index < layers.length;
        if (!sprite.visible) return;
        sprite.texture =
          this.textures[sample ? "idle" : action][
            `${prefix}/${layers[index]}/${suffix}`
          ];
        sprite.scale.set(sample ? 1 : 136 / sprite.texture.height);
      });
    }
    this.cargo?.update(
      sample?.rig,
      sample?.direction,
      sample?.frame ?? 0,
      cargo > 0,
      this.sprites.find(
        (s) => s.visible && s.texture.label?.includes("/body-front/"),
      ),
    );
    return this.sprites.filter((s) => s.visible).map((s) => s.texture.label);
  }
}
