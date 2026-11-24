import { Container, Sprite, type Texture } from "pixi.js";
import { RegisteredCargo } from "./RegisteredCargo";
import { animationLayers, type DollAppearance } from "./walkLayers";
import type { Direction } from "./directions";
import {
  animationCatalog,
  type Clip,
  type RegisteredClip,
  type AnimationAction,
} from "./animationCatalog";
import type { RegisteredDollClip } from "./assetSetLoader";
import type { WorldAssets } from "./worldAssets";
export type DollTextures = Partial<Record<Clip, Record<string, Texture>>>;

/** One sprite pool consumes the same registered clip used by animation resolution. */
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
    action: Clip,
    frame: number,
    direction: Direction,
    appearance: DollAppearance,
    cargo: number,
    registered?: RegisteredDollClip,
  ) {
    const layers = animationLayers(
      "walk",
      appearance,
      registered?.descriptor.activeLayers,
      registered?.descriptor,
      direction,
    );
    const prefix = registered?.descriptor.clip.action ?? action;
    const suffix = `${direction}/${String(frame).padStart(2, "0")}`;
    const key = `${registered?.assetSetId ?? "legacy"}/${registered?.root ?? ""}/${prefix}/${suffix}/${layers.join("/")}`;
    if (key !== this.key) {
      this.key = key;
      while (this.sprites.length < layers.length) {
        const sprite = new Sprite();
        this.node.addChild(sprite);
        this.sprites.push(sprite);
      }
      this.sprites.forEach((sprite, index) => {
        sprite.visible = index < layers.length;
        if (!sprite.visible) return;
        sprite.texture = (registered?.textures ?? this.textures[action]!)[
          `${prefix}/${layers[index]}/${suffix}`
        ];
        const spec =
          registered?.timing ??
          (animationCatalog[action as AnimationAction] as RegisteredClip);
        sprite.anchor.set(
          spec.groundPivot[0] / sprite.texture.orig.width,
          spec.groundPivot[1] / sprite.texture.orig.height,
        );
        sprite.scale.set(spec.renderScale ?? 136 / sprite.texture.orig.height);
      });
    }
    this.cargo?.update(
      registered?.descriptor.activeLayers.some(layer => layer.startsWith("cargo-bundle")) ? undefined : registered?.rig,
      direction === "NE" || direction === "SW" ? direction : undefined,
      frame,
      cargo > 0,
      this.sprites.find(
        (s) => s.visible && s.texture.label?.includes("/body-front/"),
      ),
    );
    return this.sprites.filter((s) => s.visible).map((s) => s.texture.label);
  }
}
