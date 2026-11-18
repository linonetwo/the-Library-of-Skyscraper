import { animationFrame } from "./animationCatalog";
export type Point = { x: number; y: number };
export type Direction = "S" | "SW" | "W" | "NW" | "N" | "NE" | "E" | "SE";
const compass: Direction[] = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
export function facing(from: Point, to: Point): Direction {
  const sector = Math.round(Math.atan2(to.y - from.y, to.x - from.x) / (Math.PI / 4));
  return compass[(sector + 8) % 8];
}

/** Presentation motion follows authoritative destinations; it never changes simulation. */
export class ActorMotion {
  private from: Point;
  private to: Point;
  private started = 0;
  private actionStarted = 0;
  private path:Point[]=[];
  direction: Direction = "S";
  constructor(position: Point, readonly duration = 450) {
    this.from = this.to = position;
  }
  sample(now: number) {
    const progress = Math.min(1, Math.max(0, (now - this.started) / this.duration));
    const moving = progress < 1 && (this.from.x !== this.to.x || this.from.y !== this.to.y);
    const path=[this.from,...this.path,this.to];
    const lengths=path.slice(1).map((p,i)=>Math.hypot(p.x-path[i].x,p.y-path[i].y));
    let remaining=lengths.reduce((a,b)=>a+b,0)*progress;
    let index=0;while(index<lengths.length-1 && remaining>lengths[index])remaining-=lengths[index++];
    const a=path[index],b=path[index+1],t=lengths[index]?remaining/lengths[index]:1;
    if(this.path.length){
      if(moving && lengths[index])this.direction=facing(a,b);
      else if(!moving){let final=lengths.length-1;while(final>=0&&lengths[final]===0)final--;if(final>=0)this.direction=facing(path[final],path[final+1]);}
    }
    return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,moving,direction:this.direction,
      frame:animationFrame(moving?'walk':'idle',moving?now-this.actionStarted:now)};
  }

  move(to: Point, now: number, snap = false, path:Point[] = []) {
    if (snap) {
      this.from = this.to = to;
      this.path=[];
      return;
    }
    if (to.x === this.to.x && to.y === this.to.y) return;
    const previous = this.sample(now);
    if (!previous.moving) this.actionStarted = now;
    this.from = previous;
    this.direction = facing(this.to, to);
    this.to = to;
    this.path=path;
    this.started = now;
  }
}
