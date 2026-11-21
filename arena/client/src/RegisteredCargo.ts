import { Container, type Sprite } from "pixi.js";
import { worldSprite, type WorldAssets } from "./worldAssets";
export type SampleRig = {
  groundPivot: [number, number];
  directions: Record<
    "NE" | "SW",
    {
      joints: { pelvis: { cell: [number, number] } };
      poses: { joints: { pelvis?: { offset?: [number, number] } } }[];
    }
  >;
};
/** Attachment registration is enabled only for the rig that authored its joints. */
export class RegisteredCargo {
  private sprite;
  constructor(
    private parent: Container,
    private assets: WorldAssets,
  ) {
    this.sprite = worldSprite(assets, "cargo-bundle");
    this.sprite.visible = false;
    parent.addChild(this.sprite);
  }
  update(
    rig: SampleRig | undefined,
    direction: "NE" | "SW" | undefined,
    frame: number,
    visible: boolean,
    foreground?: Sprite,
  ) {
    this.sprite.visible = !!rig && !!direction && visible;
    if (!rig || !direction || !visible) return;
    const view = rig.directions[direction],
      pelvis = view.joints.pelvis.cell,
      phase = view.poses[frame].joints.pelvis?.offset ?? [0, 0],
      offset = this.assets.specs["cargo-bundle"].jointOffset!;
    this.sprite.position.set(
      pelvis[0] + phase[0] + offset[0] - rig.groundPivot[0],
      pelvis[1] + phase[1] + offset[1] - rig.groundPivot[1],
    );
    const front = foreground
      ? this.parent.getChildIndex(foreground)
      : this.parent.children.length;
    const current = this.parent.getChildIndex(this.sprite);
    this.parent.setChildIndex(
      this.sprite,
      direction === "NE" ? 0 : front - (current < front ? 1 : 0),
    );
  }
}
