import { Container } from "pixi.js";
import { ActorView, type DollTextures } from "./ActorView";
import type { MapProps } from "./mapScene";
import { floorPoint } from "./libraryLayout";

export class ActorScene {
  readonly node = new Container({ sortableChildren: true });
  private views = new Map<string, ActorView>();
  private session = "";
  private tick = -1;
  constructor(private textures: DollTextures) {}

  update(props: MapProps, now: number) {
    const snapshot = props.snapshot;
    if (!snapshot) return;
    const snap = snapshot.sessionId !== this.session || snapshot.tick < this.tick;
    this.session = snapshot.sessionId;
    this.tick = snapshot.tick;
    const ids = new Set(snapshot.actors.map(actor => actor.id));
    for (const [id, view] of this.views) {
      if (!ids.has(id)) { view.node.destroy({ children: true }); this.views.delete(id); }
    }
    for (const actor of snapshot.actors) {
      const room = snapshot.rooms.find(room => room.id === actor.roomId)!;
      const point = floorPoint(room.q, room.r);
      const group = snapshot.actors.filter(unit => unit.roomId === actor.roomId);
      const position = {
        x: point.x + (group.findIndex(unit => unit.id === actor.id) - (group.length - 1) / 2) * 39,
        y: point.y + 4,
      };
      let view = this.views.get(actor.id);
      if (!view) {
        view = new ActorView(actor, position, this.textures, props.onSelect);
        this.views.set(actor.id, view);
        this.node.addChild(view.node);
      }
      view.update(actor, actor.id === props.selected, position, now, snap);
    }
  }

  render(now: number) {
    const poses = [...this.views.values()].map(view => view.render(now));
    return poses;
  }
}
