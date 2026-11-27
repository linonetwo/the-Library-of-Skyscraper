import {Assets,Container,Graphics,Sprite,type Texture} from 'pixi.js';
import type {AtlasDescriptor} from './assetSetLoader';
import {clipDuration,frameAt,type ClipTiming} from './animationTiming';
import {inkRelease} from './tacticalAnimation';
import {project} from './isoGeometry';
import type {Snapshot} from './types';
type InkDescriptor=Pick<AtlasDescriptor,'groundPivot'|'renderScale'|'layers'>&{clip:ClipTiming};
type ReleasePose={id:string;castReleaseTip?:{x:number;y:number}};
/** A separate ground atlas: its source already has the correct 2:1 ellipse. */
export async function loadGroundInk(){
 const root='/assets/iso-v070-combat-study/ink-fx';
 const response=await fetch(root+'/atlas-budget.json');
 if(!response.ok)throw new Error(`墨印资源 ${response.status}`);
 const descriptor:InkDescriptor=await response.json();
 const sheets=await Promise.all(descriptor.layers.filter(layer=>layer.active).flatMap(layer=>layer.pages.map(page=>Assets.load(root+'/'+page.json))));
 return {descriptor,textures:Object.assign({},...sheets.map(sheet=>sheet.textures)) as Record<string,Texture>};
}
export class GroundInkEffects{
 private nodes=new Map<number,{node:Container;ink:Sprite;ray:Graphics}>();
 constructor(private parent:Container,private assets:Awaited<ReturnType<typeof loadGroundInk>>){}
 update(snapshot:Snapshot,simTimeMs:number,poses:readonly ReleasePose[]){
  const visible=new Set<number>(),report:{eventId:number;frame:number;x:number;y:number}[]=[];
  const {descriptor,textures}=this.assets,duration=clipDuration(descriptor.clip);
  for(const event of snapshot.events){
   const point=inkRelease(event.tactical),elapsed=simTimeMs-event.tick*(snapshot.tickDurationMs??500);
   if(!point||elapsed<0||elapsed>=duration)continue;
   visible.add(event.id);
   let view=this.nodes.get(event.id);
   if(!view){const node=new Container(),ray=new Graphics(),ink=new Sprite();node.eventMode='none';node.addChild(ray,ink);this.parent.addChild(node);view={node,ray,ink};this.nodes.set(event.id,view);}
   const frame=frameAt(descriptor.clip,elapsed),target=project(point.x,point.y),texture=textures[`inkFx/ink/ground/${String(frame).padStart(2,'0')}`];
   view.ink.texture=texture;
   view.ink.anchor.set(descriptor.groundPivot[0]/texture.orig.width,descriptor.groundPivot[1]/texture.orig.height);
   view.ink.scale.set(descriptor.renderScale);view.ink.position.copyFrom(target);
   view.ray.clear();
   const tip=poses.find(pose=>pose.id===event.tactical!.actorId)?.castReleaseTip;
   if(tip&&elapsed<125){const u=elapsed/125;view.ray.moveTo(tip.x,tip.y).lineTo(tip.x+(target.x-tip.x)*u,tip.y+(target.y-tip.y)*u).stroke({color:0x5d7775,width:2,alpha:1-u});}
   report.push({eventId:event.id,frame,...point});
  }
  for(const [id,view]of this.nodes)if(!visible.has(id)){view.node.destroy({children:true});this.nodes.delete(id);}
  return report;
 }
}
