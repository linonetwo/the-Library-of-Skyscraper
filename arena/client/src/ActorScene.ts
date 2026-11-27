import { SimulationClock } from "./SimulationClock";
import { project } from "./isoGeometry";
import { Container } from "pixi.js";
import { ActorView, type DollTextures } from "./ActorView";
import type { MapProps } from "./mapScene";
import { actorSlot, mapLayout } from "./mapLayout";

export class ActorScene {
  readonly node: Container;
  private views = new Map<string, ActorView>();
  private previousActors = new Map<string, import("./types").Actor>();
  private snapshotActors = new Map<string, import("./types").Actor>();
  private session = "";
  private tick = -1;
  private clock = new SimulationClock();
  private rooms = new Map<string, string>();
  constructor(
    private textures: DollTextures,
    node = new Container({ sortableChildren: true }),
    private assets?: import("./worldAssets").WorldAssets,
  ) {
    this.node = node;
  }

  update(props: MapProps, now: number) {
    const snapshot = props.snapshot;
    if (!snapshot) return;
    this.clock.update(snapshot, now);
    const isV3 = (snapshot.simulationVersion ?? 0) >= 3;
    const snap =
      snapshot.sessionId !== this.session ||
      snapshot.tick < this.tick ||
      snapshot.tick > this.tick + 1 ||
      snapshot.paused;
    if (snapshot.sessionId !== this.session || snapshot.tick !== this.tick) this.previousActors = this.snapshotActors;
    this.snapshotActors = new Map(snapshot.actors.map((a) => [a.id, a]));
    if (snap) this.previousActors = this.snapshotActors;
    this.session = snapshot.sessionId;
    this.tick = snapshot.tick;
    const ids = new Set(snapshot.actors.map((actor) => actor.id));
    for (const [id, view] of this.views) {
      if (!ids.has(id)) {
        view.node.destroy({ children: true });
        this.views.delete(id);
      }
    }
    for (const actor of snapshot.actors) {
      const room = snapshot.rooms.find((room) => room.id === actor.roomId)!;
      const group = snapshot.actors
        .filter((unit) => unit.roomId === actor.roomId)
        .sort((a, b) => a.id.localeCompare(b.id));
      const position =
        isV3 && actor.worldPosition
          ? project(actor.worldPosition.x, actor.worldPosition.y)
          : actorSlot(
              room,
              group.findIndex((unit) => unit.id === actor.id),
            );
      let view = this.views.get(actor.id);
      if (!view) {
        view = new ActorView(
          actor,
          position,
          this.textures,
          props.onSelect,
          this.assets,
        );
        this.views.set(actor.id, view);
        view.node.label = "actor:" + actor.id;
        this.node.addChild(view.node);
      }
      const previous = this.rooms.get(actor.id);
      const link = mapLayout(snapshot.rooms).links.find(
        (l) =>
          (l.from === previous && l.to === actor.roomId) ||
          (l.to === previous && l.from === actor.roomId),
      );
      const path =
        previous !== actor.roomId && link
          ? (link.from === previous
              ? link.points
              : [...link.points].reverse()
            ).map((p) => project(p.x, p.y))
          : [];
      view.mobility = (snapshot.simulationVersion ?? 0) >= 7 ? {previous:this.previousActors.get(actor.id),current:actor,snap,tick:snapshot.tick} : undefined;
      view.simulationTime = this.clock.sample(now);
      view.authoritativeAnimation = (snapshot.simulationVersion ?? 0) >= 4;
      view.tickDuration = snapshot.tickDurationMs || 500;
      view.tacticalState=snapshot.tactics?.actorStates.find(state=>state.actorId===actor.id);
      const cast=view.tacticalState?.cast;
      const release=cast&&snapshot.events.find(event=>event.tick===cast.releaseTick&&event.tactical?.actorId===actor.id&&event.tactical.phase==='released'&&event.tactical.targetPosition);
      view.tacticalTargetPosition=release?.tactical?.targetPosition??snapshot.enemies?.find(enemy=>enemy.id===cast?.targetId)?.worldPosition;
      view.gatherInterval =
        (snapshot.scenarioConfig?.gatherIntervalTicks ?? 4) * view.tickDuration;
      view.samplePose = props.samplePose;
      view.sampleWalk = props.sampleWalk ?? false;
      view.assetSet = props.assetSet;
      view.dollAppearance = props.dollAppearance;
      view.update(
        actor,
        actor.id === props.selected,
        position,
        now,
        snap,
        isV3 ? [] : path,
        isV3 ? snapshot.tickDurationMs || 500 : 450,
      );
      this.rooms.set(actor.id, actor.roomId);
    }
  }

  simulationTime(now: number) {
    return this.clock.sample(now);
  }

  render(now: number) {
    const poses = [...this.views.values()].map((view) =>
      view.render(now, this.clock.sample(now)),
    );
    return poses.map((pose) => ({
      ...pose,
      task: this.snapshotActors.get(pose.id)?.task,
      travel: this.snapshotActors.get(pose.id)?.travel,
      worldPosition: pose.worldPosition,
    }));
  }
}
