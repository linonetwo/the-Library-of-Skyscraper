import { project } from "./isoGeometry";
import { Container } from "pixi.js";
import { ActorView, type DollTextures } from "./ActorView";
import type { MapProps } from "./mapScene";
import { actorSlot, mapLayout } from "./mapLayout";

export class ActorScene {
  readonly node:Container;
  private views = new Map<string, ActorView>();
  private session = "";
  private tick = -1;
  private rooms=new Map<string,string>();
  constructor(private textures: DollTextures,node=new Container({sortableChildren:true})) {this.node=node;}

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
      const group=snapshot.actors.filter(unit=>unit.roomId===actor.roomId).sort((a,b)=>a.id.localeCompare(b.id));
      const position=actorSlot(room,group.findIndex(unit=>unit.id===actor.id));
      let view = this.views.get(actor.id);
      if (!view) {
        view = new ActorView(actor, position, this.textures, props.onSelect);
        this.views.set(actor.id, view);
        view.node.label="actor:"+actor.id;
        this.node.addChild(view.node);
      }
      const previous=this.rooms.get(actor.id);
      const link=mapLayout(snapshot.rooms).links.find(l=>(l.from===previous&&l.to===actor.roomId)||(l.to===previous&&l.from===actor.roomId));
      const path=previous!==actor.roomId&&link?(link.from===previous?link.points:[...link.points].reverse()).map(p=>project(p.x,p.y)):[];
      view.update(actor, actor.id === props.selected, position, now, snap,path);
      this.rooms.set(actor.id,actor.roomId);
    }
  }

  render(now: number) {
    const poses = [...this.views.values()].map(view => view.render(now));
    return poses;
  }
}
