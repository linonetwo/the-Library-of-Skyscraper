import { Container, Graphics, Text } from "pixi.js";
import { ActorMotion } from "./actorMotion";
import { DollRenderer } from "./DollRenderer";
import { loadAssetSet, loadClipLayers, type AssetSetIndex, type LoadedAssetSet } from "./assetSetLoader";
import { project } from "./isoGeometry";
import { resolveAnimation } from "./resolveAnimation";
import type { Snapshot } from "./types";

type Enemy = NonNullable<Snapshot["enemies"]>[number];
type View = { node: Container; doll: DollRenderer; motion: ActorMotion; enemy: Enemy; title: Text; bar: Graphics };
const appearance = { outfit: "none", hair: "none", weapon: false } as const;
export async function loadEnemyAssets(): Promise<LoadedAssetSet> {
  const index: AssetSetIndex = await fetch("/assets/iso-v030-enemy-eight-final-1f8e013/index.json").then(r => r.json());
  const assets = await loadAssetSet(index);
  await Promise.all(Object.values(assets.clips).map(clip => loadClipLayers(clip!, ["body", "body-front"])));
  return assets;
}

/** Receives the battlefield simulation time; owns no presentation clock. */
export class EnemyScene {
  private views = new Map<string, View>();
  private session = "";
  private tick = -1;
  private tickMs = 500;
  constructor(private parent: Container, private assets: LoadedAssetSet) {}
  update(snapshot: Snapshot, simulationTime: number) {
    const snap = snapshot.sessionId !== this.session || snapshot.tick < this.tick || snapshot.tick > this.tick + 1 || snapshot.paused;
    this.session = snapshot.sessionId;
    this.tick = snapshot.tick;
    this.tickMs = snapshot.tickDurationMs || 500;
    const enemies = (snapshot.simulationVersion ?? 0) >= 4 ? snapshot.enemies ?? [] : [];
    const ids = new Set(enemies.map(enemy => enemy.id));
    for (const [id, view] of this.views) if (!ids.has(id)) {
      view.node.destroy({ children: true });
      this.views.delete(id);
    }
    for (const enemy of enemies) {
      const position = project(enemy.worldPosition.x, enemy.worldPosition.y);
      let view = this.views.get(enemy.id);
      if (!view) {
        const node = new Container(), doll = new DollRenderer({});
        node.label = "enemy:" + enemy.id;
        const title = new Text({text: "", style: {fontSize: 13, fill: 0xf4ad98, stroke: {color:0x132c30,width:4}}});
        title.anchor.set(.5);
        title.y = -107;
        const bar = new Graphics();
        node.addChild(new Graphics().ellipse(0,1,19,9.5).fill({color:0x081b22,alpha:.3}),doll.node,title,bar);
        this.parent.addChild(node);
        view = {node,doll,motion:new ActorMotion(position,this.tickMs),enemy,title,bar};
        this.views.set(enemy.id,view);
        view.motion.move(position,simulationTime,true,[],enemy.motionDistanceMilli ?? 0);
      }
      view.enemy = enemy;
      view.motion.duration = this.tickMs;
      view.motion.move(position,simulationTime,snap,[],enemy.motionDistanceMilli ?? 0);
      view.title.text = enemy.hp <= 0 ? "守卫已倒地" : "敌方 · 书库守卫";
      view.bar.clear().rect(-26,-94,52,5).fill(0x173438).rect(-26,-94,52*Math.max(0,enemy.hp/enemy.maxHp),5).fill(0xe8907d);
    }
  }
  render(simulationTime: number) {
    return [...this.views.values()].map(view => {
      const motion = view.motion.sample(simulationTime);
      const resolved = resolveAnimation(view.enemy,simulationTime,{
        moving:motion.moving,direction:motion.direction,tickDurationMs:this.tickMs,
        worldPosition:view.enemy.worldPosition,motionDistanceMilli:motion.motionDistanceMilli,
      },this.assets.catalog);
      view.node.position.set(motion.x,motion.y);
      view.node.zIndex = motion.y;
      const textures = view.doll.update(resolved.clip,resolved.frame,resolved.direction,appearance,0,this.assets.clips[resolved.clip]);
      return {id:view.enemy.id,...resolved,textures,x:motion.x,y:motion.y};
    });
  }
  destroy() {
    for (const view of this.views.values()) view.node.destroy({children:true});
    this.views.clear();
  }
}
