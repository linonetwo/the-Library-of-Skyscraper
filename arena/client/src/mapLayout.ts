import { project, type GridPoint } from './isoGeometry';
import type { Room } from './types';
export type FloorTile = GridPoint & {roomId:string; corridor?:boolean};
export const roomCenter=(q:number,r:number):GridPoint=>({x:8*q+4*r,y:8*r});
export function corridor(from:GridPoint,to:GridPoint) {
 const points:GridPoint[]=[from];let {x,y}=from;
 while(x!==to.x || y!==to.y){
  if(x!==to.x){x+=Math.sign(to.x-x);points.push({x,y});}
  if(y!==to.y){y+=Math.sign(to.y-y);points.push({x,y});}
 }
 return points;
}
export function mapLayout(rooms:Room[]) {
 const tiles=new Map<string,FloorTile>();
 const links:{from:string;to:string;points:GridPoint[]}[]=[];
 for(const room of rooms){const center=roomCenter(room.q,room.r);
  for(let x=-2;x<=2;x++)for(let y=-2;y<=2;y++){
   const tile={x:center.x+x,y:center.y+y,roomId:room.id};tiles.set(`${tile.x},${tile.y}`,tile);
  }
 }
 for(let i=0;i<rooms.length;i++)for(let j=i+1;j<rooms.length;j++){
  const a=rooms[i],b=rooms[j],q=a.q-b.q,r=a.r-b.r;
  if((Math.abs(q)+Math.abs(r)+Math.abs(q+r))/2!==1)continue;
  const points=corridor(roomCenter(a.q,a.r),roomCenter(b.q,b.r));
  links.push({from:a.id,to:b.id,points});
  points.forEach((p,index)=>{const key=`${p.x},${p.y}`;if(!tiles.has(key))tiles.set(key,{...p,roomId:index<points.length/2?a.id:b.id,corridor:true});});
 }
 return {tiles:[...tiles.values()],links};
}
export function actorSlot(room:Room,index:number) {
 const p=roomCenter(room.q,room.r);
 return project(p.x+(index%3-1)*0.65,p.y+(Math.floor(index/3)-0.5)*0.65);
}
