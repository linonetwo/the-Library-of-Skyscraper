export type Bounds={minX:number;minY:number;maxX:number;maxY:number};
export function fitMap(bounds:Bounds,width:number,height:number,zoom=1,padding=36){
 const scale=Math.min(Math.max(1,width-padding*2)/(bounds.maxX-bounds.minX),Math.max(1,height-padding*2)/(bounds.maxY-bounds.minY))*zoom;
 return {scale,x:width/2-scale*(bounds.minX+bounds.maxX)/2,y:height/2-scale*(bounds.minY+bounds.maxY)/2};
}
