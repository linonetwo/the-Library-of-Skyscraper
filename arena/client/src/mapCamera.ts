export type Bounds={minX:number;minY:number;maxX:number;maxY:number};
export function fitMap(bounds:Bounds,width:number,height:number,zoom=1,padding=36){
 const scale=Math.min(Math.max(1,width-padding*2)/(bounds.maxX-bounds.minX),Math.max(1,height-padding*2)/(bounds.maxY-bounds.minY))*zoom;
 return {scale,x:width/2-scale*(bounds.minX+bounds.maxX)/2,y:height/2-scale*(bounds.minY+bounds.maxY)/2};
}

/** Balance the actor's room and its nearest reachable neighbor without shrinking dolls. */
export function localRoomFocus(actor:{x:number;y:number},centers:{x:number;y:number}[],room:{x:number;y:number},viewport:{width:number;height:number},scale:number){
 const neighbor=centers.filter(p=>p.x!==room.x||p.y!==room.y).sort((a,b)=>Math.hypot(a.x-room.x,a.y-room.y)-Math.hypot(b.x-room.x,b.y-room.y))[0]??room;
 const bounds={minX:Math.min(room.x,neighbor.x)-192,maxX:Math.max(room.x,neighbor.x)+192,minY:Math.min(room.y,neighbor.y)-144,maxY:Math.max(room.y,neighbor.y)+112};
 const target={x:(bounds.minX+bounds.maxX)/2,y:(bounds.minY+bounds.maxY)/2};
 // Keep the followed feet within the central safe zone while exposing nearby floor.
 const maxX=viewport.width*.2/scale,maxY=viewport.height*.18/scale;
 return {x:actor.x+Math.max(-maxX,Math.min(maxX,target.x-actor.x)),y:actor.y+Math.max(-maxY,Math.min(maxY,target.y-actor.y))};
}
