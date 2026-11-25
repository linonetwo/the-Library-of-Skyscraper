import {fitMap,type Bounds} from './mapCamera';
import type {GridPoint} from './isoGeometry';
export type FocusIntent={kind:'actor'|'room';id:string;revision:number}|{kind:'overview';revision:number};
type Mode={kind:'overview'}|{kind:'actor';id:string}|{kind:'room';id:string}|{kind:'manual';center:GridPoint};
export class CameraController {
 mode:Mode={kind:'overview'};scale=1;private revision=-1;private zoom=1;
 transform={x:0,y:0,scale:1};
 focus(intent:FocusIntent|undefined){if(intent&&intent.revision!==this.revision){this.revision=intent.revision;if(intent.kind==='overview')this.overview();else this.mode={kind:intent.kind,id:intent.id};this.scale=1;}}
 apply(bounds:Bounds,width:number,height:number,zoom:number,actor:(id:string)=>GridPoint|undefined,room:(id:string)=>GridPoint|undefined){
  this.zoom=zoom;
  if(this.mode.kind==='overview')this.transform=fitMap(bounds,width,height,zoom);
  else {const center=this.mode.kind==='manual'?this.mode.center:this.mode.kind==='actor'?actor(this.mode.id):room(this.mode.id);const scale=Math.max(.7,Math.min(1,width/900))*zoom*this.scale;if(center)this.transform={x:width/2-center.x*scale,y:height*.47-center.y*scale,scale};}
  return this.transform;
 }
 pan(dx:number,dy:number,width:number,height:number){const t=this.transform;this.scale=t.scale/(Math.max(.7,Math.min(1,width/900))*this.zoom);this.mode={kind:'manual',center:{x:(width/2-t.x-dx)/t.scale,y:(height*.47-t.y-dy)/t.scale}};}
 wheel(x:number,y:number,delta:number,width:number,height:number,zoom:number){const t=this.transform;const world={x:(x-t.x)/t.scale,y:(y-t.y)/t.scale};const scale=Math.max(.35,Math.min(2.5,t.scale*Math.exp(-delta*.001)));this.scale=scale/(Math.max(.7,Math.min(1,width/900))*zoom);this.mode={kind:'manual',center:{x:world.x+(width/2-x)/scale,y:world.y+(height*.47-y)/scale}};}
 overview(){this.mode={kind:'overview'};this.scale=1;}
}
