import { Container, Graphics, Text, Sprite, Polygon, Texture } from "pixi.js";
import type { Snapshot } from "./types";
import { project, diamond } from "./isoGeometry";
import { mapLayout, roomCenter } from "./mapLayout";
export type MapProps = {
  focusIntent?:import("./cameraController").FocusIntent;
  snapshot: Snapshot | null;
  selected: string | null;
  selectedRoom: string | null;
  zoom: number;
  showRoutes: boolean;
  onSelect: (id: string) => void;
  onRoom: (id: string) => void;
};

export function paintMap(ground:Container,p:MapProps,entities:Container,textures:Record<string,Texture>) {
 const snapshot=p.snapshot;if(!snapshot)return;
 const layout=mapLayout(snapshot.rooms);
 const occupied=new Set(layout.tiles.map(t=>`${t.x},${t.y}`));
 const foundations=new Graphics();
 for(const tile of layout.tiles){const p=project(tile.x,tile.y);
  // Only exposed front edges receive a low foundation; shared seams stay flat.
  for(const [dx,dy,a,b] of [[1,0,{x:p.x+64,y:p.y},{x:p.x,y:p.y+32}],[0,1,{x:p.x,y:p.y+32},{x:p.x-64,y:p.y}]] as const){
   if(occupied.has(`${tile.x+dx},${tile.y+dy}`))continue;
   foundations.poly([a.x,a.y,b.x,b.y,b.x,b.y+16,a.x,a.y+16]).fill(dx?0x3e4137:0x756753);
   foundations.moveTo(a.x,a.y+20).lineTo(b.x,b.y+20).stroke({color:0x081e20,width:7,alpha:.18});
  }
 }
 foundations.eventMode='none';ground.addChild(foundations);
 for(const tile of layout.tiles){
  const point=project(tile.x,tile.y);
  const sprite=new Sprite(textures[tile.corridor?'floor-worn':(tile.x+tile.y)%4===0?'floor-inlay':'floor-stone']);
  sprite.anchor.set(.5);sprite.position.copyFrom(point);
  sprite.hitArea=new Polygon(diamond(0,0));sprite.eventMode='static';sprite.cursor='pointer';
  sprite.on('pointertap',()=>p.onRoom(tile.roomId));ground.addChild(sprite);
  if(p.selectedRoom===tile.roomId)ground.addChild(new Graphics().poly(diamond(point.x,point.y)).fill({color:0xe3c286,alpha:.17}).stroke({color:0xe3c286,alpha:.35,width:1}));
 }
 if(p.showRoutes){const routes=new Graphics();for(const link of layout.links){link.points.forEach((v,i)=>{const v2=project(v.x,v.y);if(i===0)routes.moveTo(v2.x,v2.y);else routes.lineTo(v2.x,v2.y);});routes.stroke({color:0xf2d493,width:2,alpha:.3});}ground.addChild(routes);}
 for(const room of snapshot.rooms){
  const c=roomCenter(room.q,room.r);
  const point=project(c.x,c.y);
  const title=new Text({text:room.name+' · '+(room.enemyHp>0?'威胁 '+room.enemyHp:room.kind==='resource'?'藏材 '+room.resources:room.kind==='catalog'?'编目目标':'书苑'),style:{fontSize:16,fill:0x3c493c,dropShadow:{color:0xf4e4bd,blur:2,distance:1}}});
  title.anchor.set(.5);title.position.set(point.x,point.y+110);title.eventMode='none';const plaque=new Graphics().roundRect(point.x-title.width/2-7,point.y+99,title.width+14,24,4).fill({color:0xf0e4c6,alpha:.72});plaque.eventMode='none';ground.addChild(plaque,title);
  for(const [dx,dy] of [[-2,-2],[-1,-2],[2,-2]]){
   if(layout.links.some(link=>link.points.some(p=>p.x===c.x+dx&&p.y===c.y+dy)))continue;
   const foot=project(c.x+dx,c.y+dy);
   const prop=new Sprite(textures['bookcase-u']);prop.anchor.set(.5,160/192);prop.position.copyFrom(foot);prop.zIndex=foot.y;prop.eventMode='none';prop.label='shelf:'+room.id+':'+dx;entities.addChild(prop);
  }
  if(snapshot.buildings.some(b=>b.roomId===room.id)||room.kind==='catalog'){
   const foot=project(c.x+1.5,c.y+1);const prop=new Sprite(textures[room.kind==='catalog'?'lectern':'plinth']);prop.anchor.set(.5,160/192);prop.position.copyFrom(foot);prop.zIndex=foot.y;prop.eventMode='none';entities.addChild(prop);
  }
 }
}
