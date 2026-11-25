import { Application, Text } from "pixi.js";
import { DollRenderer } from "./DollRenderer";
import type { RegisteredDollClip } from "./assetSetLoader";
import type { Direction } from "./directions";
import type { DollAppearance } from "./walkLayers";
export const labDirections: Direction[] = ["S", "SW", "W", "NW", "N", "NE", "E", "SE"];
export type LabPose = { clip?: RegisteredDollClip; direction: Direction; frame: number; appearance: DollAppearance };
/** One stopped scene, sharing the game's textures and renderer implementation. */
export class AnimationLabScene {
  private app = new Application();
  private dolls = Array.from({ length: 9 }, () => new DollRenderer({}));
  private labels = labDirections.map(direction => new Text({ text: direction, style: { fontFamily: "sans-serif", fontSize: 14, fill: "#aebbb2" } }));
  async init(host: HTMLElement) {
    await this.app.init({ width: 768, height: 736, backgroundAlpha: 0, antialias: true, autoStart: false });
    this.app.ticker.stop();
    host.appendChild(this.app.canvas);
    this.app.stage.addChild(...this.dolls.map(doll => doll.node), ...this.labels);
    this.labels.forEach((label, i) => { label.anchor.set(0.5, 0); label.position.set((i % 4) * 192 + 96, 320 + Math.floor(i / 4) * 192); });
    return this;
  }
  draw({ clip, direction, frame, appearance }: LabPose) {
    const poses: { direction: Direction; frame: number; layers: (string | undefined)[] }[] = [];
    this.dolls.forEach((doll, i) => {
      const facing = i === 0 ? direction : labDirections[i - 1];
      doll.node.visible = !!clip?.descriptor.directions.includes(facing);
      if (!clip || !doll.node.visible) return;
      doll.node.scale.set(i === 0 ? 1.5 : 1);
      doll.node.position.set(i === 0 ? 384 : ((i - 1) % 4) * 192 + 96,
        i === 0 ? 274 : 320 + Math.floor((i - 1) / 4) * 192 + 172.8);
      const layers = doll.update(clip.descriptor.clip.action, frame, facing, appearance, 0, clip);
      if (i > 0) poses.push({ direction: facing, frame, layers });
    });
    this.labels.forEach((label, i) => { label.text = labDirections[i] + (clip?.descriptor.directions.includes(labDirections[i]) ? "" : " · 未注册"); });
    this.app.render();
    return poses;
  }
  destroy() { this.app.destroy(true, { children: true }); }
}
