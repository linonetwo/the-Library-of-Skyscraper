import {sampleMobilityPose} from "./mobilityPose";
import expeditionConfig from "../../shared/first-expedition.json";
import { DollRenderer, type DollTextures } from "./DollRenderer";
export type { DollTextures } from "./DollRenderer";
import type { WorldAssets } from "./worldAssets";
import type { Clip } from "./animationCatalog";
import type { LoadedAssetSet } from "./assetSetLoader";
import type { DollAppearance } from "./walkLayers";
import { cueActive as isCueActive, resolveAnimation } from "./resolveAnimation";
import { Container, Graphics, Rectangle, Text } from "pixi.js";
import { roleNames } from "./types";
import { inverse, project } from "./isoGeometry";
import type { Actor } from "./types";
import { ActorMotion, facing, type Point } from "./actorMotion";

export class ActorView {
  readonly node = new Container();
  readonly motion: ActorMotion;
  mobility?: {previous?:Actor;current:Actor;snap:boolean;tick:number};
  samplePose?: "NE" | "SW";
  sampleWalk = false;
  assetSet?: LoadedAssetSet;
  dollAppearance?: DollAppearance;
  private dollRenderer: DollRenderer;
  private doll: Container;
  private shadow = new Graphics()
    .ellipse(0, 1, 18, 9)
    .fill({ color: 0x102225, alpha: 0.23 });
  private halo = new Graphics();
  private health = new Graphics();
  private activity = new Graphics();
  simulationTime = 0;
  authoritativeAnimation = false;
  tickDuration = 500;
  gatherInterval = 2000;
  private attackAt = -10000;
  private actionTick = -1;
  private hitAt = -1000;
  private previousHp = 0;
  private status = new Text({
    text: "",
    style: {
      fontSize: 12,
      fill: 0xf3e3b6,
      stroke: { color: 0x102228, width: 3 },
    },
  });
  private actor: Actor;

  constructor(
    actor: Actor,
    position: Point,
    textures: DollTextures,
    onSelect: (id: string) => void,
    assets?: WorldAssets,
  ) {
    this.actor = actor;
    this.motion = new ActorMotion(position);
    this.dollRenderer = new DollRenderer(textures, assets);
    this.doll = this.dollRenderer.node;
    this.halo
      .ellipse(0, 0, 24, 12)
      .stroke({ color: 0xf5d18a, width: 2 })
      .fill({ color: 0xf5d18a, alpha: 0.15 });
    this.node.addChild(
      this.shadow,
      this.halo,
      this.doll,
      this.health,
      this.activity,
      this.status,
    );
    this.previousHp = actor.hp;
    this.status.anchor.set(0.5);
    this.status.position.set(0, -135);
    // Input follows the visible head/body column rather than transparent atlas cells.
    this.node.hitArea = new Rectangle(-20, -125, 40, 125);
    this.node.interactiveChildren = false;
    this.node.eventMode = "static";
    this.node.cursor = "pointer";
    this.node.on("pointertap", (event) => {
      event.stopPropagation();
      onSelect(actor.id);
    });
  }

  update(
    actor: Actor,
    selected: boolean,
    destination: Point,
    now: number,
    snap: boolean,
    path: Point[] = [],
    duration = 500,
  ) {
    if (actor.hp < this.previousHp) this.hitAt = now;
    this.previousHp = actor.hp;
    if (actor.actionTick !== this.actionTick) {
      if (actor.state === "fighting") this.attackAt = this.simulationTime;
      this.actionTick = actor.actionTick ?? -1;
    }
    this.actor = actor;
    if (!this.mobility) this.motion.move(
      destination, now, snap, path, actor.motionDistanceMilli,
      this.authoritativeAnimation
        ? (actor.travel?.speedMilliPerTick ?? expeditionConfig.speedMilliPerTick) / this.tickDuration
        : undefined,
      duration,
    );
    this.status.text =
      actor.hp <= 0
        ? "倒地"
        : actor.state === "retreating"
          ? "↩ 撤退"
          : actor.state === "gathering"
            ? `采集 · ${actor.cargo}/${actor.cargoCapacity}`
            : actor.state === "fighting"
              ? "⚔ 交战"
              : actor.cargo > 0
                ? `运输 ${actor.cargo}`
                : actor.task?.stage === "building"
                  ? "施工中"
                  : "";
    this.status.text = `${actor.owner.toUpperCase()} · ${roleNames[actor.role]}${this.status.text ? " · " + this.status.text : ""}`;
    this.status.style.fill = actor.owner === "p1" ? 0xc7e7c0 : 0xb1d7f3;
    this.doll.alpha = actor.hp <= 0 && !this.assetSet?.clips.down ? 0.45 : 1;
    this.doll.rotation =
      !this.authoritativeAnimation && actor.hp <= 0 && !this.assetSet?.clips.down ? -Math.PI / 2 : 0;
    this.halo.visible = selected;
    this.health
      .clear()
      .roundRect(-16, 5, 32, 3, 1)
      .fill(0x20353a)
      .roundRect(-16, 5, Math.max(0.1, (32 * actor.hp) / actor.maxHp), 3, 1)
      .fill(actor.hp > actor.maxHp * 0.35 ? 0xabcda0 : 0xe18c75);
  }

  render(now: number, simNow = this.simulationTime) {
    const mobility = this.mobility && sampleMobilityPose(this.mobility.previous,this.mobility.current,(simNow-this.mobility.tick*this.tickDuration)/this.tickDuration,this.mobility.snap);
    const pose = mobility ?? this.motion.sample(now);
    const selection = this.authoritativeAnimation
      ? resolveAnimation(
          mobility ? {...this.actor,locomotion:mobility.locomotion} : this.actor,
          simNow,
          {
            ...pose,
            moving: this.samplePose
              ? this.sampleWalk
              : pose.moving ||
                !!this.actor.travel ||
                this.actor.task?.stage === "approaching",
            worldPosition: mobility?.worldPosition ?? inverse(pose.x, pose.y),
            tickDurationMs: this.tickDuration,
          },
          this.assetSet?.catalog,
        )
      : undefined;
    this.node.position.set(pose.x, pose.y);
    this.node.zIndex = mobility ? project(mobility.worldPosition.x,mobility.worldPosition.y).y : pose.y;
    this.shadow.y = mobility ? (mobility.worldHeightMilli-mobility.supportHeightMilli)/1000*78.384 : 0;
    this.activity.clear();
    const cue = this.actor.actionCue;
    const cueActive = isCueActive(cue, simNow, this.tickDuration);
    const hit = selection
      ? selection.impact
      : cue?.kind === "hit"
        ? !!cueActive
        : now - this.hitAt < 350;
    if (cueActive && cue?.targetPosition && !this.actor.travel) {
      pose.direction = facing(
        pose,
        project(cue.targetPosition.x, cue.targetPosition.y),
      );
      this.motion.direction = pose.direction;
    }
    this.doll.tint = hit ? 0xff937f : 0xffffff;
    if (hit && !this.assetSet?.clips.hit)
      this.activity
        .circle(0, -55, 40)
        .stroke({ color: 0xf49a80, width: 3, alpha: 0.7 });
    if (this.actor.cargo > 0 && !this.assetSet?.clips.carry &&
        !this.assetSet?.clips[selection?.clip ?? (pose.moving ? "walk" : "idle")]?.rig)
      this.activity
        .roundRect(14, -40, 13, 18, 3)
        .fill(0xc9a56d)
        .stroke({ color: 0xf3dfb7, width: 1 });
    if (
      this.actor.state === "gathering" &&
      (!selection || selection.requestedClip === "collect")
    )
      this.activity
        .arc(
          0,
          0,
          23,
          -Math.PI / 2,
          -Math.PI / 2 +
            Math.PI *
              2 *
              (((simNow - (this.actor.actionTick ?? 0) * this.tickDuration) %
                this.gatherInterval) /
                this.gatherInterval),
        )
        .stroke({ color: 0xdac489, width: 3 });
    if (
      !this.assetSet?.clips.attack &&
      ((cue?.kind === "attack" && cueActive) ||
        (!cue &&
          this.actor.state === "fighting" &&
          simNow - this.attackAt < 300))
    )
      this.activity
        .moveTo(20, -55)
        .lineTo(40, -85)
        .stroke({ color: 0xf3d28a, width: 3 });
    const action: Clip = selection?.clip ?? (pose.moving ? "walk" : "idle");
    const frame = selection?.frame ?? pose.frame;
    const registration = this.assetSet?.clips[action];
    this.shadow.alpha = action === "down" && registration ? 0.15 : 1;
    const released = registration?.timing.releaseFrame;
    const cargo =
      this.actor.cargo ||
      (selection?.requestedClip === "unload" &&
      released !== undefined &&
      frame < released
        ? 1
        : 0);
    const textures = this.dollRenderer.update(
      action,
      frame,
      selection?.direction ?? pose.direction,
      this.dollAppearance ?? this.actor.appearance,
      cargo,
      registration,
    );
    return {
      id: this.actor.id,
      ...pose,
      worldPosition: mobility?.worldPosition ?? this.actor.worldPosition,
      worldHeightMilli: mobility?.worldHeightMilli,
      supportHeightMilli: mobility?.supportHeightMilli,
      authoritativeLocomotion: this.actor.locomotion,
      authoritativeWorldPosition: this.actor.worldPosition,
      authoritativeWorldHeightMilli: this.actor.worldHeightMilli,
      presentationProgress: mobility?.locomotion?.progress,
      direction: selection?.direction ?? pose.direction,
      frame: selection?.frame ?? pose.frame,
      animation: action,
      requestedAnimation: selection?.requestedClip,
      requestedFacing: selection?.direction ?? pose.direction,
      clipFacing: selection?.direction ?? pose.direction,
      requestedDirections: selection ? this.assetSet?.clips[selection.requestedClip]?.descriptor.directions : undefined,
      clipDirections: registration?.descriptor.directions,
      motionDistanceMilli: pose.motionDistanceMilli,
      textures,
    };
  }
}
