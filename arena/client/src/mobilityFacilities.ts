import { Container, Graphics, MeshSimple, Rectangle, Text, Texture } from "pixi.js";
import { project } from "./isoGeometry";
import type { Point3Milli } from "./mobilityTypes";
import type { Snapshot } from "./types";

export const mobilityPoint = (p: Point3Milli) => project(p.x / 1000, p.y / 1000, p.z / 1000);
type Screen = { x: number; y: number };
const gold = 0xd7b66e;
// One crop per loaded atlas texture, retained with that atlas's lifetime.
const timberCrops = new WeakMap<Texture, Texture>();
function timber(textures: Record<string, Texture>) {
  const source = textures["bookcase-u"];
  if (!source) return textures["low-wall-u"];
  let crop = timberCrops.get(source);
  if (!crop) {
    crop = new Texture({ source: source.source,
      frame: new Rectangle(source.frame.x + 24, source.frame.y + 54, 8, 80) });
    timberCrops.set(source, crop);
  }
  return crop;
}
function quad(layer: Container, points: Screen[], texture: Texture | undefined, tint = 0xffffff) {
  if (texture) {
    const mesh = new MeshSimple({ texture, vertices: new Float32Array(points.flatMap(p => [p.x, p.y])),
      uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), indices: new Uint32Array([0, 1, 2, 0, 2, 3]) });
    mesh.autoUpdate = false; mesh.tint = tint; mesh.eventMode = "none"; layer.addChild(mesh);
  } else layer.addChild(new Graphics().poly(points.flatMap(p => [p.x, p.y])).fill(0x93633a));
  layer.addChild(new Graphics().poly(points.flatMap(p => [p.x, p.y])).stroke({ color: 0x483323, width: 1, alpha: .8 }));
}
function beam(layer: Container, a: Screen, b: Screen, width: number, texture: Texture | undefined, tint = 0xffffff) {
  const length = Math.hypot(b.x-a.x, b.y-a.y) || 1;
  const nx = -(b.y-a.y)/length*width/2, ny = (b.x-a.x)/length*width/2;
  quad(layer, [{x:a.x+nx,y:a.y+ny},{x:b.x+nx,y:b.y+ny},{x:b.x-nx,y:b.y-ny},{x:a.x-nx,y:a.y-ny}], texture, tint);
}
const offset = (p: Point3Milli, x: number, y: number, z = 0): Point3Milli => ({x:p.x+x,y:p.y+y,z:p.z+z});
function deck(layer: Container, from: Point3Milli, to: Point3Milli, width: number, wood: Texture | undefined) {
  const length = Math.hypot(to.x-from.x,to.y-from.y); if (!length) return;
  const nx=-(to.y-from.y)/length*width/2, ny=(to.x-from.x)/length*width/2;
  const a=offset(from,nx,ny), b=offset(to,nx,ny), c=offset(to,-nx,-ny), d=offset(from,-nx,-ny);
  // Dark fascia below the near side establishes thickness without moving the walking surface.
  quad(layer,[c,d,offset(d,0,0,-100),offset(c,0,0,-100)].map(mobilityPoint),wood,0x9b7955);
  const boards=Math.max(1,Math.ceil(length/250));
  for(let i=0;i<boards;i++) {
    const p=(u:number)=>offset(from,(to.x-from.x)*u,(to.y-from.y)*u,(to.z-from.z)*u);
    quad(layer,[offset(p(i/boards),nx,ny),offset(p((i+1)/boards),nx,ny),offset(p((i+1)/boards),-nx,-ny),offset(p(i/boards),-nx,-ny)].map(mobilityPoint),wood,i%2?0xf1d8ad:0xffebc6);
  }
  for(const [start,end] of [[a,b],[d,c]]) beam(layer,mobilityPoint(start),mobilityPoint(end),3,wood,0xb78d4b);
}
function selectable(layer:Container, points:Screen[], edgeId:string, onSelect:(id:string)=>void) {
  const hit=new Graphics();
  for(let i=1;i<points.length;i++)hit.moveTo(points[i-1].x,points[i-1].y).lineTo(points[i].x,points[i].y).stroke({color:gold,width:32,alpha:.001});
  hit.eventMode="static";hit.cursor="pointer";hit.on("pointertap",e=>{e.stopPropagation();onSelect(edgeId);});layer.addChild(hit);
}
function label(layer:Container,text:string,p:Screen) {
  const node=new Text({text,style:{fontFamily:"serif",fontSize:12,fill:gold,stroke:{color:0x10262b,width:4}}});
  node.anchor.set(.5,1);node.position.set(p.x,p.y-18);node.eventMode="none";layer.addChild(node);
}
/** Static structures use the authority's XYZ surfaces; no animation or movement is simulated here. */
export function paintMobilityFacilities(layer: Container, snapshot: Snapshot, textures: Record<string, Texture>, onSelect: (edgeId: string) => void) {
  const wood=timber(textures);
  for(const edge of snapshot.worldMap?.mobilityEdges??[]) {
    const structure=new Container();structure.eventMode="passive";layer.addChild(structure);
    for(const support of edge.supports??[]) {
      for(const end of [support.from,support.to]) {
        const foot=mobilityPoint({...end,z:0}),top=mobilityPoint(end);
        structure.addChild(new Graphics().ellipse(foot.x,foot.y,15,6).fill({color:0x102321,alpha:.25}));
        beam(structure,foot,top,9,wood,0xb88f66);
        const brace=mobilityPoint(offset(end,0,350,-350));beam(structure,brace,top,6,wood,0xb88f66);
      }
      deck(structure,support.from,support.to,support.widthMilli,wood);
    }
    for(const segment of edge.segments) {
      if(segment.role!=="ladder")continue;
      const facing=segment.ladderFacing??{x:0,y:1};const norm=Math.hypot(facing.x,facing.y)||1;
      const nx=-facing.y/norm*220,ny=facing.x/norm*220;
      // Width is perpendicular to the registered ladder face in WORLD XY.
      for(const sign of [-1,1])beam(structure,mobilityPoint(offset(segment.from,nx*sign,ny*sign)),mobilityPoint(offset(segment.to,nx*sign,ny*sign)),5,wood);
      const low=Math.min(segment.from.z,segment.to.z),high=Math.max(segment.from.z,segment.to.z);
      for(let z=low;z<=high;z+=250){const p={...segment.from,z};beam(structure,mobilityPoint(offset(p,nx,ny)),mobilityPoint(offset(p,-nx,-ny)),4,wood,0xf4d9a7);}
      const foot={...segment.from,z:low},top={...segment.to,z:high};
      deck(structure,offset(foot,-facing.x/norm*220,-facing.y/norm*220),offset(foot,facing.x/norm*220,facing.y/norm*220),600,wood);
      deck(structure,top,offset(top,facing.x/norm*500,facing.y/norm*500),650,wood);
    }
    const first=edge.segments[0]?.from,last=edge.segments.at(-1)?.to;
    if(!first||!last)continue;
    if(edge.kind==="jump") {
      const distance=Math.hypot(last.x-first.x,last.y-first.y),dx=(last.x-first.x)/distance,dy=(last.y-first.y)/distance;
      for(const [p,sign] of [[first,-1],[last,1]] as const){
        deck(structure,offset(p,dx*sign*600,dy*sign*600),p,900,wood);
        const side={x:-dy*450,y:dx*450};
        // Uneven short end-grain marks read as a broken lip, never a bridge across the gap.
        for(const k of [-.65,0,.65])beam(structure,mobilityPoint(offset(p,side.x*k,side.y*k)),mobilityPoint(offset(p,side.x*k-dx*sign*90,side.y*k-dy*sign*90,-55)),3,wood);
      }
    }
    for(const [index,p] of [first,last].entries()) {
      const screen=mobilityPoint(p);const room=index===0?edge.fromRoomId:edge.toRoomId;
      structure.addChild(new Graphics().ellipse(screen.x,screen.y,edge.landingRadiusMilli/1000*64,edge.landingRadiusMilli/1000*32).stroke({color:gold,width:1,alpha:.65}));
      label(structure,`${edge.kind==="jump"?"断桥踏板":"高廊梯脚"} · ${snapshot.rooms.find(r=>r.id===room)?.name??room}`,screen);
    }
    selectable(structure,edge.segments.flatMap(s=>[mobilityPoint(s.from),mobilityPoint(s.to)]),edge.edgeId,onSelect);
  }
}
