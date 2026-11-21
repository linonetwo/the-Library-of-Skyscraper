import { Container, Sprite, type Texture } from "pixi.js";
import { RegisteredCargo, type SampleRig } from "./RegisteredCargo";
import { animationLayers } from "./walkLayers";
import type { Appearance } from "./types";
import type { Direction } from "./directions";
import {
  animationCatalog,
  type RegisteredClip,
  type AnimationAction,
} from "./animationCatalog";
import type { WorldAssets } from "./worldAssets";
export type DollTextures = Record<AnimationAction, Record<string, Texture>>;
export type SampleDoll = {
  direction: "NE" | "SW";
  frame: number;
  rig?: SampleRig;
  layers?: string[];
  clip?: RegisteredClip;
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
    const layers = sample?.layers ?? animationLayers(action, appearance);
    const suffix = `${sample?.direction ?? direction}/${String(sample?.frame ?? frame).padStart(2, "0")}`;
    const prefix = sample ? "walk" : action;
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
        const registration =
          sample?.clip ?? (animationCatalog[action] as RegisteredClip);
        sprite.anchor.set(
          registration.groundPivot[0] / sprite.texture.orig.width,
          registration.groundPivot[1] / sprite.texture.orig.height,
        );
        sprite.scale.set(
          registration.renderScale ??
            (sample ? 1 : 136 / sprite.texture.orig.height),
        );
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
